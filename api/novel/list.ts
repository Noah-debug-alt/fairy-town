import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    // 解析查询参数
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const pageSize = parseInt(url.searchParams.get('pageSize') || '10');

    // 校验分页参数
    const validPage = Math.max(1, page);
    const validPageSize = Math.max(1, Math.min(100, pageSize));
    const skip = (validPage - 1) * validPageSize;

    // 查询小说列表，按上传时间倒序排列，返回基础信息（不含完整原文）
    const [novels, total] = await Promise.all([
      prisma.novel.findMany({
        select: {
          id: true,
          title: true,
          author: true,
          uploadTime: true,
          parseStatus: true,
          remark: true,
          createdAt: true
        },
        orderBy: {
          uploadTime: 'desc'
        },
        skip,
        take: validPageSize
      }),
      prisma.novel.count()
    ]);

    // 计算总页数
    const totalPages = Math.ceil(total / validPageSize);

    // 返回小说列表和分页信息
    return new Response(JSON.stringify({
      code: 200,
      message: '查询成功',
      data: {
        list: novels,
        pagination: {
          page: validPage,
          pageSize: validPageSize,
          total,
          totalPages
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('查询小说列表失败:', error);
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
