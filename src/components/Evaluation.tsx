import React, { useState } from 'react';
import { Target, Search, BarChart3, Loader2, CheckCircle2, ChevronRight } from 'lucide-react';
import { embedText, generateAnswer, evaluateResponse } from '../lib/gemini';
import { globalStore } from '../lib/vector-store';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface EvalResult {
  query: string;
  answer: string;
  metrics: {
    relevancy: number;
    faithfulness: number;
    conciseness: number;
    reasoning: string;
  };
}

export const Evaluation: React.FC = () => {
  const [evalInput, setEvalInput] = useState('');
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [results, setResults] = useState<EvalResult[]>([]);

  const runEval = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!evalInput.trim() || isEvaluating) return;

    setIsEvaluating(true);
    try {
      const q = evalInput;
      setEvalInput('');

      // 1. Retrieval
      const queryEmbedding = await embedText(q);
      const searchResults = globalStore.search(queryEmbedding, 3);
      const contextText = searchResults.map(r => r.chunk.text).join('\n\n');

      // 2. Generation
      const answer = await generateAnswer(q, contextText);

      // 3. Eval by LLM
      const evalMetrics = await evaluateResponse(q, answer, contextText);

      setResults(prev => [{
        query: q,
        answer,
        metrics: evalMetrics
      }, ...prev]);
    } catch (error) {
      console.error("Eval error:", error);
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <Target className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-300">自动化评测中心 / EVAL LAB</h2>
        </div>
        <span className="text-[10px] font-mono text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded">LLM-as-a-Judge</span>
      </div>

      <form onSubmit={runEval} className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-transparent rounded-xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="relative flex space-x-2">
          <input
            type="text"
            value={evalInput}
            onChange={(e) => setEvalInput(e.target.value)}
            placeholder="输入需评测的查询指令..."
            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-all font-mono"
            disabled={isEvaluating}
          />
          <button 
            type="submit"
            disabled={isEvaluating || !evalInput.trim()}
            className="px-4 py-2 bg-zinc-100 text-zinc-950 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg active:scale-95"
          >
            {isEvaluating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "运行评测 / RUN"}
          </button>
        </div>
      </form>

      <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 scrollbar-hide">
        <AnimatePresence>
          {results.map((res, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800 space-y-4 tech-border"
            >
              <div className="flex justify-between items-start">
                 <div className="space-y-1">
                   <p className="text-[9px] uppercase text-zinc-600 font-bold tracking-tighter">评估请求 / QUERY</p>
                   <p className="text-xs text-zinc-300 font-medium">"{res.query}"</p>
                 </div>
                 <div className="flex space-x-2">
                   <MetricBadge label="相关性" score={res.metrics.relevancy} />
                   <MetricBadge label="忠实度" score={res.metrics.faithfulness} />
                 </div>
              </div>

              <div className="space-y-2">
                 <p className="text-[9px] uppercase text-zinc-600 font-bold tracking-tighter">生成回答 / ANSWER</p>
                 <p className="text-xs text-zinc-400 italic bg-black/40 p-2 rounded border border-zinc-800/50 leading-relaxed truncate">
                   {res.answer}
                 </p>
              </div>

              <div className="p-3 bg-emerald-950/10 border border-emerald-900/20 rounded-lg">
                <div className="flex items-center space-x-2 mb-2">
                  <BarChart3 className="w-3 h-3 text-emerald-500" />
                  <span className="text-[9px] uppercase font-bold text-emerald-500">Judge Reasoning / 评测分析</span>
                </div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  {res.metrics.reasoning}
                </p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

const MetricBadge = ({ label, score }: { label: string, score: number }) => {
  const getColors = (s: number) => {
    if (s > 0.8) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (s > 0.5) return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    return "bg-red-500/20 text-red-400 border-red-500/30";
  };

  return (
    <div className={cn("px-2 py-0.5 rounded border text-[9px] font-mono", getColors(score))}>
      {label}: {(score * 10).toFixed(1)}
    </div>
  );
};
