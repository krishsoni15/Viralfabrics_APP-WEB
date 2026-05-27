const mongoose = require('mongoose');

async function cleanup() {
    const uri = 'mongodb+srv://krish1509soni:mqYQZaMl2qjtNkWL@cluster0.hb5hrbq.mongodb.net/CRM_AdminPanel?retryWrites=true&w=majority&appName=Cluster0';

    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(uri);
        console.log('Connected.');

        const db = mongoose.connection.db;

        // 1. Find and Delete orders with FY2627 prefix
        const ordersToDelete = await db.collection('orders').countDocuments({ orderId: /^FY2627-/ });
        if (ordersToDelete > 0) {
            const result = await db.collection('orders').deleteMany({ orderId: /^FY2627-/ });
            console.log(`✅ Deleted ${result.deletedCount} orders with FY2627 prefix.`);
        } else {
            console.log('ℹ️ No orders found with FY2627 prefix.');
        }

        // 2. Find and Delete counters ending with _FY2627
        const countersToDelete = await db.collection('counters').countDocuments({ _id: /_FY2627$/ });
        if (countersToDelete > 0) {
            const result = await db.collection('counters').deleteMany({ _id: /_FY2627$/ });
            console.log(`✅ Deleted ${result.deletedCount} counter documents for FY2627.`);
        } else {
            console.log('ℹ️ No counter documents found for FY2627.');
        }

        console.log('Cleanup complete.');
    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        process.exit();
    }
}

cleanup();
