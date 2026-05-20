import { useCallback, useSyncExternalStore } from 'react';

export interface RagSettings {
  topK: number;
  kbId: string;
  kbName: string;
  sessionId: string;
}

const STORAGE_KEY = 'nanorag_settings';

const defaultSettings: RagSettings = {
  topK: 4,
  kbId: '',
  kbName: '',
  sessionId: '',
};

type SettingsUpdater = RagSettings | ((settings: RagSettings) => RagSettings);
type SettingsListener = () => void;

const listeners = new Set<SettingsListener>();

function readStoredSettings(): RagSettings {
  const saved = localStorage.getItem(STORAGE_KEY);
  let parsed: Partial<RagSettings>;
  try {
    parsed = saved ? JSON.parse(saved) : {};
  } catch {
    parsed = {};
  }
  return normalizeSettings(parsed);
}

function normalizeSettings(value: Partial<RagSettings>): RagSettings {
  return {
    topK: typeof value.topK === 'number' && Number.isFinite(value.topK)
      ? value.topK
      : defaultSettings.topK,
    kbId: typeof value.kbId === 'string' ? value.kbId : defaultSettings.kbId,
    kbName: typeof value.kbName === 'string' ? value.kbName : defaultSettings.kbName,
    sessionId: typeof value.sessionId === 'string' && value.sessionId
      ? value.sessionId
      : crypto.randomUUID(),
  };
}

let currentSettings = readStoredSettings();

function persistSettings(settings: RagSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function emitSettingsChanged() {
  listeners.forEach((listener) => listener());
}

function setGlobalSettings(updater: SettingsUpdater) {
  const nextSettings = typeof updater === 'function'
    ? updater(currentSettings)
    : updater;
  currentSettings = normalizeSettings(nextSettings);
  persistSettings(currentSettings);
  emitSettingsChanged();
}

function subscribe(listener: SettingsListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  currentSettings = readStoredSettings();
  emitSettingsChanged();
});

persistSettings(currentSettings);

export function settingsForKnowledgeBase(
  settings: RagSettings,
  knowledgeBase: { kb_id: string; name: string },
): RagSettings {
  return {
    ...settings,
    kbId: knowledgeBase.kb_id,
    kbName: knowledgeBase.name,
  };
}

export function useRagSettings() {
  const settings = useSyncExternalStore(
    subscribe,
    () => currentSettings,
    () => currentSettings,
  );
  const setSettings = useCallback((updater: SettingsUpdater) => {
    setGlobalSettings(updater);
  }, []);

  return [settings, setSettings] as const;
}
