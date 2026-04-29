import { useState, useEffect } from 'react';

export interface RagSettings {
  topK: number;
  apiKey: string;
  kbId: string;
  sessionId: string;
}

const STORAGE_KEY = 'nanorag_settings';
export const API_KEY_KEY = 'nanorag_api_key';

const defaultSettings: RagSettings = {
  topK: 4,
  apiKey: import.meta.env.VITE_RAG_API_KEY || '',
  kbId: 'default',
  sessionId: '',
};

export function useRagSettings() {
  const [settings, setSettings] = useState<RagSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : defaultSettings;
    if (!parsed.sessionId) {
      parsed.sessionId = crypto.randomUUID();
    }
    return parsed;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem(API_KEY_KEY, settings.apiKey);
  }, [settings]);

  return [settings, setSettings] as const;
}
