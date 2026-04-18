import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        if (!id || isNaN(parseInt(id))) {
            return new Response(JSON.stringify({
                code: 400,
                message: '无效的小说ID'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const novelId = parseInt(id);

        const novel = await prisma.novel.findUnique({
            where: { id: novelId }
        });

        if (!novel) {
            return new Response(JSON.stringify({
                code: 404,
                message: '小说不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const plots = await prisma.plot.findMany({
            where: { novelId },
            orderBy: [
                { chapterIndex: 'asc' },
                { sceneIndex: 'asc' }
            ],
            select: {
                id: true,
                chapterIndex: true,
                sceneIndex: true,
                title: true,
                content: true,
                involvedCharacterIds: true,
                dialogueContent: true,
                narrationContent: true,
                location: true,
                isCompleted: true,
                completedAt: true
            }
        });

        const characters = await prisma.character.findMany({
            where: { novelId },
            select: { id: true, name: true }
        });

        const characterMap = new Map(characters.map(c => [c.id, c.name]));

        const formattedPlots = plots.map(plot => {
            let involvedCharacterIds: number[] = [];
            try {
                involvedCharacterIds = JSON.parse(plot.involvedCharacterIds);
            } catch { }

            let dialogueContent: string[] = [];
            try {
                dialogueContent = JSON.parse(plot.dialogueContent);
            } catch { }

            return {
                ...plot,
                involvedCharacterIds,
                involvedCharacterNames: involvedCharacterIds.map(id => characterMap.get(id) || '未知'),
                dialogueContent
            };
        });

        const currentPlot = plots.find(p => !p.isCompleted);
        const completedCount = plots.filter(p => p.isCompleted).length;

        return new Response(JSON.stringify({
            code: 200,
            message: '获取成功',
            data: {
                total: plots.length,
                completed: completedCount,
                currentPlotId: currentPlot?.id || null,
                plots: formattedPlots
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('获取情节列表失败:', error);
        return new Response(JSON.stringify({
            code: 500,
            message: '获取失败，请稍后重试'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await prisma.$disconnect();
    }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    try {
        if (!id || isNaN(parseInt(id))) {
            return new Response(JSON.stringify({
                code: 400,
                message: '无效的小说ID'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const novelId = parseInt(id);
        const body = await request.json();
        const { plotId, action } = body;

        if (!plotId || !action) {
            return new Response(JSON.stringify({
                code: 400,
                message: '缺少必要参数'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const plot = await prisma.plot.findFirst({
            where: { id: plotId, novelId }
        });

        if (!plot) {
            return new Response(JSON.stringify({
                code: 404,
                message: '情节不存在'
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (action === 'complete') {
            await prisma.plot.update({
                where: { id: plotId },
                data: {
                    isCompleted: true,
                    completedAt: new Date()
                }
            });
        } else if (action === 'reset') {
            await prisma.plot.update({
                where: { id: plotId },
                data: {
                    isCompleted: false,
                    completedAt: null
                }
            });
        } else if (action === 'reset-all') {
            await prisma.plot.updateMany({
                where: { novelId },
                data: {
                    isCompleted: false,
                    completedAt: null
                }
            });
        }

        return new Response(JSON.stringify({
            code: 200,
            message: '操作成功'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('更新情节失败:', error);
        return new Response(JSON.stringify({
            code: 500,
            message: '操作失败，请稍后重试'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    } finally {
        await prisma.$disconnect();
    }
}
