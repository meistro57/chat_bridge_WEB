#!/bin/bash

# Configuration
PREFERRED_BACKEND_PORT=8000
PREFERRED_FRONTEND_PORT=5173
PYTHON_ENV="/home/mark/chat_bridge/venv/bin/python3"
CORE_DEP="/home/mark/chat_bridge"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Chat Bridge Web Development Auto-Start ===${NC}"

# Function to check if a port is in use (Host or Docker)
is_port_in_use() {
    local port=$1
    # Check host-level listening ports
    if ss -tuln | grep -q ":$port "; then
        return 0
    fi
    # Check docker container port mappings
    if docker ps --format "{{.Ports}}" | grep -q ":$port->"; then
        return 0
    fi
    return 1
}

# Function to find the next available port
find_free_port() {
    local port=$1
    while is_port_in_use $port; do
        port=$((port + 1))
    done
    echo $port
}

# Resolve Ports
BACKEND_PORT=$(find_free_port $PREFERRED_BACKEND_PORT)
FRONTEND_PORT=$(find_free_port $PREFERRED_FRONTEND_PORT)

if [ "$BACKEND_PORT" -ne "$PREFERRED_BACKEND_PORT" ]; then
    echo -e "${YELLOW}Notice: Port $PREFERRED_BACKEND_PORT in use. Using $BACKEND_PORT for Backend.${NC}"
fi

if [ "$FRONTEND_PORT" -ne "$PREFERRED_FRONTEND_PORT" ]; then
    echo -e "${YELLOW}Notice: Port $PREFERRED_FRONTEND_PORT in use. Using $FRONTEND_PORT for Frontend.${NC}"
fi

# Check for core dependencies
if [ ! -d "$CORE_DEP" ]; then
    echo -e "${RED}Error: Core dependency directory $CORE_DEP not found.${NC}"
    exit 1
fi

# Ensure roles.json exists in the root or copy from core
if [ ! -f "roles.json" ]; then
    if [ -f "$CORE_DEP/roles.json" ]; then
        cp "$CORE_DEP/roles.json" .
        echo -e "${GREEN}Copied roles.json from core.${NC}"
    else
        echo -e "${RED}Warning: roles.json not found in core. Using fallback.${NC}"
        echo '{"persona_library": {}}' > roles.json
    fi
fi

# Setup Environment
export PYTHONPATH=$(pwd):$(pwd)/backend:$CORE_DEP

# 1. Start Backend
echo -e "${BLUE}Starting Backend on port $BACKEND_PORT...${NC}"
# Use --port flag explicitly
$PYTHON_ENV launcher.py --port $BACKEND_PORT > backend.log 2>&1 &
BACKEND_PID=$!

# 2. Wait for Backend
echo -e "${BLUE}Waiting for Backend to respond...${NC}"
MAX_RETRIES=10
COUNT=0
while ! curl -s http://localhost:$BACKEND_PORT/ > /dev/null; do
    sleep 2
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Backend failed to start on $BACKEND_PORT. Check backend.log${NC}"
        # Show last errors from log
        tail -n 5 backend.log
        kill $BACKEND_PID 2>/dev/null
        exit 1
    fi
done
echo -e "${GREEN}Backend is UP!${NC}"

# 3. Start Frontend
echo -e "${BLUE}Starting Frontend on port $FRONTEND_PORT...${NC}"
cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install > ../frontend_install.log 2>&1
fi

# Vite picks up --port
npm run dev -- --host 0.0.0.0 --port $FRONTEND_PORT > ../frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

# 4. Wait for Frontend
echo -e "${BLUE}Waiting for Frontend to respond...${NC}"
COUNT=0
while ! curl -s http://localhost:$FRONTEND_PORT/ > /dev/null; do
    sleep 2
    COUNT=$((COUNT+1))
    if [ $COUNT -ge $MAX_RETRIES ]; then
        echo -e "${RED}Frontend failed to start on $FRONTEND_PORT. Check frontend.log${NC}"
        kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
        exit 1
    fi
done
echo -e "${GREEN}Frontend is UP!${NC}"

echo -e "${GREEN}=== System Successfully Started ===${NC}"
echo -e "${BLUE}Backend:  http://localhost:$BACKEND_PORT${NC}"
echo -e "${BLUE}Frontend: http://localhost:$FRONTEND_PORT${NC}"
echo ""
echo "Press Ctrl+C to stop both servers."

# Trap SIGINT to kill processes on exit
trap "kill $BACKEND_PID $FRONTEND_PID; echo -e '\n${BLUE}Servers stopped.${NC}'; exit" SIGINT

# Keep script running
wait
