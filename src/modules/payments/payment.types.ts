export enum PaymentStatus {
    PENDING   = 'pending',
    SUCCEEDED = 'succeeded',
    FAILED    = 'failed',
    REFUNDED  = 'refunded',
  }
  
  export interface CreatePaymentIntentDTO {
    orderId: string;
  }
  
  export interface PaymentIntentResponse {
    clientSecret: string;
    paymentIntentId: string;
    amount: number;       // in smallest currency unit (cents)
    currency: string;
  }
  
  export interface RefundDTO {
    orderId: string;
    reason?: string;
  }
  
  export interface RefundResponse {
    refundId: string;
    amount: number;
    status: string;
  }
  
  // Stripe webhook event types we handle
  export type StripeWebhookEventType =
    | 'payment_intent.succeeded'
    | 'payment_intent.payment_failed'
    | 'charge.refunded';