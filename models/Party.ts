import mongoose, { Document, Schema, Model } from "mongoose";

// Enhanced TypeScript interfaces
export interface IParty extends Document {
  name: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  isActive: boolean;
  category: 'customer' | 'supplier' | 'partner' | 'other';
  priority: number;
  creditLimit?: number;
  paymentTerms?: number; // days
  taxId?: string;
  website?: string;
  notes?: string;
  metadata: {
    createdBy?: string;
    tags: string[];
    source?: string;
    industry?: string;
    region?: string;
  };
  lastOrderDate?: Date;
  totalOrders: number;
  totalValue: number;
  createdAt: Date;
  updatedAt: Date;
}

// Enhanced static methods interface
export interface IPartyModel extends Model<IParty> {
  findByName(name: string): Promise<IParty | null>;
  searchParties(searchTerm: string): Promise<IParty[]>;
  findActiveParties(): Promise<IParty[]>;
  findByContactPhone(phone: string): Promise<IParty | null>;
  findByCategory(category: string): Promise<IParty[]>;
  findByRegion(region: string): Promise<IParty[]>;
  findTopCustomers(limit?: number): Promise<IParty[]>;
  findRecentlyActive(days: number): Promise<IParty[]>;
  getPartyStats(): Promise<any>;
}

// Validation functions
const validatePhoneNumber = (phone: string) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateWebsite = (website: string) => {
  const urlRegex = /^https?:\/\/.+/;
  return urlRegex.test(website);
};

const validateTaxId = (taxId: string) => {
  return /^[A-Z0-9]{5,20}$/.test(taxId);
};

const PartySchema = new Schema<IParty>({
  name: {
    type: String,
    required: [true, "Party name is required"],
    trim: true,
    minlength: [2, "Party name must be at least 2 characters"],
    maxlength: [100, "Party name cannot exceed 100 characters"],
    unique: true,
    index: true
  },
  contactName: {
    type: String,
    trim: true,
    maxlength: [50, "Contact name cannot exceed 50 characters"]
  },
  contactPhone: {
    type: String,
    trim: true,
    maxlength: [20, "Contact phone cannot exceed 20 characters"],
    sparse: true,
    validate: {
      validator: validatePhoneNumber,
      message: "Please provide a valid phone number"
    }
  },
  contactEmail: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    validate: {
      validator: validateEmail,
      message: "Please provide a valid email address"
    }
  },
  address: {
    type: String,
    trim: true,
    maxlength: [200, "Address cannot exceed 200 characters"]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  category: {
    type: String,
    enum: {
      values: ['customer', 'supplier', 'partner', 'other'],
      message: "Category must be one of: customer, supplier, partner, other"
    },
    default: 'customer',
    index: true
  },
  priority: {
    type: Number,
    min: [1, "Priority must be at least 1"],
    max: [10, "Priority cannot exceed 10"],
    default: 5,
    index: true
  },
  creditLimit: {
    type: Number,
    min: [0, "Credit limit cannot be negative"],
    default: 0
  },
  paymentTerms: {
    type: Number,
    min: [0, "Payment terms cannot be negative"],
    max: [365, "Payment terms cannot exceed 365 days"],
    default: 30
  },
  taxId: {
    type: String,
    trim: true,
    uppercase: true,
    sparse: true,
    validate: {
      validator: validateTaxId,
      message: "Tax ID must be 5-20 alphanumeric characters"
    }
  },
  website: {
    type: String,
    trim: true,
    validate: {
      validator: validateWebsite,
      message: "Please provide a valid website URL"
    }
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, "Notes cannot exceed 1000 characters"]
  },
  metadata: {
    createdBy: {
      type: String,
      maxlength: [50, "Creator name cannot exceed 50 characters"]
    },
    tags: [{
      type: String,
      trim: true,
      maxlength: [30, "Tag cannot exceed 30 characters"]
    }],
    source: {
      type: String,
      maxlength: [50, "Source cannot exceed 50 characters"]
    },
    industry: {
      type: String,
      maxlength: [50, "Industry cannot exceed 50 characters"],
      index: true
    },
    region: {
      type: String,
      maxlength: [50, "Region cannot exceed 50 characters"],
      index: true
    }
  },
  lastOrderDate: {
    type: Date,
    index: true
  },
  totalOrders: {
    type: Number,
    default: 0,
    min: [0, "Total orders cannot be negative"],
    index: true
  },
  totalValue: {
    type: Number,
    default: 0,
    min: [0, "Total value cannot be negative"],
    index: true
  }
}, {
  timestamps: true,
  collection: 'parties',
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

// **EXACT INDEXES TO ADD**
// Primary indexes (removed duplicates that are already defined in field definitions)
PartySchema.index({ contactPhone: 1 }, { sparse: true, name: 'idx_party_phone' });
PartySchema.index({ contactEmail: 1 }, { sparse: true, name: 'idx_party_email' });
PartySchema.index({ lastOrderDate: -1 }, { name: 'idx_party_last_order' });
PartySchema.index({ totalOrders: -1 }, { name: 'idx_party_total_orders' });
PartySchema.index({ totalValue: -1 }, { name: 'idx_party_total_value' });
PartySchema.index({ createdAt: -1 }, { name: 'idx_party_created_desc' });
PartySchema.index({ updatedAt: -1 }, { name: 'idx_party_updated_desc' });

// Compound indexes for common query patterns
PartySchema.index({ isActive: 1, category: 1 }, { name: 'idx_party_active_category' });
PartySchema.index({ isActive: 1, priority: -1 }, { name: 'idx_party_active_priority' });
PartySchema.index({ category: 1, region: 1 }, { name: 'idx_party_category_region' });
PartySchema.index({ isActive: 1, totalValue: -1 }, { name: 'idx_party_active_value' });
PartySchema.index({ isActive: 1, lastOrderDate: -1 }, { name: 'idx_party_active_last_order' });
PartySchema.index({ category: 1, totalOrders: -1 }, { name: 'idx_party_category_orders' });

// Text search index
PartySchema.index({ 
  name: "text", 
  contactName: "text", 
  address: "text",
  "metadata.tags": "text",
  notes: "text"
}, {
  weights: {
    name: 10,
    contactName: 8,
    address: 5,
    "metadata.tags": 3,
    notes: 2
  },
  name: "idx_party_text_search"
});

// **VALIDATION RULES**
// ✅ Required: name, isActive, category, priority
// ✅ Regex: contactPhone, contactEmail, website, taxId
// ✅ Enums: category (customer, supplier, partner, other)
// ✅ Min/Max: name (2-100), priority (1-10), paymentTerms (0-365), creditLimit (0+)
// ✅ Custom validation: phone format, email format, website format, tax ID format

// **EMBED VS REFERENCE DECISIONS**
// ✅ **Embedded**: metadata (small, always accessed together)
// ✅ **Embedded**: tags (small array, no complex queries)
// ✅ **Reference**: createdBy (could be User ID for complex queries)
// ✅ **Embedded**: contact info (small, always with party)

// **TTL/TIME-SERIES OPTIMIZATIONS**
// No TTL needed for parties (they're permanent business data)
// Consider TTL for:
// - Party activity logs (90 days)
// - Party search history (30 days)
// - Party audit trails (1 year)

// **STATIC METHODS**
PartySchema.statics.findByName = function(name: string): Promise<IParty | null> {
  return this.findOne({ 
    name: { $regex: name, $options: 'i' },
    isActive: true 
  }).lean();
};

PartySchema.statics.searchParties = function(searchTerm: string): Promise<IParty[]> {
  return this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
  .sort({ score: { $meta: "textScore" }, priority: -1 })
  .limit(50)
  .lean();
};

PartySchema.statics.findActiveParties = function(): Promise<IParty[]> {
  return this.find({ isActive: true })
    .sort({ priority: -1, name: 1 })
    .lean();
};

PartySchema.statics.findByContactPhone = function(phone: string): Promise<IParty | null> {
  return this.findOne({ 
    contactPhone: phone,
    isActive: true 
  }).lean();
};

PartySchema.statics.findByCategory = function(category: string): Promise<IParty[]> {
  return this.find({ 
    category, 
    isActive: true 
  })
  .sort({ priority: -1, name: 1 })
  .lean();
};

PartySchema.statics.findByRegion = function(region: string): Promise<IParty[]> {
  return this.find({ 
    "metadata.region": region,
    isActive: true 
  })
  .sort({ priority: -1, name: 1 })
  .lean();
};

PartySchema.statics.findTopCustomers = function(limit: number = 10): Promise<IParty[]> {
  return this.find({ 
    category: 'customer',
    isActive: true 
  })
  .sort({ totalValue: -1, totalOrders: -1 })
  .limit(limit)
  .lean();
};

PartySchema.statics.findRecentlyActive = function(days: number): Promise<IParty[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    lastOrderDate: { $gte: cutoffDate },
    isActive: true
  })
  .sort({ lastOrderDate: -1 })
  .lean();
};

PartySchema.statics.getPartyStats = async function(): Promise<any> {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalParties: { $sum: 1 },
        activeParties: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        customers: { $sum: { $cond: [{ $eq: ["$category", "customer"] }, 1, 0] } },
        suppliers: { $sum: { $cond: [{ $eq: ["$category", "supplier"] }, 1, 0] } },
        partners: { $sum: { $cond: [{ $eq: ["$category", "partner"] }, 1, 0] } },
        totalValue: { $sum: "$totalValue" },
        avgValue: { $avg: "$totalValue" }
      }
    }
  ]);
  
  return stats[0] || {
    totalParties: 0,
    activeParties: 0,
    customers: 0,
    suppliers: 0,
    partners: 0,
    totalValue: 0,
    avgValue: 0
  };
};

// **VIRTUAL FIELDS**
PartySchema.virtual('fullInfo').get(function() {
  return {
    id: this._id,
    name: this.name,
    contactName: this.contactName,
    contactPhone: this.contactPhone,
    contactEmail: this.contactEmail,
    address: this.address,
    isActive: this.isActive,
    category: this.category,
    priority: this.priority,
    creditLimit: this.creditLimit,
    paymentTerms: this.paymentTerms,
    taxId: this.taxId,
    website: this.website,
    notes: this.notes,
    metadata: this.metadata,
    lastOrderDate: this.lastOrderDate,
    totalOrders: this.totalOrders,
    totalValue: this.totalValue,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt
  };
});

// **MIDDLEWARE**
PartySchema.pre('save', function(next) {
  // Normalize phone number
  if (this.contactPhone) {
    this.contactPhone = this.contactPhone.replace(/\s+/g, '');
  }
  
  // Normalize tags
  if (this.metadata?.tags) {
    this.metadata.tags = [...new Set(this.metadata.tags.map(tag => tag.toLowerCase().trim()))];
  }
  
  next();
});

PartySchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

// **QUERY OPTIMIZATION**
PartySchema.pre('find', function() {
  this.lean();
});

PartySchema.pre('findOne', function() {
  this.lean();
});

const Party = mongoose.models.Party || mongoose.model<IParty, IPartyModel>("Party", PartySchema);

export default Party;
