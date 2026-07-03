import mongoose, { Document, Schema, Model } from "mongoose";

export interface ISupplier extends Document {
  name: string;
  address?: string;
  gstin?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISupplierModel extends Model<ISupplier> {
  searchByName(query: string, limit?: number): Promise<ISupplier[]>;
}

const SupplierSchema = new Schema<ISupplier>({
  name: {
    type: String,
    required: [true, "Supplier name is required"],
    trim: true,
    maxlength: [300, "Supplier name cannot exceed 300 characters"],
    index: true
  },
  address: {
    type: String,
    trim: true,
    default: "",
    maxlength: [500, "Address cannot exceed 500 characters"]
  },
  gstin: {
    type: String,
    trim: true,
    uppercase: true,
    default: "",
    maxlength: [20, "GSTIN cannot exceed 20 characters"]
  }
}, {
  timestamps: true,
  collection: 'suppliers',
  toJSON: {
    transform: function (doc, ret: any) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Case-insensitive unique index on name + address + gstin
SupplierSchema.index(
  { name: 1, address: 1, gstin: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 }, name: 'idx_supplier_name_details_unique' }
);

// Text search
SupplierSchema.index({ name: "text", address: "text", gstin: "text" }, {
  weights: { name: 10, gstin: 5, address: 3 },
  name: "idx_supplier_text_search"
});

SupplierSchema.statics.searchByName = function (query: string, limit: number = 10): Promise<ISupplier[]> {
  return this.find({
    name: { $regex: query, $options: 'i' }
  })
    .sort({ name: 1 })
    .limit(limit)
    .lean();
};

// Programmatically drop the old single-name unique index if database is connected
if (mongoose.connection.readyState >= 1) {
  mongoose.connection.db?.collection('suppliers').dropIndex('idx_supplier_name_unique').catch(() => {});
} else {
  mongoose.connection.once('open', () => {
    mongoose.connection.db?.collection('suppliers').dropIndex('idx_supplier_name_unique').catch(() => {});
  });
}

if (mongoose.models.Supplier) {
  delete mongoose.models.Supplier;
}

const Supplier = mongoose.model<ISupplier, ISupplierModel>("Supplier", SupplierSchema);

export default Supplier;
