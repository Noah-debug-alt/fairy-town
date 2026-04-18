import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
        const url = new URL(request.url);

        const page = parseInt(url.searchParams.get('page') || '1');
        const pageSize = parseInt(url.searchParams.get('pageSize') || '20');
        const type = url.searchParams.get('type') || undefined;

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

        const where: Record<string, unknown> = { characterId };
        if (type) {
            where.type = type;
        }

        const [memories, total] = await Promise.all([
            prisma.memory.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize
            }),
            prisma.memory.count({ where })
        ]);

        const formattedMemories = memories.map(m => ({
            id: m.id,
            content: m.content,
            type: m.type,
            importance: m.importance,
            tags: JSON.parse(m.tags || '[]'),
            timestamp: m.timestamp,
            createdAt: m.createdAt
        }));

        return new Response(JSON.stringify({
            code: 200,
            message: '查询成功',
            data: {
                list: formattedMemories,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                }
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('查询记忆列表失败:', error);
        return new Response(JSON.stringify({
            code: 500,
            message: '查询失败，请稍后重试'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await prisma.$disconnect();
    }
}
