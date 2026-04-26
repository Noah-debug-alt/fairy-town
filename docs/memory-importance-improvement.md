# 记忆流重要性改进技术文档

## 一、需求概述

### 1.1 功能目标

本次改进包含两个核心功能：

1. **访问频率统计**：记录每条记忆被检索和使用的次数，并在前端展示
2. **用户自定义重要性**：允许用户手动调整记忆的重要性值，并保留修改历史

### 1.2 功能范围

| 功能 | 后端 | 前端 | 说明 |
|------|------|------|------|
| 访问频率统计 | ✅ | ✅ | 记录并展示记忆被访问的次数 |
| 用户自定义重要性 | ✅ | ✅ | 在角色详情页记忆流查看处添加修改功能 |
| 修改历史记录 | ✅ | ❌ | 后端记录所有修改操作 |

---

## 二、数据库设计

### 2.1 Memory 模型修改

在 `prisma/schema.prisma` 中的 `Memory` 模型添加以下字段：

```prisma
model Memory {
  // ... 现有字段 ...
  
  // 访问频率统计
  accessCount    Int       @default(0)    // 被检索次数
  lastAccessedAt DateTime?                // 最后被访问时间
  
  // 用户自定义重要性
  isManuallySet  Boolean   @default(false) // 是否被用户手动设置过
  manualSetBy    String?                   // 设置者标识（可选）
  manualSetAt    DateTime?                 // 手动设置时间
  
  // ... 其他字段 ...
}
```

### 2.2 新增 MemoryImportanceHistory 模型

用于记录重要性修改历史：

```prisma
model MemoryImportanceHistory {
  id           Int      @id @default(autoincrement())
  memoryId     Int      // 关联的记忆ID
  oldImportance Int    // 修改前的重要性
  newImportance Int    // 修改后的重要性
  operator     String   // 操作者标识
  operatorType String   // 操作者类型：user / system
  reason       String?  // 修改原因（可选）
  createdAt    DateTime @default(now())
  
  memory       Memory   @relation(fields: [memoryId], references: [id], onDelete: Cascade)
  
  @@index([memoryId])
  @@index([createdAt])
}
```

### 2.3 数据库迁移命令

```bash
# 生成 Prisma 客户端
npm run db:generate

# 推送数据库变更
npm run db:push
```

---

## 三、后端 API 设计

### 3.1 修改现有 API

#### 3.1.1 GET /api/character/:id/memory

**修改内容**：在返回的记忆列表中增加 `accessCount` 和 `isManuallySet` 字段

**响应示例**：
```json
{
  "code": 200,
  "data": {
    "list": [
      {
        "id": 1,
        "content": "记忆内容...",
        "type": "DIALOGUE",
        "importance": 7,
        "accessCount": 15,
        "isManuallySet": true,
        "tags": ["对话", "重要"],
        "timestamp": "2024-01-15T10:30:00Z",
        "createdAt": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "total": 50
    }
  }
}
```

### 3.2 新增 API

#### 3.2.1 PUT /api/memory/:id/importance

**功能**：更新单条记忆的重要性

**请求体**：
```json
{
  "importance": 8,
  "operator": "用户标识",
  "reason": "这是关键记忆"
}
```

**参数说明**：
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| importance | number | 是 | 新的重要性值（1-10） |
| operator | string | 否 | 操作者标识 |
| reason | string | 否 | 修改原因 |

**响应示例**：
```json
{
  "code": 200,
  "message": "重要性更新成功",
  "data": {
    "id": 1,
    "importance": 8,
    "isManuallySet": true,
    "manualSetAt": "2024-01-15T12:00:00Z",
    "oldImportance": 5
  }
}
```

**错误响应**：
```json
{
  "code": 400,
  "message": "重要性值必须在 1-10 范围内"
}
```

#### 3.2.2 GET /api/memory/:id/history

**功能**：获取单条记忆的重要性修改历史

**响应示例**：
```json
{
  "code": 200,
  "data": {
    "memoryId": 1,
    "currentImportance": 8,
    "history": [
      {
        "id": 1,
        "oldImportance": 5,
        "newImportance": 7,
        "operator": "用户A",
        "operatorType": "user",
        "reason": "这是重要记忆",
        "createdAt": "2024-01-14T10:00:00Z"
      },
      {
        "id": 2,
        "oldImportance": 7,
        "newImportance": 8,
        "operator": "用户A",
        "operatorType": "user",
        "reason": "再次确认重要性",
        "createdAt": "2024-01-15T12:00:00Z"
      }
    ]
  }
}
```

---

## 四、后端代码修改

### 4.1 修改文件清单

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `prisma/schema.prisma` | 修改 | 添加新字段和新模型 |
| `utils/memory/index.ts` | 修改 | 添加访问计数和重要性更新逻辑 |
| `server.ts` | 修改 | 添加新的 API 路由 |

### 4.2 utils/memory/index.ts 修改内容

#### 4.2.1 新增函数：updateMemoryImportance

```typescript
/**
 * 更新记忆重要性（用户手动设置）
 * @param memoryId 记忆ID
 * @param newImportance 新的重要性值（1-10）
 * @param operator 操作者标识
 * @param reason 修改原因
 */
updateMemoryImportance: async (
  memoryId: number,
  newImportance: number,
  operator: string = 'unknown',
  reason?: string
): Promise<{ memory: Memory; historyEntry: MemoryImportanceHistory }> => {
  // 1. 验证重要性范围
  if (newImportance < 1 || newImportance > 10) {
    throw new Error('重要性值必须在 1-10 范围内');
  }

  // 2. 获取当前记忆
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId }
  });

  if (!memory) {
    throw new Error('记忆不存在');
  }

  const oldImportance = memory.importance;

  // 3. 如果值相同，直接返回
  if (oldImportance === newImportance) {
    return { memory, historyEntry: null };
  }

  // 4. 更新记忆并记录历史（事务）
  const result = await prisma.$transaction(async (tx) => {
    // 更新记忆
    const updatedMemory = await tx.memory.update({
      where: { id: memoryId },
      data: {
        importance: newImportance,
        isManuallySet: true,
        manualSetBy: operator,
        manualSetAt: new Date()
      }
    });

    // 记录历史
    const historyEntry = await tx.memoryImportanceHistory.create({
      data: {
        memoryId,
        oldImportance,
        newImportance,
        operator,
        operatorType: 'user',
        reason
      }
    });

    return { memory: updatedMemory, historyEntry };
  });

  return result;
}
```

#### 4.2.2 新增函数：getImportanceHistory

```typescript
/**
 * 获取记忆重要性修改历史
 * @param memoryId 记忆ID
 * @param limit 返回条数限制
 */
getImportanceHistory: async (
  memoryId: number,
  limit: number = 20
): Promise<MemoryImportanceHistory[]> => {
  return await prisma.memoryImportanceHistory.findMany({
    where: { memoryId },
    orderBy: { createdAt: 'desc' },
    take: limit
  });
}
```

#### 4.2.3 修改函数：retrieveRelevantMemory

在检索记忆时更新访问计数：

```typescript
retrieveRelevantMemory: async (params: MemoryRetrievalParams): Promise<Memory[]> => {
  // ... 现有检索逻辑 ...

  // 在返回结果前，更新访问计数
  if (memories.length > 0) {
    await prisma.memory.updateMany({
      where: { id: { in: memories.map(m => m.id) } },
      data: {
        accessCount: { increment: 1 },
        lastAccessedAt: new Date()
      }
    });
  }

  return memories;
}
```

#### 4.2.4 修改函数：getMemories

在返回的记忆中包含访问计数：

```typescript
getMemories: async (characterId, options) => {
  // ... 现有查询逻辑 ...
  
  // 确保返回 accessCount 和 isManuallySet 字段
  return await prisma.memory.findMany({
    where,
    select: {
      id: true,
      content: true,
      type: true,
      importance: true,
      accessCount: true,        // 新增
      isManuallySet: true,      // 新增
      tags: true,
      timestamp: true,
      createdAt: true,
      updatedAt: true
    },
    orderBy: [
      { importance: 'desc' },
      { timestamp: 'desc' }
    ],
    take: limit
  });
}
```

### 4.3 server.ts 新增路由

```typescript
// PUT /api/memory/:id/importance - 更新记忆重要性
if (path.match(/^\/api\/memory\/\d+\/importance$/) && req.method === 'PUT') {
  const memoryId = parseInt(path.split('/')[2]);
  
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      const { importance, operator, reason } = data;
      
      if (importance === undefined || importance === null) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 400, message: '缺少重要性参数' }));
        return;
      }
      
      if (importance < 1 || importance > 10) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ code: 400, message: '重要性值必须在 1-10 范围内' }));
        return;
      }
      
      const { memory } = await import('./utils/memory/index');
      const result = await memory.updateMemoryImportance(
        memoryId,
        importance,
        operator || 'user',
        reason
      );
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        code: 200,
        message: '重要性更新成功',
        data: result.memory
      }));
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ code: 500, message: '更新失败: ' + err.message }));
    }
  });
  return;
}

// GET /api/memory/:id/history - 获取重要性修改历史
if (path.match(/^\/api\/memory\/\d+\/history$/) && req.method === 'GET') {
  const memoryId = parseInt(path.split('/')[2]);
  
  try {
    const { memory } = await import('./utils/memory/index');
    const history = await memory.getImportanceHistory(memoryId);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      code: 200,
      data: {
        memoryId,
        history
      }
    }));
  } catch (err: any) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code: 500, message: '获取历史失败: ' + err.message }));
  }
  return;
}
```

---

## 五、前端修改

### 5.1 修改文件清单

| 文件路径 | 修改类型 | 说明 |
|----------|----------|------|
| `pages/town/character/[characterId].tsx` | 修改 | 添加访问次数显示和自定义重要性按钮 |

### 5.2 角色详情页修改内容

#### 5.2.1 记忆列表显示调整

在记忆列表中增加以下显示：
- 访问次数标签（如：`访问: 15次`）
- 手动设置标识（如：`⭐ 已自定义`）

#### 5.2.2 新增"自定义重要性"功能

**交互流程**：
1. 用户点击记忆条目旁的"自定义重要性"按钮
2. 弹出对话框，显示当前重要性值
3. 用户输入新的重要性值（1-10）
4. 可选填写修改原因
5. 点击确认后调用 API 更新
6. 更新成功后刷新记忆列表

**UI 组件**：
- 使用 Ant Design 的 `Modal` 作为弹窗
- 使用 `InputNumber` 作为重要性输入控件
- 使用 `TextArea` 作为原因输入框

### 5.3 前端代码示例

```tsx
// 自定义重要性弹窗组件
const ImportanceModal: React.FC<{
  visible: boolean;
  memory: Memory | null;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ visible, memory, onClose, onSuccess }) => {
  const [importance, setImportance] = useState(5);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (memory) {
      setImportance(memory.importance);
      setReason('');
    }
  }, [memory]);

  const handleOk = async () => {
    if (!memory) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/memory/${memory.id}/importance`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importance,
          operator: 'user',
          reason: reason || undefined
        })
      });
      
      const data = await response.json();
      if (data.code === 200) {
        message.success('重要性更新成功');
        onSuccess();
        onClose();
      } else {
        message.error(data.message);
      }
    } catch (err) {
      message.error('更新失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="自定义记忆重要性"
      open={visible}
      onOk={handleOk}
      onCancel={onClose}
      confirmLoading={loading}
    >
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>记忆内容：</div>
        <div style={{ padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
          {memory?.content}
        </div>
      </div>
      
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>重要性（1-10）：</div>
        <InputNumber
          min={1}
          max={10}
          value={importance}
          onChange={setImportance}
          style={{ width: '100%' }}
        />
        <div style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
          1 = 最不重要，10 = 最重要
        </div>
      </div>
      
      <div>
        <div style={{ marginBottom: 8 }}>修改原因（可选）：</div>
        <TextArea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="请输入修改原因..."
          rows={3}
        />
      </div>
    </Modal>
  );
};
```

---

## 六、实施步骤

### 步骤 1：数据库修改

1. 修改 `prisma/schema.prisma`
2. 运行 `npm run db:generate`
3. 运行 `npm run db:push`

### 步骤 2：后端修改

1. 修改 `utils/memory/index.ts`
   - 添加 `updateMemoryImportance` 函数
   - 添加 `getImportanceHistory` 函数
   - 修改 `retrieveRelevantMemory` 函数（添加访问计数）
   - 修改 `getMemories` 函数（返回新字段）

2. 修改 `server.ts`
   - 添加 `PUT /api/memory/:id/importance` 路由
   - 添加 `GET /api/memory/:id/history` 路由
   - 修改 `GET /api/character/:id/memory` 路由响应

### 步骤 3：前端修改

1. 修改 `pages/town/character/[characterId].tsx`
   - 添加访问次数显示
   - 添加"自定义重要性"按钮
   - 添加重要性修改弹窗组件

### 步骤 4：测试

1. 测试访问计数是否正确累加
2. 测试重要性修改功能
3. 测试修改历史记录
4. 测试前端显示和交互

---

## 七、注意事项

### 7.1 数据兼容性

- 新增字段都有默认值，现有数据不受影响
- `accessCount` 默认为 0
- `isManuallySet` 默认为 false

### 7.2 性能考虑

- 访问计数更新使用批量操作，减少数据库压力
- 修改历史表添加索引，保证查询性能

### 7.3 错误处理

- 重要性值必须在 1-10 范围内
- 记忆不存在时返回 404
- 数据库操作失败时返回 500

---

## 八、验收标准

### 8.1 功能验收

- [ ] 记忆列表正确显示访问次数
- [ ] 点击"自定义重要性"按钮弹出修改窗口
- [ ] 可以成功修改重要性值
- [ ] 修改后记忆列表正确更新
- [ ] 修改历史被正确记录

### 8.2 界面验收

- [ ] 访问次数显示清晰
- [ ] 自定义重要性按钮位置合理
- [ ] 弹窗交互流畅
- [ ] 错误提示友好

### 8.3 数据验收

- [ ] 访问计数准确
- [ ] 修改历史完整
- [ ] 数据库字段正确更新

---

## 九、后续扩展

本次实现为后续功能打下基础：

1. **访问热度排行**：基于 `accessCount` 可以实现"最常回忆的记忆"排行
2. **重要性分析**：基于修改历史可以分析用户对记忆的认知变化
3. **智能推荐**：结合访问频率和重要性优化记忆检索
