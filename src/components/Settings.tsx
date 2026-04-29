import React from 'react';
import { Download, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { getParsedDoc, listDocuments } from '../lib/api';
import { eventBus } from '../lib/event-bus';
import { useRagSettings } from '../lib/settings-store';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useRagSettings();

  const handleExport = async () => {
    if (!settings.kbId) return;
    try {
      eventBus.emit('正在导出当前知识范围', 'info');
      const docs = await listDocuments(settings.kbId);
      const fullData = [];
      for (const doc of docs) {
        const parsed = await getParsedDoc(doc.doc_id);
        fullData.push(parsed);
      }
      const blob = new Blob([JSON.stringify(fullData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nanorag_export_${settings.kbId}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      eventBus.emit('知识范围已导出', 'success');
    } catch (error) {
      console.error(error);
      eventBus.emit('导出失败', 'error');
    }
  };

  const resetSession = () => {
    setSettings({ ...settings, sessionId: crypto.randomUUID() });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">运行设置</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">知识库来自后端真实数据；这里只保留检索参数和会话操作。</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={!settings.kbId}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
        >
          <Download className="h-3.5 w-3.5" />
          导出
        </button>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <SlidersHorizontal className="h-4 w-4 text-slate-500" />
          检索
        </div>
        <Field label={`top_k: ${settings.topK}`} hint="调用 /v1/rag/chat 时请求的上下文数量。">
          <input
            type="range"
            min="1"
            max="20"
            step="1"
            value={settings.topK}
            onChange={(event) => setSettings({ ...settings, topK: Number(event.target.value) })}
            className="w-full accent-slate-950"
          />
        </Field>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900">会话</div>
            <div className="mt-1 truncate font-mono text-xs text-slate-500">{settings.sessionId}</div>
          </div>
          <button
            type="button"
            onClick={resetSession}
            className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            重置
          </button>
        </div>
      </section>
    </div>
  );
};

const Field = ({ children, hint, label }: { children: React.ReactNode; hint: string; label: string }) => (
  <label className="block">
    <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-800">
      <span>{label}</span>
    </div>
    <div className="mt-2">{children}</div>
    <div className="mt-1 text-xs leading-5 text-slate-500">{hint}</div>
  </label>
);
