/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { DocumentUploader } from './components/DocumentUploader';
import { ChatInterface } from './components/ChatInterface';
import { KnowledgeExplorer } from './components/KnowledgeExplorer';
import { Evaluation } from './components/Evaluation';
import { Settings } from './components/Settings';
import { Cpu, Github, ExternalLink, Terminal, BarChart3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { globalStore } from './lib/vector-store';
import { cn } from './lib/utils';

import { SystemLog } from './components/SystemLog';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';

const dummyData = Array.from({ length: 40 }, (_, i) => ({ value: Math.random() * 20 + (i % 5 === 0 ? 40 : 10) }));

const LoadChart = () => (
  <div className="h-16 w-full mt-4 bg-zinc-950/50 rounded-lg overflow-hidden border border-zinc-900">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={dummyData}>
        <defs>
          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <Area 
          type="monotone" 
          dataKey="value" 
          stroke="#10b981" 
          strokeWidth={1}
          fillOpacity={1} 
          fill="url(#colorValue)" 
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

export default function App() {
  const [dbStats, setDbStats] = useState({ 
    chunkCount: 0,
    sourceCount: 0,
    estimatedMem: '0 KB'
  });
  const [activeTab, setActiveTab] = useState<'upload' | 'explorer' | 'eval' | 'settings'>('upload');

  const updateStats = () => {
    const allChunks = globalStore.getAllChunks();
    const sources = new Set(allChunks.map(c => c.metadata.source));
    // Estimate memory: each embedding is 768 floats (4 bytes each)
    const floatSize = 4;
    const embeddingDim = 768;
    const totalBytes = allChunks.length * embeddingDim * floatSize;
    const memStr = totalBytes > 1024 * 1024 
      ? `${(totalBytes / (1024 * 1024)).toFixed(2)} MB` 
      : `${(totalBytes / 1024).toFixed(1)} KB`;

    setDbStats({
      chunkCount: allChunks.length,
      sourceCount: sources.size,
      estimatedMem: memStr
    });
  };

  // Initial stats update
  React.useEffect(() => {
    updateStats();
    return globalStore.subscribe(updateStats);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-zinc-300 font-sans selection:bg-emerald-500/30 selection:text-emerald-200 overflow-hidden">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-900/10 blur-[120px]" />
        <div className="absolute bottom-[5%] right-[-5%] w-[30%] h-[30%] rounded-full bg-blue-900/5 blur-[100px]" />
      </div>

      <div className="relative flex flex-col md:flex-row h-screen p-4 md:p-6 gap-6 max-w-[1700px] mx-auto overflow-hidden">
        {/* Sidebar */}
        <div className="w-full md:w-[400px] flex flex-col space-y-6 shrink-0 h-full overflow-hidden">
          <header className="space-y-1">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)] border border-emerald-400/20">
                <Cpu className="w-5 h-5 text-zinc-950" />
              </div>
              <h1 className="text-xl font-bold tracking-tighter text-white uppercase italic">NanoRAG</h1>
            </div>
            <div className="flex items-center space-x-2 pt-1">
              <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest pl-1">Ais-Build / Dev.V1</span>
              <div className="h-px w-6 bg-zinc-800" />
              <div className="flex items-center space-x-1">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] text-emerald-500/60 font-mono uppercase text-nowrap">系统就绪 / READY</span>
              </div>
            </div>
          </header>

          <div className="flex-1 flex flex-col space-y-6 min-h-0 overflow-hidden">
            <nav className="grid grid-cols-4 gap-1 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
              <NavButton active={activeTab === 'upload'} onClick={() => setActiveTab('upload')}>注入</NavButton>
              <NavButton active={activeTab === 'explorer'} onClick={() => setActiveTab('explorer')}>浏览</NavButton>
              <NavButton active={activeTab === 'eval'} onClick={() => setActiveTab('eval')}>评测</NavButton>
              <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')}>设置</NavButton>
            </nav>

            <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  {activeTab === 'upload' && <DocumentUploader onProcessingComplete={updateStats} />}
                  {activeTab === 'explorer' && <KnowledgeExplorer onRefresh={updateStats} />}
                  {activeTab === 'eval' && <Evaluation />}
                  {activeTab === 'settings' && <Settings />}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* System Monitor Area */}
            <section className="space-y-4 pt-4 border-t border-zinc-900/50 shrink-0">
               <div className="flex items-center justify-between">
                <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2">
                  <Terminal className="w-3 h-3" />
                  内核遥测 / TELEMETRY
                </h2>
                <span className="text-[9px] font-mono text-zinc-700 uppercase animate-pulse">扫描中...</span>
              </div>
              <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/50 space-y-3 tech-border">
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <MonitorValue label="IO 延迟" value={`${Math.floor(Math.random() * 15 + 5)}ms`} color={dbStats.chunkCount > 0 ? "text-emerald-400" : "text-zinc-700"} />
                  <MonitorValue label="分块计数" value={dbStats.chunkCount.toString()} color="text-emerald-400" />
                  <MonitorValue label="向量内存" value={dbStats.estimatedMem} color="text-emerald-400" />
                  <MonitorValue label="已归档文档" value={dbStats.sourceCount.toString()} color="text-orange-400" />
                </div>
                <div className="pt-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-mono text-zinc-600 uppercase">神经核心负载 / NEURAL LOAD</span>
                    <span className="text-[9px] font-mono text-emerald-500">22.4 TPS</span>
                  </div>
                  <LoadChart />
                </div>
              </div>
            </section>

            <SystemLog />
          </div>

          <footer className="pt-4 border-t border-zinc-900/50 flex items-center justify-between px-2 shrink-0">
            <a href="https://github.com/ifnodoraemon/nano-rag" target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-700 hover:text-zinc-500 transition-colors flex items-center space-x-1 font-mono uppercase tracking-widest group">
              <Github className="w-3.5 h-3.5 transition-transform group-hover:scale-110" />
              <span>Project Artifact</span>
            </a>
            <div className="flex items-center space-x-4">
              <BarChart3 className="w-3.5 h-3.5 text-zinc-800 hover:text-emerald-500/50 transition-colors cursor-help" />
              <div className="w-px h-3 bg-zinc-900" />
              <ExternalLink className="w-3.5 h-3.5 text-zinc-800 hover:text-emerald-500/50 transition-colors cursor-pointer" />
            </div>
          </footer>
        </div>

        {/* Main Content (Chat) */}
        <main className="flex-1 min-w-0 h-full relative group overflow-hidden">
          <ChatInterface />
        </main>
      </div>
    </div>
  );
}

const NavButton = ({ active, children, onClick }: { active: boolean, children: React.ReactNode, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "py-2 text-[10px] font-bold uppercase transition-all rounded-lg",
      active ? "bg-zinc-800 text-white shadow-inner border border-zinc-700/50" : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/30"
    )}
  >
    {children}
  </button>
);

const MonitorValue = ({ label, value, color }: { label: string, value: string, color: string }) => (
  <div className="space-y-1">
    <p className="text-[9px] uppercase text-zinc-600 font-bold tracking-tight">{label}</p>
    <p className={cn("text-xs font-mono", color)}>{value}</p>
  </div>
);

