
import sys
import os
import uvicorn
import argparse
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Union

# Fix the PYTHONPATH
WEB_ROOT = Path(__file__).parent.resolve()
CORE_DEP = Path("/home/mark/chat_bridge")
sys.path.insert(0, str(WEB_ROOT))
sys.path.insert(0, str(CORE_DEP))
sys.path.insert(0, str(WEB_ROOT / "backend"))

# MONKEYPATCH: Starlette 0.50.0 / FastAPI 0.104.1 incompatibility
import fastapi.applications
from starlette.types import ASGIApp
from starlette.middleware import Middleware
from starlette.middleware.errors import ServerErrorMiddleware
from starlette.middleware.exceptions import ExceptionMiddleware
from fastapi.middleware.asyncexitstack import AsyncExitStackMiddleware

def fixed_build_middleware_stack(self) -> ASGIApp:
    debug = self.debug
    error_handler = None
    exception_handlers = {}

    for key, value in self.exception_handlers.items():
        if key in (500, Exception):
            error_handler = value
        else:
            exception_handlers[key] = value

    middleware = (
        [Middleware(ServerErrorMiddleware, handler=error_handler, debug=debug)]
        + self.user_middleware
        + [
            Middleware(
                ExceptionMiddleware, handlers=exception_handlers, debug=debug
            ),
            Middleware(AsyncExitStackMiddleware),
        ]
    )

    app = self.router
    for m in reversed(middleware):
        # FIX: Handle both 2-tuple and 3-tuple (or Middleware object)
        if hasattr(m, "cls"):
            cls, options = m.cls, m.kwargs
        elif len(m) == 3:
            cls, options = m[0], m[2]
        else:
            cls, options = m
        app = cls(app=app, **options)
    return app

# Overwrite the broken method
fastapi.applications.FastAPI.build_middleware_stack = fixed_build_middleware_stack

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    from backend.main import app
    print(f"🚀 Starting Patched Backend (v7) on port {args.port}...")
    uvicorn.run(app, host="0.0.0.0", port=args.port)
