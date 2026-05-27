import { NextResponse } from 'next/server';
import dbConnect from '@/lib/dbConnect';
import mongoose from 'mongoose';
import * as XLSX from 'xlsx';
import JSZip from 'jszip';

// Import all models
import Order from '@/models/Order';
import Party from '@/models/Party';
import Quality from '@/models/Quality';
import Fabric from '@/models/Fabric';
import Lab from '@/models/Lab';
import GreyInfo from '@/models/GreyInfo';
import { Mill, MillInput } from '@/models/Mill';
import MillOutput from '@/models/MillOutput';
import Dispatch from '@/models/Dispatch';
import Process from '@/models/Process';
import Log from '@/models/Log';
import User from '@/models/User';
import Counter from '@/models/Counter';
import Sample from '@/models/Sample';
import Weaver from '@/models/Weaver';
import QualityName from '@/models/QualityName';
import WeaverQualityName from '@/models/WeaverQualityName';
import SamplingWeaver from '@/models/SamplingWeaver';
import SystemConfig from '@/models/SystemConfig';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ── Helpers ──────────────────────────────────────────────────────────

/** Deeply convert a Mongoose Lean Document into proper MongoDB Extended JSON */
function toMongoJSON(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (obj instanceof Date) return { $date: obj.toISOString() };
    if (obj.constructor && obj.constructor.name === 'ObjectId') return { $oid: obj.toString() };
    if (obj._bsontype === 'ObjectId' || (typeof obj.toHexString === 'function')) return { $oid: obj.toString() };
    if (Array.isArray(obj)) return obj.map(toMongoJSON);
    if (typeof obj === 'object') {
        const newObj: any = {};
        for (const [k, v] of Object.entries(obj)) {
            newObj[k] = toMongoJSON(v);
        }
        return newObj;
    }
    return obj;
}

/** Flatten nested objects for CSV/Excel rows */
function flattenDoc(doc: Record<string, any>, prefix = ''): Record<string, string> {
    const flat: Record<string, string> = {};
    for (const [key, value] of Object.entries(doc)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        if (value === null || value === undefined) {
            flat[fullKey] = '';
        } else if (Array.isArray(value)) {
            flat[fullKey] = JSON.stringify(value);
        } else if (typeof value === 'object' && !(value instanceof Date)) {
            // Check if it's a MongoDB ObjectId
            if (value._bsontype === 'ObjectId' || value.toString().match(/^[0-9a-fA-F]{24}$/)) {
                flat[fullKey] = value.toString();
            } else {
                Object.assign(flat, flattenDoc(value as Record<string, any>, fullKey));
            }
        } else {
            flat[fullKey] = String(value);
        }
    }
    return flat;
}

/** Convert array of docs to flat rows with consistent headers */
function docsToFlatRows(docs: any[]): { headers: string[]; rows: Record<string, string>[] } {
    if (docs.length === 0) return { headers: [], rows: [] };
    const flatDocs = docs.map(d => flattenDoc(d));
    const headerSet = new Set<string>();
    flatDocs.forEach(d => Object.keys(d).forEach(k => headerSet.add(k)));
    const headers = Array.from(headerSet);
    return { headers, rows: flatDocs };
}

/** Build CSV string from flat rows */
function buildCSV(headers: string[], rows: Record<string, string>[]): string {
    const escape = (str: string) => {
        if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes('\r')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    };
    const lines = [headers.map(escape).join(',')];
    rows.forEach(row => {
        lines.push(headers.map(h => escape(row[h] || '')).join(','));
    });
    return lines.join('\n');
}

// ── Main handler ─────────────────────────────────────────────────────

export async function GET() {
    try {
        await dbConnect();

        // Fetch ALL collections in parallel
        const [
            orders, parties, qualities, fabrics, labs, greyInfos,
            mills, millInputs, millOutputs, dispatches, processes,
            logs, users, counters, samples, weavers,
            qualityNames, weaverQualityNames, samplingWeavers, systemConfigs,
        ] = await Promise.all([
            Order.find({}).lean(),
            Party.find({}).lean(),
            Quality.find({}).lean(),
            Fabric.find({}).lean(),
            Lab.find({}).lean(),
            GreyInfo.find({}).lean(),
            Mill.find({}).lean(),
            MillInput.find({}).lean(),
            MillOutput.find({}).lean(),
            Dispatch.find({}).lean(),
            Process.find({}).lean(),
            Log.find({}).sort({ createdAt: -1 }).limit(10000).lean(),
            User.find({}).select('-password -refreshToken').lean(),
            Counter.find({}).lean(),
            Sample.find({}).lean(),
            Weaver.find({}).lean(),
            QualityName.find({}).lean(),
            WeaverQualityName.find({}).lean(),
            SamplingWeaver.find({}).lean(),
            SystemConfig.find({}).lean(),
        ]);

        // Collection map for iteration
        const collections: Record<string, any[]> = {
            orders, parties, qualities, fabrics, labs, greyInfos,
            mills, millInputs, millOutputs, dispatches, processes,
            logs, users, counters, samples, weavers,
            qualityNames, weaverQualityNames, samplingWeavers, systemConfigs,
        };

        // Timestamp for filenames
        const now = new Date();
        const pad = (n: number) => String(n).padStart(2, '0');
        const timestamp = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
        const folderName = `ViralFabrics_Backup_${timestamp}`;

        // ─── Build metadata ──────────────────────────────────────────
        const totalRecords: Record<string, number> = {};
        for (const [name, docs] of Object.entries(collections)) {
            totalRecords[name] = docs.length;
        }
        const metadata = {
            appName: 'ViralFabrics CRM',
            backupDate: now.toISOString(),
            dbName: mongoose.connection.db?.databaseName || 'CRM_AdminPanel',
            totalRecords,
        };

        // ─── Create ZIP ──────────────────────────────────────────────
        const zip = new JSZip();
        const root = zip.folder(folderName)!;

        // ──────── 1. JSON folder ─────────────────────────────────────
        const jsonFolder = root.folder('JSON')!;

        // Convert collections to MongoDB Extended JSON format safely
        const eJsonCollections: Record<string, any[]> = {};
        for (const [name, docs] of Object.entries(collections)) {
            eJsonCollections[name] = toMongoJSON(docs);
        }

        // Full structured backup
        jsonFolder.file('full_backup.json', JSON.stringify({ metadata, collections: eJsonCollections }, null, 2));
        // Individual collection files
        for (const [name, eDocs] of Object.entries(eJsonCollections)) {
            if (eDocs.length > 0) {
                jsonFolder.file(`${name}.json`, JSON.stringify(eDocs, null, 2));
            }
        }

        // ──────── 2. CSV folder ──────────────────────────────────────
        const csvFolder = root.folder('CSV')!;
        for (const [name, docs] of Object.entries(collections)) {
            if (docs.length === 0) continue;
            const { headers, rows } = docsToFlatRows(docs);
            csvFolder.file(`${name}.csv`, buildCSV(headers, rows));
        }

        // ──────── 3. Excel file (all collections as sheets) ──────────
        const wb = XLSX.utils.book_new();

        // Metadata sheet
        const metaRows = Object.entries(totalRecords).map(([collection, count]) => ({
            Collection: collection,
            'Record Count': count,
        }));
        metaRows.push({ Collection: 'TOTAL', 'Record Count': Object.values(totalRecords).reduce((a, b) => a + b, 0) });
        const metaSheet = XLSX.utils.json_to_sheet(metaRows);
        metaSheet['!cols'] = [{ wch: 25 }, { wch: 15 }];
        XLSX.utils.book_append_sheet(wb, metaSheet, 'Summary');

        // One sheet per collection
        for (const [name, docs] of Object.entries(collections)) {
            if (docs.length === 0) continue;
            const { headers, rows } = docsToFlatRows(docs);
            const sheetData = rows.map(row => {
                const obj: Record<string, string> = {};
                headers.forEach(h => { obj[h] = row[h] || ''; });
                return obj;
            });
            const ws = XLSX.utils.json_to_sheet(sheetData);
            // Auto-size columns
            ws['!cols'] = headers.map(h => ({
                wch: Math.min(Math.max(h.length, 12), 40),
            }));
            // Truncate sheet name to 31 chars (Excel limit)
            const sheetName = name.length > 31 ? name.slice(0, 31) : name;
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }

        const xlsxBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        root.file(`ViralFabrics_Backup_${timestamp}.xlsx`, xlsxBuffer);

        // ──────── 4. README inside zip ───────────────────────────────
        const readme = `# ViralFabrics CRM — Full Backup
Generated: ${now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
Database: ${metadata.dbName}

## Contents
├── JSON/
│   ├── full_backup.json    (complete structured backup)
│   └── <collection>.json   (individual collection files)
├── CSV/
│   └── <collection>.csv    (one file per collection)
├── ViralFabrics_Backup_${timestamp}.xlsx  (all collections as Excel sheets)
└── README.txt

## Collections Backed Up
${Object.entries(totalRecords).map(([n, c]) => `  • ${n}: ${c} records`).join('\n')}

Total Records: ${Object.values(totalRecords).reduce((a, b) => a + b, 0)}
`;
        root.file('README.txt', readme);

        // ──────── Generate ZIP buffer ────────────────────────────────
        const zipBuffer = await zip.generateAsync({
            type: 'nodebuffer',
            compression: 'DEFLATE',
            compressionOptions: { level: 6 },
        });

        return new NextResponse(new Uint8Array(zipBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${folderName}.zip"`,
                'Content-Length': String(zipBuffer.length),
            },
        });
    } catch (error: any) {
        console.error('Backup API Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate backup', details: error.message },
            { status: 500 }
        );
    }
}

//push 
