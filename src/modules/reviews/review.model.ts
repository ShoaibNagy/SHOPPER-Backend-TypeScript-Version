import mongoose, { Schema, Document, Model } from 'mongoose';
import { ReviewResponse } from './review.types';

export interface IReview extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  username: string;           // denormalised for fast reads — no join needed
  productId: mongoose.Types.ObjectId;
  rating: number;
  comment: string;
  createdAt: Date;
  updatedAt: Date;
  toResponseObject(): ReviewResponse;
}

interface IReviewModel extends Model<IReview> {
  getAverageRating(productId: string): Promise<number>;
}

const reviewSchema = new Schema<IReview>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    productId: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot exceed 5'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
      maxlength: [1000, 'Comment cannot exceed 1000 characters'],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// ── Indexes ──────────────────────────────────────────────────────────────────
// Compound unique index: one review per user per product
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });
reviewSchema.index({ productId: 1, createdAt: -1 }); // product review listing
reviewSchema.index({ rating: 1 });                   // filter by rating

// ── Instance methods ─────────────────────────────────────────────────────────
reviewSchema.methods.toResponseObject = function (): ReviewResponse {
  return {
    id:        (this._id as mongoose.Types.ObjectId).toString(),
    userId:    (this.userId as mongoose.Types.ObjectId).toString(),
    username:  this.username as string,
    productId: (this.productId as mongoose.Types.ObjectId).toString(),
    rating:    this.rating as number,
    comment:   this.comment as string,
    createdAt: this.createdAt as Date,
    updatedAt: this.updatedAt as Date,
  };
};

// ── Static methods ───────────────────────────────────────────────────────────
reviewSchema.statics.getAverageRating = async function (
  productId: string,
): Promise<number> {
  const result = await this.aggregate([
    { $match: { productId: new mongoose.Types.ObjectId(productId) } },
    { $group: { _id: null, avg: { $avg: '$rating' } } },
  ]) as { avg: number }[];

  return result.length > 0 ? Math.round((result[0].avg) * 10) / 10 : 0;
};

export const Review = mongoose.model<IReview, IReviewModel>('Review', reviewSchema);