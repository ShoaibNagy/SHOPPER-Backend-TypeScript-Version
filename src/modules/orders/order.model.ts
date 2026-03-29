import mongoose, { Schema, Document, Model } from 'mongoose';
import { OrderStatus, OrderItemSnapshot, ShippingAddress, OrderResponse } from './order.types';

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  items: OrderItemSnapshot[];
  shippingAddress: ShippingAddress;
  status: OrderStatus;
  total: number;
  paymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
  toResponseObject(): OrderResponse;
}

interface IOrderModel extends Model<IOrder> {
  findByUser(userId: string): Promise<IOrder[]>;
}

const orderItemSchema = new Schema<OrderItemSnapshot>(
  {
    productId: { type: String, required: true },
    name:      { type: String, required: true },
    image:     { type: String, required: true },
    price:     { type: Number, required: true, min: 0 },
    quantity:  { type: Number, required: true, min: 1 },
    subtotal:  { type: Number, required: true, min: 0 },
  },
  { _id: false }, // no separate _id for embedded items
);

const shippingAddressSchema = new Schema<ShippingAddress>(
  {
    fullName:   { type: String, required: true, trim: true },
    line1:      { type: String, required: true, trim: true },
    line2:      { type: String, trim: true },
    city:       { type: String, required: true, trim: true },
    state:      { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country:    { type: String, required: true, trim: true },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items: OrderItemSnapshot[]) => items.length > 0,
        message: 'Order must contain at least one item',
      },
    },
    shippingAddress: {
      type: shippingAddressSchema,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(OrderStatus),
      default: OrderStatus.PENDING,
    },
    total: {
      type: Number,
      required: true,
      min: [0, 'Order total cannot be negative'],
    },
    paymentIntentId: {
      type: String,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Indexes ──────────────────────────────────────────────────────────────────
orderSchema.index({ userId: 1, createdAt: -1 }); // user order history
orderSchema.index({ status: 1 });                 // admin filtering by status
orderSchema.index({ paymentIntentId: 1 });        // payment webhook lookup

// ── Instance methods ─────────────────────────────────────────────────────────
orderSchema.methods.toResponseObject = function (): OrderResponse {
  return {
    id:              (this._id as mongoose.Types.ObjectId).toString(),
    userId:          (this.userId as mongoose.Types.ObjectId).toString(),
    items:           this.items as OrderItemSnapshot[],
    shippingAddress: this.shippingAddress as ShippingAddress,
    status:          this.status as OrderStatus,
    total:           this.total as number,
    paymentIntentId: this.paymentIntentId as string | undefined,
    createdAt:       this.createdAt as Date,
    updatedAt:       this.updatedAt as Date,
  };
};

// ── Static methods ───────────────────────────────────────────────────────────
orderSchema.statics.findByUser = function (userId: string): Promise<IOrder[]> {
  return this.find({ userId }).sort({ createdAt: -1 });
};

export const Order = mongoose.model<IOrder, IOrderModel>('Order', orderSchema);