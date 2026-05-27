import mongoose, { Document, Schema, Model } from "mongoose";

export interface ISystemConfig extends Document {
  key: string;
  value: any;
  updatedAt: Date;
  createdAt: Date;
}

export interface ISystemConfigModel extends Model<ISystemConfig> {
  getLogoutAllTimestamp(): Promise<Date | null>;
  setLogoutAllTimestamp(): Promise<void>;
}

const SystemConfigSchema = new Schema<ISystemConfig>({
  key: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  value: {
    type: Schema.Types.Mixed,
    required: true
  }
}, {
  timestamps: true,
  collection: 'system_configs'
});

// Static method to get logout all timestamp
// ⚡ OPTIMIZATION: Use lean() for faster queries and select only needed fields
SystemConfigSchema.statics.getLogoutAllTimestamp = async function(): Promise<Date | null> {
  const config = await this.findOne({ key: 'logout_all_timestamp' })
    .select('value')
    .lean()
    .maxTimeMS(2000); // 2 second timeout
  if (config && config.value) {
    return new Date(config.value);
  }
  return null;
};

// Static method to set logout all timestamp
// ⚡ OPTIMIZATION: Add timeout and lean options
SystemConfigSchema.statics.setLogoutAllTimestamp = async function(): Promise<void> {
  await this.findOneAndUpdate(
    { key: 'logout_all_timestamp' },
    { 
      key: 'logout_all_timestamp',
      value: new Date().toISOString()
    },
    { 
      upsert: true, 
      new: true,
      maxTimeMS: 2000 // 2 second timeout
    }
  );
};

const SystemConfig = mongoose.models.SystemConfig || mongoose.model<ISystemConfig, ISystemConfigModel>("SystemConfig", SystemConfigSchema);

export default SystemConfig;

