const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  const orderId = '6a2e93f1a3c3f8091311ac5b';
  console.log(`Connected! Fetching order ${orderId}...`);
  
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }), 'orders');
  const order = await Order.findById(orderId).lean();
  console.log('Order:', JSON.stringify(order, null, 2));
  
  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch(console.error);
