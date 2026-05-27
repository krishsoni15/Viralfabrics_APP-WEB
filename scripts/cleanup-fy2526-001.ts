/**
 * Cleanup script: Delete the accidental FY2526-001 order from the database.
 * Run with: npx tsx scripts/cleanup-fy2526-001.ts
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

function loadEnv(filePath: string) {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');
        content.split('\n').forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const eqIndex = trimmed.indexOf('=');
                if (eqIndex > 0) {
                    const key = trimmed.slice(0, eqIndex).trim();
                    const value = trimmed.slice(eqIndex + 1).trim();
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            }
        });
    } catch { /* file not found, skip */ }
}

loadEnv(path.resolve(__dirname, '../.env.local'));
loadEnv(path.resolve(__dirname, '../.env'));

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not found'); process.exit(1); }

async function cleanup() {
    try {
        await mongoose.connect(MONGODB_URI!);
        const db = mongoose.connection.db!;
        const ordersCollection = db.collection('orders');

        // Show all FY-prefixed orders
        const fyOrders = await ordersCollection.find({
            orderId: { $regex: /^FY/ }
        }).project({ orderId: 1, createdAt: 1 }).toArray();

        console.log('\n📋 FY-prefixed orders in database:');
        fyOrders.forEach((o: any) => {
            console.log(`   ${o.orderId} (created: ${o.createdAt})`);
        });

        if (fyOrders.length === 0) {
            console.log('   None found - all clean!');
        } else {
            // Delete the FY2526-001 order
            const result = await ordersCollection.deleteOne({ orderId: 'FY2526-001' });
            if (result.deletedCount > 0) {
                console.log('\n✅ Deleted FY2526-001 from orders collection');
            } else {
                console.log('\nℹ️  FY2526-001 not found (already deleted)');
            }

            // Also delete any FY2627 and FY2728 test orders
            const result2627 = await ordersCollection.deleteMany({ orderId: { $regex: /^FY2627-/ } });
            const result2728 = await ordersCollection.deleteMany({ orderId: { $regex: /^FY2728-/ } });

            if (result2627.deletedCount > 0) {
                console.log(`✅ Deleted ${result2627.deletedCount} FY2627 test order(s)`);
            }
            if (result2728.deletedCount > 0) {
                console.log(`✅ Deleted ${result2728.deletedCount} FY2728 test order(s)`);
            }
        }

        // Show remaining orders
        const remaining = await ordersCollection.find({}).project({ orderId: 1 }).sort({ orderId: 1 }).toArray();
        console.log(`\n📊 Remaining orders (${remaining.length} total):`);
        remaining.forEach((o: any) => console.log(`   ${o.orderId}`));

        console.log('\n✅ Done!');
    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

cleanup();
