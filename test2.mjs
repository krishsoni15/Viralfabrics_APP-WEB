import fs from 'fs';
import mongoose from 'mongoose';
const env = fs.readFileSync('.env', 'utf8');
const uriMatch = env.match(/MONGODB_URI=(.*)/);
if (!uriMatch) { console.log('no uri'); process.exit(1); }
const uri = uriMatch[1].trim();
await mongoose.connect(uri);
const db = mongoose.connection.db;
const orders = await db.collection('orders').find().sort({_id:-1}).limit(2).toArray();
console.log(orders.map(o => `"${o.orderId}"`));
process.exit(0);
