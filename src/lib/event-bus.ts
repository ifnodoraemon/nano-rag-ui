type EventType = 'info' | 'success' | 'warn' | 'error';

interface LogEvent {
  id: string;
  time: string;
  message: string;
  type: EventType;
}

type Subscriber = (events: LogEvent[]) => void;

class EventBus {
  private events: LogEvent[] = [
    { id: 'init', time: new Date().toLocaleTimeString(), message: 'System Kernel Initialized', type: 'info' }
  ];
  private subscribers: Subscriber[] = [];

  emit(message: string, type: EventType = 'info') {
    this.events.unshift({
      id: crypto.randomUUID(),
      time: new Date().toLocaleTimeString(),
      message,
      type
    });
    if (this.events.length > 50) this.events.pop();
    this.notify();
  }

  getEvents(): LogEvent[] {
    return this.events;
  }

  subscribe(callback: Subscriber) {
    this.subscribers.push(callback);
    return () => {
      this.subscribers = this.subscribers.filter(sub => sub !== callback);
    };
  }

  private notify() {
    this.subscribers.forEach(sub => sub(this.events));
  }
}

export const eventBus = new EventBus();
