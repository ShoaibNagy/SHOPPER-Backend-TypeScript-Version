import { eventBus } from '../eventBus';
import { sendEmail } from '../../utils/emailSender';
import { Order } from '../../../modules/orders/order.model';
import { User } from '../../../modules/users/user.model';
import { logger } from '../../middleware/logger';

export const registerPaymentListeners = (): void => {

  // ── payment.succeeded ─────────────────────────────────────────────────────────
  // Fired by payment.service when Stripe confirms payment via webhook.
  // Sends a payment confirmation email — the order.statusChanged listener
  // will send the separate "order confirmed" email once the status updates.
  eventBus.on('payment.succeeded', async ({ orderId, amount }) => {
    logger.info(`[payment.succeeded] Payment confirmed for order ${orderId} — $${amount}`);

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        logger.warn(`[payment.succeeded] Order ${orderId} not found — skipping email.`);
        return;
      }

      const user = await User.findById(order.userId);
      if (!user) {
        logger.warn(`[payment.succeeded] User not found for order ${orderId} — skipping email.`);
        return;
      }

      await sendEmail({
        to:      user.email,
        subject: `Payment confirmed — Order #${orderId}`,
        html: `
          <p>Hi ${user.username},</p>
          <p>We successfully received your payment of <strong>$${amount.toFixed(2)}</strong> 
             for order <strong>#${orderId}</strong>.</p>
          <p>Your order is now being prepared and you'll receive a shipping update soon.</p>
        `,
        text: `Hi ${user.username}, payment of $${amount.toFixed(2)} received for order #${orderId}.`,
      });
    } catch (err) {
      logger.error(`[payment.succeeded] Failed to send payment confirmation for order ${orderId}:`, err);
    }
  });

  // ── payment.failed ────────────────────────────────────────────────────────────
  // Fired by payment.service when Stripe reports a failed payment attempt.
  // Notifies the customer so they can retry with a different card.
  eventBus.on('payment.failed', async ({ orderId, reason }) => {
    logger.warn(`[payment.failed] Payment failed for order ${orderId}: ${reason}`);

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        logger.warn(`[payment.failed] Order ${orderId} not found — skipping email.`);
        return;
      }

      const user = await User.findById(order.userId);
      if (!user) {
        logger.warn(`[payment.failed] User not found for order ${orderId} — skipping email.`);
        return;
      }

      await sendEmail({
        to:      user.email,
        subject: `Payment failed — Order #${orderId}`,
        html: `
          <p>Hi ${user.username},</p>
          <p>Unfortunately, your payment for order <strong>#${orderId}</strong> could not be processed.</p>
          <p><strong>Reason:</strong> ${reason}</p>
          <p>Please try again with a different payment method. Your order is still saved 
             and waiting for payment.</p>
        `,
        text: `Hi ${user.username}, your payment for order #${orderId} failed: ${reason}. Please retry.`,
      });
    } catch (err) {
      logger.error(`[payment.failed] Failed to send payment failure email for order ${orderId}:`, err);
    }
  });

};