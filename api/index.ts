// API路由入口文件
// 后续接口开发将在此目录中实现

export * from './novel/upload';
export * from './novel/list';
export * from './novel/[id]';
export * from './novel/[id]/parse';
export * from './character/[id]/init-memory';
export * from './character/[id]/memory';
export * from './memory/write';

export const apiRoutes = {
  // 预留API路由定义
};
