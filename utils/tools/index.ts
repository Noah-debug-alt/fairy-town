// 工具函数集合
// 用于各种工具函数的实现

import mammoth from 'mammoth';
import MarkdownIt from 'markdown-it';

const md = new MarkdownIt();

// 工具函数集合
export const tools = {
  // 解析DOCX文件
  parseDocx: async (file: Buffer): Promise<string> => {
    const result = await mammoth.extractRawText({ buffer: file });
    return result.value;
  },

  // 解析Markdown文件
  parseMarkdown: (content: string): string => {
    return md.render(content);
  },

  // 生成随机ID
  generateId: (): number => {
    return Math.floor(Math.random() * 1000000);
  },

  // 格式化时间
  formatTime: (date: Date): string => {
    return date.toISOString();
  },

  // 计算两个日期之间的天数
  getDaysBetween: (date1: Date, date2: Date): number => {
    const diffTime = Math.abs(date2.getTime() - date1.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  },

  // 深拷贝对象
  deepClone: <T>(obj: T): T => {
    return JSON.parse(JSON.stringify(obj));
  },

  // 验证邮箱格式
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // 截断文本
  truncateText: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  },

  // 生成随机颜色
  generateRandomColor: (): string => {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  },

  // 计算文本相似度
  calculateSimilarity: (_text1: string, _text2: string): number => {
    // 后续实现文本相似度计算的逻辑
    return 0.5;
  },

  // 提取文本关键词
  extractKeywords: (_text: string, _count: number = 5): string[] => {
    // 后续实现提取文本关键词的逻辑
    return [];
  },

  // 生成角色头像URL
  generateAvatarUrl: (name: string): string => {
    // 后续实现生成角色头像URL的逻辑
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  },

  // 检查文件类型
  checkFileType: (filename: string): string => {
    const extension = filename.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'docx':
        return 'docx';
      case 'md':
        return 'markdown';
      case 'txt':
        return 'text';
      default:
        return 'unknown';
    }
  },
};
