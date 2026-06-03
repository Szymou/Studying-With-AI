<div align="center">

# 🧠 Studying-With-AI

**AI 驱动的面试学习系统 — 智能刷题 · 间隔重复 · 语音朗读**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

<p align="center">
  <img src="https://img.shields.io/badge/AI-Interview-orange" alt="AI Interview"/>
  <img src="https://img.shields.io/badge/Spaced%20Repetition-SM2-purple" alt="SM-2"/>
  <img src="https://img.shields.io/badge/TTS-Edge%20TTS-blue" alt="TTS"/>
</p>

</div>

---

## 📋 目录

- [项目简介](#-项目简介)
- [功能特性](#-功能特性)
- [技术栈](#-技术栈)
- [快速开始](#-快速开始)
- [Docker 部署](#-docker-部署)
- [使用指南](#-使用指南)
- [功能详解](#-功能详解)
- [项目结构](#-项目结构)
- [常见问题](#-常见问题)
- [开发计划](#-开发计划)
- [贡献指南](#-贡献指南)
- [许可证](#-许可证)

---

## 📖 项目简介

**Studying-With-AI** 是一个面向技术面试准备的 AI 增强型学习系统。它打破传统"刷题软件"的模式，融合**认知科学**与**AI 技术**，提供从学习、练习、复习到反馈的完整闭环。

无论是准备 Java 后端面试，还是学习 Go、Python、前端、数据库等领域的八股文知识，这个系统都能帮你**更高效地记忆**、**更深入地理解**。

### 核心理念

```
❌ 传统刷题：随机出题 → 看答案 → 下次随机 → 遗忘
✅ 本系统：  智能出题 → 主动回忆 → SM-2 间隔重复 → AI 分析错误 → 牢固记忆
```

---

## ✨ 功能特性

### 🧠 智能学习引擎

| 特性 | 说明 |
|------|------|
| **SM-2 间隔重复** | 基于 SuperMemo SM-2 算法，根据你的自评自动安排复习计划。记住的题间隔拉长，遗忘的题立即重现 |
| **主动回忆模式** | 不直接展示答案，先让你在脑海里回忆，点击「显示答案」后自评（记得/模糊/忘了），比被动阅读记忆率高 50% |
| **交错练习** | 支持跨领域混练，混合 Java/Go/Python 等不同领域的题目，提升知识迁移能力 |
| **AI 错误分析** | 答错或自评「模糊」时，AI 自动分析错误类型：概念不清 / 记忆混淆 / 细节遗漏 |

### 🤖 AI 能力

| 特性 | 说明 |
|------|------|
| **AI 智能问答** | 每道题都有 AI 助手，不仅给出答案，还能评价你的回答，指出不足 |
| **AI 生成题目** | 输入主题，AI 自动生成面试题及答案，自动去重，支持按分类扩充 |
| **AI 多轮咨询** | 内置聊天式 AI 咨询，带对话历史，可连续追问 |
| **AI 自动扩充** | 一键扫描当前领域所有分类，逐类自动生成新题目，补充题库 |

### 🔊 TTS 语音朗读

| 特性 | 说明 |
|------|------|
| **浏览器语音** | 使用系统 TTS，响应快、无需网络，适合日常使用 |
| **Edge TTS** | 服务端 Edge TTS（Microsoft Xiaoxiao 中文女声），音质自然流畅 |
| **语速调节** | 0.5x ~ 2.0x 六档可调 |
| **设置页统一配置** | 阅读方案、音色、语速均在设置页管理，弹窗一键朗读 |

### 🎨 用户体验

| 特性 | 说明 |
|------|------|
| **暗色/亮色主题** | 支持一键切换，CSS 变量全覆盖 |
| **多领域管理** | 预设 6 大领域（Java/Go/Python/前端/数据库/DevOps），支持 AI 生成新领域 |
| **拖拽排序** | 左侧栏领域可拖拽排序，持久化到后端 + localStorage 备份 |
| **代码复制** | AI 回答中的代码块右上角一键复制 |
| **移动端适配** | 响应式布局，侧边栏折叠，手机友好 |
| **AI 提示词可配置** | 设置页可自定义 AI 回答风格 |

---

## 🛠 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | 原生 HTML/CSS/JavaScript + marked (Markdown 渲染) |
| **后端** | Node.js + Express + TypeScript |
| **数据库** | SQLite (better-sqlite3) |
| **认证** | JWT (jsonwebtoken) + bcrypt |
| **AI 接口** | OpenAI 兼容 API（可接入 NVIDIA / DeepSeek / OpenAI / 本地模型） |
| **TTS** | 浏览器 SpeechSynthesis / 服务端 Edge TTS |
| **部署** | Docker / Docker Compose |

---

## 🚀 快速开始

### 前置要求

- Node.js >= 18
- npm >= 9

### 1. 克隆并安装

```bash
git clone https://github.com/Szymou/Studying-With-AI.git
cd Studying-With-AI
npm install
```

### 2. 配置 AI

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的 AI API 配置：

```env
# 例如使用 OpenAI
AI_API_KEY=sk-your-openai-key
AI_API_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-3.5-turbo

# 或者使用本地部署的模型
# AI_API_KEY=not-needed
# AI_API_BASE_URL=http://127.0.0.1:8000/v1
# AI_MODEL=deepseek-default
```

### 3. 启动

```bash
# 编译 TypeScript
npm run build

# 启动服务
npm start
```

访问 **http://localhost:7777** 即可使用。

### 4. 注册账号

首次打开页面，注册一个账号即可开始学习。系统内置了 **100+ 道 Java 面试题**，覆盖基础、集合、并发、JVM、Spring、设计模式、数据库等分类。

---

## 🐳 Docker 部署

```bash
# 1. 配置 AI（创建 .env 文件）
cp .env.example .env
# 编辑 .env 填入你的 AI API 配置

# 2. 启动
docker compose up -d

# 3. 查看日志
docker compose logs -f
```

访问 **http://localhost:7777**。

> **注意**：如果你有本地 AI 服务，确保 docker-compose.yml 中正确配置了网络连接。

---

## 📖 使用指南

### 首页概览

```
┌─────────────────────────────────────────────────┐
│  ☕ Java 学习     已练习: 15  正确数: 12  86%   │  ← 领域标题 + 学习统计
├─────────────────────────────────────────────────┤
│  [随机练习] [学习记录] [题目搜索] [管理题目] ❤️  │  ← 功能 Tab
├─────────────────────────────────────────────────┤
│                                                 │
│  内容区域...                                     │
│                                                 │
└─────────────────────────────────────────────────┘
   ↕ 左侧栏：领域切换 + 生成新领域 + AI咨询 + 设置
```

### 推荐学习路径

```
1. 选择领域 → 2. 随机练习（展示模式）→ 3. 切换回忆模式 → 4. 自评
       ↓                                              ↓
  学习记录 ← 查看历史                                   SM-2 安排复习
       ↓                                              ↓
  6. 复习到期题目 ← 侧边栏 📅N 提醒 ← 5. 回到练习
```

### 练习模式对比

| 模式 | 组合 | 适用场景 |
|------|------|----------|
| 📖 展示 + 📚 单领域 | 显示题目→输入答案→提交→对错判断 | 初次学习，了解知识点 |
| 🧠 回忆 + 📚 单领域 | 显示题目→回忆→显示答案→自评 | 复习巩固，加深记忆 |
| 📖 展示 + 🌐 全局 | 跨领域混合出题 | 模拟面试，知识串联 |
| 🧠 回忆 + 🌐 全局 | 跨领域主动回忆 | 考前冲刺，查漏补缺 |

---

## 🔍 功能详解

### 🧠 间隔重复（SM-2）

系统使用 SuperMemo SM-2 算法（1987）来安排复习计划：

```
自评 → 质量分 → SM-2 计算 → 下次复习时间
🟢 记得 → 5分 → 间隔×ease factor → 1天后 / 6天后 / 更久
🟡 模糊 → 3分 → 间隔小幅增加 → 几小时后
🔴 忘了 → 1分 → 重置间隔 → 1小时后重练
```

侧边栏每个领域名后显示 **📅N** 表示待复习题目数。

### 🤖 AI 提示词自定义

设置页 → AI 提示词配置，可修改三个场景的 AI 提示词：

- **AI助手/AI咨询** — 控制问答风格
- **生成题目/生成新领域** — 控制出题风格
- **错误分析** — 控制分析语气

修改后即时生效，无需重启。

### 🔊 TTS 语音配置

设置页 → 语音朗读配置：

| 方案 | 优点 | 缺点 |
|------|------|------|
| 浏览器语音 | 响应快，离线可用 | 音质一般，依赖系统 |
| Edge TTS | 音质自然，中文优秀 | 首次有延迟 |

---

## 📁 项目结构

```
Studying-With-AI/
├── public/              # 前端静态文件
│   └── index.html       # 单页应用（所有前端代码）
├── src/                 # 后端 TypeScript 源码
│   ├── routes/          # Express 路由
│   │   ├── ai.ts        # AI 问答/生成/TTS/错误分析
│   │   ├── auth.ts      # 用户注册/登录
│   │   ├── questions.ts # 题目 CRUD + SM-2 + 进度统计
│   │   ├── domains.ts   # 领域管理 + 排序
│   │   ├── favorites.ts # 收藏
│   │   └── custom-questions.ts
│   ├── utils/
│   │   ├── sm2.ts       # SM-2 间隔重复算法
│   │   └── similarity.ts # Dice 系数文本去重
│   ├── db.ts            # SQLite 数据库初始化
│   ├── auth.ts          # JWT + bcrypt 认证
│   └── server.ts        # Express 服务入口
├── data/                # SQLite 数据库文件
├── dist/                # TypeScript 编译输出
├── Dockerfile           # Docker 构建
├── docker-compose.yml   # Docker 编排
└── .env.example         # 环境变量模板
```

---

## ❓ 常见问题

### Q: AI 功能无法使用？

检查 `.env` 配置是否正确：

```bash
# 查看当前配置
curl http://localhost:7777/api/ai/config

# 如果显示 configured:false，检查 AI_API_KEY 是否设置
```

常见问题：
- **API Key 过期**（如 NVIDIA API 每 3 个月过期）
- **模型名称不对**（检查 AI_MODEL）
- **网络不通**（本地服务未启动）

### Q: TTS 朗读没有声音？

1. 打开设置页 → 语音朗读配置
2. 点击「🔊 试听」
3. 如果浏览器方案没声音，切换到 Edge TTS
4. Edge TTS 需要 `edge-tts` 已安装：`pip3 install edge-tts`

### Q: 如何导入自己的题目？

管理页面 → 增加自定义题目，支持单题添加。

### Q: 数据存在哪里？

SQLite 数据库文件 `data/questions.db`，直接复制即可备份。

---

## 🗺 开发计划

- [x] 随机练习 + 答案判定
- [x] AI 智能问答
- [x] 多领域切换
- [x] AI 生成题目
- [x] SM-2 间隔重复
- [x] 主动回忆模式
- [x] AI 错误分析
- [x] 交错练习
- [x] TTS 语音朗读
- [x] 暗色/亮色主题
- [x] 移动端适配
- [x] Docker 部署
- [ ] 用户学习报告
- [ ] 知识图谱可视化
- [ ] 题型标签（记忆/对比/设计/排错）
- [ ] 多人对战模式
- [ ] WebSocket 实时协作

---

## 🤝 贡献指南

欢迎贡献！提交 PR 前请确保：

1. 代码通过 TypeScript 编译：`npm run build`
2. 遵循现有代码风格
3. 新功能请先提 Issue 讨论

---

## 📄 许可证

[MIT](LICENSE)

---

<div align="center">

**如果这个项目对你有帮助，请给它一个 ⭐️！**

</div>
