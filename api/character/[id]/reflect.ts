import { PrismaClient } from '@prisma/client';
import { agent } from '../../../utils/agent';

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

        const reflections = await agent.generateCharacterReflection(characterId, character.novelId);

        return new Response(JSON.stringify({
            code: 200,
            message: '反思生成成功',
            data: {
                count: reflections.length,
                reflections
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('生成反思失败:', error);
        return new Response(JSON.stringify({
            code: 500,
            message: error instanceof Error ? error.message : '生成反思失败，请稍后重试'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await prisma.$disconnect();
    }
}
