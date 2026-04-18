import { PrismaClient } from '@prisma/client';
import { memory } from '../../utils/memory';

const prisma = new PrismaClient();

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { characterId, novelId, content, type, importance, tags } = body;

        if (!characterId || !novelId || !content || !type) {
            return new Response(JSON.stringify({
                code: 400,
                message: '缺少必要的参数：characterId、novelId、content、type'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const [character, novel] = await Promise.all([
            prisma.character.findUnique({ where: { id: characterId } }),
            prisma.novel.findUnique({ where: { id: novelId } })
        ]);

        if (!character) {
            return new Response(JSON.stringify({
                code: 404,
                message: '角色不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!novel) {
            return new Response(JSON.stringify({
                code: 404,
                message: '小说不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (character.novelId !== novelId) {
            return new Response(JSON.stringify({
                code: 400,
                message: '角色与小说不匹配'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const validTypes = ['OBSERVATION', 'DIALOGUE', 'REFLECTION', 'PLOT'];
        if (!validTypes.includes(type)) {
            return new Response(JSON.stringify({
                code: 400,
                message: `无效的记忆类型，允许的类型：${validTypes.join(', ')}`
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await memory.writeMemory({
            characterId,
            novelId,
            content,
            type,
            importance: importance ?? 5,
            tags: tags ?? []
        });

        const mem = result as {
            id: number;
            characterId: number;
            novelId: number;
            content: string;
            type: string;
            importance: number;
            timestamp: Date;
            createdAt: Date;
        };

        return new Response(JSON.stringify({
            code: 200,
            message: '记忆写入成功',
            data: {
                id: mem.id,
                characterId: mem.characterId,
                novelId: mem.novelId,
                content: mem.content,
                type: mem.type,
                importance: mem.importance,
                timestamp: mem.timestamp,
                createdAt: mem.createdAt
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('写入记忆失败:', error);
        return new Response(JSON.stringify({
            code: 500,
            message: '写入记忆失败，请稍后重试'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await prisma.$disconnect();
    }
}
