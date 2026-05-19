import fs from 'fs';
import path from 'path';

const IMAGE_GEN_PROVIDER = process.env.IMAGE_GEN_PROVIDER || 'auto';
const SD_WEBUI_URL = process.env.SD_WEBUI_URL || 'http://localhost:7860';
const DIFFUSERS_SERVER_URL = process.env.DIFFUSERS_SERVER_URL || 'http://127.0.0.1:7861';
const OLLAMADIFFUSER_URL = process.env.OLLAMADIFFUSER_URL || 'http://localhost:8000';
const OLLAMADIFFUSER_MODEL = process.env.OLLAMADIFFUSER_MODEL || 'flux.1-schnell';
const SILICONFLOW_API_KEY = process.env.SILICONFLOW_API_KEY || '';
const SILICONFLOW_MODEL = process.env.SILICONFLOW_MODEL || 'black-forest-labs/FLUX.1-schnell';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const DALLE_MODEL = process.env.DALLE_MODEL || 'dall-e-3';

// 修复：统一步数为15步，加快生成速度
const DEFAULT_STEPS = 15;

// 修复：GPU生图超时时间设为5分钟（300秒）
const DIFFUSERS_TIMEOUT_MS = 300000;

// 修复：重试次数
const MAX_RETRIES = 2;

export interface ImageGenResult {
    success: boolean;
    imageUrl?: string;
    imageBase64?: string;
    prompt?: string;
    provider?: string;
    error?: string;
}

// 修复：精简样式描述，避免CLIP截断（CLIP最多77 token）
const SCENE_STYLE = 'isometric view, fairy tale town, Studio Ghibli, warm pastel, cozy, detailed, soft lighting, masterpiece, best quality';

const CHARACTER_STYLE = 'anime illustration, fairy tale character, warm pastel, Studio Ghibli, detailed face, expressive eyes, upper body portrait, masterpiece, best quality';

const CHARACTER_PROMPT_PREFIX = 'portrait of a single character, upper body, facing viewer, ';

const CHARACTER_NEGATIVE_PROMPT = 'landscape, scenery, building, no people, multiple people, crowd, full body, low quality, blurry, text, watermark, ugly, deformed, bad anatomy';

const SCENE_NEGATIVE_PROMPT = 'person, human, face, portrait, people, crowd, low quality, blurry, text, watermark, ugly, deformed, bad anatomy';

const BASE_NEGATIVE_PROMPT = 'low quality, blurry, text, watermark, ugly, deformed, bad anatomy';

// 修复：添加Diffusers服务健康检查函数
export async function checkDiffusersHealth(): Promise<boolean> {
    try {
        const response = await fetch(`${DIFFUSERS_SERVER_URL}/health`, {
            signal: AbortSignal.timeout(5000),
        });
        if (response.ok) {
            const data = await response.json();
            return data.model_loaded === true;
        }
        return false;
    } catch {
        return false;
    }
}

// 修复：添加等待Diffusers服务就绪的函数
async function waitForDiffusersReady(maxWaitMs: number = 120000): Promise<boolean> {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
        if (await checkDiffusersHealth()) {
            return true;
        }
        console.log('Waiting for Diffusers server to be ready...');
        await new Promise(resolve => setTimeout(resolve, 5000));
    }
    return false;
}

export function buildScenePrompt(sceneName: string, sceneDescription: string, sceneType: string): string {
    const typeDescriptions: Record<string, string> = {
        public: 'a town square with fountain and benches',
        shop: 'a cozy shop with display windows and awning',
        park: 'a green park with trees and flowers',
        school: 'a school building with playground',
        hospital: 'a hospital with red cross sign',
        home: 'a cute cottage with garden fence',
        restaurant: 'a restaurant with outdoor seating',
        library: 'a library with arched windows and books',
        forest: 'a mystical forest with glowing mushrooms',
        castle: 'a fairy tale castle with towers and flags',
        market: 'a market stall with colorful goods',
        bridge: 'a stone bridge over a stream',
        lake: 'a serene lake with lily pads',
        church: 'a chapel with stained glass windows',
        tavern: 'a rustic tavern with warm light',
    };

    const typeDesc = typeDescriptions[sceneType] || 'a charming building in a fairy tale village';

    let prompt = typeDesc;

    if (sceneName) {
        // 修复：缩短名字部分，避免CLIP截断
        const shortName = sceneName.length > 20 ? sceneName.substring(0, 20) : sceneName;
        prompt += `, sign reads "${shortName}"`;
    }

    if (sceneDescription && sceneDescription.length > 5) {
        // 修复：限制描述长度为40字符，避免Prompt过长超过CLIP 77 token限制
        const descShort = sceneDescription.length > 40
            ? sceneDescription.substring(0, 40)
            : sceneDescription;
        prompt += `, ${descShort}`;
    }

    prompt += `, ${SCENE_STYLE}`;
    return prompt;
}

export function buildCharacterPrompt(characterName: string, characterDescription: string, characterAppearance?: string): string {
    let appearancePart = '';

    if (characterAppearance && characterAppearance.length > 5) {
        // 修复：限制外貌描述长度为100字符
        appearancePart = characterAppearance.substring(0, 100);
    } else if (characterDescription && characterDescription.length > 5) {
        appearancePart = extractAppearanceKeywords(characterDescription);
    } else {
        appearancePart = 'mysterious fairy tale character';
    }

    let prompt = CHARACTER_PROMPT_PREFIX;
    prompt += appearancePart;
    // 修复：缩短名字部分
    const shortName = characterName.length > 15 ? characterName.substring(0, 15) : characterName;
    prompt += `, named "${shortName}"`;
    prompt += `, ${CHARACTER_STYLE}`;

    return prompt;
}

function extractAppearanceKeywords(description: string): string {
    const appearanceKeywords = [
        'young', 'old', 'elderly', 'young man', 'old woman', '年幼', '年老', '老人', '少女', '少年', '中年',
        'hair', 'blonde', 'black hair', 'silver hair', 'long hair', 'short hair', 'white hair', 'brown hair',
        '头发', '长发', '短发', '白发', '黑发', '金发',
        'eyes', 'blue eyes', 'brown eyes', 'green eyes', 'bright eyes', '眼睛', '眼神', '眼眸',
        'wearing', 'dress', 'coat', 'hat', 'glasses', 'robe', 'cloak', 'armor', 'crown',
        '穿着', '戴着', '帽子', '眼镜', '长袍', '披风', '盔甲', '王冠',
        'tall', 'short', 'thin', 'slim', 'fat', 'muscular', 'petite',
        '高', '矮', '瘦', '胖', '苗条', '健壮', '娇小',
        'smile', 'angry', 'sad', 'happy', 'gentle', 'fierce', 'kind', 'stern',
        '微笑', '愤怒', '悲伤', '开心', '温柔', '凶狠', '慈祥', '严肃',
        'pale', 'tan', 'dark skin', 'fair skin', '苍白', '黝黑', '白皙'
    ];

    const sentences = description.split(/[，。,.\n]/);
    const appearanceSentences: string[] = [];

    for (const sentence of sentences) {
        const lowerSentence = sentence.toLowerCase();
        for (const keyword of appearanceKeywords) {
            if (lowerSentence.includes(keyword.toLowerCase())) {
                appearanceSentences.push(sentence.trim());
                break;
            }
        }
    }

    if (appearanceSentences.length > 0) {
        // 修复：限制提取结果长度为100字符
        return appearanceSentences.join(', ').substring(0, 100);
    }

    return description.substring(0, 100);
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

// 修复：添加通用重试函数
async function fetchWithRetry(url: string, options: RequestInit, retries: number = MAX_RETRIES, timeoutMs: number = DIFFUSERS_TIMEOUT_MS): Promise<Response> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            return response;
        } catch (error: any) {
            lastError = error;
            if (attempt < retries) {
                const waitMs = (attempt + 1) * 3000;
                console.log(`Request failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${waitMs / 1000}s... Error: ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, waitMs));
            }
        }
    }

    throw lastError || new Error('Request failed after retries');
}

async function generateWithSiliconFlow(prompt: string, negativePrompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    if (!SILICONFLOW_API_KEY) {
        return { success: false, error: 'SiliconFlow API key not configured', prompt };
    }

    try {
        const response = await fetchWithRetry('https://api.siliconflow.cn/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SILICONFLOW_API_KEY}`,
            },
            body: JSON.stringify({
                model: SILICONFLOW_MODEL,
                prompt,
                negative_prompt: negativePrompt,
                image_size: `${width}x${height}`,
                num_inference_steps: DEFAULT_STEPS,
                guidance_scale: 7.5,
            }),
        }, 1, 60000);

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

async function generateWithOllamaDiffuser(prompt: string, negativePrompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    try {
        const response = await fetchWithRetry(`${OLLAMADIFFUSER_URL}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                negative_prompt: negativePrompt,
                width,
                height,
                model: OLLAMADIFFUSER_MODEL,
                steps: DEFAULT_STEPS,
            }),
        }, 1, 120000);

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

async function generateWithSDWebUI(prompt: string, negativePrompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    try {
        const response = await fetchWithRetry(`${SD_WEBUI_URL}/sdapi/v1/txt2img`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                negative_prompt: negativePrompt,
                width,
                height,
                steps: DEFAULT_STEPS,
                cfg_scale: 7,
                sampler_name: 'DPM++ 2M Karras',
            }),
        }, 1, 120000);

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
        const response = await fetchWithRetry(`${OPENAI_BASE_URL}/images/generations`, {
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
        }, 1, 60000);

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

async function generateWithDiffusers(prompt: string, negativePrompt: string, width: number = 512, height: number = 512): Promise<ImageGenResult> {
    try {
        // 修复：生图前先检查服务是否可用
        const isHealthy = await checkDiffusersHealth();
        if (!isHealthy) {
            console.log('Diffusers server not ready, waiting...');
            const ready = await waitForDiffusersReady(60000);
            if (!ready) {
                throw new Error('Diffusers server is not available after waiting');
            }
        }

        const response = await fetchWithRetry(`${DIFFUSERS_SERVER_URL}/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt,
                negative_prompt: negativePrompt,
                width,
                height,
                steps: DEFAULT_STEPS,
                guidance_scale: 7.5,
            }),
        }, MAX_RETRIES, DIFFUSERS_TIMEOUT_MS);

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
    negativePrompt: string,
    width: number,
    height: number,
    name: string,
    sceneType: string,
    isCharacter: boolean
): Promise<ImageGenResult> {
    const provider = IMAGE_GEN_PROVIDER;

    if (provider === 'auto') {
        // 修复：auto模式下优先尝试Diffusers（本地GPU）
        try {
            const checkResp = await fetch(`${DIFFUSERS_SERVER_URL}/health`, {
                signal: AbortSignal.timeout(3000),
            });
            if (checkResp.ok) {
                const healthData = await checkResp.json();
                if (healthData.model_loaded) {
                    const result = await generateWithDiffusers(prompt, negativePrompt, width, height);
                    if (result.success) return result;
                }
            }
        } catch {
            console.log('Diffusers not available, trying other providers...');
        }

        try {
            const checkResp = await fetch(`${OLLAMADIFFUSER_URL}/api/status`, {
                signal: AbortSignal.timeout(3000),
            });
            if (checkResp.ok) {
                const result = await generateWithOllamaDiffuser(prompt, negativePrompt, width, height);
                if (result.success) return result;
            }
        } catch {
            console.log('OllamaDiffuser not available, trying other providers...');
        }

        if (SILICONFLOW_API_KEY) {
            const result = await generateWithSiliconFlow(prompt, negativePrompt, width, height);
            if (result.success) return result;
            console.log('SiliconFlow failed, trying SD WebUI...');
        }

        try {
            const checkResp = await fetch(`${SD_WEBUI_URL}/sdapi/v1/sd-models`, {
                signal: AbortSignal.timeout(3000),
            });
            if (checkResp.ok) {
                const result = await generateWithSDWebUI(prompt, negativePrompt, width, height);
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
            const result = await generateWithDiffusers(prompt, negativePrompt, width, height);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'ollamadiffuser': {
            const result = await generateWithOllamaDiffuser(prompt, negativePrompt, width, height);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'siliconflow': {
            const result = await generateWithSiliconFlow(prompt, negativePrompt, width, height);
            if (result.success) return result;
            return generateCanvasPlaceholder(name, sceneType, isCharacter);
        }
        case 'sdwebui': {
            const result = await generateWithSDWebUI(prompt, negativePrompt, width, height);
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
    return tryGenerateWithFallback(prompt, SCENE_NEGATIVE_PROMPT, 512, 512, sceneName, sceneType, false);
}

export async function generateCharacterImage(
    characterName: string,
    characterDescription: string,
    characterAppearance?: string
): Promise<ImageGenResult> {
    const prompt = buildCharacterPrompt(characterName, characterDescription, characterAppearance);
    return tryGenerateWithFallback(prompt, CHARACTER_NEGATIVE_PROMPT, 384, 512, characterName, '', true);
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

    // 修复：生成图片前先等待Diffusers服务就绪
    if (IMAGE_GEN_PROVIDER === 'diffusers' || IMAGE_GEN_PROVIDER === 'auto') {
        console.log('Checking Diffusers server availability before generating images...');
        const ready = await waitForDiffusersReady(120000);
        if (!ready) {
            console.log('Diffusers server not available, will use fallback providers');
        } else {
            console.log('Diffusers server is ready');
        }
    }

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
