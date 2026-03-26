import { logger } from '../middleware/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Stub implementation — swap the body of sendEmail() for Nodemailer,
// SendGrid, Resend, or any other provider without touching call sites.
export const sendEmail = async (options: EmailOptions): Promise<void> => {
  if (process.env['NODE_ENV'] === 'development') {
    logger.info(`[DEV] Email would be sent to ${options.to}: ${options.subject}`);
    return;
  }

  // TODO: plug in your email provider here
  // Example with Nodemailer:
  // const transporter = nodemailer.createTransport({ ... });
  // await transporter.sendMail({ from: 'noreply@shopper.com', ...options });

  logger.warn('Email provider not configured. Message not sent.');
};

// Pre-built email templates
export const emailTemplates = {
  welcomeEmail: (username: string): EmailOptions => ({
    to: '',
    subject: 'Welcome to Shopper!',
    html: `<h1>Welcome, ${username}!</h1><p>Your account has been created successfully.</p>`,
    text: `Welcome, ${username}! Your account has been created successfully.`,
  }),

  passwordReset: (username: string, resetUrl: string): EmailOptions => ({
    to: '',
    subject: 'Reset your Shopper password',
    html: `<p>Hi ${username},</p><p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    text: `Hi ${username}, visit this link to reset your password: ${resetUrl}`,
  }),

  orderConfirmation: (username: string, orderId: string): EmailOptions => ({
    to: '',
    subject: `Order ${orderId} confirmed`,
    html: `<p>Hi ${username},</p><p>Your order <strong>${orderId}</strong> has been confirmed.</p>`,
    text: `Hi ${username}, your order ${orderId} has been confirmed.`,
  }),
};