# Agent Guide - Chat Bridge Web

This document provides essential information for AI agents working on the Chat Bridge Web codebase.

## Project Overview

Chat Bridge Web is a modern web interface for the Chat Bridge AI conversation platform. It features a retro-inspired UI and supports real-time streaming of conversations between multiple AI providers.

### Tech Stack

- **AI Engine**: FastAPI (Python 3.11+)
- **Platform Layer**: Laravel 10+ (PHP 8.2+)
- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS
- **Real-time**: WebSockets for live conversation streaming
- **Environment**: Custom orchestration with auto-port detection and version patching.

## Repository Structure

```text
chat_bridge_WEB/
├── backend/            # FastAPI AI Engine
├── laravel-backend/    # Laravel Platform (History, Auth, Persistence)
├── frontend/           # React application
├── dev_start.sh        # Orchestration script (Primary entry point)
├── launcher.py         # Monkeypatched backend runner
├── AGENTS.md           # This document
└── README.md           # General project documentation
```

## Essential Commands

### Automated Startup
The project uses `dev_start.sh` to manage backend/frontend lifecycles simultaneously.
- **Run**: `./dev_start.sh`
- **Features**: 
  - Finds free ports automatically (checking both Host and Docker).
  - Uses `launcher.py` to start the backend.
  - Automatically installs frontend dependencies if `node_modules` is missing.

### Manual Backend (from `backend/`)
- **Run**: `python3 ../launcher.py --port 8000` (Always use the launcher to avoid Starlette errors)
- **Tests**: `/home/mark/chat_bridge/venv/bin/python3 backend/tests/integration_test.py`

### Manual Frontend (from `frontend/`)
- **Run**: `npm run dev -- --port 5173`
- **Build**: `npm run build`

## Architecture & Integration

### Hybrid Architecture (Laravel + Python)
The system uses a hybrid approach where Laravel serves as the primary platform layer (persistence, auth, history) while delegating actual LLM interactions to the Python engine.
- **Frontend** talks to **Laravel** (Port 8001 typically).
- **Laravel** talks to **Python Backend** (Port 8000) via HTTP.
- **Python Backend** talks to **LLM Providers**.
- **WebSockets** are broadcast from Laravel.

### The Middleware Monkeypatch (`launcher.py`)
The environment has a version conflict: **FastAPI 0.104.1** + **Starlette 0.50.0**. Starlette 0.50 changed internal middleware representations from 2-tuples to 3-tuples, which crashes older FastAPI.
- **Solution**: `launcher.py` applies a surgical patch to `fastapi.applications.FastAPI.build_middleware_stack` to correctly unpack 3-tuple middleware.
- **Requirement**: Always use `launcher.py` to start the backend or run integration tests.

### Chat Bridge Core Dependency
The backend relies on the core `chat_bridge` logic in a sibling directory.
- **Path Setup**: Backend scripts dynamically add `../chat_bridge` to `sys.path`.
- **Key Files**: `bridge_agents.py` and `roles.json`.

### API Key Injection
The system supports on-the-fly API key configuration:
1. Frontend sends keys in the `POST /api/conversations` or `POST /api/provider-status` body.
2. Backend maps the provider key to the corresponding environment variable (e.g., `openai` -> `OPENAI_API_KEY`).
3. Backend injects these into `os.environ` *before* calling into the core bridge agents logic.

## Testing Patterns

### Integration Testing
- Existing suite: `backend/tests/integration_test.py`.
- Pattern: Mocks `bridge_agents` but runs full FastAPI request/response cycles through `TestClient`.
- Note: The test file itself implements the middleware patch to ensure it can run in the broken environment.

### Smoke Testing
- Script: `smoke_test.py`.
- Pattern: Checks specific dynamically assigned ports to ensure E2E connectivity.

## UI Styling (Retro Theme)
The frontend uses a custom retro theme inspired by classic Windows styling.
- Colors: `win-gray-100` through `win-gray-600`, `winamp-green`, `winamp-blue`.
- Components: Built with Tailwind utility classes + `clsx`.
- Icons: `lucide-react`.
