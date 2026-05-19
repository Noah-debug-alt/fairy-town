import os
import sys
import base64
import argparse
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import torch
from diffusers import StableDiffusionXLPipeline
from diffusers import DPMSolverMultistepScheduler

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: str = "low quality, blurry, text, watermark, ugly, deformed, noisy, oversaturated, cropped, worst quality, low resolution, bad anatomy"
    width: int = 512
    height: int = 512
    steps: int = 15  # 修复：默认步数从20改为15，加快生成速度
    guidance_scale: float = 7.5
    seed: Optional[int] = None

pipe = None
model_loaded = False
model_path = None

def load_model(path: str):
    global pipe, model_loaded, model_path
    if model_loaded and model_path == path:
        return True

    print(f"Loading model from: {path}")
    
    use_cpu = not torch.cuda.is_available()
    
    try:
        if not use_cpu:
            print(f"Using GPU: {torch.cuda.get_device_name(0)}")
            print(f"CUDA Version: {torch.version.cuda}")
            print(f"VRAM: {torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB")
            
            pipe = StableDiffusionXLPipeline.from_pretrained(
                path,
                torch_dtype=torch.float16,
                use_safetensors=True,
                local_files_only=True,
            )
            pipe = pipe.to("cuda")
        else:
            print("Using CPU (CUDA not available)")
            pipe = StableDiffusionXLPipeline.from_pretrained(
                path,
                torch_dtype=torch.float32,
                use_safetensors=True,
                local_files_only=True,
            )
            pipe = pipe.to("cpu")

        pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)

        if not use_cpu and torch.cuda.is_available():
            pipe.enable_attention_slicing()
            pipe.vae.enable_slicing()
            torch.cuda.empty_cache()

        model_loaded = True
        model_path = path
        print("Model loaded successfully!")
        return True
    except Exception as e:
        print(f"Failed to load model: {e}")
        import traceback
        traceback.print_exc()
        return False

@app.get("/")
async def root():
    return {"status": "ok", "model_loaded": model_loaded, "model_path": model_path}

@app.get("/health")
async def health():
    return {
        "status": "healthy" if model_loaded else "model_not_loaded",
        "model_loaded": model_loaded,
        "model_path": model_path,
        "device": "cuda" if torch.cuda.is_available() else "cpu",
        "torch_version": torch.__version__,
    }

@app.post("/generate")
async def generate(req: GenerateRequest):
    if not model_loaded:
        raise HTTPException(status_code=400, detail="Model not loaded. Call /load first.")

    try:
        generator = None
        if req.seed is not None:
            generator = torch.Generator(device="cuda" if torch.cuda.is_available() else "cpu").manual_seed(req.seed)

        negative = req.negative_prompt if req.negative_prompt else ""

        result = pipe(
            prompt=req.prompt,
            negative_prompt=negative,
            width=req.width,
            height=req.height,
            num_inference_steps=req.steps,
            guidance_scale=req.guidance_scale,
            generator=generator,
        )

        image = result.images[0]

        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as f:
            image.save(f, "PNG")
            image_path = f.name

        with open(image_path, "rb") as f:
            image_base64 = base64.b64encode(f.read()).decode()

        os.unlink(image_path)

        return {
            "success": True,
            "image_base64": image_base64,
            "prompt": req.prompt,
            "provider": "diffusers",
        }
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        raise HTTPException(status_code=500, detail=error_detail)

@app.post("/load")
async def load(request: dict):
    model_dir = request.get("model_path")
    if not model_dir:
        raise HTTPException(status_code=400, detail="model_path required")

    if not os.path.exists(model_dir):
        raise HTTPException(status_code=404, detail=f"Model path not found: {model_dir}")

    success = load_model(model_dir)
    if success:
        return {"success": True, "message": "Model loaded"}
    else:
        raise HTTPException(status_code=500, detail="Failed to load model")

if __name__ == "__main__":
    import uvicorn
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--port", type=int, default=7861, help="Port to bind")
    parser.add_argument("--model-path", default=None, help="Path to diffusers model")
    args = parser.parse_args()

    if args.model_path and os.path.exists(args.model_path):
        load_model(args.model_path)

    uvicorn.run(app, host=args.host, port=args.port)
