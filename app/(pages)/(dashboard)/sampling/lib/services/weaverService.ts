/**
 * Weaver Service Layer
 * Contains business logic for weaver operations
 * Can be used by both server actions and API routes
 */

import dbConnect from '@/lib/dbConnect';
import SamplingWeaver from '@/models/SamplingWeaver';
import Sample from '@/models/Sample';
import { sanitizeString } from '@/lib/sanitize';
import type { FilterQuery } from 'mongoose';
import mongoose from 'mongoose';
import { VALIDATION, PAGINATION } from '../../constants';

export interface WeaverData {
  name: string;
  phone?: string;
  address?: string;
}

export interface WeaverQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  sort?: 'newest' | 'oldest';
}

/**
 * Get weavers with pagination
 * @param params - Query parameters for filtering and pagination
 * @returns Object containing weavers array and pagination info
 * @throws Error if database connection fails
 */
export async function getWeavers(params: WeaverQueryParams) {
  await dbConnect();
  
  const page = params.page || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(Math.max(params.limit || PAGINATION.DEFAULT_LIMIT, PAGINATION.MIN_LIMIT), PAGINATION.MAX_LIMIT);
  const skip = (page - 1) * limit;
  const sortOrder = params.sort === 'oldest' ? 1 : -1;
  const search = params.search || '';
  
  const query: FilterQuery<typeof SamplingWeaver> = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { address: { $regex: search, $options: 'i' } }
    ];
  }
  
  const [weavers, total] = await Promise.all([
    SamplingWeaver.find(query, {
      _id: 1,
      name: 1,
      phone: 1,
      address: 1,
      createdAt: 1
    })
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean(),
    SamplingWeaver.countDocuments(query)
  ]);
  
  return {
    weavers: (weavers as any[]).map((w: any) => ({
      _id: w._id?.toString() || String(w._id),
      name: w.name,
      phone: w.phone || '',
      address: w.address || ''
    })),
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
}

/**
 * Get single weaver by ID
 * @param weaverId - MongoDB ObjectId string
 * @returns Weaver object
 * @throws Error if weaverId is invalid format or weaver not found
 */
export async function getWeaverById(weaverId: string) {
  await dbConnect();
  
  if (!/^[0-9a-fA-F]{24}$/.test(weaverId)) {
    throw new Error('Invalid weaver ID format');
  }
  
  const weaver = await SamplingWeaver.findById(weaverId, {
    _id: 1,
    name: 1,
    phone: 1,
    address: 1,
    createdAt: 1
  }).lean() as any;
  
  if (!weaver) {
    throw new Error('Weaver not found');
  }
  
  return {
    _id: weaver._id?.toString() || String(weaver._id),
    name: weaver.name,
    phone: weaver.phone || '',
    address: weaver.address || ''
  };
}

/**
 * Create a new weaver
 * @param data - Weaver data (name, phone, address)
 * @returns Created weaver object
 * @throws Error if name is missing or validation fails
 */
export async function createWeaver(data: WeaverData) {
  await dbConnect();
  
  if (!data.name?.trim()) {
    throw new Error('Name is required');
  }
  
  const weaver = new SamplingWeaver({
    name: sanitizeString(data.name.trim(), { maxLength: VALIDATION.NAME_MAX_LENGTH }),
    phone: data.phone ? sanitizeString(data.phone.trim(), { maxLength: VALIDATION.PHONE_MAX_LENGTH }) : '',
    address: data.address ? sanitizeString(data.address.trim(), { maxLength: VALIDATION.ADDRESS_MAX_LENGTH }) : ''
  });
  
  await weaver.save();
  
  return {
    _id: weaver._id.toString(),
    name: weaver.name,
    phone: weaver.phone || '',
    address: weaver.address || ''
  };
}

/**
 * Update existing weaver
 * @param weaverId - MongoDB ObjectId string
 * @param data - Updated weaver data
 * @returns Updated weaver object
 * @throws Error if weaverId is invalid, weaver not found, or validation fails
 */
export async function updateWeaver(weaverId: string, data: WeaverData) {
  await dbConnect();
  
  if (!/^[0-9a-fA-F]{24}$/.test(weaverId)) {
    throw new Error('Invalid weaver ID format');
  }
  
  if (!data.name?.trim()) {
    throw new Error('Name is required');
  }
  
  const weaver = await SamplingWeaver.findByIdAndUpdate(
    weaverId,
    {
      name: sanitizeString(data.name.trim(), { maxLength: VALIDATION.NAME_MAX_LENGTH }),
      phone: data.phone ? sanitizeString(data.phone.trim(), { maxLength: VALIDATION.PHONE_MAX_LENGTH }) : '',
      address: data.address ? sanitizeString(data.address.trim(), { maxLength: VALIDATION.ADDRESS_MAX_LENGTH }) : ''
    },
    { new: true, runValidators: true }
  ).lean() as any;
  
  if (!weaver) {
    throw new Error('Weaver not found');
  }
  
  return {
    _id: weaver._id?.toString() || String(weaver._id),
    name: weaver.name,
    phone: weaver.phone || '',
    address: weaver.address || ''
  };
}

/**
 * Delete weaver and all associated samples (atomic transaction)
 * @param weaverId - MongoDB ObjectId string
 * @returns Object with sampleCount (number of samples deleted)
 * @throws Error if weaverId is invalid, weaver not found, or transaction fails
 */
export async function deleteWeaver(weaverId: string) {
  await dbConnect();
  
  if (!/^[0-9a-fA-F]{24}$/.test(weaverId)) {
    throw new Error('Invalid weaver ID format');
  }
  
  const weaver = await SamplingWeaver.findById(weaverId).lean();
  if (!weaver) {
    throw new Error('Weaver not found');
  }
  
  const session = await mongoose.startSession();
  
  try {
    await session.startTransaction();
    
    const sampleCount = await Sample.countDocuments({ weaverId }).session(session);
    
    if (sampleCount > 0) {
      await Sample.deleteMany({ weaverId }).session(session);
    }
    
    await SamplingWeaver.findByIdAndDelete(weaverId).session(session);
    
    await session.commitTransaction();
    
    return { sampleCount };
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

