# Project Manager — Local-first project management with built-in AI

A local-first desktop project management tool with AI-powered assistance. Built with **Tauri v2** (Rust) + **React + TypeScript** + **SQLite**.

<p align="center">
  <img src="tauri-app/src-tauri/icons/icon.png" alt="logo" width="120" />
</p>

<img width="1195" height="760" alt="截屏2026-06-24 01 39 11" src="https://github.com/user-attachments/assets/b5723cd8-dbea-40a9-bded-b9f5a099e734" />
<img width="1192" height="761" alt="截屏2026-06-24 01 42 02" src="https://github.com/user-attachments/assets/1583f15c-574e-4a7c-a65f-703007a5a1a8" />
<img width="1193" height="792" alt="截屏2026-06-24 01 41 18" src="https://github.com/user-attachments/assets/7a0ddef9-4991-48b7-8195-e3e89389bc5d" />

## ✨ Features

- **📁 Hierarchical Organization** — Folders → Projects → Nodes, with drag-and-drop in the sidebar
- **📎 File Management** — Attach files to nodes, preview images/PDF/text/.docx in-app
- **📋 Timeline** — Track progress with timeline entries per node
- **🤖 AI Chat Panel** — Built-in AI assistant with streaming responses (DeepSeek, OpenAI-compatible APIs)
- **🔍 Full-Text Search** — Search across all folders, projects, nodes, and files
- **🌗 Theme System** — Light / Dark / Auto (follows system preference)
- **💾 Export & Import** — Backup and restore all your data as ZIP files
- **⚡ Local-First** — All data stored in local SQLite, no cloud required
- **🔌 Extensible Storage** — Trait-based backend, swappable to other databases

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Shell** | [Tauri v2](https://v2.tauri.app/) |
| **Backend** | Rust, [rusqlite](https://github.com/rusqlite/rusqlite) (bundled SQLite), ureq, chrono |
| **Frontend** | React 19, TypeScript, Vite |
| **Styling** | Tailwind CSS v4 |
| **State** | [Zustand](https://zustand.docs.pmnd.rs/) |
| **AI Integration** | OpenAI-compatible API (DeepSeek, etc.) with SSE streaming |

## 📂 Project Structure

```
.
├── project-managerdemo.html    # Original prototype (legacy)
├── structure.txt               # Detailed architecture docs
│
└── tauri-app/
    ├── src/                    # React + TypeScript frontend
    │   ├── api/                # Tauri IPC wrappers
    │   ├── components/         # React components
    │   │   ├── board/          # Main content area
    │   │   ├── chat/           # AI chat panel
    │   │   ├── layout/         # App layout & header
    │   │   ├── modals/         # Dialogs (CRUD, preview, stats)
    │   │   ├── settings/       # Theme toggle, API config form
    │   │   └── sidebar/        # Folder tree, context menu
    │   ├── stores/             # Zustand stores
    │   ├── types/              # TypeScript type definitions
    │   └── utils/              # Helper functions
    │
    ├── src-old/                # Vanilla JS frontend (legacy)
    │
    └── src-tauri/              # Rust backend
        ├── src/
        │   ├── main.rs         # Entry point, command registration
        │   ├── lib.rs          # Library crate exports
        │   ├── commands.rs     # 35+ Tauri IPC commands
        │   ├── storage.rs      # Storage trait (20 methods)
        │   ├── services.rs     # AI client, .docx text extraction
        │   ├── models.rs       # Data structures
        │   ├── error.rs        # Error handling
        │   └── db/
        │       ├── sqlite.rs   # SQLite implementation
        │       └── migration.rs # Schema migrations
        └── tests/
            └── storage_tests.rs # 35 integration tests
```

## 🚀 Getting Started

### Prerequisites

- [Rust](https://www.rust-lang.org/tools/install) (1.70+)
- [Node.js](https://nodejs.org/) (18+)
- [pnpm](https://pnpm.io/) (or npm/yarn)
- macOS / Windows / Linux

### Install Dependencies

```bash
cd tauri-app
pnpm install
```

### Run in Development

```bash
pnpm dev
```

This starts the Vite dev server at `http://localhost:5173` and launches the Tauri window.

### Build for Production

```bash
pnpm build
```

The packaged app will be in `tauri-app/src-tauri/target/release/bundle/`.

## 🧪 Testing

**Backend (35 integration tests):**

```bash
cargo test --manifest-path tauri-app/src-tauri/Cargo.toml
```

**Frontend:**

```bash
cd tauri-app
pnpm test
```

## ⚙️ AI Configuration

1. Open the app, go to **Settings** (gear icon in the sidebar)
2. Add an API configuration:
   - **Name**: Any label (e.g., "DeepSeek")
   - **API Key**: Your API key (stored locally in SQLite, never sent anywhere else)
   - **Base URL**: API endpoint (e.g., `https://api.deepseek.com/v1`)
   - **Model**: Model name (e.g., `deepseek-chat`)
3. Open the **Chat** panel from the header to start using the AI assistant

The AI assistant can read the currently selected node's context, helping you brainstorm, summarize, or generate content.

## 📦 Data Storage

All data is stored locally:

```
~/Library/Application Support/com.projectmanager.app/data.db   (macOS)
~/.local/share/com.projectmanager.app/data.db                  (Linux)
%APPDATA%/com.projectmanager.app/data.db                       (Windows)
```

Your API keys are stored in the same SQLite database and **never** leave your machine (except when calling the AI API directly).

## 🔒 Privacy

- ✅ Fully local — no telemetry, no cloud sync
- ✅ API keys encrypted at rest in local SQLite
- ✅ AI requests sent directly from your machine to the API provider
- ✅ Export/Import gives you full data portability

## 📄 License

MIT

## Status
Currently in maintenance mode. The core architecture and v1 features are complete and tested. The project demonstrates a working pattern for local-first desktop apps with integrated AI assistance. Open to revisiting if new use cases emerge.

---

Built with ❤️ using Tauri + React + Rust
