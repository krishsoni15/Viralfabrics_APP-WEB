import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { Mill } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, notFoundResponse, updatedResponse, deletedResponse } from '@/lib/response';
import { logUpdate, logDelete, logError } from '@/lib/logger';
import { CACHE_TAGS } from "@/lib/cacheConfig";
import { revalidateTag, revalidatePath } from 'next/cache';
import { invalidateMillsCache } from '@/lib/cachedData';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    const { id } = await params;

    const mill = await Mill.findById(id).lean();
    
    if (!mill) {
      return NextResponse.json(notFoundResponse('Mill'), { status: 404 });
    }

    return NextResponse.json(successResponse(mill, 'Mill fetched successfully'));

  } catch (error: any) {
    return NextResponse.json(errorResponse('Failed to fetch mill'), { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { name, contactPerson, contactPhone, address, email, isActive } = body;

    // Check if mill exists
    const existingMill = await Mill.findById(id);
    if (!existingMill) {
      return NextResponse.json(notFoundResponse('Mill'), { status: 404 });
    }

    // Validate required fields
    if (!name || name.trim().length === 0) {
      return NextResponse.json(validationErrorResponse('Mill name is required'), { status: 400 });
    }

    // Check if another mill with same name already exists
    const duplicateMill = await Mill.findOne({ 
      name: { $regex: new RegExp(`^${name.trim()}$`, 'i') },
      _id: { $ne: id }
    });
    if (duplicateMill) {
      return NextResponse.json(validationErrorResponse('Mill with this name already exists'), { status: 400 });
    }

    // Update mill
    const updatedMill = await Mill.findByIdAndUpdate(
      id,
      {
        name: name.trim(),
        contactPerson: contactPerson?.trim(),
        contactPhone: contactPhone?.trim(),
        address: address?.trim(),
        email: email?.trim(),
        isActive: isActive !== undefined ? isActive : existingMill.isActive
      },
      { new: true, runValidators: true }
    );

    if (!updatedMill) {
      return NextResponse.json(notFoundResponse('Mill'), { status: 404 });
    }

    await logUpdate('mill', id, { oldName: existingMill.name }, { newName: updatedMill.name }, request);

    return NextResponse.json(updatedResponse(updatedMill, 'Mill updated successfully'));

  } catch (error: any) {
    if (error.code === 11000) {
      return NextResponse.json(validationErrorResponse('Mill with this name already exists'), { status: 400 });
    }
    
    await logError('mill_update', error, {
      resource: 'mill',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to update mill'), { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await dbConnect();
    
    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    const { id } = await params;

    // Check if mill exists
    const mill = await Mill.findById(id);
    if (!mill) {
      return NextResponse.json(notFoundResponse('Mill'), { status: 404 });
    }

    // ⚡ FIX: Check if mill is being used in any place before deletion
    const { MillInput } = await import('@/models');
    
    // Check mill inputs (mills are used in mill inputs)
    const millInputsCount = await MillInput.countDocuments({ mill: id });
    
    if (millInputsCount > 0) {
      return NextResponse.json({
        success: false,
        message: `Cannot delete mill "${mill.name}" - it's being used in ${millInputsCount} mill input(s). Please remove all mill inputs using this mill first.`
      }, { status: 400 });
    }

    // Delete mill only if not in use
    await Mill.findByIdAndDelete(id);

    // ⚡ CACHE REVALIDATION
    invalidateMillsCache();
    revalidateTag(CACHE_TAGS.MILLS);
    revalidatePath('/mills');
    
    // ⚡ FIX: Clear in-memory cache from main route
    try {
      const { millsCache } = await import('../cache');
      if (millsCache) {
        millsCache.clear();
        console.log('🗑️ Cleared in-memory mills cache after deleting mill');
      }
    } catch (e) {
      console.error('Failed to clear in-memory cache:', e);
    }
    
    console.log('🗑️ Cleared all mills caches after deleting mill');

    logDelete('mill', id, {}, request);

    return NextResponse.json(deletedResponse('Mill deleted successfully'));

  } catch (error: unknown) {
    await logError('mill_delete', error, {
      resource: 'mill',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to delete mill'), { status: 500 });
  }
}
