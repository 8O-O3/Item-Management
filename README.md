# Project Manager

一款本地优先的桌面项目管理工具，内置 AI 辅助功能。基于 **Tauri v2 (Rust) + React + TypeScript + SQLite** 构建。

<p align="center">
  <img src="tauri-app/src-tauri/icons/icon.png" alt="logo" width="120" />
</p>

## ✨ 功能特性

- **📁 层级管理** — 文件夹 → 项目 → 节点，支持侧边栏拖拽排序
- **📎 文件管理** — 为节点添加附件，支持图片/PDF/文本/.docx 预览
- **📋 时间线** — 为每个节点记录进度，追踪每一步
- **🤖 AI 对话面板** — 内置 AI 助手，支持流式输出（DeepSeek 及兼容 OpenAI 接口的 API）
- **🔍 全文搜索** — 跨所有文件夹、项目、节点、文件进行搜索
- **🌗 主题系统** — 浅色 / 深色 / 自动（跟随系统）
- **💾 导入导出** — 以 ZIP 格式备份和恢复全部数据
- **⚡ 本地优先** — 所有数据存储在本地 SQLite，无需云端
- **🔌 可扩展存储** — 基于 Trait 抽象，可切换其他数据库后端

## 🏗️ 技术栈

| 层 | 技术 |
|-------|-----------|
| **桌面框架** | [Tauri v2](https://v2.tauri.app/) |
| **后端** | Rust, [rusqlite](https://github.com/rusqlite/rusqlite) (内置 SQLite), ureq, chrono |
| **前端** | React 19, TypeScript, Vite |
| **样式** | Tailwind CSS v4 |
| **状态管理** | [Zustand](https://zustand.docs.pmnd.rs/) |
| **AI 集成** | OpenAI 兼容接口（DeepSeek 等），支持 SSE 流式输出 |

## 📂 项目结构

```
.
├── project-managerdemo.html    # 原始原型（旧版）
├── structure.txt               # 详细架构文档
│
└── tauri-app/
    ├── src/                    # React + TypeScript 前端
    │   ├── api/                # Tauri IPC 封装
    │   ├── components/         # React 组件
    │   │   ├── board/          # 主内容区
    │   │   ├── chat/           # AI 对话面板
    │   │   ├── layout/         # 应用布局 & 顶栏
    │   │   ├── modals/         # 弹窗（增删改查、预览、统计）
    │   │   ├── settings/       # 主题切换、API 配置表单
    │   │   └── sidebar/        # 文件夹树、右键菜单
    │   ├── stores/             # Zustand 状态仓库
    │   ├── types/              # TypeScript 类型定义
    │   └── utils/              # 工具函数
    │
    ├── src-old/                # 原生 JS 前端（旧版）
    │
    └── src-tauri/              # Rust 后端
        ├── src/
        │   ├── main.rs         # 入口，注册 IPC 命令
        │   ├── lib.rs          # 库 crate 导出
        │   ├── commands.rs     # 35+ 个 Tauri IPC 命令
        │   ├── storage.rs      # Storage trait（20 个方法）
        │   ├── services.rs     # AI 客户端、.docx 文本提取
        │   ├── models.rs       # 数据结构定义
        │   ├── error.rs        # 错误处理
        │   └── db/
        │       ├── sqlite.rs   # SQLite 实现
        │       └── migration.rs # 数据库迁移
        └── tests/
            └── storage_tests.rs # 35 个集成测试
```

## 🚀 快速开始

### 环境要求

- [Rust](https://www.rust-lang.org/tools/install) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- [pnpm](https://pnpm.io/)（也可用 npm / yarn）
- macOS / Windows / Linux

### 安装依赖

```bash
cd tauri-app
pnpm install
```

### 开发模式运行

```bash
pnpm dev
```

启动 Vite 开发服务器（`http://localhost:5173`）并自动打开 Tauri 窗口。

### 生产构建

```bash
pnpm build
```

打包后的应用位于 `tauri-app/src-tauri/target/release/bundle/`。

## 🧪 测试

**后端（35 个集成测试）：**

```bash
cargo test --manifest-path tauri-app/src-tauri/Cargo.toml
```

**前端：**

```bash
cd tauri-app
pnpm test
```

## ⚙️ AI 配置

1. 打开应用，点击侧边栏的 **设置**（齿轮图标）
2. 添加 API 配置：
   - **名称**：任意标签（如 "DeepSeek"）
   - **API Key**：你的密钥（仅存储在本地 SQLite 中，不会发送到其他地方）
   - **Base URL**：API 地址（如 `https://api.deepseek.com/v1`）
   - **Model**：模型名称（如 `deepseek-chat`）
3. 点击顶栏的 **Chat** 打开 AI 对话面板，即可使用

AI 助手可以读取当前选中节点的内容，帮你头脑风暴、总结归纳、生成内容。

## 📦 数据存储

所有数据存储在本地：

```
~/Library/Application Support/com.projectmanager.app/data.db   (macOS)
~/.local/share/com.projectmanager.app/data.db                  (Linux)
%APPDATA%/com.projectmanager.app/data.db                       (Windows)
```

API Key 同样存储在该 SQLite 数据库内，**绝不会**离开你的设备（仅在直接调用 AI API 时发送）。

## 🔒 隐私保护

- ✅ 完全本地运行 — 无遥测、无云同步
- ✅ API Key 存储在本地 SQLite 中
- ✅ AI 请求直接从你的设备发送到 API 提供商
- ✅ 数据导入导出，完全掌控你的数据

## 📄 开源协议

MIT

---

用 Tauri + React + Rust 构建 ❤️
