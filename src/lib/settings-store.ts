import { useState, useEffect } from 'react';

export interface RagSettings {
  chunkSize: number;
  overlap: number;
  topK: number;
  model: string;
}

const STORAGE_KEY = 'nanorag_settings';

const defaultSettings: RagSettings = {
  chunkSize: 500,
  overlap: 100,
  topK: 4,
  model: 'gemini-3-flash-preview',
};

export function useRagSettings() {
  const [settings, setSettings] = useState<RagSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : defaultSettings;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings] as const;
}
