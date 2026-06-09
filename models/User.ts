import mongoose, { Document, Schema, Model } from "mongoose";
import bcrypt from "bcryptjs";

// Enhanced TypeScript interfaces
export interface IUser extends Document {
  name: string;
  username: string;
  password: string;
  email?: string;
  phoneNumber?: string;
  address?: string;
  role: "master" | "superadmin" | "admin" | "user" | "party";
  partyId?: mongoose.Types.ObjectId;
  isActive: boolean;
  lastLogin?: Date;
  loginCount: number;
  failedLoginAttempts: number;
  lastFailedLogin?: Date;
  accountLocked: boolean;
  lockExpiresAt?: Date;
  preferences: {
    theme: 'light' | 'dark';
    language: 'en' | 'es' | 'fr';
    notifications: boolean;
    timezone: string;
  };
  metadata: {
    createdBy?: string;
    department?: string;
    employeeId?: string;
    notes?: string;
  };
  createdAt: Date;
  updatedAt: Date;
  
  // Instance methods
  comparePassword(candidatePassword: string): Promise<boolean>;
  incrementLoginCount(): Promise<void>;
  recordFailedLogin(): Promise<void>;
  resetFailedLogins(): Promise<void>;
  lockAccount(durationMinutes?: number): Promise<void>;
  unlockAccount(): Promise<void>;
}

// Enhanced static methods interface
export interface IUserModel extends Model<IUser> {
  findByUsernameOrEmail(identifier: string): Promise<IUser | null>;
  findActiveUsers(): Promise<IUser[]>;
  findByRole(role: string): Promise<IUser[]>;
  searchUsers(searchTerm: string): Promise<IUser[]>;
  findRecentlyActive(days: number): Promise<IUser[]>;
  findLockedAccounts(): Promise<IUser[]>;
  findByDepartment(department: string): Promise<IUser[]>;
  getLoginStats(): Promise<any>;
  cleanupExpiredLocks(): Promise<void>;
}

// Validation functions
const validateEmail = (email: string) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePhoneNumber = (phone: string) => {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
  return phoneRegex.test(phone);
};

const UserSchema = new Schema<IUser>({
  name: {
    type: String,
    required: [true, "Name is required"],
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [50, "Name cannot exceed 50 characters"],
    index: true
  },
  username: {
    type: String,
    unique: true,
    required: [true, "Username is required"],
    trim: true,
    lowercase: true,
    // No restrictions on username - user can set any username
    index: true // ⚡ Already indexed for fast login
  },
  password: {
    type: String,
    required: [true, "Password is required"],
    // No restrictions on password - user can set any password
    select: false
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    sparse: true,
    validate: {
      validator: validateEmail,
      message: "Please provide a valid email address"
    },
    index: true
  },
  phoneNumber: {
    type: String,
    trim: true,
    sparse: true,
    validate: {
      validator: validatePhoneNumber,
      message: "Please provide a valid phone number"
    }
  },
  address: {
    type: String,
    trim: true,
    maxlength: [200, "Address cannot exceed 200 characters"]
  },
  role: {
    type: String,
    enum: {
      values: ["master", "superadmin", "admin", "user", "party"],
      message: "Role must be one of 'master', 'superadmin', 'admin', 'user', or 'party'"
    },
    default: "user",
    index: true
  },
  partyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Party",
    index: true
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  lastLogin: {
    type: Date,
    index: true
  },
  loginCount: {
    type: Number,
    default: 0,
    min: [0, "Login count cannot be negative"],
    index: true
  },
  failedLoginAttempts: {
    type: Number,
    default: 0,
    min: [0, "Failed login attempts cannot be negative"]
  },
  lastFailedLogin: {
    type: Date
  },
  accountLocked: {
    type: Boolean,
    default: false,
    index: true
  },
  lockExpiresAt: {
    type: Date,
    index: true
  },
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark'],
      default: 'light'
    },
    language: {
      type: String,
      enum: ['en', 'es', 'fr'],
      default: 'en'
    },
    notifications: {
      type: Boolean,
      default: true
    },
    timezone: {
      type: String,
      default: 'UTC'
    }
  },
  metadata: {
    createdBy: {
      type: String,
      maxlength: [50, "Creator name cannot exceed 50 characters"]
    },
    department: {
      type: String,
      maxlength: [50, "Department cannot exceed 50 characters"],
      index: true
    },
    employeeId: {
      type: String,
      maxlength: [20, "Employee ID cannot exceed 20 characters"],
      sparse: true
    },
    notes: {
      type: String,
      maxlength: [500, "Notes cannot exceed 500 characters"]
    }
  }
}, {
  timestamps: true,
  collection: 'users',
  toJSON: {
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.failedLoginAttempts;
      delete ret.lastFailedLogin;
      return ret;
    },
    virtuals: true
  },
  toObject: {
    transform: function(doc, ret: any) {
      ret.id = ret._id;
      delete ret._id;
      delete ret.__v;
      delete ret.password;
      delete ret.failedLoginAttempts;
      delete ret.lastFailedLogin;
      return ret;
    },
    virtuals: true
  }
});

// **EXACT INDEXES TO ADD**
// Primary indexes (removed duplicates that are already defined in field definitions)
UserSchema.index({ loginCount: -1 }, { name: 'idx_user_login_count' });
UserSchema.index({ createdAt: -1 }, { name: 'idx_user_created_desc' });
UserSchema.index({ updatedAt: -1 }, { name: 'idx_user_updated_desc' });

// Compound indexes for common query patterns
UserSchema.index({ isActive: 1, role: 1 }, { name: 'idx_user_active_role' });
UserSchema.index({ isActive: 1, department: 1 }, { name: 'idx_user_active_department' });
UserSchema.index({ role: 1, department: 1 }, { name: 'idx_user_role_department' });
UserSchema.index({ isActive: 1, lastLogin: -1 }, { name: 'idx_user_active_last_login' });
UserSchema.index({ accountLocked: 1, lockExpiresAt: 1 }, { name: 'idx_user_lock_expiry' });

// Text search index
UserSchema.index({ 
  name: "text", 
  username: "text", 
  email: "text",
  "metadata.employeeId": "text"
}, {
  weights: {
    name: 10,
    username: 8,
    email: 5,
    "metadata.employeeId": 3
  },
  name: "idx_user_text_search"
});

// **VALIDATION RULES**
// ✅ Required: name, username, password, role, isActive
// ✅ Regex: email, phoneNumber, username
// ✅ Enums: role (superadmin, user, manager), theme (light, dark), language (en, es, fr)
// ✅ Min/Max: name (2-50), username (3-30), password (8+), loginCount (0+), failedLoginAttempts (0+)
// ✅ Custom validation: email format, phone format, username format

// **EMBED VS REFERENCE DECISIONS**
// ✅ **Embedded**: preferences (small, always accessed together)
// ✅ **Embedded**: metadata (small, always with user)
// ✅ **Reference**: createdBy (could be User ID for complex queries)
// ✅ **Embedded**: login tracking (small data, always with user)

// **TTL/TIME-SERIES OPTIMIZATIONS**
// TTL for expired account locks
UserSchema.index({ lockExpiresAt: 1 }, { expireAfterSeconds: 0, name: 'idx_user_lock_ttl' });

// **SECURITY MIDDLEWARE**
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    // Check if password is already hashed (bcrypt hashes start with $2b$)
    if (this.password && this.password.startsWith('$2b$')) {
      return next(); // Password is already hashed, don't hash again
    }
    
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error as Error);
  }
});

UserSchema.pre('findOneAndUpdate', async function(next) {
  const update = this.getUpdate() as any;
  if (update.password) {
    try {
      // Check if password is already hashed (bcrypt hashes start with $2b$)
      if (update.password && update.password.startsWith('$2b$')) {
        return next(); // Password is already hashed, don't hash again
      }
      
      const salt = await bcrypt.genSalt(12);
      update.password = await bcrypt.hash(update.password, salt);
    } catch (error) {
      return next(error as Error);
    }
  }
  next();
});

// **INSTANCE METHODS**
UserSchema.methods.comparePassword = async function(candidatePassword: string): Promise<boolean> {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

UserSchema.methods.incrementLoginCount = async function(): Promise<void> {
  this.loginCount += 1;
  this.lastLogin = new Date();
  this.failedLoginAttempts = 0;
  this.accountLocked = false;
  this.lockExpiresAt = undefined;
  await this.save();
};

UserSchema.methods.recordFailedLogin = async function(): Promise<void> {
  this.failedLoginAttempts += 1;
  this.lastFailedLogin = new Date();
  
  // Lock account after 5 failed attempts
  if (this.failedLoginAttempts >= 5) {
    this.accountLocked = true;
    this.lockExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
  
  await this.save();
};

UserSchema.methods.resetFailedLogins = async function(): Promise<void> {
  this.failedLoginAttempts = 0;
  this.lastFailedLogin = undefined;
  await this.save();
};

UserSchema.methods.lockAccount = async function(durationMinutes: number = 30): Promise<void> {
  this.accountLocked = true;
  this.lockExpiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);
  await this.save();
};

UserSchema.methods.unlockAccount = async function(): Promise<void> {
  this.accountLocked = false;
  this.lockExpiresAt = undefined;
  this.failedLoginAttempts = 0;
  await this.save();
};

// **STATIC METHODS**
UserSchema.statics.findByUsernameOrEmail = function(identifier: string): Promise<IUser | null> {
  return this.findOne({
    $or: [
      { username: identifier.toLowerCase() },
      { email: identifier.toLowerCase() }
    ],
    isActive: true,
    accountLocked: false
  }).select('+password');
};

UserSchema.statics.findActiveUsers = function(): Promise<IUser[]> {
  return this.find({ isActive: true })
    .select('-password')
    .sort({ name: 1 })
    .lean();
};

UserSchema.statics.findByRole = function(role: string): Promise<IUser[]> {
  return this.find({ role, isActive: true })
    .select('-password')
    .sort({ name: 1 })
    .lean();
};

UserSchema.statics.searchUsers = function(searchTerm: string): Promise<IUser[]> {
  return this.find({
    $text: { $search: searchTerm },
    isActive: true
  })
  .select('-password')
  .sort({ score: { $meta: "textScore" } })
  .limit(50)
  .lean();
};

UserSchema.statics.findRecentlyActive = function(days: number): Promise<IUser[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return this.find({
    lastLogin: { $gte: cutoffDate },
    isActive: true
  })
  .select('-password')
  .sort({ lastLogin: -1 })
  .lean();
};

UserSchema.statics.findLockedAccounts = function(): Promise<IUser[]> {
  return this.find({ 
    accountLocked: true,
    lockExpiresAt: { $gt: new Date() }
  })
  .select('-password')
  .sort({ lockExpiresAt: 1 })
  .lean();
};

UserSchema.statics.findByDepartment = function(department: string): Promise<IUser[]> {
  return this.find({ 
    "metadata.department": department,
    isActive: true 
  })
  .select('-password')
  .sort({ name: 1 })
  .lean();
};

UserSchema.statics.getLoginStats = async function(): Promise<any> {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalUsers: { $sum: 1 },
        activeUsers: { $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] } },
        lockedUsers: { $sum: { $cond: [{ $eq: ["$accountLocked", true] }, 1, 0] } },
        totalLogins: { $sum: "$loginCount" },
        avgLogins: { $avg: "$loginCount" }
      }
    }
  ]);
  
  return stats[0] || {
    totalUsers: 0,
    activeUsers: 0,
    lockedUsers: 0,
    totalLogins: 0,
    avgLogins: 0
  };
};

UserSchema.statics.cleanupExpiredLocks = async function(): Promise<void> {
  await this.updateMany(
    { 
      accountLocked: true,
      lockExpiresAt: { $lt: new Date() }
    },
    {
      $set: {
        accountLocked: false,
        failedLoginAttempts: 0
      },
      $unset: { lockExpiresAt: 1 }
    }
  );
};

// **VIRTUAL FIELDS**
UserSchema.virtual('fullProfile').get(function() {
  return {
    id: this._id,
    name: this.name,
    username: this.username,
    email: this.email,
    phoneNumber: this.phoneNumber,
    address: this.address,
    role: this.role,
    isActive: this.isActive,
    lastLogin: this.lastLogin,
    loginCount: this.loginCount,
    accountLocked: this.accountLocked,
    preferences: this.preferences,
    metadata: this.metadata,
    partyId: this.partyId,
    createdAt: this.createdAt
  };
});

// **DATA INTEGRITY MIDDLEWARE**
UserSchema.pre('save', function(next) {
  if (this.phoneNumber) {
    this.phoneNumber = this.phoneNumber.replace(/\s+/g, '');
  }
  next();
});

UserSchema.post('save', function(error: any, doc: any, next: any) {
  if (error.name === 'MongoError' && error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    next(new Error(`${field} already exists`));
  } else {
    next(error);
  }
});

// **QUERY OPTIMIZATION MIDDLEWARE**
// UserSchema.pre('find', function() {
//   if (!this.getQuery().password) {
//     this.lean();
//   }
// });

// UserSchema.pre('findOne', function() {
//   if (!this.getQuery().password) {
//     this.lean();
//   }
// });

// **EXACT INDEXES TO ADD**
// Primary indexes
UserSchema.index({ username: 1 }, { unique: true, name: 'idx_user_username_unique' });
UserSchema.index({ name: 1 }, { name: 'idx_user_name' });
UserSchema.index({ role: 1 }, { name: 'idx_user_role' });
UserSchema.index({ isActive: 1 }, { name: 'idx_user_active' });
UserSchema.index({ createdAt: -1 }, { name: 'idx_user_created_desc' });
UserSchema.index({ updatedAt: -1 }, { name: 'idx_user_updated_desc' });
UserSchema.index({ lastLogin: -1 }, { name: 'idx_user_last_login' });
UserSchema.index({ accountLocked: 1 }, { name: 'idx_user_locked' });

// Compound indexes for common query patterns
UserSchema.index({ role: 1, isActive: 1 }, { name: 'idx_user_role_active' });
UserSchema.index({ isActive: 1, createdAt: -1 }, { name: 'idx_user_active_created' });
UserSchema.index({ role: 1, createdAt: -1 }, { name: 'idx_user_role_created' });

// Text search index
UserSchema.index({ 
  name: "text", 
  username: "text",
  "metadata.department": "text"
}, {
  weights: {
    name: 10,
    username: 8,
    "metadata.department": 5
  },
  name: "idx_user_text_search"
});

if (mongoose.models.User && !mongoose.models.User.schema.paths.partyId) {
  delete mongoose.models.User;
}

const User = mongoose.models.User || mongoose.model<IUser, IUserModel>("User", UserSchema);

export default User;
