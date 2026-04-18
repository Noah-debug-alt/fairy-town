import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

router.get('/:novelId/data', async (req: Request, res: Response) => {
    try {
        const { novelId } = req.params;

        const novel = await prisma.novel.findUnique({
            where: { id: Number(novelId) },
            include: {
                characters: true,
                scenes: true,
            },
        });

        if (!novel) {
            const defaultScenes = [
                { id: 1, name: '小镇广场', type: 'public', description: '小镇的中心广场' },
                { id: 2, name: '幸福咖啡馆', type: 'shop', description: '温馨的咖啡馆' },
                { id: 3, name: '星光公园', type: 'park', description: '绿树成荫的公园' },
                { id: 4, name: '童话小学', type: 'school', description: '孩子们学习的地方' },
                { id: 5, name: '爱心医院', type: 'hospital', description: '小镇的医院' },
                { id: 6, name: '魔法商店', type: 'shop', description: '售卖魔法物品的商店' },
                { id: 7, name: '温暖书店', type: 'shop', description: '安静的书店' },
                { id: 8, name: '居民小屋', type: 'home', description: '小镇居民的住所' },
            ];

            return res.json({
                code: 200,
                data: {
                    novel: { id: Number(novelId), title: '童话镇', author: '未知作者' },
                    characters: [
                        { id: 1, name: '小红帽', avatarUrl: null, description: '勇敢善良的小女孩', plotSetting: '去看望奶奶的路上', isOnline: true, currentScene: '星光公园' },
                        { id: 2, name: '大灰狼', avatarUrl: null, description: '虽然凶猛但有时也很善良', plotSetting: '森林里的居民', isOnline: true, currentScene: '居民小屋' },
                        { id: 3, name: '白雪公主', avatarUrl: null, description: '美丽善良的公主', plotSetting: '逃难到小镇', isOnline: true, currentScene: '居民小屋' },
                        { id: 4, name: '七个小矮人', avatarUrl: null, description: '友善勤劳的小矮人', plotSetting: '矿工', isOnline: true, currentScene: '小镇广场' },
                        { id: 5, name: '灰姑娘', avatarUrl: null, description: '勤劳善良的姑娘', plotSetting: '被继母虐待', isOnline: false, currentScene: '居民小屋' },
                        { id: 6, name: '王子', avatarUrl: null, description: '英俊潇洒的王子', plotSetting: '寻找真爱', isOnline: true, currentScene: '幸福咖啡馆' },
                    ],
                    scenes: defaultScenes,
                    events: [
                        { id: 1, characterId: 1, characterName: '小红帽', type: 'location', content: '到达了星光公园', timestamp: new Date(Date.now() - 300000), isRead: true },
                        { id: 2, characterId: 2, characterName: '大灰狼', type: 'message', content: '今天天气真不错', timestamp: new Date(Date.now() - 240000), isRead: true },
                        { id: 3, characterId: 3, characterName: '白雪公主', type: 'action', content: '在居民小屋里休息', timestamp: new Date(Date.now() - 180000), isRead: true },
                        { id: 4, characterId: 6, characterName: '王子', type: 'message', content: '幸福咖啡馆的咖啡真香', timestamp: new Date(Date.now() - 120000), isRead: true },
                    ],
                },
            });
        }

        const events = await prisma.townEvent.findMany({
            where: { novelId: Number(novelId) },
            orderBy: { timestamp: 'desc' },
            take: 50,
        });

        const charactersWithScene = novel.characters.map((c) => ({
            ...c,
            isOnline: Math.random() > 0.3,
            currentScene: c.currentScene || '小镇广场',
        }));

        const defaultScenes = [
            { id: 1, name: '小镇广场', type: 'public', description: '小镇的中心广场' },
            { id: 2, name: '幸福咖啡馆', type: 'shop', description: '温馨的咖啡馆' },
            { id: 3, name: '星光公园', type: 'park', description: '绿树成荫的公园' },
            { id: 4, name: '童话小学', type: 'school', description: '孩子们学习的地方' },
            { id: 5, name: '爱心医院', type: 'hospital', description: '小镇的医院' },
            { id: 6, name: '魔法商店', type: 'shop', description: '售卖魔法物品的商店' },
            { id: 7, name: '温暖书店', type: 'shop', description: '安静的书店' },
            { id: 8, name: '居民小屋', type: 'home', description: '小镇居民的住所' },
        ];

        const scenes = novel.scenes.length > 0
            ? novel.scenes.map(s => ({
                ...s,
                characters: charactersWithScene.filter(c => c.currentScene === s.name),
            }))
            : defaultScenes.map(s => ({
                ...s,
                characters: charactersWithScene.filter(c => c.currentScene === s.name),
            }));

        res.json({
            code: 200,
            data: {
                novel: {
                    id: novel.id,
                    title: novel.title,
                    author: novel.author,
                },
                characters: charactersWithScene,
                scenes,
                events: events.length > 0 ? events : [
                    { id: 1, characterId: 1, characterName: '小红帽', type: 'location', content: '到达了星光公园', timestamp: new Date(Date.now() - 300000), isRead: true },
                    { id: 2, characterId: 2, characterName: '大灰狼', type: 'message', content: '今天天气真不错', timestamp: new Date(Date.now() - 240000), isRead: true },
                    { id: 3, characterId: 3, characterName: '白雪公主', type: 'action', content: '在居民小屋里休息', timestamp: new Date(Date.now() - 180000), isRead: true },
                    { id: 4, characterId: 6, characterName: '王子', type: 'message', content: '幸福咖啡馆的咖啡真香', timestamp: new Date(Date.now() - 120000), isRead: true },
                ],
            },
        });
    } catch (error) {
        console.error('获取小镇数据失败:', error);
        res.json({
            code: 500,
            message: '获取小镇数据失败',
        });
    }
});

router.get('/:novelId/events', async (req: Request, res: Response) => {
    try {
        const { novelId } = req.params;
        const { since } = req.query;

        const where: Record<string, unknown> = { novelId: Number(novelId) };
        if (since) {
            where.timestamp = { gte: new Date(Number(since)) };
        }

        const events = await prisma.townEvent.findMany({
            where,
            orderBy: { timestamp: 'desc' },
            take: 50,
        });

        res.json({
            code: 200,
            data: events,
        });
    } catch (error) {
        console.error('获取事件失败:', error);
        res.json({
            code: 500,
            message: '获取事件失败',
        });
    }
});

router.post('/:novelId/events', async (req: Request, res: Response) => {
    try {
        const { novelId } = req.params;
        const { characterId, characterName, type, content } = req.body;

        const event = await prisma.townEvent.create({
            data: {
                novelId: Number(novelId),
                characterId: characterId || 0,
                type: type || 'message',
                content: content || '',
                timestamp: new Date(),
                isRead: false,
            },
        });

        res.json({
            code: 200,
            data: event,
        });
    } catch (error) {
        console.error('创建事件失败:', error);
        res.json({
            code: 500,
            message: '创建事件失败',
        });
    }
});

router.get('/:novelId/status', async (req: Request, res: Response) => {
    try {
        const { novelId } = req.params;

        let status = await prisma.townStatus.findUnique({
            where: { novelId: Number(novelId) },
        });

        if (!status) {
            status = await prisma.townStatus.create({
                data: {
                    novelId: Number(novelId),
                    isRunning: false,
                    speed: 1,
                    currentTime: new Date(),
                },
            });
        }

        res.json({
            code: 200,
            data: status,
        });
    } catch (error) {
        console.error('获取状态失败:', error);
        res.json({
            code: 500,
            message: '获取状态失败',
        });
    }
});

router.put('/:novelId/status', async (req: Request, res: Response) => {
    try {
        const { novelId } = req.params;
        const { isRunning, speed, currentTime } = req.body;

        const status = await prisma.townStatus.upsert({
            where: { novelId: Number(novelId) },
            update: {
                isRunning: isRunning ?? undefined,
                speed: speed ?? undefined,
                currentTime: currentTime ? new Date(currentTime) : undefined,
                lastUpdateTime: new Date(),
            },
            create: {
                novelId: Number(novelId),
                isRunning: isRunning ?? false,
                speed: speed ?? 1,
                currentTime: currentTime ? new Date(currentTime) : new Date(),
            },
        });

        res.json({
            code: 200,
            data: status,
        });
    } catch (error) {
        console.error('更新状态失败:', error);
        res.json({
            code: 500,
            message: '更新状态失败',
        });
    }
});

router.post('/:novelId/command', async (req: Request, res: Response) => {
    try {
        const { novelId } = req.params;
        const { command } = req.body;

        await prisma.townEvent.create({
            data: {
                novelId: Number(novelId),
                characterId: 0,
                characterName: '系统',
                type: 'message',
                content: `执行指令: ${command}`,
                timestamp: new Date(),
                isRead: true,
            },
        });

        res.json({
            code: 200,
            message: '指令已接收',
        });
    } catch (error) {
        console.error('执行指令失败:', error);
        res.json({
            code: 500,
            message: '执行指令失败',
        });
    }
});

export default router;
