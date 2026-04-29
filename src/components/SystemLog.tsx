import React from 'react';
import { Clock, Terminal } from 'lucide-react';
import { eventBus } from '../lib/event-bus';
import { cn } from '../lib/utils';

export const SystemLog: React.FC = () => {
  const [events, setEvents] = React.useState(() => eventBus.getEvents());

  React.useEffect(() => {
    return eventBus.subscribe((newEvents) => {
      setEvents([...newEvents]);
    });
  }, []);

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <Terminal className="h-3.5 w-3.5" />
          活动日志
        </h2>
      </div>
      <div className="max-h-40 overflow-y-auto p-2 font-mono">
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2 rounded px-2 py-1 text-[11px] leading-5">
            <span className="flex shrink-0 items-center gap-1 text-slate-400">
              <Clock className="h-3 w-3" />
              {event.time}
            </span>
            <span
              className={cn(
                'break-all',
                event.type === 'success' && 'text-emerald-700',
                event.type === 'warn' && 'text-amber-700',
                event.type === 'error' && 'text-red-700',
                event.type === 'info' && 'text-slate-600',
              )}
            >
              {event.message}
            </span>
          </div>
        ))}
        {events.length === 0 && (
          <div className="px-2 py-5 text-center text-xs text-slate-400">暂无活动</div>
        )}
      </div>
    </div>
  );
};
