import mongoose, { Document, Schema, Model } from "mongoose";

// TypeScript interface for better type safety
export interface IQuality extends Document {
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Static methods interface
export interface IQualityModel extends Model<IQuality> {
  findByName(name: string): Promise<IQuality | null>;
  searchQualities(searchTerm: string): Promise<IQuality[]>;
  findActiveQualities(): Promise<IQuality[]>;
  findRecentlyAdded(limit?: number): Promise<IQuality[]>;
}

// Validation functions
const validateQualityName = (name: string) => {
  return /^[a-zA-Z0-9\s\-_]+$/.test(name); // Alphanumeric, spaces, hyphens, underscores
};

const QualitySchema = new Schema<IQuality>({
  name: {
    type: String,
    required: [true, "Quality name is required"],
    trim: true,
    minlength: [2, "Quality name must be at least 2 characters long"],
    maxlength: [100, "Quality name cannot exceed 100 characters"],
    unique: true,
    validate: {
      validator: validateQualityName,
      message: "Quality name can only contain letters, numbers, spaces, hyphens, and underscores"
    },
    index: true // Primary search field
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, "Description cannot exceed 500 characters"]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true // For active quality filtering
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
QualitySchema.index({ createdAt: -1 }); // Recent qualities
QualitySchema.index({ updatedAt: -1 }); // Recently updated

// Compound indexes for common query patterns
QualitySchema.index({ name: 1, isActive: 1 }); // Name searches for active qualities
QualitySchema.index({ createdAt: -1, isActive: 1 }); // Recent active qualities

// Text index for search functionality with weights
QualitySchema.index({ 
  name: "text", 
  description: "text"
}, {
  weights: {
    name: 3,        // Highest priority
    description: 1  // Lower priority
  },
  name: "quality_text_search"
});

// **STATIC METHODS FOR COMMON QUERIES**
QualitySchema.statics.findByName = function(name: string): Promise<IQuality | null> {
  return this.findOne({ 
    name: { $regex: name, $options: 'i' },
    isActive: true 
  }).lean(); // Use lean() for read-only queries
};

QualitySchema.statics.searchQualities = function(searchTerm: string): Promise<IQuality[]> {
  return this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
  .sort({ score: { $meta: "textScore" } })
  .limit(50) // Limit results for performance
  .lean();
};

QualitySchema.statics.findActiveQualities = function(): Promise<IQuality[]> {
  return this.find({ isActive: true })
    .sort({ name: 1 })
    .lean();
};

QualitySchema.statics.findRecentlyAdded = function(limit: number = 10): Promise<IQuality[]> {
  return this.find({ isActive: true })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
};

// **VIRTUAL FIELDS FOR COMPUTED DATA**
QualitySchema.virtual('fullInfo').get(function() {
  return {
    id: this._id,
    name: this.name,
    description: this.description,
    isActive: this.isActive,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
});

// **MIDDLEWARE FOR DATA INTEGRITY**
// Pre-save middleware for data normalization
QualitySchema.pre('save', function(next) {
  // Normalize name (capitalize first letter of each word)
  if (this.name) {
    this.name = this.name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  next();
});

// Error handling middleware
QualitySchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

// **QUERY OPTIMIZATION MIDDLEWARE**
// Add lean() to all find queries for better performance
QualitySchema.pre('find', function() {
  this.lean();
});

QualitySchema.pre('findOne', function() {
  this.lean();
});

// Create and export the model
const Quality = mongoose.models.Quality || mongoose.model<IQuality, IQualityModel>("Quality", QualitySchema);

export default Quality;
