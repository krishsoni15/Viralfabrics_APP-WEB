import mongoose, { Document, Schema, Model } from "mongoose";

// Process interface
export interface IProcess extends Document {
  name: string;
  priority: number; // Higher number = higher priority
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
export interface IProcessModel extends Model<IProcess> {
  findByName(name: string): Promise<IProcess | null>;
  findActiveProcesses(): Promise<IProcess[]>;
  getProcessesByPriority(): Promise<IProcess[]>;
  searchProcesses(searchTerm: string): Promise<IProcess[]>;
}

// Validation function for process name
const validateProcessName = (name: string): boolean => {
  // Alphanumeric, spaces, hyphens, underscores, and common process characters
  const processNameRegex = /^[a-zA-Z0-9\s\-_&()]+$/;
  return processNameRegex.test(name);
};

const ProcessSchema = new Schema<IProcess>({
  name: {
    type: String,
    required: [true, "Process name is required"],
    trim: true,
    minlength: [2, "Process name must be at least 2 characters long"],
    maxlength: [100, "Process name cannot exceed 100 characters"],
    unique: true,
    validate: {
      validator: validateProcessName,
      message: "Process name can only contain letters, numbers, spaces, hyphens, underscores, and common process characters"
    },
    index: true // Primary search field
  },
  priority: {
    type: Number,
    required: [true, "Process priority is required"],
    min: [1, "Priority must be at least 1"],
    max: [100, "Priority cannot exceed 100"],
    index: true // For priority-based sorting
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // For active process filtering
  }
}, {
  timestamps: true,
  // Optimize JSON serialization
  toJSON: {
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
    virtuals: true
  },
  toObject: {
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      return ret;
    },
    virtuals: true
  }
});

// **PERFORMANCE INDEXES - STRATEGIC PLACEMENT**
// Single field indexes for primary lookups
ProcessSchema.index({ createdAt: -1 }); // Recent processes
ProcessSchema.index({ updatedAt: -1 });
ProcessSchema.index({ priority: -1 }); // Priority-based sorting
ProcessSchema.index({ isActive: 1, priority: -1 }); // Active processes by priority

// Compound indexes for complex queries
ProcessSchema.index({ name: 1, isActive: 1 }); // Name search with active filter
ProcessSchema.index({ priority: -1, isActive: 1 }); // Priority with active filter

// Static methods
ProcessSchema.statics.findByName = function(name: string) {
  return this.findOne({ name: { $regex: name, $options: 'i' } });
};

ProcessSchema.statics.findActiveProcesses = function() {
  return this.find({ isActive: true }).sort({ priority: -1, name: 1 });
};

ProcessSchema.statics.getProcessesByPriority = function() {
  return this.find({ isActive: true }).sort({ priority: -1, name: 1 });
};

ProcessSchema.statics.searchProcesses = function(searchTerm: string) {
  return this.find({
    $or: [
      { name: { $regex: searchTerm, $options: 'i' } },
      { description: { $regex: searchTerm, $options: 'i' } }
    ],
    isActive: true
  }).sort({ priority: -1, name: 1 });
};

// Pre-save middleware
ProcessSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.name = this.name.trim();
  }
  next();
});

// Force model reset to ensure schema changes take effect
const modelName = 'Process';
if (mongoose.models[modelName]) {
  delete mongoose.models[modelName];
}

// Also clear the model from the connection
if (mongoose.connection.models[modelName]) {
  delete (mongoose.connection.models as any)[modelName];
}

export default mongoose.model<IProcess, IProcessModel>(modelName, ProcessSchema);
