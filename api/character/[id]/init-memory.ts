import { PrismaClient } from '@prisma/client';
import { memory } from '../../../utils/memory';

const prisma = new PrismaClient();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        if (!id || isNaN(parseInt(id))) {
            return new Response(JSON.stringify({
                code: 400,
                message: '无效的角色ID'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const characterId = parseInt(id);

        const character = await prisma.character.findUnique({
            where: { id: characterId }
        });

        if (!character) {
            return new Response(JSON.stringify({
                code: 404,
                message: '角色不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const existingMemories = await prisma.memory.findMany({
            where: { characterId },
            take: 1
        });

        if (existingMemories.length > 0) {
            return new Response(JSON.stringify({
                code: 400,
                message: '该角色已有初始记忆，如需重新生成请先删除现有记忆'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await memory.initCharacterMemory({ characterId });

        return new Response(JSON.stringify({
            code: 200,
            message: '初始记忆生成成功',
            data: {
                count: result.length,
                memories: result.map(m => ({
                    id: m.id,
                    content: m.content,
                    type: m.type,
                    importance: m.importance,
                    timestamp: m.timestamp
                }))
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('生成初始记忆失败:', error);
        return new Response(JSON.stringify({
            code: 500,
            message: '生成初始记忆失败，请稍后重试'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await prisma.$disconnect();
    }
}
