import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Lab from '@/models/Lab';
import Order from '@/models/Order';

// GET - Fetch lab data for a specific order item
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await dbConnect();
    
    const { id: orderId, itemId } = await params;
    
    // Find the lab data for this specific order and item
    const labData = await Lab.findOne({
      order: orderId,
      orderItemId: itemId,
      softDeleted: false
    });
    
    if (!labData) {
      // Return empty structure if no lab data exists
      return NextResponse.json({
        success: true,
        data: {
          labData: {
            labSendDate: '',
            approvalDate: '',
            sampleNumber: ''
          }
        }
      });
    }
    
    const responseData = {
      labData: {
        labSendDate: labData.labSendDate ? labData.labSendDate.toISOString().split('T')[0] : '',
        approvalDate: labData.labSendData?.approvalDate ? labData.labSendData.approvalDate.toISOString().split('T')[0] : '',
        sampleNumber: labData.labSendData?.sampleNumber || ''
      }
    };
    
    return NextResponse.json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to fetch lab data' },
      { status: 500 }
    );
  }
}

// POST - Create or update lab data for a specific order item
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await dbConnect();
    
    const { id: orderId, itemId } = await params;
    const body = await request.json();
    
    const { labSendDate, approvalDate, sampleNumber } = body;
    
    // Validate required fields
    if (!labSendDate) {
      return NextResponse.json(
        { success: false, message: 'Lab Send Date is required' },
        { status: 400 }
      );
    }
    
    // Check if order exists
    const order = await Order.findById(orderId);
    if (!order) {
      return NextResponse.json(
        { success: false, message: 'Order not found' },
        { status: 404 }
      );
    }
    
    // Check if item exists in the order
    const itemExists = order.items.some((item: any) => item._id?.toString() === itemId);
    if (!itemExists) {
      return NextResponse.json(
        { success: false, message: 'Item not found in order' },
        { status: 404 }
      );
    }
    
    // Prepare lab data
    const labDataToSave = {
      color: '',
      shade: '',
      notes: '',
      sampleNumber: sampleNumber,
      imageUrl: '',
      approvalDate: approvalDate ? new Date(approvalDate) : null,
      specifications: {}
    };
    
    // Find existing lab data or create new one
    let labData = await Lab.findOne({ 
      order: orderId, 
      orderItemId: itemId,
      softDeleted: false 
    });
    
    if (labData) {
      // Update existing lab data
      labData.labSendData = labDataToSave;
      labData.labSendDate = new Date(labSendDate);
      labData.updatedAt = new Date();
    } else {
      // Create new lab data
      labData = new Lab({
        order: orderId,
        orderItemId: itemId,
        labSendDate: new Date(labSendDate),
        labSendData: labDataToSave,
        labSendNumber: '',
        status: 'sent',
        priority: 5,
        urgency: 'medium',
        softDeleted: false,
        metadata: {
          tags: [],
          source: 'manual',
          complexity: 'moderate'
        }
      });
    }
    
    await labData.save();
    
    return NextResponse.json({
      success: true,
      message: 'Lab data saved successfully',
      data: {
        labData: {
          labSendDate: labData.labSendDate.toISOString().split('T')[0],
          approvalDate: labData.labSendData?.approvalDate ? labData.labSendData.approvalDate.toISOString().split('T')[0] : '',
          sampleNumber: labData.labSendData?.sampleNumber || ''
        }
      }
    });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to save lab data' },
      { status: 500 }
    );
  }
}

// DELETE - Delete lab data for a specific order item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    await dbConnect();  
    
    const { id: orderId, itemId } = await params;
    
    // Find and soft delete the lab data
    const labData = await Lab.findOne({ 
      order: orderId, 
      orderItemId: itemId,
      softDeleted: false 
    });
    
    if (!labData) {
      return NextResponse.json(
        { success: false, message: 'Lab data not found' },
        { status: 404 }
      );
    }
    
    labData.softDeleted = true;
    await labData.save();
    
    return NextResponse.json({
      success: true,
      message: 'Lab data deleted successfully'
    });
    
  } catch (error) {
    return NextResponse.json(
      { success: false, message: 'Failed to delete lab data' },
      { status: 500 }
    );
  }
}
