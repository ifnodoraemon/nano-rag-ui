import React, { useEffect, useState } from 'react';
import { Download, KeyRound, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { getDocumentTree, healthDetail, listDocuments } from '../lib/api';
import { eventBus } from '../lib/event-bus';
import { useRagSettings } from '../lib/settings-store';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useRagSettings();
  const [adminKeyDraft, setAdminKeyDraft] = useState(settings.adminKey);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    setAdminKeyDraft(settings.adminKey);
  }, [settings.adminKey]);

  const connectOperator = async (event: React.FormEvent) => {
    event.preventDefault();
    const candidate = adminKeyDraft.trim();
    if (!candidate || isConnecting) return;
    setIsConnecting(true);
    setConnectionMessage(null);
    setConnectionError(null);
    try {
      await healthDetail(false, candidate);
      setSettings((previous) => ({ ...previous, adminKey: candidate }));
      setConnectionMessage('连接成功，运维数据将自动刷新。');
      eventBus.emit('运维连接已验证并保存', 'success');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectOperator = () => {
    setSettings((previous) => ({ ...previous, adminKey: '' }));
    setAdminKeyDraft('');
    setConnectionMessage('已断开运维连接。');
    setConnectionError(null);
  };

  const handleExport = async () => {
    if (!settings.kbId) return;
    try {
      eventBus.emit('正在导出当前知识范围', 'info');
      const docs = await listDocuments(settings.kbId);
      const fullData = [];
      for (const doc of docs) {
        fullData.push(await getDocumentTree(doc.doc_id, settings.kbId));
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
        <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <KeyRound className="h-4 w-4 text-slate-500" />
          运维密钥
        </div>
        <form onSubmit={connectOperator} className="space-y-3">
          <Field
            label="运维密钥"
            hint="用于文档注入、追踪和评测。填写服务端 docker/.env 中 RAG_ADMIN_API_KEYS 的一个值，验证通过后保存到当前浏览器。"
          >
            <input
              type="password"
              value={adminKeyDraft}
              onChange={(event) => {
                setAdminKeyDraft(event.target.value);
                setConnectionMessage(null);
                setConnectionError(null);
              }}
              disabled={isConnecting}
              placeholder="粘贴运维密钥"
              autoComplete="off"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 font-mono text-xs text-slate-950 outline-none transition-colors focus:border-slate-950"
            />
          </Field>
          <div className="flex gap-2">
            <button type="submit" disabled={!adminKeyDraft.trim() || isConnecting} className="btn-primary">
              {isConnecting ? '正在验证…' : '验证并连接'}
            </button>
            {settings.adminKey && (
              <button type="button" onClick={disconnectOperator} disabled={isConnecting} className="btn-secondary">断开连接</button>
            )}
          </div>
          {connectionMessage && <p role="status" className="text-xs text-emerald-700">{connectionMessage}</p>}
          {connectionError && <p role="alert" className="text-xs text-rose-700">{connectionError}</p>}
        </form>
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
