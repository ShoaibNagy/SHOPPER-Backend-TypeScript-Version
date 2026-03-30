import { eventBus } from '../eventBus';
import { sendEmail, emailTemplates } from '../../utils/emailSender';
import { User } from '../../../modules/users/user.model';
import { logger } from '../../middleware/logger';

export const registerUserListeners = (): void => {

  // ── user.registered ──────────────────────────────────────────────────────────
  // Fired by auth.service after a new account is created.
  // Sends a welcome email to the new user.
  eventBus.on('user.registered', async ({ email, username }) => {
    logger.info(`[user.registered] Sending welcome email to ${email}`);

    try {
      const template = emailTemplates.welcomeEmail(username);
      await sendEmail({ ...template, to: email });
    } catch (err) {
      // Email failure must never crash the server — log and continue
      logger.error(`[user.registered] Failed to send welcome email to ${email}:`, err);
    }
  });

  // ── user.passwordChanged ──────────────────────────────────────────────────────
  // Fired by user.service after a password change.
  // Sends a security alert so the account owner knows if they didn't initiate it.
  eventBus.on('user.passwordChanged', async ({ userId }) => {
    logger.info(`[user.passwordChanged] Sending security alert for user ${userId}`);

    try {
      const user = await User.findById(userId);
      if (!user) {
        logger.warn(`[user.passwordChanged] User ${userId} not found — skipping alert.`);
        return;
      }

      await sendEmail({
        to:      user.email,
        subject: 'Your Shopper password was changed',
        html: `
          <p>Hi ${user.username},</p>
          <p>Your password was recently changed. If this was you, no action is needed.</p>
          <p>If you did not make this change, please contact support immediately.</p>
        `,
        text: `Hi ${user.username}, your password was recently changed. If you did not do this, contact support immediately.`,
      });
    } catch (err) {
      logger.error(`[user.passwordChanged] Failed to send security alert for user ${userId}:`, err);
    }
  });

};