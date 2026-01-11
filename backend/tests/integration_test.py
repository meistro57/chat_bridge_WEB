import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import MagicMock

# Apply the patch logic from launcher.py to ensure tests can run independently
WEB_ROOT = Path(__file__).parent.parent.parent.resolve()
CORE_DEP = Path("/home/mark/chat_bridge")
sys.path.insert(0, str(WEB_ROOT))
sys.path.insert(0, str(CORE_DEP))
sys.path.insert(0, str(WEB_ROOT / "backend"))

# Mock bridge_agents BEFORE importing main
mock_bridge = types.SimpleNamespace()
mock_bridge.create_agent = MagicMock()
mock_bridge.get_spec = MagicMock()
spec = types.SimpleNamespace(
    label="Mock Provider",
    description="Mock Provider Description",
    needs_key=False,
    key_env="MOCK_KEY",
    default_system="You are a mock.",
)
mock_bridge.get_spec.return_value = spec
mock_bridge.provider_choices = MagicMock(return_value=["openai", "anthropic"])
mock_bridge.ensure_credentials = MagicMock(return_value="sk-fake-key-1234567890")
mock_bridge.resolve_model = MagicMock(return_value="fake-model")

sys.modules["bridge_agents"] = mock_bridge

# Monkeypatch Starlette/FastAPI mismatch
import fastapi.applications  # noqa: E402, I001
from fastapi.middleware.asyncexitstack import AsyncExitStackMiddleware  # noqa: E402, I001
from starlette.middleware import Middleware  # noqa: E402, I001
from starlette.middleware.errors import ServerErrorMiddleware  # noqa: E402, I001
from starlette.middleware.exceptions import ExceptionMiddleware  # noqa: E402, I001


def fixed_build_middleware_stack(self):
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
            Middleware(ExceptionMiddleware, handlers=exception_handlers, debug=debug),
            Middleware(AsyncExitStackMiddleware),
        ]
    )

    app = self.router
    for m in reversed(middleware):
        if hasattr(m, "cls"):
            cls = m.cls
            options = getattr(m, "kwargs", None) or getattr(m, "options", None) or {}
        elif len(m) == 3:
            cls, options = m[0], m[2]
        else:
            cls, options = m
        app = cls(app=app, **options)
    return app


fastapi.applications.FastAPI.build_middleware_stack = fixed_build_middleware_stack

# Now import the app
from fastapi.testclient import TestClient  # noqa: E402, I001
from backend.main import app  # noqa: E402, I001


class BackendIntegrationTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        # Mock the roles.json file location for PersonaManager
        import backend.main as main

        self.temp_dir = tempfile.TemporaryDirectory()
        roles_path = Path(self.temp_dir.name) / "roles.json"
        roles_payload = {
            "persona_library": {
                "test_persona": {
                    "name": "Test Persona",
                    "provider": "openai",
                    "system": "Test prompt",
                    "temperature": 0.5,
                }
            }
        }
        roles_path.write_text(json.dumps(roles_payload), encoding="utf-8")
        main.persona_manager.roles_path = roles_path
        main.persona_manager.roles_mtime = None
        main.persona_manager.persona_library = main.persona_manager.load_personas_from_config()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_root_health(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["version"], "1.4.1")

    def test_get_providers(self):
        response = self.client.get("/api/providers")
        self.assertEqual(response.status_code, 200)
        self.assertIn("providers", response.json())
        self.assertEqual(response.json()["providers"][0]["label"], "Mock Provider")

    def test_get_personas(self):
        response = self.client.get("/api/personas")
        self.assertEqual(response.status_code, 200)
        personas = response.json()["personas"]
        self.assertTrue(any(p["id"] == "test_persona" for p in personas))

    def test_get_models(self):
        response = self.client.get("/api/models?provider=openai")
        self.assertEqual(response.status_code, 200)
        self.assertIn("models", response.json())
        self.assertTrue(len(response.json()["models"]) > 0)

    def test_create_conversation_with_keys(self):
        # Test that conversation creation accepts api_keys
        provider = "openai"
        key_val = "sk-test-key-1234567890"

        payload = {
            "provider_a": provider,
            "provider_b": "anthropic",
            "starter_message": "Hello",
            "max_rounds": 1,
            "api_keys": {provider: key_val},
        }

        # We need to mock bridge_agents.ensure_credentials to not fail or check the env
        response = self.client.post("/api/conversations", json=payload)
        self.assertEqual(response.status_code, 200)

        # Check if it was injected into os.environ (our mock behavior in main.py)
        from bridge_agents import get_spec

        spec = get_spec(provider)
        self.assertEqual(os.environ.get(spec.key_env), key_val)

    def test_get_guides(self):
        response = self.client.get("/api/guides")
        self.assertEqual(response.status_code, 200)
        self.assertIn("guides", response.json())
        self.assertTrue(len(response.json()["guides"]) > 0)

    def test_get_guide_content(self):
        # We assume getting-started exists if setup script ran
        response = self.client.get("/api/guides/getting-started")
        if response.status_code == 200:
            self.assertIn("content", response.json())
            self.assertEqual(response.json()["guide_id"], "getting-started")

    def test_create_conversation_uses_request_models(self):
        mock_bridge.resolve_model.reset_mock()
        mock_bridge.create_agent.reset_mock()
        original_side_effect = mock_bridge.resolve_model.side_effect
        original_return_value = mock_bridge.resolve_model.return_value

        def resolve_side_effect(provider, model=None):
            return model or f"{provider}-default"

        mock_bridge.resolve_model.side_effect = resolve_side_effect

        payload = {
            "provider_a": "openai",
            "provider_b": "anthropic",
            "model_a": "gpt-4o-mini",
            "model_b": "claude-3-5-sonnet-20241022",
            "starter_message": "Model check",
            "max_rounds": 1,
        }

        response = self.client.post("/api/conversations", json=payload)
        self.assertEqual(response.status_code, 200)

        conv_id = response.json()["conversation_id"]
        import backend.main as main

        conversation = main.conversations[conv_id]
        self.assertEqual(conversation.request.model_a, "gpt-4o-mini")
        self.assertEqual(conversation.request.model_b, "claude-3-5-sonnet-20241022")

        self.assertGreaterEqual(mock_bridge.create_agent.call_count, 2)
        agent_a_call = mock_bridge.create_agent.call_args_list[0].args
        agent_b_call = mock_bridge.create_agent.call_args_list[1].args
        self.assertEqual(agent_a_call[2], "gpt-4o-mini")
        self.assertEqual(agent_b_call[2], "claude-3-5-sonnet-20241022")

        mock_bridge.resolve_model.side_effect = original_side_effect
        mock_bridge.resolve_model.return_value = original_return_value


if __name__ == "__main__":
    unittest.main()
