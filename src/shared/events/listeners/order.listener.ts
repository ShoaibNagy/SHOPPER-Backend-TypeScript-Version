import { eventBus } from '../eventBus';
import { sendEmail } from '../../utils/emailSender';
import { Order } from '../../../modules/orders/order.model';
import { User } from '../../../modules/users/user.model';
import { logger } from '../../middleware/logger';
import { OrderStatus } from '../../../modules/orders/order.types';

// Human-readable labels for order status transitions shown in emails
const STATUS_LABELS: Record<string, string> = {
  [OrderStatus.CONFIRMED]:  'confirmed and being prepared',
  [OrderStatus.PROCESSING]: 'currently being packed',
  [OrderStatus.SHIPPED]:    'on its way to you',
  [OrderStatus.DELIVERED]:  'delivered',
  [OrderStatus.CANCELLED]:  'cancelled',
  [OrderStatus.REFUNDED]:   'refunded',
};

export const registerOrderListeners = (): void => {

  // ── order.placed ──────────────────────────────────────────────────────────────
  // Fired by order.service after a new order is created from the cart.
  // Sends an order receipt email summarising what was purchased.
  eventBus.on('order.placed', async ({ orderId, userId, total }) => {
    logger.info(`[order.placed] Order ${orderId} placed by user ${userId} — total: $${total}`);

    try {
      const [order, user] = await Promise.all([
        Order.findById(orderId),
        User.findById(userId),
      ]);

      if (!order || !user) {
        logger.warn(`[order.placed] Order or user not found for order ${orderId} — skipping email.`);
        return;
      }

      // Build an itemised receipt table for the email body
      const itemRows = order.items
        .map(
          (item) =>
            `<tr>
              <td>${item.name}</td>
              <td>${item.quantity}</td>
              <td>$${item.price.toFixed(2)}</td>
              <td>$${item.subtotal.toFixed(2)}</td>
            </tr>`,
        )
        .join('');

      await sendEmail({
        to:      user.email,
        subject: `Order ${orderId} received — thank you!`,
        html: `
          <h2>Hi ${user.username}, we received your order!</h2>
          <p>Your order <strong>#${orderId}</strong> is being processed. 
             You'll receive another email once it's confirmed.</p>
          <table border="1" cellpadding="6" cellspacing="0">
            <thead>
              <tr><th>Item</th><th>Qty</th><th>Price</th><th>Subtotal</th></tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>
          <p><strong>Total: $${total.toFixed(2)}</strong></p>
          <p>Shipping to: ${order.shippingAddress.fullName}, ${order.shippingAddress.city}, ${order.shippingAddress.country}</p>
        `,
        text: `Hi ${user.username}, your order #${orderId} was received. Total: $${total.toFixed(2)}.`,
      });
    } catch (err) {
      logger.error(`[order.placed] Failed to send receipt email for order ${orderId}:`, err);
    }
  });

  // ── order.statusChanged ───────────────────────────────────────────────────────
  // Fired by order.service whenever an order transitions to a new status.
  // Sends a status update email so the customer can track their order.
  eventBus.on('order.statusChanged', async ({ orderId, status }) => {
    logger.info(`[order.statusChanged] Order ${orderId} → ${status}`);

    try {
      const order = await Order.findById(orderId);
      if (!order) {
        logger.warn(`[order.statusChanged] Order ${orderId} not found — skipping email.`);
        return;
      }

      const user = await User.findById(order.userId);
      if (!user) {
        logger.warn(`[order.statusChanged] User not found for order ${orderId} — skipping email.`);
        return;
      }

      const label = STATUS_LABELS[status] ?? status;

      await sendEmail({
        to:      user.email,
        subject: `Your order is ${label}`,
        html: `
          <p>Hi ${user.username},</p>
          <p>Your order <strong>#${orderId}</strong> is now <strong>${label}</strong>.</p>
          ${status === OrderStatus.SHIPPED
            ? '<p>You can track your delivery using the tracking number provided by the courier.</p>'
            : ''}
          ${status === OrderStatus.DELIVERED
            ? '<p>We hope you enjoy your purchase! Feel free to leave a review.</p>'
            : ''}
          ${status === OrderStatus.CANCELLED
            ? '<p>If you were charged, a refund will be processed within 3–5 business days.</p>'
            : ''}
        `,
        text: `Hi ${user.username}, your order #${orderId} is now ${label}.`,
      });
    } catch (err) {
      logger.error(`[order.statusChanged] Failed to send status email for order ${orderId}:`, err);
    }
  });

};