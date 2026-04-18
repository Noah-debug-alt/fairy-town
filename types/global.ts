// 全局核心类型定义
// 与Prisma数据库模型完全对齐

// 解析状态枚举
export enum ParseStatus {
  UNPARSED = 'UNPARSED',
  PARSING = 'PARSING',
  PARSED = 'PARSED',
  FAILED = 'FAILED'
}

// 记忆类型枚举
export enum MemoryType {
  OBSERVATION = 'OBSERVATION',
  DIALOGUE = 'DIALOGUE',
  REFLECTION = 'REFLECTION',
  PLOT = 'PLOT'
}

// 会话类型枚举
export enum SessionType {
  SINGLE = 'SINGLE',
  GROUP = 'GROUP'
}

// 会话运行状态枚举
export enum SessionStatus {
  STOPPED = 'STOPPED',
  RUNNING = 'RUNNING'
}

// 发送方类型枚举
export enum SenderType {
  USER = 'USER',
  AGENT = 'AGENT'
}

// 小说类型
export interface Novel {
  id: number;
  title: string;
  content: string;
  author: string;
  uploadTime: Date;
  parseStatus: ParseStatus;
  remark?: string;
  createdAt: Date;
  updatedAt: Date;
}

// 角色类型
export interface Character {
  id: number;
  novelId: number;
  name: string;
  avatarUrl?: string;
  description: string;
  plotSetting: string;
  relationships: string;
 出场情节: string;
  createdAt: Date;
  updatedAt: Date;
}

// 记忆类型
export interface Memory {
  id: number;
  characterId: number;
  novelId: number;
  content: string;
  timestamp: Date;
  type: MemoryType;
  importance: number; // 1-10
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

// 会话类型
export interface ChatSession {
  id: number;
  type: SessionType;
  novelId: number;
  participantIds: number[];
  createdAt: Date;
  lastMessageTime: Date;
  status: SessionStatus;
  updatedAt: Date;
}

// 消息类型
export interface ChatMessage {
  id: number;
  sessionId: number;
  novelId: number;
  senderType: SenderType;
  senderId: number;
  receiverId: number;
  content: string;
  sendTime: Date;
  isRead: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// 剧情预测类型
export interface PlotPredict {
  id: number;
  novelId: number;
  content: string;
  predictTime: Date;
  triggerCondition: string;
  isSynced: boolean;
  createdAt: Date;
  updatedAt: Date;
}
