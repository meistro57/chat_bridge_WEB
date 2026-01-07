# Chat Bridge Web GUI - Retro Edition

Nostalgic retro web interface for the Chat Bridge AI conversation platform featuring classic beveled buttons, gray color schemes, and authentic retro computing aesthetic.

## 🚀 Quick Start

### Automated Development Startup (Recommended)

The easiest way to start both the backend and frontend with automatic port detection and version patching:

```bash
# From project root
chmod +x dev_start.sh
./dev_start.sh
```

- **Backend**: Usually `http://localhost:8000`
- **Frontend**: Usually `http://localhost:5173`
- **Port Swapping**: If ports are in use (including by Docker), the script automatically picks the next available ones.

### Docker Support

Build and run using the optimized Dockerfiles:

```bash
# Build Backend
docker build -t chat-bridge-backend -f backend/Dockerfile .

# Build Frontend
docker build -t chat-bridge-frontend -f frontend/Dockerfile .
```

## 🛠 Features

- ✅ **API Key GUI**: Configure your provider keys directly in the browser via the "Keys" modal.
- ✅ **Retro Design**: Classic beveled buttons, gray color schemes, and nostalgic aesthetic.
- ✅ **Real-time Streaming**: AI conversation streaming via WebSockets.
- ✅ **Smart Port Detection**: Automatically avoids port conflicts with host or Docker processes.
- ✅ **Compatibility Patch**: Includes a built-in launcher to resolve FastAPI/Starlette version mismatches.

## 📁 Project Structure

```text
chat_bridge_WEB/
├── backend/            # FastAPI application
│   ├── main.py         # API entry point
│   ├── requirements.txt
│   └── tests/          # Integration tests
├── frontend/           # React + Vite application
│   ├── src/            # App components and types
│   └── package.json
├── dev_start.sh        # Primary orchestration script
├── launcher.py         # Patched backend launcher
└── AGENTS.md           # Technical guide for AI agents
```

## 🧪 Testing

### Backend Integration Tests
Tests include automatic monkeypatching for the environment:
```bash
/home/mark/chat_bridge/venv/bin/python3 backend/tests/integration_test.py
```

### Full Stack Smoke Test
Verify the entire running environment:
```bash
/home/mark/chat_bridge/venv/bin/python3 smoke_test.py
```

## 🔐 API Configuration

You can set keys in a `.env` file in the root, or enter them directly in the Web UI by clicking the **🔑 Keys** button. Keys entered in the UI are:
- Stored only in memory for the session.
- Injected into the backend environment for conversation initialization.
- Validated in real-time with the status indicators.

## 🤝 Contributing

The web GUI is part of the Chat Bridge modernization effort. See `AGENTS.md` for detailed technical conventions and architecture details.
