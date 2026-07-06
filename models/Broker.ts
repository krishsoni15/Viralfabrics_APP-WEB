import mongoose, { Document, Schema, Model } from "mongoose";

export interface IBroker extends Document {
  name: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IBrokerModel extends Model<IBroker> {
  searchByName(query: string, limit?: number): Promise<IBroker[]>;
}

const BrokerSchema = new Schema<IBroker>({
  name: {
    type: String,
    required: [true, "Broker name is required"],
    trim: true,
    maxlength: [200, "Broker name cannot exceed 200 characters"],
    index: true
  },
  phone: {
    type: String,
    trim: true,
    default: "",
    maxlength: [20, "Phone cannot exceed 20 characters"]
  }
}, {
  timestamps: true,
  collection: 'brokers',
  toJSON: {
    transform: function (doc, ret: any) {
      ret.id = ret._id;
      delete ret.__v;
      return ret;
    }
  }
});

// Case-insensitive unique index on name + phone
BrokerSchema.index(
  { name: 1, phone: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 }, name: 'idx_broker_name_phone_unique' }
);

// Text search
BrokerSchema.index({ name: "text", phone: "text" }, {
  weights: { name: 10, phone: 5 },
  name: "idx_broker_text_search"
});

BrokerSchema.statics.searchByName = function (query: string, limit: number = 10): Promise<IBroker[]> {
  return this.find({
    name: { $regex: query, $options: 'i' }
  })
    .sort({ name: 1 })
    .limit(limit)
    .lean();
};

// Programmatically drop the old single-name unique index if database is connected
if (mongoose.connection.readyState >= 1) {
  mongoose.connection.db?.collection('brokers').dropIndex('idx_broker_name_unique').catch(() => {});
} else {
  mongoose.connection.once('open', () => {
    mongoose.connection.db?.collection('brokers').dropIndex('idx_broker_name_unique').catch(() => {});
  });
}

if (mongoose.models.Broker) {
  delete mongoose.models.Broker;
}

const Broker = mongoose.model<IBroker, IBrokerModel>("Broker", BrokerSchema);

export default Broker;
