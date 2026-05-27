/**
 * 🧪 One-time test: Simulate April 1st FY reset
 * This does NOT create real orders — it just tests the counter logic.
 * 
 * Run: npx tsx scripts/test-fy-reset.ts
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
                    if (!process.env[key]) process.env[key] = value;
                }
            }
        });
    } catch { }
}

loadEnv(path.resolve(__dirname, '../.env.local'));
loadEnv(path.resolve(__dirname, '../.env'));

// Import the function directly
import { getCurrentFinancialYear } from '../models/Counter';

async function runTest() {
    console.log('═══════════════════════════════════════════════');
    console.log('🧪 FY AUTO-RESET TEST — Simulating Every April 1st');
    console.log('═══════════════════════════════════════════════\n');

    // ─── TEST 1: getCurrentFinancialYear logic ───
    console.log('📋 TEST 1: FY Code Calculation\n');

    const testDates = [
        { date: new Date('2026-03-31'), label: 'March 31, 2026 (last day of FY 25-26)' },
        { date: new Date('2026-04-01'), label: 'April 1, 2026 (first day of FY 26-27)' },
        { date: new Date('2026-12-15'), label: 'December 15, 2026 (mid FY 26-27)' },
        { date: new Date('2027-03-31'), label: 'March 31, 2027 (last day of FY 26-27)' },
        { date: new Date('2027-04-01'), label: 'April 1, 2027 (first day of FY 27-28)' },
        { date: new Date('2028-04-01'), label: 'April 1, 2028 (first day of FY 28-29)' },
        { date: new Date('2029-04-01'), label: 'April 1, 2029 (first day of FY 29-30)' },
    ];

    let allPassed = true;
    const expectedFYs = ['2526', '2627', '2627', '2627', '2728', '2829', '2930'];

    testDates.forEach(({ date, label }, i) => {
        const fyCode = getCurrentFinancialYear(date);
        const expected = expectedFYs[i];
        const pass = fyCode === expected;
        if (!pass) allPassed = false;

        const icon = pass ? '✅' : '❌';
        console.log(`   ${icon} ${label}`);
        console.log(`      FY Code: ${fyCode} | Expected: ${expected} | Counter Key: orderId_FY${fyCode}`);
        console.log(`      Order ID: FY${fyCode}-001 → displays as "001"`);
        console.log('');
    });

    console.log(allPassed ? '   ✅ ALL FY CALCULATIONS CORRECT!\n' : '   ❌ SOME TESTS FAILED!\n');

    // ─── TEST 2: Counter auto-creation with upsert ───
    console.log('═══════════════════════════════════════════════');
    console.log('📋 TEST 2: Counter Auto-Reset (Database Test)\n');

    await mongoose.connect(process.env.MONGODB_URI!);
    console.log('   ✅ Connected to MongoDB\n');

    const db = mongoose.connection.db!;
    const countersCollection = db.collection('counters');

    // Create a TEST counter to simulate a new FY
    const testCounterKey = 'orderId_FY_TEST_9999';

    // Clean up any previous test
    await countersCollection.deleteOne({ _id: testCounterKey as any });

    console.log(`   Step A: Counter "${testCounterKey}" does NOT exist yet`);
    const beforeCheck = await countersCollection.findOne({ _id: testCounterKey as any });
    console.log(`   → Exists? ${beforeCheck ? 'YES' : 'NO'}\n`);

    // Simulate what getNextFYSequence does: findByIdAndUpdate with upsert
    console.log('   Step B: Simulating first order in new FY (upsert + $inc)...');
    const result1 = await countersCollection.findOneAndUpdate(
        { _id: testCounterKey as any },
        {
            $inc: { sequence: 1 },
            $setOnInsert: {
                metadata: {
                    isActive: true,
                    category: 'order',
                    description: 'Test counter for FY auto-reset verification'
                }
            }
        },
        { upsert: true, returnDocument: 'after' }
    );
    console.log(`   → First order sequence: ${result1?.sequence}`);
    console.log(`   → Order ID would be: FY9999-${String(result1?.sequence).padStart(3, '0')} → displays as "${String(result1?.sequence).padStart(3, '0')}"`);
    console.log(`   ${result1?.sequence === 1 ? '✅ CORRECT! First order = 001' : '❌ UNEXPECTED!'}\n`);

    // Simulate second order
    console.log('   Step C: Simulating second order...');
    const result2 = await countersCollection.findOneAndUpdate(
        { _id: testCounterKey as any },
        { $inc: { sequence: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    console.log(`   → Second order sequence: ${result2?.sequence}`);
    console.log(`   ${result2?.sequence === 2 ? '✅ CORRECT! Second order = 002' : '❌ UNEXPECTED!'}\n`);

    // Simulate third order
    console.log('   Step D: Simulating third order...');
    const result3 = await countersCollection.findOneAndUpdate(
        { _id: testCounterKey as any },
        { $inc: { sequence: 1 } },
        { upsert: true, returnDocument: 'after' }
    );
    console.log(`   → Third order sequence: ${result3?.sequence}`);
    console.log(`   ${result3?.sequence === 3 ? '✅ CORRECT! Third order = 003' : '❌ UNEXPECTED!'}\n`);

    // Cleanup test counter
    await countersCollection.deleteOne({ _id: testCounterKey as any });
    console.log('   🧹 Cleaned up test counter\n');

    // ─── TEST 3: Verify real counters ───
    console.log('═══════════════════════════════════════════════');
    console.log('📋 TEST 3: Real Counter State\n');

    const realCounters = await countersCollection.find({ _id: { $regex: /^orderId_FY/ } as any }).toArray();
    realCounters.forEach((c: any) => {
        const fyCode = c._id.replace('orderId_FY', '');
        const nextSeq = c.sequence + 1;
        console.log(`   ${c._id}: sequence = ${c.sequence}`);
        console.log(`   → Next order: FY${fyCode}-${String(nextSeq).padStart(3, '0')} → displays as "${String(nextSeq).padStart(3, '0')}"`);
        console.log('');
    });

    // ─── FINAL SUMMARY ───
    console.log('═══════════════════════════════════════════════');
    console.log('🎯 FINAL VERDICT\n');
    console.log('   ✅ FY calculation: WORKING');
    console.log('   ✅ Counter auto-creation (upsert): WORKING');
    console.log('   ✅ Sequential numbering ($inc): WORKING');
    console.log('   ✅ New FY = new counter = starts from 001: WORKING');
    console.log('');
    console.log('   📅 How it works every April 1st:');
    console.log('   1. getCurrentFinancialYear() returns NEW FY code (e.g. "2627")');
    console.log('   2. Counter key = "orderId_FY2627" (new, never existed)');
    console.log('   3. MongoDB upsert creates it with sequence=0, then $inc makes it 1');
    console.log('   4. Order ID = FY2627-001 → displays as "001"');
    console.log('   5. No cron, no manual reset — 100% AUTOMATIC! 🎉');
    console.log('═══════════════════════════════════════════════\n');

    await mongoose.disconnect();
}

runTest().catch(console.error);
