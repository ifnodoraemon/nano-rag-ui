import { useState, useEffect } from 'react';

export interface RagSettings {
  topK: number;
  workspaceId: string;
  kbId: string;
  tenantId: string;
  sessionId: string;
}

const STORAGE_KEY = 'nanorag_settings';

const defaultSettings: RagSettings = {
  topK: 4,
  workspaceId: '',
  kbId: '',
  tenantId: '',
  sessionId: '',
};

export function settingsForWorkspace(
  settings: RagSettings,
  workspace: { workspace_id: string; kb_id: string; tenant_id: string | null },
): RagSettings {
  return {
    ...settings,
    workspaceId: workspace.workspace_id,
    kbId: workspace.kb_id,
    tenantId: workspace.tenant_id || '',
  };
}

export function useRagSettings() {
  const [settings, setSettings] = useState<RagSettings>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = saved ? JSON.parse(saved) : defaultSettings;
    if (typeof parsed.workspaceId !== 'string') {
      parsed.workspaceId = defaultSettings.workspaceId;
    }
    if (typeof parsed.kbId !== 'string') {
      parsed.kbId = defaultSettings.kbId;
    }
    if (!parsed.sessionId) {
      parsed.sessionId = crypto.randomUUID();
    }
    if (typeof parsed.tenantId !== 'string') {
      parsed.tenantId = defaultSettings.tenantId;
    }
    return parsed;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  return [settings, setSettings] as const;
}
