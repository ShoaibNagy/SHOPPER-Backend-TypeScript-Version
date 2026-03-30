import { registerUserListeners } from './user.listener';
import { registerOrderListeners } from './order.listener';
import { registerPaymentListeners } from './payment.listener';
import { logger } from '../../middleware/logger';

// Call once at server bootstrap — registers all eventBus listeners.
// Order matters for readability but not for correctness; all events
// are queued and dispatched asynchronously.
export const registerAllListeners = (): void => {
  registerUserListeners();
  registerOrderListeners();
  registerPaymentListeners();
  logger.info('EventBus listeners registered.');
};