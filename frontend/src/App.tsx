// App.tsx
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { Persona, PersonaDetail, Message, Model, Guide, GuideContent, ProviderOption } from './types';

interface BannerState {
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

interface ProviderStatusEntry {
  label?: string;
  connected?: boolean;
  error?: string;
}

type ProviderStatusMap = Record<string, ProviderStatusEntry>;

interface LlmTestEntry {
  prompt: string;
  model: string;
  status: 'idle' | 'running' | 'success' | 'error';
  response?: string;
  error?: string;
}

type ModalType = 'agentA' | 'agentB' | 'guides' | 'settings' | 'personas' | null;

type ConversationStatus = 'idle' | 'configuring' | 'running' | 'finished' | 'error';

const DEFAULT_PROVIDER_OPTIONS: ProviderOption[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'autogen', label: 'AutoGen' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'openrouter', label: 'OpenRouter' },
  { value: 'ollama', label: 'Ollama' },
  { value: 'lmstudio', label: 'LM Studio' },
];

const STATUS_COPY: Record<ConversationStatus, { label: string; description: string }> = {
  idle: {
    label: 'Waiting to begin',
    description: 'Select two personas, tune their providers, and compose a compelling opener.',
  },
  configuring: {
    label: 'Dialling in settings',
    description: 'Submitting your conversation blueprint to the bridge. One moment…',
  },
  running: {
    label: 'Agents live',
    description: 'Both agents are exchanging ideas in real-time. Enjoy the show!',
  },
  finished: {
    label: 'Conversation wrapped',
    description: 'The final turn has landed. Reset to orchestrate another encounter.',
  },
  error: {
    label: 'Connection interrupted',
    description: 'Something went awry. Review the notice below and try again.',
  },
};

const statusTone: Record<ConversationStatus, string> = {
  idle: 'bg-win-gray-300 text-win-gray-600 border-win-gray-400',
  configuring: 'bg-winamp-orange text-win-gray-600 border-win-gray-400',
  running: 'bg-winamp-green text-win-gray-600 border-win-gray-400',
  finished: 'bg-winamp-blue text-win-gray-600 border-win-gray-400',
  error: 'bg-winamp-red text-win-gray-600 border-win-gray-400',
};

const normalizeBaseUrl = (baseUrl: string) => baseUrl.replace(/\/$/, '');

const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL ?? '');
const wsBaseUrl = normalizeBaseUrl(import.meta.env.VITE_WS_BASE_URL ?? '');

const buildApiUrl = (path: string) => `${apiBaseUrl}${path}`;

const buildWsUrl = (path: string) => {
  const fallbackBase = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
  const base = wsBaseUrl || fallbackBase;
  return `${base}${path}`;
};

const Banner = ({ banner, onClose }: { banner: BannerState | null; onClose: () => void }) => {
  if (!banner) {
    return null;
  }

  const tone = {
    info: 'bg-blue-500/15 border-blue-400/40 text-blue-100',
    success: 'bg-emerald-500/15 border-emerald-400/40 text-emerald-100',
    warning: 'bg-amber-500/15 border-amber-400/40 text-amber-100',
    error: 'bg-rose-500/15 border-rose-400/40 text-rose-100',
  }[banner.type];

  return (
    <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${tone}`}>
      <span className="mt-0.5 text-base">{banner.type === 'error' ? '⚠️' : 'ℹ️'}</span>
      <div className="flex-1 leading-relaxed">{banner.message}</div>
      <button
        type="button"
        className="rounded-md border border-win-gray-400 px-2 py-1 text-xs uppercase tracking-wide text-win-gray-600 transition hover:text-win-gray-800 hover:border-win-gray-600"
        onClick={onClose}
      >
        Dismiss
      </button>
    </div>
  );
};

const PersonaSummary = ({ title, persona, onSelect }: { title: string; persona: Persona | null; onSelect: () => void }) => (
  <div className="space-y-2">
    <p className="text-xs uppercase tracking-wide text-win-gray-600">{title}</p>
    <button
      type="button"
      onClick={onSelect}
      className={`group w-full rounded-lg border border-win-gray-400 bg-win-gray-100 p-4 text-left transition hover:border-win-gray-600 hover:bg-win-gray-200 ${
        persona ? 'shadow-inner shadow-win-gray-500' : 'border-dashed'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-win-gray-800">
            {persona ? persona.name : 'Choose a persona'}
          </p>
          <p className="mt-1 text-sm text-win-gray-600">
            {persona?.description ?? 'Open the library to assign a persona to this agent.'}
          </p>
        </div>
        <span className="rounded-full border border-win-gray-400 px-3 py-1 text-xs text-win-gray-600 transition group-hover:border-win-gray-600 group-hover:text-win-gray-800">
          Configure
        </span>
      </div>
      {persona?.system_preview && (
        <p className="mt-3 line-clamp-2 text-xs text-win-gray-500">
          {persona.system_preview}
        </p>
      )}
    </button>
  </div>
);

const StatusBadge = ({ status }: { status: ConversationStatus }) => (
  <div className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide ${statusTone[status]}`}>
    <span className="inline-block h-2.5 w-2.5 rounded-full bg-current shadow-lg" />
    {STATUS_COPY[status].label}
  </div>
);

const ProviderStatusIndicator = ({ providerStatus, isLoading }: { providerStatus: ProviderStatusMap; isLoading: boolean }) => (
  <div className="mb-6 rounded-lg border border-win-gray-400 bg-win-gray-200 p-4 shadow-inner shadow-win-gray-500">
    <h3 className="text-sm font-semibold text-win-gray-800 mb-3">Provider Status</h3>
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
      {Object.entries(providerStatus).map(([key, status]: [string, ProviderStatusEntry]) => (
        <div key={key} className="flex flex-col items-center gap-1">
          <div className="text-xs text-win-gray-600 uppercase tracking-wide">{status?.label || key}</div>
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="w-2.5 h-2.5 rounded-full bg-win-gray-400 animate-pulse" />
            ) : (
              <div className={`w-2.5 h-2.5 rounded-full ${status?.connected ? 'bg-winamp-green' : 'bg-winamp-red'}`} />
            )}
            <span className="text-xs text-win-gray-700">
              {isLoading ? 'Checking' : (status?.connected ? 'Connected' : 'Needs Auth')}
            </span>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-3 text-xs text-win-gray-500 text-center">
      {isLoading ? 'Checking provider connectivity...' : 'Display shows which providers have valid API keys configured.'}
    </div>
  </div>
);

const MetricsPanel = ({
  totalTokens,
  avgResponseTime,
  messageCount,
  conversationStatus
}: {
  totalTokens: number;
  avgResponseTime: number;
  messageCount: number;
  conversationStatus: ConversationStatus;
}) => {
  if (messageCount === 0 || conversationStatus === 'idle') {
    return null;
  }

  return (
    <div className="mb-4 rounded-lg border border-win-gray-400 bg-gradient-to-r from-winamp-teal/10 to-winamp-blue/10 p-3 shadow-inner shadow-win-gray-300">
      <h3 className="text-xs font-semibold text-win-gray-800 mb-2 uppercase tracking-wide">📊 Session Metrics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="flex flex-col items-center gap-1 rounded bg-white/50 px-3 py-2 border border-win-gray-300">
          <span className="text-xs text-win-gray-600 uppercase tracking-wide">Messages</span>
          <span className="text-lg font-bold text-winamp-blue">{messageCount}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded bg-white/50 px-3 py-2 border border-win-gray-300">
          <span className="text-xs text-win-gray-600 uppercase tracking-wide">Total Tokens</span>
          <span className="text-lg font-bold text-winamp-teal">{totalTokens.toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded bg-white/50 px-3 py-2 border border-win-gray-300">
          <span className="text-xs text-win-gray-600 uppercase tracking-wide">Avg Response</span>
          <span className="text-lg font-bold text-winamp-purple">{avgResponseTime.toFixed(2)}s</span>
        </div>
        <div className="flex flex-col items-center gap-1 rounded bg-white/50 px-3 py-2 border border-win-gray-300">
          <span className="text-xs text-win-gray-600 uppercase tracking-wide">Est. Cost</span>
          <span className="text-lg font-bold text-winamp-green">${(totalTokens * 0.00001).toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
};

const formatTimestamp = (timestamp: string) => {
  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.error('Unable to format timestamp', error);
    return timestamp;
  }
};

const RetroChatBridge = () => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(true);
  const [selectedPersonaA, setSelectedPersonaA] = useState<Persona | null>(null);
  const [selectedPersonaB, setSelectedPersonaB] = useState<Persona | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [providerOptions, setProviderOptions] = useState<ProviderOption[]>(DEFAULT_PROVIDER_OPTIONS);
  const [selectedProviderA, setSelectedProviderA] = useState(DEFAULT_PROVIDER_OPTIONS[0]?.value ?? 'openai');
  const [selectedProviderB, setSelectedProviderB] = useState(DEFAULT_PROVIDER_OPTIONS[1]?.value ?? 'anthropic');
  const [selectedModelA, setSelectedModelA] = useState<string>('');
  const [selectedModelB, setSelectedModelB] = useState<string>('');
  const [modelsA, setModelsA] = useState<Model[]>([]);
  const [modelsB, setModelsB] = useState<Model[]>([]);
  const [isLoadingModelsA, setIsLoadingModelsA] = useState(false);
  const [isLoadingModelsB, setIsLoadingModelsB] = useState(false);
  const [personaModels, setPersonaModels] = useState<Model[]>([]);
  const [isLoadingPersonaModels, setIsLoadingPersonaModels] = useState(false);
  const [maxRounds, setMaxRounds] = useState(24);
  const [temperatureA, setTemperatureA] = useState(0.7);
  const [temperatureB, setTemperatureB] = useState(0.7);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<ModalType>(null);
  const [personaSearchTerm, setPersonaSearchTerm] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationStatus, setConversationStatus] = useState<ConversationStatus>('idle');
  const [banner, setBanner] = useState<BannerState | null>(null);

  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [persistKeys, setPersistKeys] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);
  const [llmTests, setLlmTests] = useState<Record<string, LlmTestEntry>>({});
  const [personaManagerEntries, setPersonaManagerEntries] = useState<PersonaDetail[]>([]);
  const [isLoadingPersonaManager, setIsLoadingPersonaManager] = useState(false);
  const [activePersonaId, setActivePersonaId] = useState<string | null>(null);
  const [personaForm, setPersonaForm] = useState<PersonaDetail>({
    id: '',
    name: '',
    provider: DEFAULT_PROVIDER_OPTIONS[0]?.value ?? 'openai',
    system_prompt: '',
    temperature: 0.7,
    model: null,
    guidelines: [],
    notes: null,
  });

  // Enhanced UX state variables
  const autoScroll = true;
  const [isTyping, setIsTyping] = useState(false);

  // iFrame and metrics state
  const [isEmbedded, setIsEmbedded] = useState(false);
  const [compactMode, setCompactMode] = useState(false);
  const [totalTokens, setTotalTokens] = useState(0);
  const [avgResponseTime, setAvgResponseTime] = useState(0);


  // Guides state
  const [guides, setGuides] = useState<Guide[]>([]);
  const [selectedGuide, setSelectedGuide] = useState<GuideContent | null>(null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const startTypingSequence = () => {
    setIsTyping(true);
  };

  const stopTyping = () => {
    setIsTyping(false);
  };

  const [providerStatus, setProviderStatus] = useState<ProviderStatusMap>({});
  const [isLoadingProviderStatus, setIsLoadingProviderStatus] = useState(true);
  const conversationStatusRef = useRef(conversationStatus);

  const fetchProviders = useCallback(async () => {
    try {
      const response = await fetch(buildApiUrl('/api/providers'));
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = await response.json();
      const options = (data.providers ?? [])
        .map((provider: { key?: string; label?: string; description?: string }) => ({
          value: provider.key ?? '',
          label: provider.label ?? provider.key ?? 'Unknown',
          description: provider.description,
        }))
        .filter((provider: ProviderOption) => provider.value);
      if (options.length === 0) {
        throw new Error('No providers returned by the API.');
      }
      setProviderOptions(options);
    } catch (error) {
      console.error('Failed to fetch providers:', error);
      setProviderOptions(DEFAULT_PROVIDER_OPTIONS);
      setBanner({
        type: 'warning',
        message: 'Provider list unavailable. Falling back to the default set.',
      });
    }
  }, []);

  const personaModelOptions = useMemo(() => {
    const options = [...personaModels];
    if (personaForm.model && !personaModels.some((model) => model.id === personaForm.model)) {
      options.push({ id: personaForm.model, name: `${personaForm.model} (custom)` });
    }
    return options;
  }, [personaForm.model, personaModels]);

  const fetchProviderStatus = useCallback(async () => {
    setIsLoadingProviderStatus(true);
    try {
      const response = await fetch(buildApiUrl('/api/provider-status'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_keys: apiKeys }),
      });
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = await response.json();
      setProviderStatus((data.providers ?? {}) as ProviderStatusMap);
    } catch (error) {
      console.error('Failed to fetch provider status:', error);
      // Set all providers to disconnected on error
      const disconnectedStatus: ProviderStatusMap = {};
      providerOptions.forEach((option) => {
        disconnectedStatus[option.value] = { connected: false, label: option.label, error: 'Status check failed' };
      });
      setProviderStatus(disconnectedStatus);
    } finally {
      setIsLoadingProviderStatus(false);
    }
  }, [apiKeys, providerOptions]);

  const persistApiKeys = useCallback(async (): Promise<boolean> => {
    const hasKeys = Object.values(apiKeys).some((key) => key.trim().length > 0);
    if (!hasKeys) {
      setBanner({ type: 'warning', message: 'Add at least one API key before saving.' });
      return false;
    }
    setIsSavingKeys(true);
    try {
      const response = await fetch(buildApiUrl('/api/api-keys/persist'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_keys: apiKeys }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail ?? 'Failed to persist API keys');
      }
      setBanner({ type: 'success', message: 'API keys saved to .env for future sessions.' });
      return true;
    } catch (error) {
      console.error('Failed to persist API keys:', error);
      setBanner({ type: 'error', message: 'Unable to save API keys.' });
      return false;
    } finally {
      setIsSavingKeys(false);
    }
  }, [apiKeys]);

  const fetchGuides = async () => {
    try {
      const response = await fetch(buildApiUrl('/api/guides'));
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = await response.json();
      setGuides(data.guides ?? []);
    } catch (error) {
      console.error('Failed to fetch guides:', error);
      setBanner({ type: 'error', message: 'Failed to load guides list' });
    }
  };

  const fetchGuideContent = async (guideId: string) => {
    setIsLoadingGuide(true);
    try {
      const response = await fetch(buildApiUrl(`/api/guides/${guideId}`));
      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }
      const data = await response.json();
      setSelectedGuide(data);
    } catch (error) {
      console.error('Failed to fetch guide content:', error);
      setBanner({ type: 'error', message: 'Failed to load guide content' });
    } finally {
      setIsLoadingGuide(false);
    }
  };

  const fetchPersonas = useCallback(async () => {
    setIsLoadingPersonas(true);
    try {
      const response = await fetch(buildApiUrl('/api/personas'));
      if (!response.ok) {
        throw new Error(`Failed to fetch personas: ${response.status}`);
      }
      const data = await response.json();
      setPersonas(data.personas ?? []);
    } catch (error) {
      console.error('Failed to fetch personas:', error);
      setPersonas([]);
    } finally {
      setIsLoadingPersonas(false);
    }
  }, []);

  const fetchPersonaManager = useCallback(async () => {
    setIsLoadingPersonaManager(true);
    try {
      const response = await fetch(buildApiUrl('/api/persona-manager'));
      if (!response.ok) {
        throw new Error(`Failed to fetch persona manager: ${response.status}`);
      }
      const data = await response.json();
      setPersonaManagerEntries(data.personas ?? []);
    } catch (error) {
      console.error('Failed to fetch persona manager:', error);
      setPersonaManagerEntries([]);
      setBanner({ type: 'error', message: 'Failed to load persona manager' });
    } finally {
      setIsLoadingPersonaManager(false);
    }
  }, []);

  const resetPersonaForm = useCallback(() => {
    setActivePersonaId(null);
    setPersonaForm({
      id: '',
      name: '',
      provider: DEFAULT_PROVIDER_OPTIONS[0]?.value ?? 'openai',
      system_prompt: '',
      temperature: 0.7,
      model: null,
      guidelines: [],
      notes: null,
    });
  }, []);

  const selectPersonaForEdit = useCallback((persona: PersonaDetail) => {
    setActivePersonaId(persona.id);
    setPersonaForm({
      ...persona,
      model: persona.model ?? null,
      notes: persona.notes ?? null,
      temperature: persona.temperature ?? 0.7,
    });
  }, []);

  const savePersona = useCallback(async () => {
    const trimmedId = activePersonaId ?? personaForm.id.trim();
    if (!trimmedId) {
      setBanner({ type: 'warning', message: 'Persona ID is required.' });
      return;
    }

    const payload: PersonaDetail = {
      ...personaForm,
      id: trimmedId,
      name: personaForm.name.trim() || trimmedId,
      model: personaForm.model?.trim() ? personaForm.model : null,
      temperature: personaForm.temperature ?? 0.7,
      guidelines: personaForm.guidelines.filter((line) => line.trim().length > 0),
      notes: personaForm.notes?.trim() ? personaForm.notes : null,
    };

    const isEditing = Boolean(activePersonaId);
    const url = isEditing
      ? buildApiUrl(`/api/persona-manager/${activePersonaId}`)
      : buildApiUrl('/api/persona-manager');
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail ?? 'Failed to save persona');
      }
      await fetchPersonaManager();
      await fetchPersonas();
      setBanner({ type: 'success', message: `Persona ${isEditing ? 'updated' : 'created'} successfully.` });
      if (!isEditing) {
        resetPersonaForm();
      }
    } catch (error) {
      console.error('Failed to save persona:', error);
      setBanner({ type: 'error', message: 'Failed to save persona.' });
    }
  }, [activePersonaId, fetchPersonaManager, fetchPersonas, personaForm, resetPersonaForm]);

  const deletePersona = useCallback(async () => {
    if (!activePersonaId) {
      setBanner({ type: 'warning', message: 'Select a persona to delete.' });
      return;
    }
    try {
      const response = await fetch(buildApiUrl(`/api/persona-manager/${activePersonaId}`), { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail ?? 'Failed to delete persona');
      }
      await fetchPersonaManager();
      await fetchPersonas();
      resetPersonaForm();
      setBanner({ type: 'success', message: 'Persona deleted.' });
    } catch (error) {
      console.error('Failed to delete persona:', error);
      setBanner({ type: 'error', message: 'Failed to delete persona.' });
    }
  }, [activePersonaId, fetchPersonaManager, fetchPersonas, resetPersonaForm]);

  const fetchModels = async (provider: string, isAgentA: boolean) => {
    if (isAgentA) {
      setIsLoadingModelsA(true);
    } else {
      setIsLoadingModelsB(true);
    }
    try {
      const response = await fetch(buildApiUrl(`/api/models?provider=${provider}`));
      if (!response.ok) {
        throw new Error(`Failed to fetch models for ${provider}`);
      }
      const data = await response.json();
      const models = data.models ?? [];
      if (isAgentA) {
        setModelsA(models);
        if (models.length > 0) {
          setSelectedModelA(models[0].id);
        }
      } else {
        setModelsB(models);
        if (models.length > 0) {
          setSelectedModelB(models[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      if (isAgentA) {
        setIsLoadingModelsA(false);
      } else {
        setIsLoadingModelsB(false);
      }
    }
  };

  const fetchPersonaModels = useCallback(async (provider: string) => {
    setIsLoadingPersonaModels(true);
    try {
      const response = await fetch(buildApiUrl(`/api/models?provider=${provider}`));
      if (!response.ok) {
        throw new Error(`Failed to fetch models for ${provider}`);
      }
      const data = await response.json();
      setPersonaModels(data.models ?? []);
    } catch (error) {
      console.error('Failed to fetch persona models:', error);
      setPersonaModels([]);
    } finally {
      setIsLoadingPersonaModels(false);
    }
  }, []);

  useEffect(() => {
    fetchModels(selectedProviderA, true);
  }, [selectedProviderA]);

  useEffect(() => {
    fetchModels(selectedProviderB, false);
  }, [selectedProviderB]);

  useEffect(() => {
    fetchPersonaModels(personaForm.provider);
  }, [fetchPersonaModels, personaForm.provider]);

  useEffect(() => {
    if (providerOptions.length === 0) {
      return;
    }
    setSelectedProviderA((prev) =>
      providerOptions.some((option) => option.value === prev)
        ? prev
        : providerOptions[0]?.value ?? prev,
    );
    setSelectedProviderB((prev) =>
      providerOptions.some((option) => option.value === prev)
        ? prev
        : providerOptions[1]?.value ?? providerOptions[0]?.value ?? prev,
    );
    setPersonaForm((prev) => ({
      ...prev,
      provider: providerOptions.some((option) => option.value === prev.provider)
        ? prev.provider
        : providerOptions[0]?.value ?? prev.provider,
    }));
  }, [providerOptions]);

  useEffect(() => {
    setLlmTests((prev) => {
      const next: Record<string, LlmTestEntry> = { ...prev };
      providerOptions.forEach((option) => {
        if (!next[option.value]) {
          next[option.value] = {
            prompt: `Say hello from ${option.label}.`,
            model: '',
            status: 'idle',
          };
        }
      });
      Object.keys(next).forEach((provider) => {
        if (!providerOptions.some((option) => option.value === provider)) {
          delete next[provider];
        }
      });
      return next;
    });
  }, [providerOptions]);

  const updateLlmTestEntry = (providerKey: string, updates: Partial<LlmTestEntry>) => {
    setLlmTests((prev) => ({
      ...prev,
      [providerKey]: {
        ...prev[providerKey],
        ...updates,
      },
    }));
  };

  const runLlmTest = async (providerKey: string) => {
    const entry = llmTests[providerKey];
    if (!entry?.prompt?.trim()) {
      setBanner({ type: 'warning', message: 'Add a prompt before testing the provider.' });
      return;
    }

    updateLlmTestEntry(providerKey, { status: 'running', error: undefined, response: undefined });

    try {
      const response = await fetch(buildApiUrl('/api/llm-test'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: providerKey,
          prompt: entry.prompt,
          model: entry.model?.trim() ? entry.model.trim() : null,
          api_keys: apiKeys,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail ?? `Provider test failed (${response.status}).`);
      }

      const data = await response.json();
      updateLlmTestEntry(providerKey, {
        status: 'success',
        response: data.response ?? 'No response payload returned.',
      });
    } catch (error) {
      updateLlmTestEntry(providerKey, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to run provider test.',
      });
    }
  };

  useEffect(() => {
    if (!conversationId) {
      return undefined;
    }

    const ws = new WebSocket(buildWsUrl(`/ws/conversations/${conversationId}`));
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConversationStatus('running');
      setBanner({ type: 'success', message: 'Connected! Agents are now conversing in real-time.' });
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Received message:', data);

        if (data.type === 'message_start') {
          // Enhanced typing indicator start
          startTypingSequence();
          setConversationStatus('running');
          setBanner(null);

        } else if (data.type === 'message' && data.data) {
          stopTyping(); // Stop typing indicator when message arrives
          setMessages((prevMessages) => {
            const isDuplicate = prevMessages.some(
              (message) => message.sender === data.data.sender && message.content === data.data.content,
            );
            if (isDuplicate) {
              return prevMessages;
            }

            const newMessages = [...prevMessages, {
              content: data.data.content,
              sender: data.data.sender,
              timestamp: data.data.timestamp || new Date().toISOString(),
              persona: data.data.persona,
            }];

            // Smart auto-scroll logic
            if (autoScroll) {
              setTimeout(() => {
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }, 100);
            }

            return newMessages;
          });

        } else if (data.type === 'message_end') {
          stopTyping();
          setConversationStatus('running');
          startTypingSequence(); // Start next agent

        } else if (data.type === 'complete') {
          stopTyping();
          setConversationStatus('finished');
          setBanner({ type: 'success', message: 'Conversation completed successfully!' });
        } else if (data.type === 'error') {
          stopTyping();
          setConversationStatus('error');
          setBanner({ type: 'error', message: data.message || 'An error occurred during the conversation.' });
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setIsTyping(false);
      setConversationStatus('error');
      setBanner({ type: 'error', message: 'WebSocket connection error. Check that the backend is running.' });
    };

    ws.onclose = () => {
      console.log('WebSocket closed');
      setIsTyping(false);
      if (conversationStatusRef.current === 'running') {
        setConversationStatus('finished');
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [autoScroll, conversationId]);

  useEffect(() => {
    conversationStatusRef.current = conversationStatus;
  }, [conversationStatus]);

  useEffect(() => {
    messagesEndRef?.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Detect iFrame embedding and set up postMessage communication
  useEffect(() => {
    const embedded = window.self !== window.top;
    setIsEmbedded(embedded);

    // Listen for messages from parent
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'setCompactMode') {
        setCompactMode(event.data.value);
      }
    };

    window.addEventListener('message', handleMessage);

    // Notify parent that we're ready
    if (embedded) {
      window.parent.postMessage({ type: 'chatBridgeReady' }, '*');
    }

    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Calculate aggregate metrics when messages change
  useEffect(() => {
    const messagesWithTokens = messages.filter(msg => msg.tokens !== undefined);
    const messagesWithTime = messages.filter(msg => msg.response_time !== undefined);

    const tokens = messagesWithTokens.reduce((sum, msg) => sum + (msg.tokens || 0), 0);
    const avgTime = messagesWithTime.length > 0
      ? messagesWithTime.reduce((sum, msg) => sum + (msg.response_time || 0), 0) / messagesWithTime.length
      : 0;

    setTotalTokens(tokens);
    setAvgResponseTime(avgTime);

    // Send metrics to parent if embedded
    if (isEmbedded) {
      window.parent.postMessage({
        type: 'metricsUpdate',
        data: {
          totalTokens: tokens,
          avgResponseTime: avgTime,
          messageCount: messages.length,
          conversationStatus,
        },
      }, '*');
    }
  }, [messages, isEmbedded, conversationStatus]);

  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    if (modalType === 'settings') {
      fetchProviderStatus();
    }
    setModalType(null);
    setPersonaSearchTerm('');
    setSelectedGuide(null);
    resetPersonaForm();
  }, [fetchProviderStatus, modalType, resetPersonaForm]);

  useEffect(() => {
    fetchProviders();
    fetchProviderStatus();
    fetchGuides();
    fetchPersonas();
  }, [fetchPersonas, fetchProviderStatus, fetchProviders]);

  useEffect(() => {
    if (!isModalOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeModal();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeModal, isModalOpen]);

  useEffect(() => {
    if (isModalOpen && modalType === 'personas') {
      fetchPersonaManager();
    }
  }, [fetchPersonaManager, isModalOpen, modalType]);

  const filteredPersonas = useMemo(() => {
    if (!personaSearchTerm.trim()) {
      return personas;
    }
    const search = personaSearchTerm.toLowerCase();
    return personas.filter((persona) =>
      [persona.name, persona.description, persona.system_preview]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(search)),
    );
  }, [personaSearchTerm, personas]);

  const canStartConversation =
    !!selectedPersonaA &&
    !!selectedPersonaB &&
    Boolean(inputMessage.trim()) &&
    conversationStatus !== 'configuring' &&
    conversationStatus !== 'running';

  const startConversation = async () => {
    if (!canStartConversation) {
      setBanner({ type: 'warning', message: 'Assign both personas and craft an opener before starting the session.' });
      return;
    }

    try {
      setConversationStatus('configuring');
      setBanner({ type: 'info', message: 'Setting up the bridge. Your agents will begin shortly.' });

      const response = await fetch(buildApiUrl('/api/conversations'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_a: selectedProviderA,
          provider_b: selectedProviderB,
          persona_a: selectedPersonaA?.id,
          persona_b: selectedPersonaB?.id,
          starter_message: inputMessage,
          max_rounds: maxRounds,
          temperature_a: temperatureA,
          temperature_b: temperatureB,
          model_a: selectedModelA,
          model_b: selectedModelB,
          api_keys: apiKeys,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail ?? 'Unexpected error returned by the server.');
      }

      const data = await response.json();
      setMessages([
        {
          content: inputMessage,
          sender: 'user',
          timestamp: new Date().toISOString(),
          persona: null,
        },
      ]);
      setConversationId(data.conversation_id);
      setIsTyping(true);
    } catch (error) {
      console.error('Failed to start conversation:', error);
      setConversationStatus('error');
      setBanner({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to connect to server. Ensure the backend is running.',
      });
    }
  };

  const openModal = (type: Exclude<ModalType, null>) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const selectPersona = (persona: Persona) => {
    if (modalType === 'agentA') {
      setSelectedPersonaA(persona);
    }
    if (modalType === 'agentB') {
      setSelectedPersonaB(persona);
    }
    closeModal();
  };

  const resetConversation = () => {
    wsRef.current?.close();
    wsRef.current = null;
    setConversationId(null);
    setMessages([]);
    setIsTyping(false);
    setConversationStatus('idle');
    setBanner({ type: 'info', message: 'Conversation reset. Adjust the settings and launch another exchange.' });
  };

  const renderProviderModelSelect = (
    label: string,
    provider: string,
    model: string,
    onProviderChange: (next: string) => void,
    onModelChange: (next: string) => void,
    models: Model[],
    isLoading: boolean,
  ) => (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-2 text-sm text-win-gray-600">
        <span className="text-xs uppercase tracking-wide text-win-gray-600">{label} Provider</span>
        <select
          value={provider}
          onChange={(event) => onProviderChange(event.target.value)}
          className="rounded-lg border border-win-gray-400 bg-win-gray-100 px-3 py-2 text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
        >
          {providerOptions.map((option) => (
            <option key={option.value} value={option.value} className="bg-win-gray-100 text-win-gray-800">
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-sm text-win-gray-600">
        <span className="text-xs uppercase tracking-wide text-win-gray-600">{label} Model</span>
        <select
          value={model}
          onChange={(event) => onModelChange(event.target.value)}
          disabled={isLoading || models.length === 0}
          className="rounded-lg border border-win-gray-400 bg-win-gray-100 px-3 py-2 text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none disabled:opacity-50"
        >
          {isLoading ? (
            <option>Loading models...</option>
          ) : models.length === 0 ? (
            <option>No models available</option>
          ) : (
            models.map((m) => (
              <option key={m.id} value={m.id} className="bg-win-gray-100 text-win-gray-800">
                {m.name}
              </option>
            ))
          )}
        </select>
      </label>
    </div>
  );

  return (
    <div className={`min-h-screen bg-win-gray-100 font-sans ${compactMode ? 'compact-mode' : ''}`}>
      {/* Retro frame */}
      <div className={`mx-auto flex min-h-screen w-full flex-col gap-8 ${compactMode ? 'max-w-full px-2 py-2' : 'max-w-6xl px-4 py-10'}`}>
        {/* Title bar */}
        <header className={`flex flex-col gap-4 border-b-2 border-win-gray-400 bg-win-gray-300 px-4 shadow-md ${compactMode ? 'py-1' : 'py-2'}`}>
          <div className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <span role="img" aria-label="spark" className="text-xl">🎵</span>
              <h1 className="text-xl font-bold text-win-gray-800">Chat Bridge Studio</h1>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {!compactMode && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setModalType('guides');
                      setIsModalOpen(true);
                      setSelectedGuide(null);
                    }}
                    className="rounded-lg border-2 border-win-gray-400 bg-win-gray-200 px-4 py-2 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:border-win-gray-600 hover:bg-win-gray-300"
                    title="View guides and documentation"
                  >
                    📚 Help
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal('settings')}
                    className="rounded-lg border-2 border-win-gray-400 bg-win-gray-200 px-4 py-2 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:border-win-gray-600 hover:bg-win-gray-300"
                    title="Configure API Keys"
                  >
                    🔑 Keys
                  </button>
                  <button
                    type="button"
                    onClick={() => openModal('personas')}
                    className="rounded-lg border-2 border-win-gray-400 bg-win-gray-200 px-4 py-2 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:border-win-gray-600 hover:bg-win-gray-300"
                    title="Manage personas in roles.json"
                  >
                    🎭 Personas
                  </button>
                </>
              )}
              {isEmbedded && (
                <button
                  type="button"
                  onClick={() => setCompactMode(!compactMode)}
                  className="rounded-lg border-2 border-win-gray-400 bg-win-gray-200 px-3 py-1 text-xs font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:border-win-gray-600 hover:bg-win-gray-300"
                  title={compactMode ? 'Expand view' : 'Compact view'}
                >
                  {compactMode ? '🔲 Expand' : '📐 Compact'}
                </button>
              )}
              {conversationId && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const response = await fetch(buildApiUrl(`/api/conversations/${conversationId}/transcript`));
                      if (!response.ok) {
                        throw new Error(`Server responded with ${response.status}`);
                      }
                      const data = await response.json();

                      // Create a blob and download
                      const blob = new Blob([data.transcript], { type: 'text/markdown' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = data.filename;
                      document.body.appendChild(a);
                      a.click();
                      document.body.removeChild(a);
                      URL.revokeObjectURL(url);

                      setBanner({ type: 'success', message: `Transcript downloaded as ${data.filename}` });
                    } catch (error) {
                      console.error('Failed to download transcript:', error);
                      setBanner({ type: 'error', message: 'Failed to download transcript' });
                    }
                  }}
                  className="rounded-lg border-2 border-win-gray-400 bg-win-gray-200 px-4 py-2 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:border-win-gray-600 hover:bg-win-gray-300"
                >
                  📄 Transcript
                </button>
              )}
              <StatusBadge status={conversationStatus} />
            </div>
          </div>
          <p className="text-sm text-win-gray-600">{STATUS_COPY[conversationStatus].description}</p>
        </header>

        {!compactMode && (
          <ProviderStatusIndicator
            providerStatus={providerStatus}
            isLoading={isLoadingProviderStatus}
          />
        )}

        <MetricsPanel
          totalTokens={totalTokens}
          avgResponseTime={avgResponseTime}
          messageCount={messages.length}
          conversationStatus={conversationStatus}
        />

        {!compactMode && (
          <div className="rounded-lg border-2 border-win-gray-400 bg-win-gray-200 p-4 shadow-inner shadow-win-gray-500">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-win-gray-800">LLM test bench</h3>
              <p className="text-sm text-win-gray-600">
                Verify each provider with a quick prompt. Results stream back from the backend using your configured keys.
              </p>
            </div>
            <div className="text-xs text-win-gray-500">
              Tip: use the Keys modal to store credentials first.
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {providerOptions.map((provider) => {
              const entry = llmTests[provider.value];
              const status = providerStatus[provider.value];
              const statusLabel = status?.connected ? 'Connected' : 'Needs auth';
              const statusTone = status?.connected ? 'text-winamp-green' : 'text-winamp-red';

              return (
                <div
                  key={provider.value}
                  className="flex flex-col gap-3 rounded-lg border border-win-gray-400 bg-win-gray-100 p-3 shadow-inner shadow-win-gray-300"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-win-gray-800">{provider.label}</p>
                      <p className={`text-xs ${statusTone}`}>{statusLabel}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => runLlmTest(provider.value)}
                      disabled={entry?.status === 'running' || !entry?.prompt?.trim()}
                      className="rounded border-2 border-win-gray-400 bg-winamp-teal px-3 py-1 text-xs font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {entry?.status === 'running' ? 'Testing…' : 'Run test'}
                    </button>
                  </div>
                  <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-win-gray-600">
                    Model (optional)
                    <input
                      type="text"
                      value={entry?.model ?? ''}
                      onChange={(event) => updateLlmTestEntry(provider.value, { model: event.target.value })}
                      placeholder="provider default"
                      className="rounded border border-win-gray-400 bg-win-gray-100 px-2 py-1 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs uppercase tracking-wide text-win-gray-600">
                    Prompt
                    <textarea
                      value={entry?.prompt ?? ''}
                      onChange={(event) => updateLlmTestEntry(provider.value, { prompt: event.target.value })}
                      rows={2}
                      className="resize-none rounded border border-win-gray-400 bg-win-gray-100 px-2 py-1 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                    />
                  </label>
                  {entry?.status === 'error' && (
                    <div className="rounded border border-winamp-red/30 bg-winamp-red/10 px-2 py-2 text-xs text-winamp-red">
                      {entry.error ?? 'Test failed.'}
                    </div>
                  )}
                  {entry?.status === 'success' && entry.response && (
                    <div className="rounded border border-winamp-blue/30 bg-winamp-blue/10 px-2 py-2 text-xs text-win-gray-700">
                      <span className="block text-xs font-semibold text-win-gray-600">Response</span>
                      <span className="mt-1 block whitespace-pre-wrap">{entry.response}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        )}

        {banner && <Banner banner={banner} onClose={() => setBanner(null)} />}

        <div className={`grid flex-1 gap-6 ${compactMode ? 'grid-cols-1' : 'lg:grid-cols-[360px,1fr]'}`}>
          {/* Configuration panel - styled like a retro dialog box */}
          {!compactMode && (
          <aside className="space-y-6 rounded-lg border-2 border-win-gray-400 bg-win-gray-200 p-4 shadow-inner shadow-win-gray-500">
            <h2 className="text-lg font-semibold text-win-gray-800">Agent configuration</h2>
            <p className="text-sm text-win-gray-600">Select personas, providers, and temperatures to craft the perfect dialogue.</p>

            <div className="space-y-5">
              <PersonaSummary title="Agent A" persona={selectedPersonaA} onSelect={() => openModal('agentA')} />
              <PersonaSummary title="Agent B" persona={selectedPersonaB} onSelect={() => openModal('agentB')} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-win-gray-600">
                <span className="text-xs uppercase tracking-wide text-win-gray-600">Max rounds</span>
                <input
                  type="number"
                  value={maxRounds}
                  min={1}
                  max={100}
                  onChange={(event) => setMaxRounds(Number(event.target.value))}
                  className="rounded-lg border border-win-gray-400 bg-win-gray-100 px-3 py-2 text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-win-gray-600">
                <span className="text-xs uppercase tracking-wide text-win-gray-600">Starter tone</span>
                <div className="rounded-lg border border-win-gray-400 bg-win-gray-100 px-3 py-2 text-win-gray-800 text-sm shadow-inner shadow-win-gray-300">
                  {inputMessage.trim().length > 0 ? `${inputMessage.trim().length} characters` : 'Awaiting your starter prompt'}
                </div>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm text-win-gray-600">
                <span className="text-xs uppercase tracking-wide text-win-gray-600">Temperature A</span>
                <input
                  type="number"
                  value={temperatureA}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(event) => setTemperatureA(Number(event.target.value))}
                  className="rounded-lg border border-win-gray-400 bg-win-gray-100 px-3 py-2 text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm text-win-gray-600">
                <span className="text-xs uppercase tracking-wide text-win-gray-600">Temperature B</span>
                <input
                  type="number"
                  value={temperatureB}
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(event) => setTemperatureB(Number(event.target.value))}
                  className="rounded-lg border border-win-gray-400 bg-win-gray-100 px-3 py-2 text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {renderProviderModelSelect(
                'A',
                selectedProviderA,
                selectedModelA,
                setSelectedProviderA,
                setSelectedModelA,
                modelsA,
                isLoadingModelsA,
              )}
              {renderProviderModelSelect(
                'B',
                selectedProviderB,
                selectedModelB,
                setSelectedProviderB,
                setSelectedModelB,
                modelsB,
                isLoadingModelsB,
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs uppercase tracking-wide text-win-gray-600">Starter message</label>
              <textarea
                value={inputMessage}
                onChange={(event) => setInputMessage(event.target.value)}
                placeholder="Describe the topic the agents should explore..."
                rows={4}
                className="w-full resize-none rounded-lg border border-win-gray-400 bg-win-gray-100 px-4 py-3 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={startConversation}
                  disabled={!canStartConversation}
                  className="flex-1 rounded-lg border-2 border-win-gray-400 bg-gradient-to-r from-winamp-teal to-winamp-green px-6 py-3 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:shadow-win-gray-500 disabled:cursor-not-allowed disabled:opacity-50 hover:shadow-md"
                >
                  {conversationStatus === 'configuring' ? 'Launching…' : 'Launch conversation'}
                </button>
                <button
                  type="button"
                  onClick={resetConversation}
                  className="rounded-lg border-2 border-win-gray-400 px-6 py-3 text-sm font-semibold text-win-gray-600 shadow-inner shadow-win-gray-300 transition hover:border-win-gray-600 hover:bg-win-gray-300 hover:text-win-gray-800"
                >
                  Reset
                </button>
              </div>
            </div>
          </aside>
          )}

          {/* Chat area with window styling */}
          <section className="flex flex-col rounded-lg border-2 border-win-gray-400 bg-win-gray-100 shadow-inner shadow-win-gray-500">
            {/* Chat title bar */}
            <div className="border-b-2 border-win-gray-400 bg-win-gray-300 px-4 py-3 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-win-gray-800">Live conversation</h2>
                  <p className="text-sm text-win-gray-600">
                    {conversationId ? `Conversation ID: ${conversationId}` : 'No active conversation yet. Configure the agents to begin.'}
                  </p>
                </div>
                {conversationId && (
                  <div className="flex items-center gap-3 text-xs text-win-gray-600">
                    <div className="flex items-center gap-1">
                      <span className={`h-2.5 w-2.5 rounded-full ${conversationStatus === 'running' ? 'bg-winamp-green animate-pulse' : 'bg-win-gray-400'}`} />
                      {conversationStatus === 'running' ? 'Streaming' : 'Standing by'}
                    </div>
                    <span className="hidden sm:inline">•</span>
                    <div>{messages.length} messages</div>
                  </div>
                )}
              </div>
            </div>

            {/* Chat messages */}
            <div className="h-[calc(100vh-20rem)] min-h-[500px] space-y-4 overflow-y-auto p-4" role="log" aria-live="polite">
              {messages.length === 0 && conversationStatus === 'idle' && (
                <div className="flex h-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-win-gray-400 bg-win-gray-200 p-6 text-center">
                  <p className="text-lg font-semibold text-win-gray-800">Ready when you are</p>
                  <p className="mt-2 max-w-md text-sm text-win-gray-600">
                    Choose two personas, brief them with a starter message, and press “Launch conversation” to watch the dialogue unfold in real-time.
                  </p>
                </div>
              )}

              {messages.map((message, index) => {
                const isUser = message.sender === 'user';
                const isAgentA = message.sender === 'agent_a';
                const textColor = isUser ? 'text-win-gray-800' : isAgentA ? 'text-winamp-blue' : 'text-winamp-red';
                const bgColor = isUser
                  ? 'bg-win-gray-200 border-win-gray-400'
                  : isAgentA
                    ? 'bg-winamp-blue/10 border-winamp-blue/30'
                    : 'bg-winamp-red/10 border-winamp-red/30';

                // Determine display name
                let displayName = 'You';
                if (!isUser) {
                  if (message.persona) {
                    displayName = message.persona;
                  } else if (isAgentA) {
                    displayName = selectedPersonaA?.name || 'Agent A';
                  } else {
                    displayName = selectedPersonaB?.name || 'Agent B';
                  }
                }

                return (
                  <article
                    key={`${message.timestamp}-${index}`}
                    className={`max-w-2xl rounded-lg border px-4 py-3 shadow-inner shadow-win-gray-300 ${bgColor} ${
                      isUser ? 'ml-auto text-right' : 'mr-auto text-left'
                    }`}
                  >
                    <header className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-win-gray-600">
                      <span>{displayName}</span>
                      <span>{formatTimestamp(message.timestamp)}</span>
                    </header>
                    <p className={`mt-2 whitespace-pre-wrap text-sm ${textColor}`}>{message.content}</p>

                    {/* Info tags for metrics */}
                    {(message.tokens || message.response_time || message.model) && (
                      <div className="mt-2 flex flex-wrap gap-2 text-xs">
                        {message.tokens && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-win-gray-400 bg-win-gray-100 px-2 py-0.5 text-win-gray-700">
                            <span className="text-xs">🔢</span>
                            <span>{message.tokens} tokens</span>
                          </span>
                        )}
                        {message.response_time && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-win-gray-400 bg-win-gray-100 px-2 py-0.5 text-win-gray-700">
                            <span className="text-xs">⏱️</span>
                            <span>{message.response_time.toFixed(2)}s</span>
                          </span>
                        )}
                        {message.model && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-win-gray-400 bg-win-gray-100 px-2 py-0.5 text-win-gray-700 max-w-[200px] truncate">
                            <span className="text-xs">🤖</span>
                            <span className="truncate">{message.model}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {isTyping && (
                <div className="flex items-center gap-2 rounded-lg border-2 border-winamp-blue/30 bg-winamp-blue/10 px-4 py-2 text-sm text-winamp-blue shadow-sm">
                  <div className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-winamp-blue" />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-winamp-blue" style={{ animationDelay: '0.1s' }} />
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-winamp-blue" style={{ animationDelay: '0.2s' }} />
                  </div>
                  <span>Agents are drafting their next response…</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </section>
        </div>
      </div>

      {/* Modal dialog - styled like a retro dialog */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-win-gray-300/70 px-4 py-6 backdrop-blur-sm">
          <div className="flex w-full max-w-xl flex-col gap-4 rounded-lg border-2 border-win-gray-400 bg-win-gray-100 p-4 shadow-lg shadow-win-gray-500">
            <header className="flex items-start justify-between border-b-2 border-win-gray-400 pb-2">
              <div>
                <h3 className="text-lg font-semibold text-win-gray-800">
                  {modalType === 'guides'
                    ? '📚 Help & Guides'
                    : modalType === 'settings'
                      ? '🔑 API Configuration'
                      : modalType === 'personas'
                        ? '🎭 Persona Manager'
                        : `Select ${modalType === 'agentA' ? 'Agent A' : 'Agent B'} persona`}
                </h3>
                <p className="text-sm text-win-gray-600">
                  {modalType === 'guides'
                    ? 'Browse documentation and guides'
                    : modalType === 'settings'
                      ? 'Configure your provider credentials'
                      : modalType === 'personas'
                        ? 'Create, edit, and curate personas stored in roles.json.'
                        : 'Browse the persona library and tap to assign.'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded border-2 border-win-gray-400 bg-win-gray-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-win-gray-600 transition hover:border-win-gray-600 hover:bg-win-gray-300 hover:text-win-gray-800"
              >
                Close
              </button>
            </header>

            {modalType === 'settings' ? (
              // Settings / API Keys modal content
              <div className="flex flex-col gap-4">
                <p className="text-sm text-win-gray-600">
                  Enter your API keys for the providers you wish to use. Keys can stay in memory for this session or be saved into a server-side .env file for future sessions.
                </p>
                <div className="grid gap-4 max-h-[400px] overflow-y-auto pr-2">
                  {providerOptions.filter(opt => !['ollama', 'lmstudio'].includes(opt.value)).map((opt) => (
                    <label key={opt.value} className="flex flex-col gap-1">
                      <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">{opt.label} API Key</span>
                      <input
                        type="password"
                        value={apiKeys[opt.value] || ''}
                        onChange={(e) => setApiKeys({ ...apiKeys, [opt.value]: e.target.value })}
                        placeholder={`sk-...`}
                        className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-4 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                      />
                    </label>
                  ))}
                </div>
                <label className="flex items-center gap-2 text-sm text-win-gray-600">
                  <input
                    type="checkbox"
                    checked={persistKeys}
                    onChange={(event) => setPersistKeys(event.target.checked)}
                    className="h-4 w-4 rounded border-win-gray-400"
                  />
                  <span>Store keys in .env for future sessions</span>
                </label>
                <p className="text-xs text-win-gray-500">
                  Manual configuration is also supported: add API keys directly in the server&apos;s <span className="font-semibold">.env</span> file.
                </p>
                <div className="flex justify-end pt-2 border-t-2 border-win-gray-400">
                  <button
                    type="button"
                    onClick={async () => {
                      if (persistKeys) {
                        const persisted = await persistApiKeys();
                        if (!persisted) {
                          return;
                        }
                      }
                      closeModal();
                    }}
                    className="rounded-lg border-2 border-win-gray-400 bg-winamp-green px-6 py-2 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:shadow-md"
                    disabled={isSavingKeys}
                  >
                    {isSavingKeys ? 'Saving…' : 'Save & Close'}
                  </button>
                </div>
              </div>
            ) : modalType === 'personas' ? (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-win-gray-600">
                    Manage the persona library stored in <span className="font-semibold">roles.json</span>. Updates are written immediately.
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs uppercase tracking-wide text-win-gray-600">Persona library</span>
                    <button
                      type="button"
                      onClick={resetPersonaForm}
                      className="rounded border-2 border-win-gray-400 bg-win-gray-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-win-gray-600 transition hover:border-win-gray-600 hover:bg-win-gray-300 hover:text-win-gray-800"
                    >
                      New Persona
                    </button>
                  </div>
                  <div className="grid max-h-[180px] gap-2 overflow-y-auto pr-2">
                    {isLoadingPersonaManager && (
                      <div className="rounded-lg border-2 border-dashed border-win-gray-400 bg-win-gray-200 p-3 text-center text-xs text-win-gray-500">
                        Loading persona library…
                      </div>
                    )}
                    {!isLoadingPersonaManager && personaManagerEntries.length === 0 && (
                      <div className="rounded-lg border-2 border-dashed border-win-gray-400 bg-win-gray-200 p-3 text-center text-xs text-win-gray-500">
                        No personas found.
                      </div>
                    )}
                    {personaManagerEntries.map((persona) => (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => selectPersonaForEdit(persona)}
                        className={`flex flex-col gap-1 rounded-lg border-2 px-3 py-2 text-left text-xs transition ${
                          activePersonaId === persona.id
                            ? 'border-winamp-teal bg-winamp-teal/10 text-win-gray-800 shadow-inner shadow-win-gray-300'
                            : 'border-win-gray-400 bg-win-gray-100 text-win-gray-600 hover:border-win-gray-600 hover:bg-win-gray-200'
                        }`}
                      >
                        <span className="font-semibold text-sm text-win-gray-800">{persona.name}</span>
                        <span className="text-xs text-win-gray-500">{persona.id} · {persona.provider}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3">
                  <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                    <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">Persona ID</span>
                    <input
                      type="text"
                      value={activePersonaId ?? personaForm.id}
                      onChange={(event) => setPersonaForm({ ...personaForm, id: event.target.value })}
                      disabled={Boolean(activePersonaId)}
                      placeholder="unique_persona_id"
                      className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none disabled:opacity-60"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                    <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">Display name</span>
                    <input
                      type="text"
                      value={personaForm.name}
                      onChange={(event) => setPersonaForm({ ...personaForm, name: event.target.value })}
                      placeholder="Persona name"
                      className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                      <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">Provider</span>
                      <select
                        value={personaForm.provider}
                        onChange={(event) => {
                          const nextProvider = event.target.value;
                          setPersonaForm({ ...personaForm, provider: nextProvider, model: null });
                        }}
                        className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                      >
                        {providerOptions.map((option) => (
                          <option key={option.value} value={option.value} className="bg-win-gray-100 text-win-gray-800">
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                      <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">Model (optional)</span>
                      <select
                        value={personaForm.model ?? ''}
                        onChange={(event) =>
                          setPersonaForm({ ...personaForm, model: event.target.value ? event.target.value : null })
                        }
                        disabled={isLoadingPersonaModels || personaModelOptions.length === 0}
                        className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none disabled:opacity-60"
                      >
                        <option value="">Use provider default</option>
                        {isLoadingPersonaModels ? (
                          <option>Loading models...</option>
                        ) : personaModelOptions.length === 0 ? (
                          <option>No models available</option>
                        ) : (
                          personaModelOptions.map((model) => (
                            <option key={model.id} value={model.id} className="bg-win-gray-100 text-win-gray-800">
                              {model.name}
                            </option>
                          ))
                        )}
                      </select>
                    </label>
                  </div>
                  <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                    <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">Temperature</span>
                    <input
                      type="number"
                      value={personaForm.temperature ?? 0.7}
                      onChange={(event) => setPersonaForm({ ...personaForm, temperature: Number(event.target.value) })}
                      min={0}
                      max={2}
                      step={0.1}
                      className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                    <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">System prompt</span>
                    <textarea
                      value={personaForm.system_prompt}
                      onChange={(event) => setPersonaForm({ ...personaForm, system_prompt: event.target.value })}
                      rows={4}
                      placeholder="Persona system prompt"
                      className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                    <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">Guidelines (one per line)</span>
                    <textarea
                      value={personaForm.guidelines.join('\n')}
                      onChange={(event) =>
                        setPersonaForm({
                          ...personaForm,
                          guidelines: event.target.value.split('\n').map((line) => line.trim()).filter(Boolean),
                        })
                      }
                      rows={4}
                      placeholder="One guideline per line"
                      className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-sm text-win-gray-600">
                    <span className="text-xs uppercase tracking-wide text-win-gray-600 font-semibold">Notes (optional)</span>
                    <textarea
                      value={personaForm.notes ?? ''}
                      onChange={(event) => setPersonaForm({ ...personaForm, notes: event.target.value })}
                      rows={2}
                      placeholder="Optional notes"
                      className="rounded border-2 border-win-gray-400 bg-win-gray-100 px-3 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                    />
                  </label>
                </div>

                <div className="flex flex-col gap-2 border-t-2 border-win-gray-400 pt-3 sm:flex-row sm:items-center sm:justify-between">
                  <button
                    type="button"
                    onClick={deletePersona}
                    className="rounded-lg border-2 border-win-gray-400 bg-winamp-red/20 px-4 py-2 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:shadow-md"
                  >
                    Delete Persona
                  </button>
                  <button
                    type="button"
                    onClick={savePersona}
                    className="rounded-lg border-2 border-win-gray-400 bg-winamp-green px-6 py-2 text-sm font-semibold text-win-gray-800 shadow-inner shadow-win-gray-300 transition hover:shadow-md"
                  >
                    {activePersonaId ? 'Update Persona' : 'Create Persona'}
                  </button>
                </div>
              </div>
            ) : modalType === 'guides' ? (
              // Guides modal content
              <>
                {selectedGuide ? (
                  // Guide viewer
                  <div className="flex flex-col gap-3 max-h-[600px]">
                    <button
                      onClick={() => setSelectedGuide(null)}
                      className="self-start rounded border-2 border-win-gray-400 bg-win-gray-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-win-gray-600 transition hover:border-win-gray-600 hover:bg-win-gray-300 hover:text-win-gray-800"
                    >
                      ← Back to guides
                    </button>
                    <div className="prose prose-sm max-w-none overflow-y-auto rounded border-2 border-win-gray-400 bg-white p-4 text-win-gray-800 shadow-inner shadow-win-gray-300">
                      {isLoadingGuide ? (
                        <p className="text-center text-win-gray-500">Loading...</p>
                      ) : (
                        <pre className="whitespace-pre-wrap font-mono text-xs">{selectedGuide.content}</pre>
                      )}
                    </div>
                  </div>
                ) : (
                  // Guides list
                  <div className="grid max-h-[500px] gap-2 overflow-y-auto pr-2">
                    {guides.length === 0 && (
                      <div className="rounded-lg border-2 border-dashed border-win-gray-400 bg-win-gray-200 p-4 text-center text-sm text-win-gray-500">
                        No guides available
                      </div>
                    )}
                    {Object.entries(
                      guides.reduce((acc, guide) => {
                        if (!acc[guide.category]) acc[guide.category] = [];
                        acc[guide.category].push(guide);
                        return acc;
                      }, {} as Record<string, Guide[]>)
                    ).map(([category, categoryGuides]) => (
                      <div key={category} className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-win-gray-600">{category}</h4>
                        {categoryGuides.map((guide) => (
                          <button
                            key={guide.id}
                            onClick={() => fetchGuideContent(guide.id)}
                            className="flex w-full flex-col gap-1 rounded-lg border-2 border-win-gray-400 bg-win-gray-100 px-4 py-2 text-left transition hover:border-win-gray-600 hover:bg-win-gray-200 hover:shadow-inner hover:shadow-win-gray-300"
                          >
                            <span className="text-sm font-semibold text-win-gray-800">{guide.title}</span>
                            <span className="text-xs text-win-gray-500">{guide.description}</span>
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              // Persona selection modal content
              <>
                <div className="relative">
                  <input
                    value={personaSearchTerm}
                    onChange={(event) => setPersonaSearchTerm(event.target.value)}
                    placeholder="Search personas by name or description"
                    className="w-full rounded border-2 border-win-gray-400 bg-win-gray-100 px-4 py-2 text-sm text-win-gray-800 shadow-inner shadow-win-gray-300 transition focus:border-win-gray-600 focus:outline-none"
                  />
                  {isLoadingPersonas && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-win-gray-500">Loading…</span>
                  )}
                </div>

                <div className="grid max-h-[500px] gap-2 overflow-y-auto pr-2">
                  {filteredPersonas.length === 0 && !isLoadingPersonas && (
                    <div className="rounded-lg border-2 border-dashed border-win-gray-400 bg-win-gray-200 p-4 text-center text-sm text-win-gray-500">
                      No personas match that description. Adjust your search and try again.
                    </div>
                  )}

                  {filteredPersonas.map((persona) => {
                    const isSelected =
                      (modalType === 'agentA' && selectedPersonaA?.id === persona.id) ||
                      (modalType === 'agentB' && selectedPersonaB?.id === persona.id);

                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => selectPersona(persona)}
                        className={`flex flex-col gap-1 rounded-lg border-2 px-4 py-2 text-left transition ${
                          isSelected
                            ? 'border-winamp-teal bg-winamp-teal/10 text-win-gray-800 shadow-inner shadow-win-gray-300'
                            : 'border-win-gray-400 bg-win-gray-100 text-win-gray-600 hover:border-win-gray-600 hover:bg-win-gray-200 hover:shadow-inner hover:shadow-win-gray-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className="text-sm font-semibold">{persona.name}</span>
                          {isSelected && (
                            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-winamp-teal text-xs text-win-gray-800">
                              ✓
                            </span>
                          )}
                        </div>
                        {persona.description && <span className="text-xs text-win-gray-500">{persona.description}</span>}
                        {persona.system_preview && (
                          <span className="text-xs text-win-gray-500 line-clamp-2">{persona.system_preview}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RetroChatBridge;
