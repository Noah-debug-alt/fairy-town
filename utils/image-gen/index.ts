import fs from 'fs';
import path from 'path';

const IMAGE_GEN_PROVIDER = process.env.IMAGE_GEN_PROVIDER || 'auto';
const SD_WEBUI_URL = process.env.SD_WEBUI_URL || 'http://localhost:7860';
const DIFFUSERS_SERVER_URL = process.env.DIFFUSERS_SERVER_URL || 'http://localhost:7861';
const OLLAMADIFFUSER_URL = process.env.OLLAMADIFFUSER_URL || 'http://localhost:8000';
const OLLAMADIFFUSER_MODEL = process.env.OLLAMADIFFUSER_MODEL || 'flux.1-schnell';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'black-forest-labs/FLUX.1-schnell';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DALLE_MODEL = process.env.DALLE_MODEL || 'dall-e-3';

export interface ImageGenResult {
    success: boolean;
    imageUrl?: string;
    imageBase64?: string;
    prompt?: string;
    provider?: string;
    error?: string;
}

const SCENE_STYLE = 'isometric view, fairy tale town, Studio Ghibli inspired, warm pastel colors, cozy atmosphere, detailed architecture, soft lighting, no text, no watermark, clean background, high quality, masterpiece';

const CHARACTER_STYLE = 'anime style illustration, fairy tale character, warm pastel colors, Studio Ghibli inspired, detailed face, expressive eyes, clean simple background, upper body portrait, no text, no watermark, high quality, masterpiece';

export function buildScenePrompt(sceneName: string, sceneDescription: string, sceneType: string): string {
    const typeDescriptions: Record<string, string> = {
        public: 'a grand town square with a central fountain, stone benches, flower beds, and a clock tower',
        shop: 'a cozy little shop with a colorful storefront, display windows showing goods, hanging sign, and awning',
        park: 'a lush green park with ancient trees, blooming flowers, a winding walking path, and a small pond',
        school: 'a charming school building with a bell tower, playground, chalkboard visible through windows',
        hospital: 'a warm and welcoming hospital with a red cross sign, flower garden, and bright windows',
        home: 'a cute cottage house with a thatched roof, chimney with smoke, garden fence, and flower boxes',
        restaurant: 'a warm restaurant with outdoor seating under awnings, warm light from windows, menu board',
        library: 'a quaint library with large arched windows, bookshelves visible inside, reading lamp, and a cat',
        forest: 'a mystical forest with towering ancient trees, glowing mushrooms, fireflies, and a hidden path',
        castle: 'a grand fairy tale castle with tall towers, colorful flags, stone walls, and a drawbridge',
        market: 'a bustling market stall with colorful goods, hanging lanterns, wooden crates, and awnings',
        bridge: 'a stone arched bridge over a gentle stream with willow trees, and stepping stones',
        lake: 'a serene lake with lily pads, a small wooden dock, rowing boat, and distant mountains',
        church: 'a small chapel with stained glass windows, a bell tower, stone cross, and candlelight',
        tavern: 'a rustic tavern with a wooden sign, warm light from windows, barrel tables, and a hearth',
    };

    const typeDesc = typeDescriptions[sceneType] || 'a charming building in a fairy tale village with unique architectural details';

    let prompt = typeDesc;

    if (sceneName) {
        prompt += `, the sign reads "${sceneName}"`;
    }

    if (sceneDescription && sceneDescription.length > 5) {
        const descShort = sceneDescription.length > 150
            ? sceneDescription.substring(0, 150)
            : sceneDescription;
        prompt += `, ${descShort}`;
    }

    prompt += `, ${SCENE_STYLE}`;
    return prompt;
}

export function buildCharacterPrompt(characterName: string, characterDescription: string): string {
    let prompt = '';

    if (characterDescription && characterDescription.length > 5) {
        const descShort = characterDescription.length > 200
            ? characterDescription.substring(0, 200)
            : characterDescription;
        prompt = descShort;
    } else {
        prompt = 'a mysterious fairy tale character with an enigmatic presence';
    }

    if (characterName) {
        prompt += `, named ${characterName}`;
    }

    prompt += `, ${CHARACTER_STYLE}`;
    return prompt;
}

async function saveBase64Image(base64Data: string, prefix: string): Promise<string> {
    const imagesDir = path.join(process.cwd(), 'public', 'generated');

    if (!fs.existsSync(imagesDir)) {
        fs.mkdirSync(imagesDir, { recursive: true });
    }

    const uniqueName = `${prefix}_${Date.now()}.png`;
    const filePath = path.join(imagesDir, uniqueName);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    return `/generated/${uniqueName}`;
}

async function generateWithSiliconFlow(prompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    if (!SILICONFLOW_API_KEY) {
        return { success: false, error: 'SiliconFlow API key not configured', prompt };
    }

    try {
        const response = await fetch('https://api.siliconflow.cn/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
            },
            body: JSON.stringify({
                model: SILICONFLOW_MODEL,
                prompt,
                negative_prompt: 'low quality, blurry, text, watermark, ugly, deformed, noisy, oversaturated, cropped, worst quality, low resolution, bad anatomy',
                image_size: `${width}x${height}`,
                num_inference_steps: 20,
                guidance_scale: 7.5,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`SiliconFlow returned ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const remoteUrl = data.images?.[0]?.url;

        if (!remoteUrl) {
            throw new Error('No image URL returned from SiliconFlow');
        }

        const imageResponse = await fetch(remoteUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download image: ${imageResponse.status}`);
        }
        const arrayBuffer = await imageResponse.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const imageUrl = await saveBase64Image(base64, `sf_${Date.now()}`);

        return { success: true, imageUrl, imageBase64: base64, prompt, provider: 'SiliconFlow' };
    } catch (error: any) {
        console.error('SiliconFlow generation failed:', error.message);
        return { success: false, error: error.message, prompt };
    }
}

async function generateWithOllamaDiffuser(prompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    try {
        const response = await fetch(`${OLLAMADIFFUSER_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                negative_prompt: 'low quality, blurry, text, watermark, ugly, deformed, noisy, oversaturated, cropped, worst quality, low resolution, bad anatomy',
                width,
                height,
                model: OLLAMADIFFUSER_MODEL,
                steps: 25,
            }),
        });

        if (!response.ok) {
            throw new Error(`OllamaDiffuser returned ${response.status}`);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('image/png') || contentType.includes('image/jpeg') || contentType.includes('image/webp')) {
            const arrayBuffer = await response.arrayBuffer();
            const base64 = Buffer.from(arrayBuffer).toString('base64');
            const imageUrl = await saveBase64Image(base64, `od_${Date.now()}.png`);
            return { success: true, imageUrl, imageBase64: base64, prompt, provider: 'OllamaDiffuser' };
        }

        const data = await response.json();
        const base64 = data.images?.[0] || data.image;

        if (!base64) {
            throw new Error('No image returned from OllamaDiffuser');
        }

        const imageUrl = await saveBase64Image(base64, `od_${Date.now()}.png`);
        return { success: true, imageUrl, imageBase64: base64, prompt, provider: 'OllamaDiffuser' };
    } catch (error: any) {
        console.error('OllamaDiffuser generation failed:', error.message);
        return { success: false, error: error.message, prompt };
    }
}

async function generateWithSDWebUI(prompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    try {
        const response = await fetch(`${SD_WEBUI_URL}/sdapi/v1/txt2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                negative_prompt: 'low quality, blurry, text, watermark, ugly, deformed, noisy, oversaturated, cropped, worst quality, low resolution, bad anatomy',
                width,
                height,
                steps: 25,
                cfg_scale: 7,
                sampler_name: 'DPM++ 2M Karras',
            }),
        });

        if (!response.ok) {
            throw new Error(`SD WebUI returned ${response.status}`);
        }

        const data = await response.json();
        const imageBase64 = data.images?.[0];

        if (!imageBase64) {
            throw new Error('No image returned from SD WebUI');
        }

        const imageUrl = await saveBase64Image(imageBase64, `sd_${Date.now()}`);

        return { success: true, imageUrl, imageBase64, prompt, provider: 'SD WebUI' };
    } catch (error: any) {
        console.error('SD WebUI generation failed:', error.message);
        return { success: false, error: error.message, prompt };
    }
}

async function generateWithDALL_E(prompt: string): Promise<ImageGenResult> {
    if (!OPENAI_API_KEY) {
        return { success: false, error: 'OpenAI API key not configured', prompt };
    }

    try {
        const response = await fetch(`${OPENAI_BASE_URL}/images/generations`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
                model: DALLE_MODEL,
                prompt,
                n: 1,
                size: '1024x1024',
                quality: 'standard',
                response_format: 'b64_json',
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`DALL-E returned ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const imageBase64 = data.data?.[0]?.b64_json;

        if (!imageBase64) {
            throw new Error('No image returned from DALL-E');
        }

        const imageUrl = await saveBase64Image(imageBase64, `dalle_${Date.now()}`);

        return { success: true, imageUrl, imageBase64, prompt, provider: 'DALL-E' };
    } catch (error: any) {
        console.error('DALL-E generation failed:', error.message);
        return { success: false, error: error.message, prompt };
    }
}

async function generateWithDiffusers(prompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    try {
        const response = await fetch(`${DIFFUSERS_SERVER_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                negative_prompt: 'low quality, blurry, text, watermark, ugly, deformed, noisy, oversaturated, cropped, worst quality, low resolution, bad anatomy',
                width,
                height,
                steps: 25,
                guidance_scale: 7.5,
            }),
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Diffusers server returned ${response.status}: ${errText}`);
        }

        const data = await response.json();
        const imageBase64 = data.image_base64;

        if (!imageBase64) {
            throw new Error('No image returned from Diffusers server');
        }

        const imageUrl = await saveBase64Image(imageBase64, `diff_${Date.now()}`);

        return { success: true, imageUrl, imageBase64, prompt, provider: 'Diffusers' };
    } catch (error: any) {
        console.error('Diffusers generation failed:', error.message);
        return { success: false, error: error.message, prompt };
    }
}

function generateCanvasPlaceholder(name: string, sceneType: string, isCharacter: boolean = false): ImageGenResult {
    const colors: Record<string, string> = {
        public: '#4A90D9', shop: '#52c41a', park: '#13c2c2', school: '#722ed1',
        hospital: '#eb2f96', home: '#faad14', restaurant: '#f5222d', library: '#2f54eb',
        forest: '#389e0d', castle: '#9254de', market: '#fa8c16', bridge: '#8c8c8c',
        lake: '#1890ff', church: '#cf1322', tavern: '#ad6800',
    };

    const color = isCharacter ? '#667eea' : (colors[sceneType] || '#667eea');
    const displayName = name || 'Unknown';

    return {
        success: true,
        imageUrl: `placeholder://${encodeURIComponent(displayName)}?color=${color.replace('#', '')}&type=${isCharacter ? 'character' : 'scene'}`,
        prompt: '',
        provider: 'Placeholder',
    };
}

async function tryGenerateWithFallback(
    prompt: string,
    width: number,
    height: number,
    name: string,
    sceneType: string,
    isCharacter: boolean
): Promise<ImageGenResult> {
    const provider = IMAGE_GEN_PROVIDER;

    if (provider === 'auto') {
        try {
            const checkResp = await fetch(`${OLLAMADIFFUSER_URL}/api/status`, {
                signal: AbortSignal.timeout(3000),
            });
            if (checkResp.ok) {
                const result = await generateWithOllamaDiffuser(prompt, width, height);
                if (result.success) return result;
            }
        } catch {
            console.log('OllamaDiffuser not available, trying other providers...');
        }

        if (SILICONFLOW_API_KEY) {
            const result = await generateWithSiliconFlow(prompt, width, height);
            if (result.success) return result;
            console.log('SiliconFlow failed, trying SD WebUI...');
        }

        try {
            const checkResp = await fetch(`${SD_WEBUI_URL}/sdapi/v1/sd-models`, {
                signal: AbortSignal.timeout(3000),
            });
            if (checkResp.ok) {
                const result = await generateWithSDWebUI(prompt, width, height);
                if (result.success) return result;
            }
        } catch {
            console.log('SD WebUI not available');
        }

        if (OPENAI_API_KEY) {
            const result = await generateWithDALL_E(prompt);
            if (result.success) return result;
        }

        return generateCanvasPlaceholder(name, sceneType, isCharacter);
    }

    switch (provider) {
        case 'diffusers': {
            const result = await generateWithDiffusers(prompt, width, height);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'ollamadiffuser': {
            const result = await generateWithOllamaDiffuser(prompt, width, height);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'siliconflow': {
            const result = await generateWithSiliconFlow(prompt, width, height);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'sdwebui': {
            const result = await generateWithSDWebUI(prompt, width, height);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'dalle': {
            const result = await generateWithDALL_E(prompt);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'placeholder':
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        default:
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
    }
}

export async function generateSceneImage(
    sceneName: string,
    sceneDescription: string,
    sceneType: string
): Promise<ImageGenResult> {
    const prompt = buildScenePrompt(sceneName, sceneDescription, sceneType);
    return tryGenerateWithFallback(prompt, 512, 512, sceneName, sceneType, false);
}

export async function generateCharacterImage(
    characterName: string,
    characterDescription: string
): Promise<ImageGenResult> {
    const prompt = buildCharacterPrompt(characterName, characterDescription);
    return tryGenerateWithFallback(prompt, 384, 512, characterName, '', true);
}

export async function generateAllImages(
    scenes: Array<{ name: string; description?: string; type: string }>,
    characters: Array<{ name: string; description: string }>
): Promise<{
    scenes: Array<{ name: string; result: ImageGenResult }>;
    characters: Array<{ name: string; result: ImageGenResult }>;
}> {
    const sceneResults: Array<{ name: string; result: ImageGenResult }> = [];
    const characterResults: Array<{ name: string; result: ImageGenResult }> = [];

    for (const scene of scenes) {
        console.log(`Generating scene image: ${scene.name} (${scene.type})`);
        const result = await generateSceneImage(scene.name, scene.description || '', scene.type);
        sceneResults.push({ name: scene.name, result });
        if (result.success && result.provider !== 'Placeholder') {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    for (const character of characters) {
        console.log(`Generating character image: ${character.name}`);
        const result = await generateCharacterImage(character.name, character.description);
        characterResults.push({ name: character.name, result });
        if (result.success && result.provider !== 'Placeholder') {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    return { scenes: sceneResults, characters: characterResults };
}

export function getImageGenStatus(): {
    provider: string;
    configured: boolean;
    models: string[];
    hasOllamaDiffuser: boolean;
    hasSiliconFlow: boolean;
    hasSDWebUI: boolean;
    hasDALLE: boolean;
    hasDiffusers: boolean;
} {
    const hasDiffusers = IMAGE_GEN_PROVIDER === 'diffusers' || IMAGE_GEN_PROVIDER === 'auto';
    const hasOllamaDiffuser = !!OLLAMADIFFUSER_URL;
    const hasSiliconFlow = !!SILICONFLOW_API_KEY;
    const hasSDWebUI = IMAGE_GEN_PROVIDER === 'sdwebui' || IMAGE_GEN_PROVIDER === 'auto';
    const hasDALLE = !!OPENAI_API_KEY;

    switch (IMAGE_GEN_PROVIDER) {
        case 'auto':
            return {
                provider: 'Auto (自动选择最佳可用后端)',
                configured: hasOllamaDiffuser || hasSiliconFlow || hasDALLE || hasDiffusers,
                models: [
                    ...(hasDiffusers ? [`Diffusers (本地): ${DIFFUSERS_SERVER_URL}`] : []),
                    ...(hasOllamaDiffuser ? [`OllamaDiffuser: ${OLLAMADIFFUSER_MODEL}@${OLLAMADIFFUSER_URL}`] : []),
                    ...(hasSiliconFlow ? [`SiliconFlow: ${SILICONFLOW_MODEL}`] : []),
                    ...(hasSDWebUI ? [`SD WebUI: ${SD_WEBUI_URL}`] : []),
                    ...(hasDALLE ? [`DALL-E: ${DALLE_MODEL}`] : []),
                    'Placeholder (fallback)',
                ],
                hasOllamaDiffuser,
                hasSiliconFlow,
                hasSDWebUI,
                hasDALLE,
                hasDiffusers,
            };
        case 'diffusers':
            return {
                provider: 'Diffusers (本地免费！使用 Animagine XL)',
                configured: true,
                models: [`Animagine XL @ ${DIFFUSERS_SERVER_URL}`],
                hasOllamaDiffuser: false,
                hasSiliconFlow: false,
                hasSDWebUI: false,
                hasDALLE: false,
                hasDiffusers: true,
            };
        case 'ollamadiffuser':
            return {
                provider: 'OllamaDiffuser (本地免费)',
                configured: true,
                models: [`${OLLAMADIFFUSER_MODEL} @ ${OLLAMADIFFUSER_URL}`],
                hasOllamaDiffuser: true,
                hasSiliconFlow: false,
                hasSDWebUI: false,
                hasDALLE: false,
                hasDiffusers: false,
            };
        case 'siliconflow':
            return {
                provider: 'SiliconFlow',
                configured: hasSiliconFlow,
                models: [SILICONFLOW_MODEL],
                hasOllamaDiffuser: false,
                hasSiliconFlow,
                hasSDWebUI: false,
                hasDALLE: false,
                hasDiffusers: false,
            };
        case 'sdwebui':
            return {
                provider: 'Stable Diffusion WebUI',
                configured: true,
                models: ['SD WebUI at ' + SD_WEBUI_URL],
                hasOllamaDiffuser: false,
                hasSiliconFlow: false,
                hasSDWebUI: true,
                hasDALLE: false,
                hasDiffusers: false,
            };
        case 'dalle':
            return {
                provider: 'DALL-E',
                configured: hasDALLE,
                models: [DALLE_MODEL],
                hasOllamaDiffuser: false,
                hasSiliconFlow: false,
                hasSDWebUI: false,
                hasDALLE,
                hasDiffusers: false,
            };
        default:
            return {
                provider: 'Placeholder (仅占位图)',
                configured: true,
                models: ['CSS/Canvas placeholder images'],
                hasOllamaDiffuser: false,
                hasSiliconFlow: false,
                hasSDWebUI: false,
                hasDALLE: false,
                hasDiffusers: false,
            };
    }
}
