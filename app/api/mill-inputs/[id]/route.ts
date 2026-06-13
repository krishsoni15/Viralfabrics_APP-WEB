import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import { MillInput } from '@/models';
import { getSession } from '@/lib/session';
import { successResponse, errorResponse, validationErrorResponse, unauthorizedResponse, notFoundResponse, updatedResponse, deletedResponse } from '@/lib/response';
import { logUpdate, logDelete, logError } from '@/lib/logger';
import { checkRateLimitOrError, apiRateLimiter, writeRateLimiter } from '@/lib/rateLimit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check
    const rateLimitError = await checkRateLimitOrError(request, apiRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { id } = await params;

    const millInput = await MillInput.findById(id)
      .populate('mill', 'name contactPerson contactPhone')
      .populate('order', 'orderId orderType party')
      .lean() as any;
    
    if (!millInput) {
      return NextResponse.json(notFoundResponse('Mill input'), { status: 404 });
    }

    return NextResponse.json(successResponse(millInput, 'Mill input fetched successfully'));

  } catch (error: any) {
    return NextResponse.json(errorResponse('Failed to fetch mill input'), { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    // Validate session
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }

    await dbConnect();

    const { id } = await params;
    const body = await request.json();
    const { mill, millDate, chalanNo, greighMtr, pcs, quality, processName, additionalMeters, notes } = body;

    // Check if mill input exists and store old values
    const existingMillInput = await MillInput.findById(id)
      .populate('mill', 'name')
      .populate('quality', 'name')
      .populate('order', 'orderId')
      .lean() as any;
    if (!existingMillInput) {
      return NextResponse.json(notFoundResponse('Mill input'), { status: 404 });
    }
    
    // Store old values for logging
    const oldValues = {
      mill: existingMillInput.mill,
      millDate: existingMillInput.millDate,
      chalanNo: existingMillInput.chalanNo,
      greighMtr: existingMillInput.greighMtr,
      pcs: existingMillInput.pcs,
      quality: existingMillInput.quality,
      processName: existingMillInput.processName,
      additionalMeters: existingMillInput.additionalMeters,
      notes: existingMillInput.notes,
      orderId: (existingMillInput.order as any)?.orderId || existingMillInput.order
    };

    // Validate required fields
    if (!mill) {
      return NextResponse.json(validationErrorResponse('Mill is required'), { status: 400 });
    }
    // All other fields are optional (millDate, chalanNo, greighMtr, pcs)

    // Check if mill exists
    const { Mill, Quality } = await import('@/models');
    const millExists = await Mill.findById(mill);
    if (!millExists) {
      return NextResponse.json(notFoundResponse('Mill'), { status: 404 });
    }

    // Check if quality exists only if provided
    if (quality) {
      const qualityExists = await Quality.findById(quality);
      if (!qualityExists) {
        return NextResponse.json(notFoundResponse('Quality'), { status: 404 });
      }
    }

    // Validate additional meters if provided
    if (additionalMeters && Array.isArray(additionalMeters)) {
      for (let i = 0; i < additionalMeters.length; i++) {
        const additional = additionalMeters[i];
        if (!additional.greighMtr || additional.greighMtr <= 0) {
          return NextResponse.json(validationErrorResponse(`Valid greigh meters is required for additional meter ${i + 1}`), { status: 400 });
        }
        if (!additional.pcs || additional.pcs <= 0) {
          return NextResponse.json(validationErrorResponse(`Valid number of pieces is required for additional meter ${i + 1}`), { status: 400 });
        }
        if (additional.quality) {
          const additionalQualityExists = await Quality.findById(additional.quality);
          if (!additionalQualityExists) {
            return NextResponse.json(notFoundResponse(`Quality for additional meter ${i + 1}`), { status: 404 });
          }
        }
      }
    }

    // Check if chalan number already exists for this order (excluding current record) - only if chalanNo is provided
    if (chalanNo && chalanNo.trim()) {
      const existingChalan = await MillInput.findOne({ 
        orderId: existingMillInput.orderId,
        chalanNo: chalanNo.trim(),
        _id: { $ne: id }
      });
      if (existingChalan) {
        return NextResponse.json(validationErrorResponse('Chalan number already exists for this order'), { status: 400 });
      }
    }

    // Update mill input - only include fields that are provided
    const updateData: any = {
      mill
    };
    
    // Only update fields if they are provided
    if (millDate) {
      updateData.millDate = new Date(millDate);
    }
    if (chalanNo !== undefined && chalanNo !== null) {
      updateData.chalanNo = chalanNo.trim() || '';
    }
    if (greighMtr !== undefined && greighMtr !== null) {
      updateData.greighMtr = parseFloat(greighMtr);
    }
    if (pcs !== undefined && pcs !== null) {
      updateData.pcs = parseInt(pcs);
    }
    if (quality !== undefined) {
      updateData.quality = quality || undefined;
    }
    if (processName !== undefined) {
      updateData.processName = processName ? processName.trim() : '';
    }
    if (additionalMeters !== undefined) {
      updateData.additionalMeters = Array.isArray(additionalMeters) ? additionalMeters.map(additional => ({
        greighMtr: additional.greighMtr ? parseFloat(additional.greighMtr) : undefined,
        pcs: additional.pcs ? parseInt(additional.pcs) : undefined,
        quality: additional.quality || undefined,
        processName: additional.processName ? additional.processName.trim() : '',
        notes: additional.notes?.trim()
      })) : [];
    }
    if (notes !== undefined) {
      updateData.notes = notes?.trim();
    }

    const updatedMillInput = await MillInput.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: false }
    );

    if (!updatedMillInput) {
      return NextResponse.json(notFoundResponse('Mill input'), { status: 404 });
    }

    // Populate references for response
    const populatedMillInput = await MillInput.findById(updatedMillInput._id)
      .populate('mill', 'name contactPerson contactPhone')
      .populate('order', 'orderId orderType party')
      .populate('quality', 'name')
      .populate('additionalMeters.quality', 'name')
      .lean() as any;

    // Store new values for logging
    const newValues = {
      mill: populatedMillInput?.mill,
      millDate: populatedMillInput?.millDate,
      chalanNo: populatedMillInput?.chalanNo,
      greighMtr: populatedMillInput?.greighMtr,
      pcs: populatedMillInput?.pcs,
      quality: populatedMillInput?.quality,
      processName: populatedMillInput?.processName,
      additionalMeters: populatedMillInput?.additionalMeters,
      notes: populatedMillInput?.notes,
      orderId: (populatedMillInput?.order as any)?.orderId || populatedMillInput?.order
    };

    // Log the update with complete oldValues and newValues
    try {
      await logUpdate('mill_input', id, oldValues, newValues, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }

    return NextResponse.json(updatedResponse(populatedMillInput, 'Mill input updated successfully'));

  } catch (error: unknown) {
    await logError('mill_input_update', error, {
      resource: 'mill_input',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to update mill input'), { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting check for write operations
    const rateLimitError = await checkRateLimitOrError(request, writeRateLimiter);
    if (rateLimitError) return rateLimitError;

    const session = await getSession(request);
    if (!session) {
      return NextResponse.json(unauthorizedResponse('Unauthorized'), { status: 401 });
    }
    const allowedRoles = ['master', 'superadmin', 'admin', 'user'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ success: false, message: 'Access denied - Unauthorized role for deletion' }, { status: 403 });
    }

    await dbConnect();

    const { id } = await params;

    // Get mill input before deletion for logging
    const millInput = await MillInput.findById(id)
      .populate('mill', 'name')
      .populate('quality', 'name')
      .populate('order', 'orderId')
      .lean() as any;
    if (!millInput) {
      return NextResponse.json(notFoundResponse('Mill input'), { status: 404 });
    }

    // Delete mill input
    await MillInput.findByIdAndDelete(id);

    // Log the deletion
    try {
      logDelete('mill_input', id, {}, request);
    } catch (logError) {
      // Don't fail the request if logging fails
    }

    return NextResponse.json(deletedResponse('Mill input deleted successfully'));

  } catch (error: unknown) {
    await logError('mill_input_delete', error, {
      resource: 'mill_input',
      endpoint: request.url,
      method: request.method,
      ipAddress: request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? undefined,
      userAgent: request.headers.get('user-agent') ?? undefined,
    });
    return NextResponse.json(errorResponse('Failed to delete mill input'), { status: 500 });
  }
}
