import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IGreyInfo extends Document {
  orderId: string;
  order: mongoose.Types.ObjectId;
  quality: mongoose.Types.ObjectId;
  quantity?: number; // greighMtr
  chalanNo?: string;
  numberOfPieces?: number; // pcs
  date?: Date; // millDate
  createdAt: Date;
  updatedAt: Date;
}

const GreyInfoSchema = new Schema<IGreyInfo>({
  orderId: {
    type: String,
    required: [true, "Order ID is required"]
  },
  order: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    required: [true, "Order reference is required"]
  },
  quality: {
    type: Schema.Types.ObjectId,
    ref: "Quality"
  },
  quantity: {
    type: Number,
    min: [0, "Quantity cannot be negative"]
  },
  chalanNo: {
    type: String,
    trim: true,
    maxlength: [50, "Chalan number cannot exceed 50 characters"]
  },
  numberOfPieces: {
    type: Number,
    min: [0, "Number of pieces cannot be negative"]
  },
  date: {
    type: Date,
    index: true
  }
}, {
  timestamps: true,
  collection: 'greyinfo'
});

// Indexes
GreyInfoSchema.index({ orderId: 1 });
GreyInfoSchema.index({ order: 1 });
GreyInfoSchema.index({ quality: 1 });
GreyInfoSchema.index({ createdAt: -1 });

export interface IGreyInfoModel extends Model<IGreyInfo> {}

const GreyInfo: IGreyInfoModel = mongoose.models.GreyInfo || mongoose.model<IGreyInfo, IGreyInfoModel>('GreyInfo', GreyInfoSchema);

export default GreyInfo;

