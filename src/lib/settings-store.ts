import { useState, useEffect } from 'react';

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
  const [settings, setSettings] = useState<RagSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : defaultSettings;
    if (typeof parsed.kbId !== 'string') {
      parsed.kbId = defaultSettings.kbId;
    }
    if (typeof parsed.kbName !== 'string') {
      parsed.kbName = defaultSettings.kbName;
    }
    if (!parsed.sessionId) {
      parsed.sessionId = crypto.randomUUID();
    }
    return parsed;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings] as const;
}
