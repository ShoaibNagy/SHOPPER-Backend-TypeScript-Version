export enum OrderStatus {
    PENDING = 'pending',         // created, awaiting payment
    CONFIRMED = 'confirmed',     // payment captured
    PROCESSING = 'processing',   // warehouse picking
    SHIPPED = 'shipped',         // courier collected
    DELIVERED = 'delivered',     // delivery confirmed
    CANCELLED = 'cancelled',     // cancelled before shipment
    REFUNDED = 'refunded',       // payment reversed
  }
  
  // Valid transitions — enforced in the service layer
  export const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
    [OrderStatus.PENDING]:    [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
    [OrderStatus.CONFIRMED]:  [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
    [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED],
    [OrderStatus.SHIPPED]:    [OrderStatus.DELIVERED],
    [OrderStatus.DELIVERED]:  [OrderStatus.REFUNDED],
    [OrderStatus.CANCELLED]:  [],
    [OrderStatus.REFUNDED]:   [],
  };
  
  export interface OrderItemSnapshot {
    productId: string;
    name: string;
    image: string;
    price: number;   // price locked at time of order — never changes
    quantity: number;
    subtotal: number;
  }
  
  export interface ShippingAddress {
    fullName: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  }
  
  export interface OrderResponse {
    id: string;
    userId: string;
    items: OrderItemSnapshot[];
    shippingAddress: ShippingAddress;
    status: OrderStatus;
    total: number;
    paymentIntentId?: string;
    createdAt: Date;
    updatedAt: Date;
  }
  
  export interface PlaceOrderDTO {
    shippingAddress: ShippingAddress;
  }
  
  export interface UpdateOrderStatusDTO {
    status: OrderStatus;
  }
  
  export interface OrderQuery {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    status?: OrderStatus;
    userId?: string;
  }