/**
 * Fix FY counter alignment script.
 * 
 * Problem:
 * - FY 25-26 has legacy orders (005, 006, etc.) without FY prefix
 * - The FY counter for 2526 needs to be set to the highest legacy order number
 *   so that new orders continue the sequence (e.g., next = FY2526-007 → displays "007")
 * - FY 26-27 counter needs to be reset to 0 so it starts fresh from 001 on April 1st
 * 
 * Run with: npx tsx scripts/reset-fy-counter.ts
 */

import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

// Load environment variables from .env file manually
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

if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
}

async function fixCounters() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI!);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        if (!db) {
            console.error('❌ Database not available');
            process.exit(1);
        }

        const countersCollection = db.collection('counters');
        const ordersCollection = db.collection('orders');

        // ──────────────────────────────────────────────
        // STEP 1: Find the highest LEGACY order number
        // Legacy orders have orderId like "001", "005", "006" (no FY prefix)
        // ──────────────────────────────────────────────
        console.log('📋 STEP 1: Finding highest legacy order number...');

        const legacyOrders = await ordersCollection.find({
            orderId: { $not: /^FY/ }  // Orders WITHOUT FY prefix
        }).project({ orderId: 1 }).sort({ orderId: -1 }).toArray();

        let highestLegacyNumber = 0;
        legacyOrders.forEach((order: any) => {
            const num = parseInt(order.orderId, 10);
            if (!isNaN(num) && num > highestLegacyNumber) {
                highestLegacyNumber = num;
            }
        });

        console.log(`   Found ${legacyOrders.length} legacy orders (without FY prefix)`);
        console.log(`   Highest legacy order number: ${highestLegacyNumber.toString().padStart(3, '0')}`);
        if (legacyOrders.length > 0) {
            console.log(`   Legacy order IDs: ${legacyOrders.map((o: any) => o.orderId).join(', ')}`);
        }

        // ──────────────────────────────────────────────
        // STEP 2: Find any FY2526-prefixed orders
        // ──────────────────────────────────────────────
        console.log('\n📋 STEP 2: Finding FY2526-prefixed orders...');

        const fy2526Orders = await ordersCollection.find({
            orderId: { $regex: /^FY2526-/ }
        }).project({ orderId: 1 }).toArray();

        let highestFY2526Number = 0;
        fy2526Orders.forEach((order: any) => {
            const match = order.orderId.match(/FY2526-(\d+)/);
            if (match) {
                const num = parseInt(match[1], 10);
                if (num > highestFY2526Number) highestFY2526Number = num;
            }
        });

        console.log(`   Found ${fy2526Orders.length} FY2526 orders`);
        if (fy2526Orders.length > 0) {
            console.log(`   FY2526 order IDs: ${fy2526Orders.map((o: any) => o.orderId).join(', ')}`);
            console.log(`   Highest FY2526 order number: ${highestFY2526Number}`);
        }

        // The counter should be set to MAX(highestLegacy, highestFY2526)
        // so the next order continues the sequence properly
        const fy2526TargetSequence = Math.max(highestLegacyNumber, highestFY2526Number);

        // ──────────────────────────────────────────────
        // STEP 3: Set orderId_FY2526 counter properly
        // ──────────────────────────────────────────────
        console.log(`\n📋 STEP 3: Setting orderId_FY2526 counter to ${fy2526TargetSequence}...`);

        await countersCollection.updateOne(
            { _id: 'orderId_FY2526' as any },
            {
                $set: { sequence: fy2526TargetSequence, lastReset: new Date() },
                $setOnInsert: {
                    metadata: {
                        isActive: true,
                        category: 'order',
                        description: 'Auto-created counter for orderId in FY 2025-26'
                    }
                }
            },
            { upsert: true }
        );
        console.log(`   ✅ orderId_FY2526 set to ${fy2526TargetSequence}`);
        console.log(`   → Next order today will be: FY2526-${(fy2526TargetSequence + 1).toString().padStart(3, '0')} (displays as "${(fy2526TargetSequence + 1).toString().padStart(3, '0')}")`);

        // ──────────────────────────────────────────────
        // STEP 4: Reset orderId_FY2627 to 0 (fresh start on April 1st)
        // ──────────────────────────────────────────────
        console.log('\n📋 STEP 4: Resetting orderId_FY2627 counter to 0...');

        // Check if any FY2627 orders exist in the DB
        const fy2627Orders = await ordersCollection.find({
            orderId: { $regex: /^FY2627-/ }
        }).project({ orderId: 1 }).toArray();

        if (fy2627Orders.length > 0) {
            console.log(`   ⚠️  Found ${fy2627Orders.length} existing FY2627 orders: ${fy2627Orders.map((o: any) => o.orderId).join(', ')}`);
            console.log(`   ⚠️  These orders exist in the database - delete them manually if they are test data`);
        }

        const result2627 = await countersCollection.updateOne(
            { _id: 'orderId_FY2627' as any },
            { $set: { sequence: 0, lastReset: new Date() } }
        );

        if (result2627.matchedCount > 0) {
            console.log('   ✅ orderId_FY2627 reset to 0');
            console.log('   → First order on April 1st will be: FY2627-001 (displays as "001")');
        } else {
            console.log('   ℹ️  orderId_FY2627 counter not found (will be auto-created on first order)');
            console.log('   → First order on April 1st will be: FY2627-001 (displays as "001")');
        }

        // ──────────────────────────────────────────────
        // STEP 5: Clean up FY2728 counter too (likely test data)
        // ──────────────────────────────────────────────
        console.log('\n📋 STEP 5: Cleaning up FY2728 counter...');

        const result2728 = await countersCollection.updateOne(
            { _id: 'orderId_FY2728' as any },
            { $set: { sequence: 0, lastReset: new Date() } }
        );

        if (result2728.matchedCount > 0) {
            console.log('   ✅ orderId_FY2728 reset to 0');
        } else {
            console.log('   ℹ️  orderId_FY2728 not found (nothing to clean)');
        }

        // ──────────────────────────────────────────────
        // FINAL: Show summary
        // ──────────────────────────────────────────────
        const allCounters = await countersCollection.find({ _id: { $regex: /^orderId_FY/ } as any }).toArray();

        console.log('\n═══════════════════════════════════════');
        console.log('📊 FINAL COUNTER STATE:');
        console.log('═══════════════════════════════════════');
        allCounters.forEach((counter: any) => {
            console.log(`   ${counter._id}: sequence = ${counter.sequence}`);
        });

        console.log('\n✨ HOW IT WORKS NOW:');
        console.log(`   📅 Today (March 31, FY 25-26):`);
        console.log(`      Next order → FY2526-${(fy2526TargetSequence + 1).toString().padStart(3, '0')} → displays as "${(fy2526TargetSequence + 1).toString().padStart(3, '0')}"`);
        console.log(`      Continues after existing orders (005, 006, etc.)`);
        console.log(`   📅 April 1st (FY 26-27):`);
        console.log(`      First order → FY2627-001 → displays as "001"`);
        console.log(`      Auto-resets every year, no manual work needed!`);
        console.log('═══════════════════════════════════════\n');

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from MongoDB');
    }
}

fixCounters();
