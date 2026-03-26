import { EventEmitter } from 'events';
import { logger } from '../middleware/logger';

// Extend this union as new domain events are added
export type AppEventMap = {
  'user.registered': { userId: string; email: string; username: string };
  'user.passwordChanged': { userId: string };
  'order.placed': { orderId: string; userId: string; total: number };
  'order.statusChanged': { orderId: string; status: string };
  'payment.succeeded': { orderId: string; amount: number };
  'payment.failed': { orderId: string; reason: string };
};

export type AppEventName = keyof AppEventMap;

class TypedEventBus extends EventEmitter {
  emit<K extends AppEventName>(event: K, payload: AppEventMap[K]): boolean {
    logger.info(`Event emitted: ${event}`, payload);
    return super.emit(event, payload);
  }

  on<K extends AppEventName>(event: K, listener: (payload: AppEventMap[K]) => void): this {
    return super.on(event, listener);
  }

  once<K extends AppEventName>(event: K, listener: (payload: AppEventMap[K]) => void): this {
    return super.once(event, listener);
  }

  off<K extends AppEventName>(event: K, listener: (payload: AppEventMap[K]) => void): this {
    return super.off(event, listener);
  }
}

export const eventBus = new TypedEventBus();