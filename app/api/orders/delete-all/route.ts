import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import Order from '@/models/Order';
import Counter from '@/models/Counter';
import { Lab, GreyInfo, MillInput, MillOutput, Dispatch } from '@/models';
import { logDelete } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
  try {
    const { getSession } = await import('@/lib/session');
    const session = await getSession(request);
    if (!session) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (session.role !== 'master') {
      return NextResponse.json({ success: false, message: 'Access denied - Only master can delete all orders' }, { status: 403 });
    }

    await dbConnect();

    // Get the count of orders before deletion
    const orderCount = await Order.countDocuments();
    
    if (orderCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'No orders found to delete'
      }, { status: 400 });
    }

    console.log('🗑️ Starting cascade delete for all orders...');
    
    // Step 1: Delete all related data first
    const deleteResults = {
      labData: 0,
      greyInfo: 0,
      millInputs: 0,
      millOutputs: 0,
      dispatches: 0,
      orders: 0
    };

    try {
      // Delete all Lab Data (soft delete)
      console.log('🗑️ Deleting all lab data...');
      const labResult = await Lab.updateMany(
        { softDeleted: { $ne: true } },
        { softDeleted: true }
      );
      deleteResults.labData = labResult.modifiedCount;
      console.log(`✅ Deleted ${deleteResults.labData} lab records`);
    } catch (error) {
      console.error('Error deleting lab data:', error);
    }

    try {
      // Delete all Grey Information
      console.log('🗑️ Deleting all grey information...');
      const greyInfoResult = await GreyInfo.deleteMany({});
      deleteResults.greyInfo = greyInfoResult.deletedCount;
      console.log(`✅ Deleted ${deleteResults.greyInfo} grey info records`);
    } catch (error) {
      console.error('Error deleting grey info:', error);
    }

    try {
      // Delete all Mill Inputs
      console.log('🗑️ Deleting all mill inputs...');
      const millInputResult = await MillInput.deleteMany({});
      deleteResults.millInputs = millInputResult.deletedCount;
      console.log(`✅ Deleted ${deleteResults.millInputs} mill input records`);
    } catch (error) {
      console.error('Error deleting mill inputs:', error);
    }

    try {
      // Delete all Mill Outputs
      console.log('🗑️ Deleting all mill outputs...');
      const millOutputResult = await MillOutput.deleteMany({});
      deleteResults.millOutputs = millOutputResult.deletedCount;
      console.log(`✅ Deleted ${deleteResults.millOutputs} mill output records`);
    } catch (error) {
      console.error('Error deleting mill outputs:', error);
    }

    try {
      // Delete all Dispatch Data
      console.log('🗑️ Deleting all dispatch data...');
      const dispatchResult = await Dispatch.deleteMany({});
      deleteResults.dispatches = dispatchResult.deletedCount;
      console.log(`✅ Deleted ${deleteResults.dispatches} dispatch records`);
    } catch (error) {
      console.error('Error deleting dispatch data:', error);
    }

    // Step 2: Delete all orders
    console.log('🗑️ Deleting all orders...');
    const deleteResult = await Order.deleteMany({});
    deleteResults.orders = deleteResult.deletedCount;
    
    if (deleteResult.deletedCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'Failed to delete orders'
      }, { status: 500 });
    }

    // Reset the counter to 0
    await Counter.findByIdAndUpdate('orderId', { sequence: 0 }, { upsert: true });

    console.log('✅ All data deleted successfully:', deleteResults);

    // Log the bulk deletion
    logDelete('order', 'bulk', {}, request);

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.deletedCount} orders and all related data (${deleteResults.labData} lab records, ${deleteResults.greyInfo} grey info, ${deleteResults.millInputs} mill inputs, ${deleteResults.millOutputs} mill outputs, ${deleteResults.dispatches} dispatches) and reset counter to 0`,
      deletedCount: deleteResult.deletedCount,
      relatedDataDeleted: deleteResults
    });

  } catch (error) {
    console.error('Error during bulk delete:', error);
    return NextResponse.json({
      success: false,
      message: 'Failed to delete all orders',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
