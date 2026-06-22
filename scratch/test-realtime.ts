import mongoose from 'mongoose';
import dbConnect from '../lib/dbConnect';
import { Order, Party, Quality } from '../models';
import SystemConfig from '../models/SystemConfig';

async function runTest() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await dbConnect();
    console.log('✅ Connected.');

    // 1. Check initial config state
    const initialConfig = await SystemConfig.findOne({ key: 'last_data_change' }).lean();
    console.log('Initial last_data_change config:', initialConfig);

    // 2. Find a random order and save it to trigger the post-save middleware
    console.log('🔍 Finding an order to trigger change event...');
    const order = await Order.findOne({});
    if (!order) {
      console.log('⚠️ No orders found in database, cannot trigger save.');
      process.exit(0);
    }

    console.log(`📝 Saving order: ${order.orderId} (ID: ${order._id})...`);
    // Touch updatedAt or save to trigger hooks
    order.markModified('updatedAt');
    await order.save();
    console.log('✅ Order saved.');

    // Wait a brief moment for the async save to finish updating SystemConfig
    console.log('⏳ Waiting for async metadata update to persist...');
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // 3. Check final config state
    const finalConfig = await SystemConfig.findOne({ key: 'last_data_change' }).lean();
    console.log('Final last_data_change config:', finalConfig);

    if (finalConfig && (finalConfig as any).value?.module === 'Order') {
      console.log('🎉 TEST PASSED! The database change plugin successfully logged the data change to SystemConfig.');
    } else {
      console.log('❌ TEST FAILED! The system config was not updated correctly.');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

runTest();
