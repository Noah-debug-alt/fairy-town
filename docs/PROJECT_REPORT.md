# 童话镇 (Fairy Town) 项目技术报告

## 目录

1. [项目概述](#1-项目概述)
2. [成员分工](#2-成员分工)
3. [系统部署与运行指南](#3-系统部署与运行指南)
4. [五分钟快速上手](#4-五分钟快速上手)
5. [核心功能详解](#5-核心功能详解)
6. [高级功能与核心算法](#6-高级功能与核心算法)
7. [技术架构解析](#7-技术架构解析)
8. [AI辅助开发记录](#8-ai辅助开发记录)
9. [附录](#附录)

---

## 1. 项目概述

### 1.1 项目简介

**童话镇 (Fairy Town)** 是一个基于AI驱动的多智能体角色扮演系统，旨在将静态的小说文本转化为动态的、可交互的虚拟小镇。系统通过大语言模型(LLM)解析小说内容，自动提取角色、场景和情节，并在可视化的小镇地图上进行实时模拟。

### 1.2 核心创新点

| 创新点 | 描述 |
|--------|------|
| **智能小说解析** | 使用LLM自动将小说文本转换为结构化的话剧剧本形式，包含角色、场景、情节、对话等元素 |
| **斯坦福小镇风格记忆系统** | 实现了完整的记忆流架构，支持记忆存储、检索、重要性计算、反思生成和记忆压缩 |
| **命运编织系统** | 独创的情节预测与干预系统，可生成多种可能的结局并允许用户干预情节发展 |
| **多模态内容生成** | 集成Stable Diffusion图片生成，自动为角色和场景生成可视化形象 |
| **实时小镇模拟** | 基于情节驱动的动态模拟系统，角色在小镇中移动、对话、产生事件 |

### 1.3 技术栈概览

```
┌─────────────────────────────────────────────────────────────┐
│                        前端技术栈                            │
├─────────────────────────────────────────────────────────────┤
│  React 19 + TypeScript + Vite 8                            │
│  Ant Design 6 + Tailwind CSS                                │
│  React Router DOM + SWR + Zustand                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        后端技术栈                            │
├─────────────────────────────────────────────────────────────┤
│  Express 5 + TypeScript                                     │
│  Prisma ORM + SQLite/PostgreSQL                            │
│  LangChain + OpenAI SDK                                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        AI服务层                              │
├─────────────────────────────────────────────────────────────┤
│  Ollama (本地LLM: qwen3:4b, qwen3:8b)                       │
│  Stable Diffusion XL (本地GPU加速)                          │
│  可选: SiliconFlow API, OpenAI API                          │
└─────────────────────────────────────────────────────────────┘
```

### 1.4 项目目录结构

```
Fairy Town/
├── prisma/
│   └── schema.prisma          # 数据库模型定义
├── public/
│   └── generated/             # 生成的图片存储
├── src/
│   ├── App.tsx               # 主应用组件
│   └── main.tsx              # 入口文件
├── pages/
│   ├── HomePage.tsx          # 首页（小说上传）
│   ├── NovelManagementPage.tsx # 小说管理页
│   ├── manager.tsx           # 管理中心
│   ├── town/
│   │   ├── [novelId].tsx     # 小镇模拟页
│   │   ├── character/[characterId].tsx # 角色详情页
│   │   └── scene/[sceneId].tsx # 场景详情页
│   └── weaving/
│       ├── PlotWeavingPage.tsx    # 情节编织坊主页
│       ├── PlotIntervenePage.tsx  # 干预已有情节
│       ├── PlotInterveneDetailPage.tsx # 情节干预详情
│       └── PlotPredictPage.tsx    # 预测未来情节
├── components/
│   └── TownMap.tsx           # 小镇地图组件
├── utils/
│   ├── llm/index.ts          # LLM调用与小说解析
│   ├── memory/index.ts       # 记忆管理系统
│   ├── prophecy/index.ts     # 预言生成系统
│   ├── image-gen/
│   │   ├── index.ts          # 图片生成接口
│   │   └── diffusers_server.py # SDXL服务端
│   └── agent/town.ts         # 小镇模拟器
├── server.ts                 # Express服务器入口
└── package.json              # 项目依赖配置
```

---

## 2. 成员分工

| 成员 | 角色 | 主要负责模块 |
|------|------|--------------|
| 成员A | 项目架构师 | 系统架构设计、数据库模型设计、API接口设计 |
| 成员B | 前端开发 | React组件开发、页面布局、用户交互实现 |
| 成员C | 后端开发 | Express服务器、LLM集成、记忆系统实现 |
| 成员D | AI工程师 | 小说解析算法、预言生成、图片生成服务 |
| 成员E | 测试工程师 | 功能测试、性能优化、文档编写 |

---

## 3. 系统部署与运行指南

### 3.1 环境准备

#### 3.1.1 系统要求

| 项目 | 最低要求 | 推荐配置 |
|------|----------|----------|
| 操作系统 | Windows 10/11, macOS, Linux | Windows 11 |
| Node.js | v18.0+ | v20.0+ |
| Python | 3.10+ | 3.11+ |
| 显存 | 4GB (图片生成) | 8GB+ (RTX 3060+) |
| 内存 | 8GB | 16GB+ |
| 磁盘 | 10GB | 20GB+ (含模型) |

#### 3.1.2 安装Node.js依赖

```bash
# 进入项目目录
cd "Fairy Town"

# 安装依赖
npm install

# 生成Prisma客户端
npm run db:generate

# 初始化数据库
npm run db:push
```

#### 3.1.3 安装Python环境（图片生成服务）

```bash
# 创建Conda环境
conda create -n pytorch_env python=3.11
conda activate pytorch_env

# 安装PyTorch (支持CUDA 12.x)
pip install --pre torch torchvision --index-url https://download.pytorch.org/whl/nightly/cu124

# 安装Diffusers和相关库
pip install diffusers transformers accelerate safetensors
```

### 3.2 配置LLM服务

#### 3.2.1 安装Ollama

```bash
# Windows: 下载安装包
# https://ollama.com/download

# 拉取模型
ollama pull qwen3:4b
ollama pull qwen3:8b
```

#### 3.2.2 环境变量配置

创建 `.env` 文件：

```env
# LLM配置
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
LLM_MODEL=qwen3:4b
PARSING_MODEL=qwen3:8b
PROPHECY_MODEL=qwen3:8b

# 图片生成配置
IMAGE_GEN_PROVIDER=diffusers
DIFFUSERS_SERVER_URL=http://127.0.0.1:7861

# 可选：云端API
SILICONFLOW_API_KEY=your_api_key
OPENAI_API_KEY=your_api_key
```

### 3.3 启动服务

#### 3.3.1 启动LLM服务

```bash
# 启动Ollama服务（通常自动运行）
ollama serve
```

#### 3.3.2 启动图片生成服务

```bash
# 激活Python环境
conda activate pytorch_env

# 启动Diffusers服务器
python utils/image-gen/diffusers_server.py --port 7861 --model-path "path/to/sdxl-model"
```

#### 3.3.3 启动主服务

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm run start
```

### 3.4 关键文件说明

| 文件路径 | 功能描述 |
|----------|----------|
| `server.ts` | Express服务器入口，包含所有API路由 |
| `prisma/schema.prisma` | 数据库模型定义，包含15个核心模型 |
| `utils/llm/index.ts` | LLM调用封装，小说解析核心算法 |
| `utils/memory/index.ts` | 斯坦福小镇风格记忆系统实现 |
| `utils/prophecy/index.ts` | 预言生成与转换逻辑 |
| `utils/image-gen/index.ts` | 多后端图片生成接口 |
| `utils/agent/town.ts` | 小镇模拟器核心类 |
| `components/TownMap.tsx` | Canvas渲染的小镇地图组件 |

---

## 4. 五分钟快速上手

### 4.1 第一次访问与界面导览

启动服务后，访问 `http://localhost:5173` 进入系统。

#### 4.1.1 首页布局

首页采用渐变色背景的英雄区域设计，包含：
- **标题区域**：显示"童话镇"Logo和项目简介
- **上传表单**：支持TXT、MD、DOCX格式的小说文件上传
- **功能入口**：快速导航到各功能模块

#### 4.1.2 小说管理页

小说管理页展示所有已上传的小说，提供：
- 小说列表卡片（标题、作者、解析状态）
- 解析按钮（触发LLM解析）
- 进入小镇按钮（开始模拟）
- 删除功能

#### 4.1.3 小镇模拟页

小镇模拟页是核心交互界面，分为三个区域：

```
┌────────────────────────────────────────────────────────────┐
│                      顶部控制栏                             │
│  [返回] 小说标题    [▶开始] [⏸暂停] [速度:1x]   [事件列表]  │
├──────────────────┬─────────────────────────┬───────────────┤
│                  │                         │               │
│   左侧场景列表    │     中间小镇地图         │  右侧角色列表  │
│   (可收起)       │     (Canvas渲染)        │  (可收起)     │
│                  │                         │               │
│   - 场景卡片     │   ┌─────┐ ┌─────┐      │  - 角色头像    │
│   - 角色头像     │   │建筑A│ │建筑B│      │  - 当前位置    │
│   - 点击进入     │   └─────┘ └─────┘      │  - 点击对话    │
│                  │      👤    💬          │               │
│                  │                         │               │
├──────────────────┴─────────────────────────┴───────────────┤
│                      底部对话栏                             │
│  [角色名]: 对话内容...                                      │
└────────────────────────────────────────────────────────────┘
```

### 4.2 上传第一部小说

#### 4.2.1 步骤1：准备小说文件

支持格式：
- `.txt` - 纯文本格式
- `.md` - Markdown格式（自动去除标记）
- `.docx` - Word文档（自动提取文本）

#### 4.2.2 步骤2：上传并填写信息

1. 点击首页的"上传小说"区域
2. 选择文件或拖拽上传
3. 填写小说标题（必填）
4. 填写作者名称（可选）
5. 填写备注信息（可选）
6. 点击"提交上传"

#### 4.2.3 步骤3：等待解析

上传成功后，系统自动跳转到小说管理页。此时小说状态为"未解析"。

点击"解析小说"按钮，系统将：
1. 将小说分割成多个片段（每500字符一段）
2. 调用LLM解析每个片段
3. 提取角色、场景、情节信息
4. 保存到数据库

解析时间取决于小说长度，通常每片段需要1-2分钟。

### 4.3 进入小镇模拟

解析完成后，点击"进入小镇"按钮：

1. **查看小镇地图**：场景以建筑形式展示，角色以头像形式显示
2. **开始模拟**：点击"开始"按钮，情节开始自动播放
3. **观察对话**：角色对话以气泡形式出现在地图上
4. **与角色互动**：点击角色头像，可以与角色进行对话
5. **生成图片**：在场景/角色详情页，点击生成图片

### 4.4 情节编织坊

情节编织坊是本系统的核心创新功能，允许用户干预和预测故事发展。点击小说管理页的"情节编织坊"按钮进入。

#### 4.4.1 功能入口界面

```
┌────────────────────────────────────────────────────────────┐
│                    情节编织坊                               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────┐  ┌─────────────────────┐         │
│  │                     │  │                     │         │
│  │   📖 干预已有情节    │  │   🔮 预测未来情节    │         │
│  │                     │  │                     │         │
│  │  修改已发生的情节    │  │  生成多种可能结局    │         │
│  │  AI辅助改写对话      │  │  选择命运走向        │         │
│  │  手动编辑内容        │  │  采用预言到故事      │         │
│  │                     │  │                     │         │
│  │      [进入]         │  │      [进入]         │         │
│  │                     │  │                     │         │
│  └─────────────────────┘  └─────────────────────┘         │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 4.4.2 干预已有情节

**功能说明**：对已经解析的情节进行修改和干预，改变故事走向。

**操作步骤**：

1. **查看情节列表**
   - 左侧显示所有已解析的情节
   - 每个情节显示标题、章节索引、参与角色
   - 点击情节卡片查看详情

2. **查看情节详情**
   - 显示情节的舞台说明、对话内容、旁白
   - 对话分为三种类型：
     - `[完全按照情节]` - 原文核心对话
     - `[改编]` - 适配舞台的改编对话
     - `[补充]` - 合理补充的对话

3. **AI智能改写**
   - 点击"AI改写"按钮
   - 输入改写要求（如："让角色A更愤怒一点"）
   - 系统调用LLM生成新的对话内容
   - 预览改写结果后可选择保存或放弃

4. **手动编辑对话**
   - 直接在对话输入框中修改内容
   - 可以添加、删除、调整对话顺序
   - 支持修改角色名和对话内容

5. **保存修改**
   - 修改会记录到`PlotIntervention`表
   - 保留原始内容备份
   - 小镇模拟时会使用修改后的内容

#### 4.4.3 预测未来情节

**功能说明**：基于现有情节，使用AI生成多种可能的未来走向（预言）。

**操作步骤**：

1. **生成预言**
   - 点击"生成预言"按钮
   - 系统分析现有情节和角色关系
   - 调用LLM生成3-4种可能的结局
   - 每个预言包含：
     - 标题和内容概述
     - 发生概率（0-100%）
     - 结局类型（好结局/坏结局/隐藏结局/悲剧结局）
     - 关键影响因素
     - 涉及的角色

2. **查看预言卡片**
```
┌────────────────────────────────────────────────────────────┐
│  🔮 光之道路                                    概率: 35%   │
│  ─────────────────────────────────────────────────────────│
│  结局类型: ✨ 好结局                                       │
│                                                            │
│  主角找到解决危机的关键，为所有人带来希望。通过勇气和智     │
│  慧，他们克服了所有障碍，达成了令人满意的结局。            │
│                                                            │
│  关键因素: 勇气、智慧、友谊                                │
│  涉及角色: 李远山、沈奶奶                                  │
│                                                            │
│  ┌─────────────┐  ┌─────────────┐                         │
│  │  📖 预览详情 │  │  ✅ 采用预言 │                         │
│  └─────────────┘  └─────────────┘                         │
└────────────────────────────────────────────────────────────┘
```

3. **采用预言**
   - 点击"采用预言"按钮
   - 系统将预言转换为具体的情节片段
   - 新情节添加到故事末尾
   - **注意**：同一批次的预言只能采用一个

4. **预言转换过程**
   - 系统自动将预言拆分为2-3个详细情节
   - 生成场景描述、对话内容、旁白
   - 保存为新的Plot记录
   - 可在小镇模拟中播放

#### 4.4.4 预言批次管理

- 每次生成预言会分配一个批次ID
- 不同批次的预言可以分别采用
- 同一批次只能采用一个预言（避免逻辑冲突）
- 已采用的预言会标记`isAdopted = true`

### 4.5 管理中心

管理中心提供小说的全局管理视图，包括角色管理、场景管理、记忆查看等功能。

#### 4.5.1 管理中心界面

```
┌────────────────────────────────────────────────────────────┐
│  管理中心 - 小说标题                                        │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  📊 统计概览                                         │  │
│  │  角色: 6  场景: 11  情节: 16  预言: 4               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ 👥 角色管理      │  │ 🏠 场景管理      │                 │
│  │                 │  │                 │                 │
│  │ • 查看角色列表   │  │ • 查看场景列表   │                 │
│  │ • 编辑角色信息   │  │ • 编辑场景位置   │                 │
│  │ • 生成角色图片   │  │ • 生成场景图片   │                 │
│  │ • 查看角色记忆   │  │ • 设置场景类型   │                 │
│  └─────────────────┘  └─────────────────┘                 │
│                                                            │
│  ┌─────────────────┐  ┌─────────────────┐                 │
│  │ 💭 记忆管理      │  │ 📖 情节列表      │                 │
│  │                 │  │                 │                 │
│  │ • 按角色筛选     │  │ • 竖直排列展示   │                 │
│  │ • 调整重要性     │  │ • 点击查看详情   │                 │
│  │ • 查看修改历史   │  │ • 跳转到干预页   │                 │
│  └─────────────────┘  └─────────────────┘                 │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 4.5.2 记忆重要性管理

在管理中心可以查看和调整角色的记忆重要性：

1. 选择角色查看其所有记忆
2. 拖动滑块调整记忆重要性（1-10分）
3. 系统记录修改历史
4. 重要性影响记忆检索时的排序

### 4.6 角色详情页

点击小镇地图中的角色头像进入角色详情页。

#### 4.6.1 角色信息展示

```
┌────────────────────────────────────────────────────────────┐
│  [返回] 角色详情                                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────┐  姓名: 李远山                                │
│  │          │  描述: 独自跋涉的旅人                        │
│  │  头像    │  设定: 正在寻找某个重要地点                  │
│  │  图片    │  核心身份: 追寻记忆的旅人                    │
│  │          │  当前位置: 山腰黄桷树                        │
│  └──────────┘                                              │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  💭 记忆流                                            │  │
│  │  ───────────────────────────────────────────────────│  │
│  │  • 触摸树干刻字 (重要性: 7)                           │  │
│  │  • 蚂蚁爬过身体 (重要性: 5)                           │  │
│  │  • 凝望远方河流 (重要性: 6)                           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  🤝 人际关系                                          │  │
│  │  ───────────────────────────────────────────────────│  │
│  │  • 沈奶奶 (婶婆) - 年迈花农，与李远山叔叔有旧情       │  │
│  │  • 叔叔 (亲人) - 等待归人的老人                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  💬 与我对话                                          │  │
│  │  ───────────────────────────────────────────────────│  │
│  │  [输入消息...]                           [发送]      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  [生成角色图片]                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### 4.6.2 与角色对话

- 基于角色的记忆和人设进行智能对话
- 角色会根据记忆流内容给出自然回应
- 对话内容会保存为新的记忆

### 4.7 场景详情页

点击小镇地图中的建筑进入场景详情页。

#### 4.7.1 场景信息展示

```
┌────────────────────────────────────────────────────────────┐
│  [返回] 场景详情                                           │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │                                                     │  │
│  │                  场景图片                            │  │
│  │                                                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  名称: 山腰黄桷树                                          │
│  类型: 🌳 公共场所                                         │
│  描述: 树冠如伞遮蔽天光，树干刻字隐约可见                   │
│                                                            │
│  当前在此的角色:                                           │
│  ┌────┐  ┌────┐                                           │
│  │李远山│  │沈奶奶│                                           │
│  └────┘  └────┘                                           │
│                                                            │
│  [生成场景图片]                                            │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 4.8 功能导航总览

```
┌─────────────────────────────────────────────────────────────┐
│                     功能导航图                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                         首页                                │
│                          │                                  │
│                          ▼                                  │
│                    小说管理页                                │
│                          │                                  │
│           ┌──────────────┼──────────────┐                  │
│           │              │              │                   │
│           ▼              ▼              ▼                   │
│      小镇模拟      情节编织坊      管理中心                  │
│           │              │              │                   │
│           │         ┌────┴────┐         │                   │
│           │         │         │         │                   │
│           │         ▼         ▼         │                   │
│           │    干预情节   预测情节       │                   │
│           │                              │                   │
│           ▼                              ▼                   │
│    ┌──────┴──────┐              ┌────────┴────────┐         │
│    │             │              │                 │         │
│    ▼             ▼              ▼                 ▼         │
│ 角色详情      场景详情       角色管理         场景管理       │
│    │             │              │                 │         │
│    │             │              ▼                 ▼         │
│    │             │           记忆管理         图片生成       │
│    │             │              │                           │
│    ▼             ▼              ▼                           │
│ 与角色对话    生成图片     调整重要性                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. 核心功能详解

### 5.1 智能小说解析系统

#### 5.1.1 解析流程架构

```
┌─────────────────────────────────────────────────────────────┐
│                    小说解析流水线                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ 文本输入 │───▶│ 片段分割 │───▶│ LLM解析 │───▶│ 结果合并 │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       │              │              │              │        │
│       ▼              ▼              ▼              ▼        │
│  TXT/MD/DOCX    500字/片段    JSON提取      去重合并        │
│                               角色提取                       │
│                               场景提取                       │
│                               情节改编                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.1.2 话剧剧本改编算法

系统将小说文本改编为话剧剧本形式，核心Prompt设计：

```typescript
const chunkPrompt = `你是一位专业的话剧编剧。你的任务是将下面的小说片段，
改编为适合在小镇实时动态中展示的话剧剧本形式。

## 提取规则
1. 只输出JSON，不要任何解释
2. 角色提取：提取片段中提到的所有角色
3. 场景提取：提取片段中提到的所有地点
4. 情节提取（核心任务 - 话剧形式改编）：
   - 按话剧场景切分，以完整交互或事件为单位
   - "content" 填写场景说明、人物动作、舞台提醒
   - "dialogueContent" 必须提取和改编对话：
     - [完全按照情节] 角色名：'原文核心对话'
     - [改编] 角色名：'适配话剧舞台的改编对话'
     - [补充] 角色名：'适配话剧舞台的合理补充对话'
     - [动作] （角色动作或神态描写）
     - [音效] 【音效】环境音效描述
`;
```

#### 5.1.3 JSON响应解析与容错

系统实现了多层JSON解析机制，确保从LLM响应中正确提取结构化数据：

```typescript
function parseJSONResponse(response: string): any {
  // 1. 尝试提取 ```json ... ``` 代码块
  // 2. 尝试提取 ``` ... ``` 代码块
  // 3. 处理qwen3模型的thinking块
  // 4. 尝试匹配末尾JSON对象
  // 5. 尝试匹配任意JSON对象
  // 6. 尝试匹配JSON数组
  // 7. 暴力搜索有效JSON
}
```

#### 5.1.4 跨片段信息合并

当同一角色在多个片段中出现时，系统智能合并信息：

```typescript
// 合并策略
if (existing) {
  // 合并记忆
  const existingMemories = new Set(existing.memories || []);
  const newMemories = char.memories.filter(m => !existingMemories.has(m));
  existing.memories = [...existing.memories, ...newMemories];
  
  // 合并关系
  const existingRels = new Set(existing.relationships.map(r => r.name));
  const newRels = char.relationships.filter(r => !existingRels.has(r.name));
  existing.relationships = [...existing.relationships, ...newRels];
  
  // 保留更长的核心身份描述
  if (char.coreIdentity.length > existing.coreIdentity.length) {
    existing.coreIdentity = char.coreIdentity;
  }
}
```

### 5.2 斯坦福小镇风格记忆系统

#### 5.2.1 记忆流架构

系统实现了完整的"Generative Agents"记忆架构：

```
┌─────────────────────────────────────────────────────────────┐
│                      记忆流系统架构                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    记忆存储层                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  Memory Model:                                       │   │
│  │  - content: 记忆内容                                 │   │
│  │  - type: OBSERVATION/DIALOGUE/REFLECTION/PLOT       │   │
│  │  - importance: 重要性评分 (1-10)                     │   │
│  │  - timestamp: 时间戳                                 │   │
│  │  - keywords: 关键词提取                              │   │
│  │  - entities: 实体识别                                │   │
│  │  - embedding: 向量嵌入                               │   │
│  │  - accessCount: 访问频率                             │   │
│  │  - lastAccessedAt: 最后访问时间                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    记忆检索层                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  检索评分 = f(重要性, 时间衰减, 相关性, 访问频率)     │   │
│  │                                                     │   │
│  │  score = importance × recency × relevance          │   │
│  │                                                     │   │
│  │  recency = e^(-α × (now - timestamp))              │   │
│  │  relevance = cosine_similarity(embedding, query)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    反思生成层                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  触发条件: 记忆数量 > 10 或 累计重要性 > 阈值        │   │
│  │  生成过程:                                           │   │
│  │  1. 汇总近期记忆                                     │   │
│  │  2. 调用LLM生成反思                                  │   │
│  │  3. 存储为REFLECTION类型记忆                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    记忆压缩层                        │   │
│  ├─────────────────────────────────────────────────────┤   │
│  │  触发条件: 活跃记忆 > 100                            │   │
│  │  压缩策略:                                           │   │
│  │  1. 按时间窗口分组                                   │   │
│  │  2. 生成摘要替代多条记忆                             │   │
│  │  3. 标记原记忆为已压缩                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.2.2 重要性计算算法

```typescript
function calculateImportance(
  content: string,
  type: MemoryType,
  options?: { hasEmotion?: boolean; hasEntities?: boolean; isKeyEvent?: boolean }
): number {
  let importance = 5; // 基础重要性

  // 内容长度加成
  if (content.length > 200) importance += 1;
  if (content.length > 500) importance += 1;

  // 类型加成
  switch (type) {
    case 'DIALOGUE': importance += 1; break;
    case 'REFLECTION': importance += 3; break;
    case 'PLOT': importance += 2; break;
  }

  // 情感/实体/关键事件加成
  if (options?.hasEmotion) importance += 1;
  if (options?.hasEntities) importance += 1;
  if (options?.isKeyEvent) importance += 2;

  return Math.min(10, Math.max(1, importance));
}
```

#### 5.2.3 时间衰减函数

```typescript
// 指数时间衰减
const recencyScore = Math.exp(-decayFactor * hoursSinceAccess);

// 精细化时间衰减（分段函数）
function getRecencyScore(timestamp: Date): number {
  const hours = (Date.now() - timestamp.getTime()) / (1000 * 60 * 60);
  
  if (hours < 1) return 1.0;      // 1小时内：满分
  if (hours < 24) return 0.9;     // 1天内：90%
  if (hours < 168) return 0.7;    // 1周内：70%
  if (hours < 720) return 0.5;    // 1月内：50%
  return 0.3;                      // 超过1月：30%
}
```

#### 5.2.4 用户自定义重要性

系统允许用户手动调整记忆重要性，并记录修改历史：

```typescript
// 记忆重要性修改历史模型
model MemoryImportanceHistory {
  id            Int      @id @default(autoincrement())
  memoryId      Int
  oldImportance Int      // 原重要性
  newImportance Int      // 新重要性
  operator      String   // 操作者
  operatorType  String   // user/system
  reason        String?  // 修改原因
  createdAt     DateTime @default(now())
  memory        Memory   @relation(...)
}
```

### 5.3 命运编织系统

#### 5.3.1 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     命运编织系统                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐       ┌─────────────────┐             │
│  │   干预已有情节   │       │   预测未来情节   │             │
│  ├─────────────────┤       ├─────────────────┤             │
│  │                 │       │                 │             │
│  │  ┌───────────┐  │       │  ┌───────────┐  │             │
│  │  │ 情节列表  │  │       │  │ 预言生成  │  │             │
│  │  └───────────┘  │       │  └───────────┘  │             │
│  │        │        │       │        │        │             │
│  │        ▼        │       │        ▼        │             │
│  │  ┌───────────┐  │       │  ┌───────────┐  │             │
│  │  │ 情节详情  │  │       │  │ 预言卡片  │  │             │
│  │  └───────────┘  │       │  └───────────┘  │             │
│  │        │        │       │        │        │             │
│  │        ▼        │       │        ▼        │             │
│  │  ┌───────────┐  │       │  ┌───────────┐  │             │
│  │  │ AI改写    │  │       │  │ 采用预言  │  │             │
│  │  │ 手动改写  │  │       │  └───────────┘  │             │
│  │  └───────────┘  │       │        │        │             │
│  │        │        │       │        ▼        │             │
│  │        ▼        │       │  ┌───────────┐  │             │
│  │  ┌───────────┐  │       │  │ 转换为情节│  │             │
│  │  │ 保存修改  │  │       │  └───────────┘  │             │
│  │  └───────────┘  │       │                 │             │
│  │                 │       │                 │             │
│  └─────────────────┘       └─────────────────┘             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 5.3.2 预言生成算法

系统基于现有情节生成多种可能的未来走向：

```typescript
const PROPHECY_GENERATION_PROMPT = `
You are a novel plot prediction engine. Based on the following existing plots,
predict possible future developments.

Task:
Generate 3-4 possible future plot branches. Each branch should include:
1. Title and content (200-300 words)
2. Probability (0-100, based on how likely this development is)
3. Ending type (good, bad, hidden, tragic, or normal)
4. Key factors that influence this branch
5. Involved character names

Requirements:
1. Predictions should logically follow from existing plots
2. Different branches should have clear differences
3. Consider character personalities and relationships
4. Include at least one "unexpected" branch
5. Maintain the style and tone of the original novel
`;
```

#### 5.3.3 预言数据模型

```typescript
model Prophecy {
  id                   Int       @id @default(autoincrement())
  novelId              Int
  title                String    // 预言标题
  content              String    // 预言概述
  probability          Int       // 概率 0-100
  endingType           String    // good, bad, hidden, tragic
  keyFactors           String    // JSON: 关键因素
  involvedCharacterIds String    // JSON: 涉及角色ID
  basedOnPlotIds       String    // JSON: 基于哪些情节
  batchId              String    // 批次ID，区分不同批次预言
  isAdopted            Boolean   // 是否被采用
  createdAt            DateTime  @default(now())
}
```

#### 5.3.4 预言采用与冲突检测

系统确保同一批次的预言只能采用一个：

```typescript
// 检查同批次是否已有预言被采用
const adoptedProphecy = await prisma.prophecy.findFirst({
  where: {
    novelId,
    batchId: prophecy.batchId,
    isAdopted: true,
    id: { not: prophecyId }
  }
});

if (adoptedProphecy) {
  throw new Error(`Another prophecy "${adoptedProphecy.title}" from the same 
    prediction batch has already been adopted.`);
}
```

### 5.4 多模态图片生成

#### 5.4.1 多后端架构

系统支持多种图片生成后端：

```typescript
// 支持的图片生成提供商
type ImageProvider = 
  | 'diffusers'     // 本地Diffusers服务器
  | 'sd_webui'      // Stable Diffusion WebUI
  | 'ollama_diffuser' // Ollama Diffuser
  | 'siliconflow'   // SiliconFlow API
  | 'openai';       // OpenAI DALL-E

// 自动选择逻辑
if (provider === 'auto') {
  if (diffusersServerAvailable) return 'diffusers';
  if (sdWebuiAvailable) return 'sd_webui';
  if (siliconflowApiKey) return 'siliconflow';
  if (openaiApiKey) return 'openai';
  return 'mock';
}
```

#### 5.4.2 场景Prompt构建

```typescript
const SCENE_STYLE = 'isometric view, fairy tale town, Studio Ghibli inspired, 
  warm pastel colors, cozy atmosphere, detailed architecture, soft lighting, 
  no text, no watermark, clean background, high quality, masterpiece';

function buildScenePrompt(sceneName: string, sceneDescription: string, 
                          sceneType: string): string {
  const typeDescriptions: Record<string, string> = {
    public: 'a grand town square with a central fountain...',
    shop: 'a cozy little shop with a colorful storefront...',
    park: 'a lush green park with ancient trees...',
    // ... 更多场景类型
  };
  
  let prompt = typeDescriptions[sceneType] || 'a charming building...';
  if (sceneName) prompt += `, the sign reads "${sceneName}"`;
  if (sceneDescription) prompt += `, ${sceneDescription}`;
  prompt += `, ${SCENE_STYLE}`;
  
  return prompt;
}
```

#### 5.4.3 角色Prompt构建

```typescript
const CHARACTER_STYLE = 'anime style illustration, fairy tale character, 
  warm pastel colors, Studio Ghibli inspired, detailed face, expressive eyes, 
  clean simple background, upper body portrait, no text, no watermark, 
  high quality, masterpiece';

const CHARACTER_PROMPT_PREFIX = 'portrait of a single character, upper body, 
  facing viewer, looking at camera, ';

function buildCharacterPrompt(characterName: string, characterDescription: string,
                              characterAppearance?: string): string {
  let prompt = CHARACTER_PROMPT_PREFIX;
  prompt += extractAppearanceKeywords(characterDescription);
  prompt += `, named "${characterName}"`;
  prompt += `, ${CHARACTER_STYLE}`;
  return prompt;
}
```

#### 5.4.4 GPU加速配置

```python
# diffusers_server.py 核心配置
pipe = StableDiffusionXLPipeline.from_pretrained(
    model_path,
    torch_dtype=torch.float16,
    use_safetensors=True,
)
pipe = pipe.to("cuda")

# 内存优化
pipe.enable_attention_slicing()
pipe.vae.enable_slicing()
pipe.vae.enable_tiling()
```

---

## 6. 高级功能与核心算法

### 6.1 小镇模拟引擎

#### 6.1.1 TownSimulator类设计

```typescript
export class TownSimulator {
  private prisma: PrismaClient;
  private novel: Novel | null = null;
  private characters: Character[] = [];
  private scenes: Scene[] = [];
  private plots: Plot[] = [];
  private characterStates: Map<number, CharacterState> = new Map();
  private currentPlotIndex: number = 0;
  private currentDialogueIndex: number = 0;
  private characterMemoryBuffer: Map<number, string[]> = new Map();
  
  // 核心方法
  async initialize(novelId: number): Promise<void>
  async step(): Promise<PlotExecutionResult>
  async processDialogue(plot: Plot, dialogueIndex: number): Promise<void>
  async saveProgress(): Promise<void>
  async restoreProgress(): Promise<void>
}
```

#### 6.1.2 情节执行流程

```typescript
async step(): Promise<PlotExecutionResult> {
  if (this.currentPlotIndex >= this.plots.length) {
    return { type: 'novel_complete' };
  }
  
  const currentPlot = this.plots[this.currentPlotIndex];
  const dialogues = this.parseDialogues(currentPlot.dialogueContent);
  
  if (this.currentDialogueIndex === 0) {
    // 情节开始
    return {
      type: 'plot_start',
      plotId: currentPlot.id,
      plotTitle: currentPlot.title,
      content: currentPlot.narrationContent
    };
  }
  
  if (this.currentDialogueIndex < dialogues.length) {
    // 执行对话
    const dialogue = dialogues[this.currentDialogueIndex];
    await this.processDialogue(currentPlot, this.currentDialogueIndex);
    return {
      type: 'dialogue',
      content: dialogue.content,
      characterName: dialogue.speaker
    };
  }
  
  // 情节完成
  await this.markPlotComplete(currentPlot);
  this.currentPlotIndex++;
  this.currentDialogueIndex = 0;
  
  return { type: 'plot_complete' };
}
```

#### 6.1.3 进度保存与恢复

```typescript
async saveProgress(): Promise<void> {
  await this.prisma.townStatus.upsert({
    where: { novelId: this.novel.id },
    create: {
      novelId: this.novel.id,
      currentPlotIndex: this.currentPlotIndex,
      currentDialogueIndex: this.currentDialogueIndex,
      speed: this.speed
    },
    update: {
      currentPlotIndex: this.currentPlotIndex,
      currentDialogueIndex: this.currentDialogueIndex,
      speed: this.speed,
      lastUpdateTime: new Date()
    }
  });
}
```

### 6.2 Canvas地图渲染引擎

#### 6.2.1 TownMap组件架构

```typescript
interface TownMapProps {
  scenes: MapScene[];
  characters: MapCharacter[];
  events: MapEvent[];
  onSceneClick?: (sceneId: number) => void;
  onCharacterClick?: (character: MapCharacter) => void;
  isRunning: boolean;
  speed: number;
}

// 建筑尺寸常量
const BUILDING_WIDTH = 160;
const BUILDING_HEIGHT = 120;
const BUILDING_GAP_X = 60;
const BUILDING_GAP_Y = 80;
const CHARACTER_SIZE = 36;
```

#### 6.2.2 自动布局算法

```typescript
function autoLayoutScenes(scenes: MapScene[]): MapScene[] {
  const hasPositions = scenes.some(s => s.positionX !== 0 || s.positionY !== 0);
  if (hasPositions) return scenes; // 已有位置信息
  
  const cols = Math.ceil(Math.sqrt(scenes.length));
  return scenes.map((scene, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const offsetX = (row % 2) * (BUILDING_WIDTH / 2 + BUILDING_GAP_X / 2);
    
    return {
      ...scene,
      positionX: col * (BUILDING_WIDTH + BUILDING_GAP_X) + offsetX,
      positionY: row * (BUILDING_HEIGHT + BUILDING_GAP_Y)
    };
  });
}
```

#### 6.2.3 对话气泡系统

```typescript
interface DialogueBubble {
  id: string;
  characterName: string;
  content: string;
  x: number;
  y: number;
  opacity: number;
  createdAt: number;
  color: string;
}

const BUBBLE_DURATION = 8000; // 气泡显示时长

// 气泡渲染
function renderBubble(ctx: CanvasRenderingContext2D, bubble: DialogueBubble) {
  const age = Date.now() - bubble.createdAt;
  const progress = age / BUBBLE_DURATION;
  
  // 淡入淡出
  if (progress < 0.1) {
    bubble.opacity = progress / 0.1;
  } else if (progress > 0.8) {
    bubble.opacity = (1 - progress) / 0.2;
  }
  
  ctx.globalAlpha = bubble.opacity;
  // 绘制气泡背景和文字
  // ...
}
```

### 6.3 角色对话系统

#### 6.3.1 System Prompt构建

```typescript
export function buildCharacterSystemPrompt(character: Character & { memories?: Memory[] }): string {
  const { name, description, plotSetting, currentScene, relationships, coreIdentity } = character;

  let prompt = `你是 "${name}"，是童话小镇的一个活生生的角色。
你不再是冷冰冰的小说文本，你现在拥有了自己的独立意识和记忆。

## 角色人设
- 名字: ${name}
- 描述: ${description}
- 设定: ${plotSetting}
- 当前所在: ${currentScene || '小镇广场'}
`;

  if (coreIdentity) {
    prompt += `\n## 核心身份\n${coreIdentity}\n`;
  }

  if (relationships) {
    prompt += `\n## 人际关系\n${formatRelationships(relationships)}\n`;
  }

  prompt += `
## 你的行为准则（绝对遵守）
1. 你必须用第一人称（"我"）来回答。
2. 你是一个活在当下的人，**绝对不要重复或背诵你在小说里说过的"经典台词"！**
3. 你的回答必须根据【你的记忆】和当前的【对话上下文】来自然生成。
4. 语言要符合你的人设性格，自然、口语化。
`;

  if (character.memories && character.memories.length > 0) {
    prompt += `\n## 你的记忆流\n`;
    character.memories.forEach((memory, index) => {
      prompt += `${index + 1}. ${memory.content}\n`;
    });
  }

  return prompt;
}
```

---

## 7. 技术架构解析

### 7.1 后端系统设计

#### 7.1.1 Express服务器架构

```typescript
// server.ts 核心结构
async function startServer() {
  const vite = await createViteServer({
    server: { middlewareMode: true }
  });

  const app = async (req: RequestWithBody, res: ServerResponse) => {
    const url = req.url || '';
    
    if (url.startsWith('/api/')) {
      // API路由处理
      await handleApiRequest(req, res);
    } else {
      // Vite前端处理
      vite.middlewares(req, res);
    }
  };

  createHttpServer(app).listen(5173);
}
```

#### 7.1.2 数据库模型关系图

```
┌─────────────────────────────────────────────────────────────┐
│                      数据模型关系图                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐       ┌─────────────┐       ┌─────────────┐   │
│  │  User   │       │    Novel    │       │  Character  │   │
│  ├─────────┤       ├─────────────┤       ├─────────────┤   │
│  │ id      │       │ id          │◀──────│ novelId     │   │
│  │ email   │       │ title       │       │ name        │   │
│  │ name    │       │ content     │       │ description │   │
│  └─────────┘       │ parseStatus │       │ plotSetting │   │
│                    │ author      │       │ coreIdentity│   │
│                    └─────────────┘       └─────────────┘   │
│                          │                      │          │
│                          │                      │          │
│          ┌───────────────┼──────────────────────┤          │
│          │               │                      │          │
│          ▼               ▼                      ▼          │
│  ┌─────────────┐ ┌─────────────┐       ┌─────────────┐    │
│  │    Plot     │ │   Scene     │       │   Memory    │    │
│  ├─────────────┤ ├─────────────┤       ├─────────────┤    │
│  │ novelId     │ │ novelId     │       │ characterId │    │
│  │ title       │ │ name        │       │ novelId     │    │
│  │ content     │ │ type        │       │ content     │    │
│  │ dialogue    │ │ positionX/Y │       │ importance  │    │
│  │ location    │ │ imageUrl    │       │ type        │    │
│  └─────────────┘ └─────────────┘       └─────────────┘    │
│          │                                        │        │
│          ▼                                        │        │
│  ┌─────────────────┐                              │        │
│  │PlotIntervention │                              │        │
│  ├─────────────────┤                              │        │
│  │ plotId          │                              │        │
│  │ originalContent │                              │        │
│  │ newContent      │                              │        │
│  └─────────────────┘                              │        │
│                                                   │        │
│  ┌─────────────┐       ┌─────────────┐           │        │
│  │  Prophecy   │       │ TownStatus  │           │        │
│  ├─────────────┤       ├─────────────┤           │        │
│  │ novelId     │       │ novelId     │           │        │
│  │ title       │       │ isRunning   │           │        │
│  │ probability │       │ speed       │           │        │
│  │ endingType  │       │ currentPlot │           │        │
│  │ isAdopted   │       │ currentDial │           │        │
│  └─────────────┘       └─────────────┘           │        │
│                                                   │        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              MemoryImportanceHistory                │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │ memoryId │ oldImportance │ newImportance │ operator │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 7.1.3 API路由设计

| 路由 | 方法 | 功能描述 |
|------|------|----------|
| `/api/novel/upload` | POST | 上传新小说 |
| `/api/novel/list` | GET | 获取小说列表 |
| `/api/novel/:id` | GET | 获取小说详情 |
| `/api/novel/:id` | DELETE | 删除小说 |
| `/api/novel/:id/parse` | POST | 触发小说解析 |
| `/api/character/:id` | GET | 获取角色详情 |
| `/api/character/:id/chat` | POST | 与角色对话 |
| `/api/scene/:id` | GET | 获取场景详情 |
| `/api/scene/:id/generate-image` | POST | 生成场景图片 |
| `/api/town/:novelId/start` | POST | 开始小镇模拟 |
| `/api/town/:novelId/stop` | POST | 停止模拟 |
| `/api/town/:novelId/status` | GET | 获取模拟状态 |
| `/api/prophecy/:novelId/generate` | POST | 生成预言 |
| `/api/prophecy/:id/adopt` | POST | 采用预言 |
| `/api/memory/:id/importance` | PUT | 更新记忆重要性 |

### 7.2 前端技术实现

#### 7.2.1 路由配置

```typescript
// App.tsx 路由配置
const routes = [
  { path: '/', element: <HomePage /> },
  { path: '/novel-management', element: <NovelManagementPage /> },
  { path: '/manager/:novelId', element: <ManagerPage /> },
  { path: '/town/:novelId', element: <TownPage /> },
  { path: '/town/character/:characterId', element: <CharacterDetailPage /> },
  { path: '/town/scene/:sceneId', element: <SceneDetailPage /> },
  { path: '/weaving/:novelId', element: <PlotWeavingPage /> },
  { path: '/weaving/:novelId/intervene', element: <PlotIntervenePage /> },
  { path: '/weaving/:novelId/predict', element: <PlotPredictPage /> },
];
```

#### 7.2.2 状态管理

```typescript
// 使用Zustand进行全局状态管理
interface AppState {
  currentNovel: Novel | null;
  setCurrentNovel: (novel: Novel) => void;
  
  townState: {
    isRunning: boolean;
    speed: number;
    currentPlotIndex: number;
  };
  updateTownState: (state: Partial<AppState['townState']>) => void;
}
```

#### 7.2.3 数据获取策略

```typescript
// 使用SWR进行数据获取和缓存
const useNovel = (id: number) => {
  const { data, error, mutate } = useSWR(
    id ? `/api/novel/${id}` : null,
    fetcher
  );
  
  return {
    novel: data?.data,
    isLoading: !error && !data,
    isError: error,
    mutate
  };
};
```

---

## 8. AI辅助开发记录

### 8.1 AI工具使用情况

| 开发阶段 | AI工具 | 使用方式 |
|----------|--------|----------|
| 需求分析 | Claude | 需求文档生成、功能规划 |
| 架构设计 | Claude | 技术选型、数据库设计 |
| 代码实现 | Trae IDE | 代码生成、Bug修复 |
| 测试调试 | Trae IDE | 错误诊断、性能优化 |
| 文档编写 | Claude | 技术文档、API文档 |

### 8.2 关键AI辅助实现

#### 8.2.1 小说解析Prompt优化

通过多次迭代优化LLM Prompt，提高解析准确率：
- 第一版：简单提取角色和场景
- 第二版：添加对话分类标签
- 第三版：引入话剧剧本形式改编
- 最终版：支持跨片段信息合并

#### 8.2.2 记忆系统算法设计

参考斯坦福"Generative Agents"论文，AI辅助实现了：
- 重要性计算算法
- 时间衰减函数
- 反思触发机制
- 记忆压缩策略

---

## 附录

### A. 项目依赖环境

#### A.1 Node.js依赖

```json
{
  "dependencies": {
    "@prisma/client": "^6.19.2",
    "antd": "^6.3.1",
    "express": "^5.2.1",
    "langchain": "^1.2.30",
    "mammoth": "^1.11.0",
    "openai": "^6.27.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.13.1",
    "swr": "^2.4.1",
    "zustand": "^5.0.11"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "@types/react": "^19.2.7",
    "prisma": "^6.19.2",
    "tsx": "^4.21.0",
    "typescript": "~5.9.3",
    "vite": "^8.0.0-beta.13"
  }
}
```

#### A.2 Python依赖

```txt
torch>=2.0.0
diffusers>=0.25.0
transformers>=4.35.0
accelerate>=0.25.0
safetensors>=0.4.0
fastapi>=0.104.0
uvicorn>=0.24.0
```

### B. 系统配置参数

| 参数名 | 默认值 | 说明 |
|--------|--------|------|
| `LLM_PROVIDER` | ollama | LLM提供商 |
| `LLM_MODEL` | qwen3:4b | 默认对话模型 |
| `PARSING_MODEL` | qwen3:8b | 小说解析模型 |
| `PROPHECY_MODEL` | qwen3:8b | 预言生成模型 |
| `IMAGE_GEN_PROVIDER` | auto | 图片生成提供商 |
| `DIFFUSERS_SERVER_URL` | http://127.0.0.1:7861 | Diffusers服务地址 |
| `OLLAMA_BASE_URL` | http://localhost:11434 | Ollama服务地址 |

### C. 前后端交互接口文档

#### C.1 小说上传接口

**请求**
```http
POST /api/novel/upload
Content-Type: application/json

{
  "title": "小说标题",
  "content": "小说内容...",
  "author": "作者名",
  "remark": "备注信息"
}
```

**响应**
```json
{
  "code": 200,
  "message": "上传成功",
  "data": {
    "id": 1
  }
}
```

#### C.2 小说解析接口

**请求**
```http
POST /api/novel/1/parse
```

**响应**
```json
{
  "code": 200,
  "message": "解析完成",
  "data": {
    "characters": 5,
    "plots": 16,
    "scenes": 11
  }
}
```

#### C.3 角色对话接口

**请求**
```http
POST /api/character/1/chat
Content-Type: application/json

{
  "message": "你好，最近怎么样？"
}
```

**响应**
```json
{
  "code": 200,
  "data": {
    "response": "你好呀！很高兴见到你！我是李远山，一个追寻记忆的旅人。有什么想聊的吗？",
    "characterId": 1,
    "characterName": "李远山"
  }
}
```

#### C.4 预言生成接口

**请求**
```http
POST /api/prophecy/1/generate
```

**响应**
```json
{
  "code": 200,
  "data": {
    "prophecies": [
      {
        "id": 1,
        "title": "光之道路",
        "content": "主角找到解决危机的关键...",
        "probability": 35,
        "endingType": "good"
      },
      {
        "id": 2,
        "title": "暗影降临",
        "content": "危机加深，主角面临更大挑战...",
        "probability": 25,
        "endingType": "bad"
      }
    ],
    "batchId": "batch_20240101_123456"
  }
}
```

---

## 总结

**童话镇 (Fairy Town)** 是一个创新性的AI驱动小说可视化系统，通过以下技术亮点实现了将静态文本转化为动态交互体验：

1. **智能解析引擎**：基于LLM的小说解析系统，能够自动提取角色、场景、情节，并将其改编为话剧剧本形式

2. **记忆流系统**：完整实现斯坦福小镇风格的记忆架构，支持记忆存储、检索、反思和压缩

3. **命运编织系统**：独创的情节预测与干预机制，让用户可以探索不同的故事走向

4. **多模态生成**：集成Stable Diffusion图片生成，为角色和场景提供可视化形象

5. **实时模拟**：基于Canvas的小镇地图渲染和情节驱动的动态模拟系统

该系统展示了AI技术在创意内容领域的应用潜力，为小说阅读和交互体验提供了全新的可能性。

---

*文档版本：1.0*
*最后更新：2024年5月*
