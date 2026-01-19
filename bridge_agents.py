# bridge_agents.py
"""Provider registry and agent adapters for Chat Bridge."""

from __future__ import annotations

import asyncio
import os
from dataclasses import dataclass
from typing import Dict, List, Optional

import httpx
import google.generativeai as genai
from autogen import AssistantAgent


DEFAULT_SYSTEM_PROMPT = "You are a helpful assistant."


@dataclass(frozen=True)
class ProviderSpec:
    key: str
    label: str
    description: str
    needs_key: bool
    key_env: Optional[str]
    default_model: str
    default_system: str = DEFAULT_SYSTEM_PROMPT


PROVIDERS: Dict[str, ProviderSpec] = {
    "openai": ProviderSpec(
        key="openai",
        label="OpenAI",
        description="OpenAI Chat Completions (GPT models).",
        needs_key=True,
        key_env="OPENAI_API_KEY",
        default_model="gpt-4o-mini",
    ),
    "anthropic": ProviderSpec(
        key="anthropic",
        label="Anthropic",
        description="Anthropic Messages API (Claude models).",
        needs_key=True,
        key_env="ANTHROPIC_API_KEY",
        default_model="claude-3-5-sonnet-20241022",
    ),
    "gemini": ProviderSpec(
        key="gemini",
        label="Gemini",
        description="Google Generative AI (Gemini).",
        needs_key=True,
        key_env="GOOGLE_API_KEY",
        default_model="gemini-1.5-flash",
    ),
    "deepseek": ProviderSpec(
        key="deepseek",
        label="DeepSeek",
        description="DeepSeek OpenAI-compatible API.",
        needs_key=True,
        key_env="DEEPSEEK_API_KEY",
        default_model="deepseek-chat",
    ),
    "openrouter": ProviderSpec(
        key="openrouter",
        label="OpenRouter",
        description="OpenRouter OpenAI-compatible API.",
        needs_key=True,
        key_env="OPENROUTER_API_KEY",
        default_model="openai/gpt-4o-mini",
    ),
    "ollama": ProviderSpec(
        key="ollama",
        label="Ollama",
        description="Local Ollama server with OpenAI-compatible endpoint.",
        needs_key=False,
        key_env=None,
        default_model="llama3.2:3b",
    ),
    "lmstudio": ProviderSpec(
        key="lmstudio",
        label="LM Studio",
        description="Local LM Studio OpenAI-compatible endpoint.",
        needs_key=False,
        key_env=None,
        default_model="local-model",
    ),
    "autogen": ProviderSpec(
        key="autogen",
        label="AutoGen",
        description="Microsoft AutoGen agent framework (OpenAI-compatible).",
        needs_key=True,
        key_env="OPENAI_API_KEY",
        default_model="gpt-4o-mini",
    ),
}


def provider_choices() -> List[str]:
    """Return provider keys in a stable order."""
    return list(PROVIDERS.keys())


def get_spec(provider: str) -> ProviderSpec:
    """Lookup provider specification."""
    if provider not in PROVIDERS:
        raise KeyError(f"Unknown provider '{provider}'.")
    return PROVIDERS[provider]


def resolve_model(provider: str, model: Optional[str] = None) -> str:
    """Return the chosen model or the provider default."""
    if model and model.strip():
        return model.strip()
    return get_spec(provider).default_model


def ensure_credentials(provider: str) -> Optional[str]:
    """Validate required credentials for a provider."""
    spec = get_spec(provider)
    if not spec.needs_key:
        return None
    if not spec.key_env:
        raise RuntimeError(f"{spec.label} requires credentials but no env var is configured.")
    api_key = os.getenv(spec.key_env, "").strip()
    if not api_key:
        raise RuntimeError(f"Missing {spec.label} credentials. Set {spec.key_env}.")
    return api_key


class ChatAgent:
    """Base class for LLM-backed agents."""

    def __init__(self, name: str, model: str, temperature: float, system_prompt: str) -> None:
        self.name = name
        self.model = model
        self.temperature = temperature
        self.system_prompt = system_prompt

    async def generate_response(self, prompt: str, mem_rounds: int) -> str:
        raise NotImplementedError


class OpenAICompatibleAgent(ChatAgent):
    """Agent for OpenAI-compatible chat completion endpoints."""

    def __init__(
        self,
        name: str,
        model: str,
        temperature: float,
        system_prompt: str,
        base_url: str,
        api_key: Optional[str],
        extra_headers: Optional[Dict[str, str]] = None,
    ) -> None:
        super().__init__(name, model, temperature, system_prompt)
        self.base_url = base_url.rstrip("/")
        self.api_key = api_key
        self.extra_headers = extra_headers or {}

    async def generate_response(self, prompt: str, mem_rounds: int) -> str:
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt},
        ]
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        headers.update(self.extra_headers)

        payload = {
            "model": self.model,
            "messages": messages,
            "temperature": self.temperature,
        }

        timeout = httpx.Timeout(60.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self.base_url}/chat/completions",
                headers=headers,
                json=payload,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise RuntimeError(
                    f"OpenAI-compatible request failed ({response.status_code}): {response.text}"
                ) from exc

        data = response.json()
        choices = data.get("choices", [])
        if not choices:
            raise RuntimeError("Provider returned no completion choices.")
        message = choices[0].get("message") or {}
        content = message.get("content") or choices[0].get("text")
        if not content:
            raise RuntimeError("Provider response missing content.")
        return str(content).strip()


class AnthropicAgent(ChatAgent):
    """Agent for Anthropic Messages API."""

    def __init__(
        self,
        name: str,
        model: str,
        temperature: float,
        system_prompt: str,
        api_key: str,
    ) -> None:
        super().__init__(name, model, temperature, system_prompt)
        self.api_key = api_key

    async def generate_response(self, prompt: str, mem_rounds: int) -> str:
        headers = {
            "Content-Type": "application/json",
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
        }
        payload = {
            "model": self.model,
            "max_tokens": 1024,
            "temperature": self.temperature,
            "system": self.system_prompt,
            "messages": [{"role": "user", "content": prompt}],
        }
        timeout = httpx.Timeout(60.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers=headers,
                json=payload,
            )
            try:
                response.raise_for_status()
            except httpx.HTTPStatusError as exc:
                raise RuntimeError(
                    f"Anthropic request failed ({response.status_code}): {response.text}"
                ) from exc

        data = response.json()
        content_entries = data.get("content", [])
        if not content_entries:
            raise RuntimeError("Anthropic response missing content.")
        text_chunks = [entry.get("text", "") for entry in content_entries if entry.get("type") == "text"]
        combined = "".join(text_chunks).strip()
        if not combined:
            raise RuntimeError("Anthropic response content was empty.")
        return combined


class GeminiAgent(ChatAgent):
    """Agent for Google Generative AI Gemini models."""

    def __init__(
        self,
        name: str,
        model: str,
        temperature: float,
        system_prompt: str,
        api_key: str,
    ) -> None:
        super().__init__(name, model, temperature, system_prompt)
        self.api_key = api_key

    async def generate_response(self, prompt: str, mem_rounds: int) -> str:
        def _run_generation() -> str:
            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(
                model_name=self.model,
                system_instruction=self.system_prompt,
            )
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(temperature=self.temperature),
            )
            if not response.text:
                raise RuntimeError("Gemini response content was empty.")
            return response.text.strip()

        return await asyncio.to_thread(_run_generation)


class AutoGenAgent(ChatAgent):
    """Agent using Microsoft AutoGen with OpenAI-compatible configuration."""

    def __init__(
        self,
        name: str,
        model: str,
        temperature: float,
        system_prompt: str,
        api_key: str,
        base_url: Optional[str] = None,
    ) -> None:
        super().__init__(name, model, temperature, system_prompt)
        self.api_key = api_key
        self.base_url = base_url

    async def generate_response(self, prompt: str, mem_rounds: int) -> str:
        def _run_autogen() -> str:
            config: Dict[str, str] = {"model": self.model, "api_key": self.api_key}
            if self.base_url:
                config["base_url"] = self.base_url
            assistant = AssistantAgent(
                name=self.name,
                llm_config={"config_list": [config], "temperature": self.temperature},
                system_message=self.system_prompt,
            )
            reply = assistant.generate_reply(messages=[{"role": "user", "content": prompt}])
            if isinstance(reply, dict):
                content = reply.get("content")
            else:
                content = reply
            if not content:
                raise RuntimeError("AutoGen response was empty.")
            return str(content).strip()

        return await asyncio.to_thread(_run_autogen)


def _openai_base_url_from_env(default: str) -> str:
    return os.getenv("OPENAI_BASE_URL", default).rstrip("/")


def create_agent(
    name: str,
    provider: str,
    model: str,
    temperature: float,
    system_prompt: str,
) -> ChatAgent:
    """Factory for provider-backed agents."""
    provider_key = provider.lower()
    spec = get_spec(provider_key)
    model_name = resolve_model(provider_key, model)

    if provider_key == "autogen":
        api_key = ensure_credentials(provider_key)
        base_url = os.getenv("AUTOGEN_BASE_URL") or os.getenv("OPENAI_BASE_URL")
        return AutoGenAgent(name, model_name, temperature, system_prompt, api_key or "", base_url)

    if provider_key in {"openai", "openrouter", "deepseek"}:
        api_key = ensure_credentials(provider_key)
        base_url_map = {
            "openai": _openai_base_url_from_env("https://api.openai.com/v1"),
            "openrouter": "https://openrouter.ai/api/v1",
            "deepseek": "https://api.deepseek.com/v1",
        }
        return OpenAICompatibleAgent(
            name,
            model_name,
            temperature,
            system_prompt,
            base_url=base_url_map[provider_key],
            api_key=api_key,
        )

    if provider_key == "ollama":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
        return OpenAICompatibleAgent(
            name,
            model_name,
            temperature,
            system_prompt,
            base_url=base_url,
            api_key=None,
        )

    if provider_key == "lmstudio":
        base_url = os.getenv("LMSTUDIO_BASE_URL", "http://localhost:1234/v1")
        return OpenAICompatibleAgent(
            name,
            model_name,
            temperature,
            system_prompt,
            base_url=base_url,
            api_key=None,
        )

    if provider_key == "anthropic":
        api_key = ensure_credentials(provider_key)
        return AnthropicAgent(name, model_name, temperature, system_prompt, api_key or "")

    if provider_key == "gemini":
        api_key = ensure_credentials(provider_key)
        return GeminiAgent(name, model_name, temperature, system_prompt, api_key or "")

    raise ValueError(f"Unsupported provider '{provider}'.")


__all__ = [
    "ProviderSpec",
    "create_agent",
    "ensure_credentials",
    "get_spec",
    "provider_choices",
    "resolve_model",
]
