import React from 'react';
import { eventBus } from '../lib/event-bus';
import { Terminal, Clock } from 'lucide-react';
import { cn } from '../lib/utils';

export const SystemLog: React.FC = () => {
  const [events, setEvents] = React.useState(() => eventBus.getEvents());

  React.useEffect(() => {
    return eventBus.subscribe((newEvents) => {
      setEvents([...newEvents]);
    });
  }, []);

  return (
    <div className="flex flex-col space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2">
          <Terminal className="w-3 h-3" />
          系统审计日志 / AUDIT LOG
        </h2>
      </div>

      <div className="bg-black/40 border border-zinc-900 rounded-xl overflow-hidden tech-border">
        <div className="max-h-[160px] overflow-y-auto p-2 space-y-1.5 scrollbar-hide font-mono">
          {events.map((event) => (
            <div key={event.id} className="flex items-start space-x-2 text-[9px] leading-tight group">
              <span className="text-zinc-700 shrink-0 flex items-center">
                <Clock className="w-2.5 h-2.5 mr-1" />
                {event.time}
              </span>
              <span className={cn(
                "break-all",
                event.type === 'success' ? "text-emerald-500/80" :
                event.type === 'warn' ? "text-orange-500/80" :
                event.type === 'error' ? "text-red-500/80" : "text-zinc-500"
              )}>
                {event.message}
              </span>
            </div>
          ))}
          {events.length === 0 && (
            <div className="text-[9px] text-zinc-800 italic p-2 text-center uppercase tracking-widest">
              No recent activity
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
