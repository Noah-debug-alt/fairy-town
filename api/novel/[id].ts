import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {

    // 校验ID格式
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
      where: {
        id: novelId
      },
      include: {
        characters: true
      }
    });

    // 异常处理：小说不存在时返回404错误
    if (!novel) {
      return new Response(JSON.stringify({
        code: 404,
        message: '小说不存在'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 返回小说的完整信息
    return new Response(JSON.stringify({
      code: 200,
      message: '查询成功',
      data: novel
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('查询小说详情失败:', error);
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

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
      where: {
        id: novelId
      }
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

    const sessions = await prisma.chatSession.findMany({
      where: { novelId }
    });

    for (const session of sessions) {
      await prisma.chatMessage.deleteMany({
        where: { sessionId: session.id }
      });
    }

    await prisma.chatSession.deleteMany({
      where: { novelId }
    });

    await prisma.memory.deleteMany({
      where: { novelId }
    });

    await prisma.character.deleteMany({
      where: { novelId }
    });

    await prisma.plotPredict.deleteMany({
      where: { novelId }
    });

    await prisma.novel.delete({
      where: {
        id: novelId
      }
    });

    return new Response(JSON.stringify({
      code: 200,
      message: '删除成功'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('删除小说失败:', error);
    return new Response(JSON.stringify({
      code: 500,
      message: '删除失败，请稍后重试'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    await prisma.$disconnect();
  }
}
