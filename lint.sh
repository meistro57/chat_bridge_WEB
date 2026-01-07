#!/bin/bash
# Combined linting script for Chat Bridge Web

RUFF="/home/mark/chat_bridge/venv/bin/ruff"
if [ ! -f "$RUFF" ]; then
    RUFF="ruff"
fi

echo "--- Backend Linting (Ruff) ---"
cd backend && $RUFF check . && $RUFF format --check .
BACKEND_EXIT=$?
cd ..

echo -e "\n--- Frontend Linting (ESLint) ---"
cd frontend && npm run lint
FRONTEND_EXIT=$?
cd ..

if [ $BACKEND_EXIT -eq 0 ] && [ $FRONTEND_EXIT -eq 0 ]; then
    echo -e "\n✅ All lint tests passed!"
    exit 0
else
    echo -e "\n❌ Some lint tests failed."
    exit 1
fi
