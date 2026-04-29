import React from 'react';
import { Settings as SettingsIcon, Sliders, Cpu, HardDrive, Download, Database, Key } from 'lucide-react';
import { useRagSettings } from '../lib/settings-store';
import { listDocuments, getParsedDoc } from '../lib/api';
import { eventBus } from '../lib/event-bus';

export const Settings: React.FC = () => {
  const [settings, setSettings] = useRagSettings();

  const handleExport = async () => {
    try {
      eventBus.emit('Starting knowledge base export...', 'info');
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
      eventBus.emit('Knowledge base exported successfully', 'success');
    } catch (e) {
      console.error(e);
      eventBus.emit('Export failed', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <SettingsIcon className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">系统内核配置 / CONFIG</h2>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-[9px] font-bold uppercase tracking-widest text-zinc-400 hover:text-emerald-500 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition-all"
        >
          <Download className="w-3 h-3" />
          <span>导出知识库 / EXPORT</span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {/* API Settings */}
        <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 space-y-4">
          <div className="flex items-center space-x-2">
            <Key className="w-3.5 h-3.5 text-zinc-500" />
            <h3 className="text-[10px] font-bold uppercase text-zinc-400">认证配置 / AUTH</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                API 密钥 (X-API-Key)
              </label>
              <input 
                type="password"
                value={settings.apiKey}
                onChange={(e) => setSettings({ ...settings, apiKey: e.target.value })}
                placeholder="在此输入 API 密钥..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="space-y-2">
              <label className="flex justify-between text-[10px] font-mono text-zinc-500 uppercase">
                知识库 ID / KB_ID
              </label>
              <input 
                type="text"
                value={settings.kbId}
                onChange={(e) => setSettings({ ...settings, kbId: e.target.value })}
                placeholder="default"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
        </div>

        {/* Retrieval Settings */}
        <div className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 space-y-4">
          <div className="flex items-center space-x-2">
            <Cpu className="w-3.5 h-3.5 text-zinc-500" />
            <h3 className="text-[10px] font-bold uppercase text-zinc-400">检索引擎 / ENGINE</h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-[10px] font-mono">
                <span className="text-zinc-500">Top-K 结果数量</span>
                <span className="text-emerald-500">{settings.topK}</span>
              </div>
              <input 
                type="range" min="1" max="10" step="1"
                value={settings.topK}
                onChange={(e) => setSettings({ ...settings, topK: parseInt(e.target.value) })}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="p-4 flex items-center justify-between opacity-50 bg-zinc-900/10 border border-dashed border-zinc-800 rounded-xl">
           <div className="flex items-center space-x-2">
             <HardDrive className="w-3.5 h-3.5 text-zinc-600" />
             <span className="text-[10px] font-mono text-zinc-600 italic">Session ID: {settings.sessionId?.substring(0, 8)}...</span>
           </div>
           <span className="text-[9px] text-zinc-700 bg-zinc-900 px-1 rounded uppercase">自动保存</span>
        </div>
      </div>
    </div>
  );
};
