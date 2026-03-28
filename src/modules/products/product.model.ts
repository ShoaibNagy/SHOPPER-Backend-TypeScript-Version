import mongoose, { Schema, Document, Model } from 'mongoose';
import { ProductCategory, ProductResponse } from './product.types';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  image: string;
  category: ProductCategory;
  new_price: number;
  old_price: number;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
  toResponseObject(): ProductResponse;
}

interface IProductModel extends Model<IProduct> {
  findByCategory(category: ProductCategory): Promise<IProduct[]>;
}

const productSchema = new Schema<IProduct>(
  {
    name: {
      type: String,
      required: [true, 'Product name is required'],
      trim: true,
      maxlength: [200, 'Product name cannot exceed 200 characters'],
    },
    image: {
      type: String,
      required: [true, 'Product image URL is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: Object.values(ProductCategory),
        message: `Category must be one of: ${Object.values(ProductCategory).join(', ')}`,
      },
    },
    new_price: {
      type: Number,
      required: [true, 'New price is required'],
      min: [0, 'Price cannot be negative'],
    },
    old_price: {
      type: Number,
      required: [true, 'Old price is required'],
      min: [0, 'Price cannot be negative'],
    },
    available: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Indexes ──────────────────────────────────────────────────────────────────
productSchema.index({ category: 1 });
productSchema.index({ available: 1 });
productSchema.index({ new_price: 1 });
productSchema.index({ name: 'text' }); // enables $text search on name

// ── Instance methods ─────────────────────────────────────────────────────────
productSchema.methods.toResponseObject = function (): ProductResponse {
  return {
    id: (this._id as mongoose.Types.ObjectId).toString(),
    name: this.name as string,
    image: this.image as string,
    category: this.category as ProductCategory,
    new_price: this.new_price as number,
    old_price: this.old_price as number,
    available: this.available as boolean,
    createdAt: this.createdAt as Date,
    updatedAt: this.updatedAt as Date,
  };
};

// ── Static methods ───────────────────────────────────────────────────────────
productSchema.statics.findByCategory = function (
  category: ProductCategory,
): Promise<IProduct[]> {
  return this.find({ category, available: true });
};

export const Product = mongoose.model<IProduct, IProductModel>('Product', productSchema);