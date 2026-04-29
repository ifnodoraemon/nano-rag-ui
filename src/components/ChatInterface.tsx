import React, { useEffect, useRef, useState } from 'react';
import { Archive, Bot, ChevronDown, FileAudio, FileVideo, Image as ImageIcon, Library, Loader2, Send, ThumbsDown, ThumbsUp, User } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Citation, chat, sendFeedback } from '../lib/api';
import { cn } from '../lib/utils';
import { useRagSettings } from '../lib/settings-store';

interface RetrievalTrace {
  latency?: number;
  results: Citation[];
  trace_id?: string;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  trace?: RetrievalTrace;
  feedback?: 'up' | 'down' | null;
}

const CHAT_STORAGE_KEY = 'nanorag_chat_history';

export const ChatInterface: React.FC = () => {
  const [settings] = useRagSettings();
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openTraceId, setOpenTraceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = input.trim();
    if (!query || isLoading || !settings.workspaceId || !settings.kbId) return;

    setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: 'user', text: query }]);
    setInput('');
    setIsLoading(true);
    const startTime = performance.now();

    try {
      const response = await chat({
        query,
        kb_id: settings.kbId,
        tenant_id: settings.tenantId ? settings.tenantId : null,
        session_id: settings.sessionId,
        top_k: settings.topK,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'model',
          text: response.answer,
          trace: {
            latency: Math.round(performance.now() - startTime),
            trace_id: response.trace_id,
            results: response.citations,
          },
          feedback: null,
        },
      ]);
    } catch (error) {
      console.error(error);
      const detail = error instanceof Error ? error.message : String(error);
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'model',
          text: `请求失败：${detail}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (message: Message, rating: 'up' | 'down') => {
    if (!message.trace?.trace_id || !settings.workspaceId || !settings.kbId) return;
    const nextRating = message.feedback === rating ? null : rating;
    setMessages((prev) => prev.map((item) => (item.id === message.id ? { ...item, feedback: nextRating } : item)));
    if (!nextRating) return;
    try {
      await sendFeedback({
        trace_id: message.trace.trace_id,
        rating: nextRating,
        kb_id: settings.kbId,
        tenant_id: settings.tenantId ? settings.tenantId : null,
        session_id: settings.sessionId,
      });
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-950">基于知识库问答</h2>
          <p className="text-xs text-slate-500">回答会展示引用、上下文分数和 Trace ID。</p>
        </div>
        <button
          type="button"
          onClick={() => setMessages([])}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
        >
          <Archive className="h-3.5 w-3.5" />
          清空
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">
        {messages.length === 0 && (
          <div className="flex h-full items-center justify-center">
            <div className="max-w-md text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500">
                <Bot className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{settings.workspaceId ? '输入一个制度或文档问题' : '请选择工作区'}</h3>
              <p className="mt-2 text-sm text-slate-500">{settings.workspaceId ? '系统会基于当前工作区的后端数据回答。' : '工作区列表来自后端接口。'}</p>
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('mb-5 flex gap-3', message.role === 'user' && 'flex-row-reverse')}
            >
              <div className={cn('mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border', message.role === 'user' ? 'border-slate-300 bg-white text-slate-600' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}>
                {message.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={cn('min-w-0 max-w-[920px] flex-1', message.role === 'user' && 'flex-none md:max-w-[70%]')}>
                <div className={cn('rounded-lg border px-4 py-3 text-sm leading-6 shadow-sm', message.role === 'user' ? 'border-slate-900 bg-slate-950 text-white' : 'border-slate-200 bg-white text-slate-800')}>
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown>
                  </div>
                </div>

                {message.role === 'model' && message.trace && (
                  <div className="mt-2 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <IconButton active={message.feedback === 'up'} onClick={() => handleFeedback(message, 'up')}><ThumbsUp className="h-3.5 w-3.5" /></IconButton>
                        <IconButton active={message.feedback === 'down'} onClick={() => handleFeedback(message, 'down')}><ThumbsDown className="h-3.5 w-3.5" /></IconButton>
                        <button
                          type="button"
                          onClick={() => setOpenTraceId(openTraceId === message.id ? null : message.id)}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-950"
                        >
                          证据
                          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', openTraceId === message.id && 'rotate-180')} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span>{message.trace.latency}ms</span>
                        {message.trace.trace_id && <span className="font-mono">{message.trace.trace_id.slice(0, 12)}</span>}
                      </div>
                    </div>

                    <AnimatePresence>
                      {openTraceId === message.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="rounded-lg border border-slate-200 bg-white p-3">
                            <div className="mb-2 text-xs font-semibold tracking-wide text-slate-500">检索上下文</div>
                            <div className="space-y-2">
                              {message.trace.results.map((result, index) => (
                                <TraceResult key={`${result.chunk_id}-${index}`} result={result} />
                              ))}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="mb-5 flex gap-3">
            <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">正在检索证据并生成回答...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 bg-white p-4 md:p-5">
        <div className="relative">
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="向当前知识范围提问..."
            className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-4 pr-14 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-slate-950"
            disabled={!settings.workspaceId || isLoading}
          />
          <button
            type="submit"
            disabled={!settings.workspaceId || !input.trim() || isLoading}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md bg-slate-950 text-white transition-colors hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{settings.workspaceId ? `kb_id=${settings.kbId}${settings.tenantId ? ` tenant_id=${settings.tenantId}` : ''}` : '未选择工作区'}</span>
          <span>top_k={settings.topK}</span>
        </div>
      </form>
    </div>
  );
};

const IconButton = ({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn('flex h-8 w-8 items-center justify-center rounded-md border transition-colors', active ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-950')}
  >
    {children}
  </button>
);

const TraceResult = ({ result }: { result: Citation }) => {
  const score = result.score ?? 0;
  const Icon = result.modality === 'image' ? ImageIcon : result.modality === 'audio' ? FileAudio : result.modality === 'video' ? FileVideo : Library;
  return (
    <div className="rounded-md border border-slate-100 bg-slate-50 p-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
            <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate">{result.citation_label || result.chunk_id}</span>
          </div>
          <div className="mt-1 truncate font-mono text-[11px] text-slate-500">{result.source}</div>
        </div>
        <div className="shrink-0 rounded bg-white px-2 py-1 font-mono text-[11px] text-slate-600">{(score * 100).toFixed(1)}%</div>
      </div>
      {result.span_text && <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{result.span_text}</p>}
      {result.media_uri && <div className="mt-1 truncate font-mono text-[11px] text-slate-400">{result.media_uri}</div>}
    </div>
  );
};
