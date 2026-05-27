import fs from 'fs';
import mongoose from 'mongoose';
const env = fs.readFileSync('.env', 'utf8');
const uri = env.split('\n').find(l => l.startsWith('MONGODB_URI')).split('=')[1].trim();
await mongoose.connect(uri);
const db = mongoose.connection.db;
const orders = await db.collection('orders').find().sort({_id:-1}).limit(2).toArray();
console.log(orders.map(o=>o.orderId));
process.exit(0);
