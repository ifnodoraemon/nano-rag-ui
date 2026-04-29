import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Library, ThumbsUp, ThumbsDown, Activity, Info, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { chat, sendFeedback } from '../lib/api';
import { cn } from '../lib/utils';
import { useRagSettings } from '../lib/settings-store';

interface RetrievalTrace {
  latency?: number;
  results: { source: string, index: string, score: number }[];
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
  const [showTraceId, setShowTraceId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const startTime = performance.now();

    try {
      const response = await chat({
        query: input,
        kb_id: settings.kbId,
        session_id: settings.sessionId,
        top_k: settings.topK,
      });

      const latency = Math.round(performance.now() - startTime);

      if (response && response.answer) {
        const botMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'model',
          text: response.answer,
          trace: {
            latency,
            trace_id: response.trace_id,
            results: (response.citations || []).map(c => ({ 
              source: c.source, 
              index: c.chunk_id,
              score: c.score ?? 0
            }))
          },
          feedback: null
        };
        setMessages(prev => [...prev, botMessage]);
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'model',
        text: "Neural diagnostic failure. Connection to backend API interrupted or configuration error detected.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFeedback = async (message: Message, rating: 'up' | 'down') => {
    if (!message.trace || !message.trace.trace_id) return;
    const newRating = message.feedback === rating ? null : rating;
    setMessages(prev => prev.map(m => 
      m.id === message.id ? { ...m, feedback: newRating } : m
    ));
    // Provide optimistic UI update above, then send to backend
    if (newRating) {
      try {
        await sendFeedback({
          trace_id: message.trace.trace_id,
          rating: newRating,
          kb_id: settings.kbId,
          session_id: settings.sessionId,
        });
      } catch (err) {
        console.error("Failed to submit feedback", err);
        // revert on failure if needed, simplified for now
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 tech-border rounded-2xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800/50 bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400">进行中 / PROCESS</span>
          </div>
          <div className="h-4 w-px bg-zinc-800 hidden sm:block" />
          <div className="hidden sm:flex items-center space-x-2">
            <Activity className="w-3 h-3 text-zinc-600" />
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">语义检索模式 : 开启</span>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => setMessages([])}
            className="text-[10px] text-zinc-600 hover:text-zinc-300 uppercase font-bold transition-colors flex items-center gap-1.5"
          >
            <Archive className="w-3 h-3" />
            重置 / RESET
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.02)_0%,transparent_70%)]">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-6 opacity-30">
            <div className="relative">
              <Bot className="w-16 h-16 text-zinc-700" />
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500/20 rounded-full blur-sm animate-pulse" />
            </div>
            <div className="max-w-[320px] space-y-2">
              <p className="text-zinc-400 font-bold uppercase tracking-[0.2em] text-xs font-mono text-center">NanoRAG 智能控制台</p>
              <p className="text-[10px] text-zinc-600 uppercase font-mono tracking-tight leading-relaxed text-center">
                等待知识数据注入 / Awaiting Ingestion<br/>
                请先上传技术文档以开始对话。
              </p>
            </div>
          </div>
        )}
        
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex space-x-6 max-w-[95%]",
                message.role === 'user' ? "ml-auto flex-row-reverse space-x-reverse" : "mr-auto"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all mt-1",
                message.role === 'user' 
                  ? "bg-zinc-900 border-zinc-800 shadow-sm" 
                  : "bg-emerald-950/10 border-emerald-900/30 shadow-[0_0_10px_rgba(16,185,129,0.05)]"
              )}>
                {message.role === 'user' ? <User className="w-5 h-5 text-zinc-500" /> : <Bot className="w-5 h-5 text-emerald-600" />}
              </div>
              <div className="space-y-4 flex-1">
                <div className={cn(
                  "p-4 rounded-2xl text-[13.5px] leading-relaxed font-sans",
                  message.role === 'user' 
                    ? "bg-zinc-100 text-zinc-900 rounded-tr-none shadow-md" 
                    : "bg-zinc-900/50 text-zinc-200 border border-zinc-800 rounded-tl-none backdrop-blur-sm shadow-xl"
                )}>
                  <div className="markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {message.text}
                    </ReactMarkdown>
                  </div>
                </div>

                {message.role === 'model' && (
                  <div className="flex flex-col space-y-3">
                    <div className="flex items-center justify-between">
                      {/* Interaction Area */}
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => handleFeedback(message, 'up')}
                          className={cn(
                            "p-1.5 rounded-lg border transition-all",
                            message.feedback === 'up' ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-400"
                          )}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleFeedback(message, 'down')}
                          className={cn(
                            "p-1.5 rounded-lg border transition-all",
                            message.feedback === 'down' ? "bg-red-500/20 border-red-500 text-red-400" : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-400"
                          )}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                          <button 
                            onClick={() => setShowTraceId(showTraceId === message.id ? null : message.id)}
                            className={cn(
                              "flex items-center space-x-2 px-2.5 py-1.5 rounded-lg border text-[10px] uppercase font-bold tracking-widest transition-all",
                              showTraceId === message.id ? "bg-zinc-800 border-zinc-700 text-zinc-200" : "bg-zinc-900 border-zinc-800 text-zinc-600 hover:text-zinc-400"
                            )}
                          >
                            <Info className="w-3 h-3" />
                            <span> {showTraceId === message.id ? '隐藏链路' : '检索链路 / TRACE'}</span>
                          </button>
                      </div>

                      {message.trace && (
                        <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-zinc-900/50 border border-zinc-800/50">
                          <span className="text-[9px] font-mono text-zinc-600 uppercase">RTT</span>
                          <span className="text-[10px] font-mono text-emerald-500">{message.trace.latency}ms</span>
                        </div>
                      )}
                    </div>

                    {/* Trace Details Panel */}
                    <AnimatePresence>
                      {showTraceId === message.id && message.trace && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="p-4 rounded-xl bg-black border border-zinc-900 space-y-4">
                            <h4 className="text-[10px] font-mono uppercase tracking-[0.2em] text-zinc-600 border-b border-zinc-900 pb-2">Retrieved Nodes / 检索分块</h4>
                            <div className="space-y-3">
                              {message.trace.results.map((res, i) => (
                                <div key={i} className="flex flex-col space-y-1">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <Library className="w-3 h-3 text-zinc-700" />
                                      <span className="text-[10px] font-mono text-zinc-400 capitalize truncate max-w-[200px]">{res.source} [CH_{res.index}]</span>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                      <div className="w-16 h-1 bg-zinc-900 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full" style={{ width: `${res.score * 100}%` }} />
                                      </div>
                                      <span className="text-[10px] font-mono text-emerald-500/70">{(res.score * 100).toFixed(1)}%</span>
                                    </div>
                                  </div>
                                </div>
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
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex space-x-6"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-950/10 border border-emerald-900/30 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            </div>
            <div className="flex space-x-1.5 items-center bg-zinc-900/50 px-4 py-3 rounded-2xl rounded-tl-none border border-zinc-800 backdrop-blur-sm">
              <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-1.5 h-1.5 bg-emerald-500/50 rounded-full animate-bounce" />
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-6 border-t border-zinc-800/50 bg-zinc-900/30 backdrop-blur-md">
        <div className="relative group/input">
          <div className="absolute -inset-px bg-gradient-to-r from-emerald-500/20 to-blue-500/20 rounded-xl opacity-0 group-focus-within/input:opacity-100 transition-opacity blur-[2px]" />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="发送技术查询或指令..."
            className="relative w-full bg-zinc-950 border border-zinc-800 rounded-xl py-4 pl-5 pr-14 text-[13.5px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-emerald-600/50 transition-all font-sans"
            disabled={isLoading}
            id="chat-input"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-zinc-950 rounded-lg transition-all active:scale-[0.95]"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center justify-between mt-3 px-1">
          <p className="text-[9px] text-zinc-700 uppercase tracking-[0.3em] font-mono">
            安全神经链接 : 已建立
          </p>
          <div className="flex items-center space-x-3">
             <p className="text-[9px] text-zinc-700 uppercase tracking-[0.1em] font-mono italic">
              嵌入式语义搜索引擎 v2
            </p>
          </div>
        </div>
      </form>
    </div>
  );
};
