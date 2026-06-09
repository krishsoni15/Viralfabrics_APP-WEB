/**
 * Sample Service Layer
 * Contains business logic for sample operations
 * Can be used by both server actions and API routes
 */

import dbConnect from '@/lib/dbConnect';
import Sample from '@/models/Sample';
import SamplingWeaver from '@/models/SamplingWeaver';
import { sanitizeString } from '@/lib/sanitize';
import type { FilterQuery } from 'mongoose';
import { FABRIC_TYPES, VALIDATION } from '../../constants';

export interface SampleData {
  weaverId: string;
  qualityName: string;
  type?: string;
  rack?: string;
  greighWidth?: number;
  finishWidth?: number;
  weight?: number;
  gsm?: number;
  content?: string;
  danier?: string;
  count?: number;
  reed?: number;
  pick?: number;
  greighRate?: number;
  label?: string;
  note?: string;
  images?: string[];
}

export interface SampleQueryParams {
  weaverId?: string;
  page?: number;
  limit?: number;
  search?: string;
}

/**
 * Get samples with pagination
 */
import { PAGINATION } from '../../constants';

export async function getSamples(params: SampleQueryParams) {
  await dbConnect();
  
  const page = params.page || PAGINATION.DEFAULT_PAGE;
  const limit = Math.min(Math.max(params.limit || 50, PAGINATION.MIN_LIMIT), PAGINATION.MAX_SAMPLES_LIMIT);
  const skip = (page - 1) * limit;
  const weaverId = params.weaverId;
  const search = params.search || '';
  
  const query: FilterQuery<typeof Sample> = {};
  if (weaverId) {
    if (!/^[0-9a-fA-F]{24}$/.test(weaverId)) {
      throw new Error('Invalid weaver ID format');
    }
    query.weaverId = weaverId;
  }
  if (search) {
    query.$or = [
      { qualityName: { $regex: search, $options: 'i' } },
      { type: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } }
    ];
  }
  
  const queryBuilder = Sample.find(query, {
    _id: 1,
    weaverId: 1,
    qualityName: 1,
    type: 1,
    rack: 1,
    greighWidth: 1,
    finishWidth: 1,
    weight: 1,
    gsm: 1,
    content: 1,
    danier: 1,
    count: 1,
    reed: 1,
    pick: 1,
    greighRate: 1,
    label: 1,
    note: 1,
    images: 1,
    createdAt: 1,
    updatedAt: 1
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);
  
  if (!weaverId) {
    queryBuilder.populate('weaverId', 'name phone address');
  }
  
  const [samples, total] = await Promise.all([
    queryBuilder.lean(),
    Sample.countDocuments(query)
  ]);
  
  return {
    samples: (samples as any[]).map((s: any) => ({
      ...s,
      _id: s._id?.toString() || String(s._id),
      weaverId: typeof s.weaverId === 'object' && s.weaverId !== null && '_id' in s.weaverId
        ? { ...s.weaverId, _id: s.weaverId._id.toString() }
        : s.weaverId
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
 * Create a new sample
 * @param data - Sample data including weaverId, qualityName, and other fields
 * @returns Created sample object with populated weaverId
 * @throws Error if weaverId is invalid, weaver not found, qualityName missing, or type validation fails
 */
export async function createSample(data: SampleData) {
  await dbConnect();
  
  if (!data.weaverId) {
    throw new Error('Weaver is required');
  }
  
  if (!/^[0-9a-fA-F]{24}$/.test(data.weaverId)) {
    throw new Error('Invalid weaver ID format');
  }
  
  if (!data.qualityName?.trim()) {
    throw new Error('Quality name is required');
  }
  
  // Verify weaver exists
  const weaver = await SamplingWeaver.findById(data.weaverId).lean();
  if (!weaver) {
    throw new Error('Weaver not found');
  }
  
  // Normalize and validate type
  let normalizedType = '';
  if (data.type && data.type.trim()) {
    const matchedType = FABRIC_TYPES.find(
      validType => validType.toLowerCase() === data.type!.trim().toLowerCase()
    );
    if (matchedType) {
      normalizedType = matchedType;
    } else {
      throw new Error(`Type must be one of: ${FABRIC_TYPES.join(', ')}, or empty`);
    }
  }
  
  const sample = new Sample({
    weaverId: data.weaverId,
    qualityName: sanitizeString(data.qualityName.trim(), { maxLength: VALIDATION.NAME_MAX_LENGTH }),
    type: normalizedType,
    rack: data.rack ? sanitizeString(data.rack.trim(), { maxLength: VALIDATION.NAME_MAX_LENGTH }) : '',
    greighWidth: data.greighWidth ? parseFloat(String(data.greighWidth)) : 0,
    finishWidth: data.finishWidth ? parseFloat(String(data.finishWidth)) : 0,
    weight: data.weight ? parseFloat(String(data.weight)) : 0,
    gsm: data.gsm ? parseFloat(String(data.gsm)) : 0,
    content: data.content ? sanitizeString(data.content.trim(), { maxLength: VALIDATION.CONTENT_MAX_LENGTH }) : '',
    danier: data.danier ? sanitizeString(data.danier.trim(), { maxLength: VALIDATION.DANIER_MAX_LENGTH }) : '',
    count: data.count ? parseFloat(String(data.count)) : 0,
    reed: data.reed ? parseFloat(String(data.reed)) : 0,
    pick: data.pick ? parseFloat(String(data.pick)) : 0,
    greighRate: data.greighRate ? parseFloat(String(data.greighRate)) : 0,
    label: data.label ? sanitizeString(data.label.trim(), { maxLength: VALIDATION.LABEL_MAX_LENGTH }) : '',
    note: data.note ? sanitizeString(data.note.trim(), { maxLength: VALIDATION.NOTE_MAX_LENGTH }) : '',
    images: data.images || []
  });
  
  await sample.save();
  
  const populatedSample = await Sample.findById(sample._id)
    .populate('weaverId', 'name phone address')
    .lean() as any;
  
  if (!populatedSample) {
    throw new Error('Sample not found after creation');
  }
  
  return {
    ...populatedSample,
    _id: populatedSample._id?.toString() || String(populatedSample._id),
    weaverId: typeof populatedSample.weaverId === 'object' && populatedSample.weaverId !== null && '_id' in populatedSample.weaverId
      ? { ...populatedSample.weaverId, _id: populatedSample.weaverId._id.toString() }
      : populatedSample.weaverId
  };
}

