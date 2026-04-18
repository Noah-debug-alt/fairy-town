import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, content, author, remark } = body;

    // 校验参数合法性
    if (!title || !content) {
      return new Response(JSON.stringify({
        code: 400,
        message: '标题和内容不能为空'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 校验内容长度
    if (content.length > 1000000) {
      return new Response(JSON.stringify({
        code: 400,
        message: '内容过长，不能超过100万字'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 过滤非法内容（这里简单处理，实际项目中可能需要更复杂的过滤）
    const filteredContent = content.replace(/<script[^>]*>.*?<\/script>/gi, '');

    // 将小说信息存入数据库
    const novel = await prisma.novel.create({
      data: {
        title,
        content: filteredContent,
        author: author || '未知',
        uploadTime: new Date(),
        parseStatus: 'UNPARSED',
        remark
      }
    });

    // 返回小说ID、上传状态、提示信息
    return new Response(JSON.stringify({
      code: 200,
      message: '上传成功',
      data: {
        id: novel.id,
        status: 'SUCCESS'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('上传小说失败:', error);
    return new Response(JSON.stringify({
      code: 500,
      message: '数据库写入失败，请稍后重试'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  } finally {
    await prisma.$disconnect();
  }
}
