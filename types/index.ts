// 全局类型定义
// 后续全局TS类型将在此文件中定义

export * from './global';

export interface User {
  id: number;
  email: string;
  name?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Agent {
  id: number;
  name: string;
  type: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}
