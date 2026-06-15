const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected! Fetching order 6a2bfd79948ba677abd355a3...');
  
  const Order = mongoose.model('Order', new mongoose.Schema({}, { strict: false }), 'orders');
  const order = await Order.findById('6a2bfd79948ba677abd355a3').lean();
  console.log('Order:', JSON.stringify(order, null, 2));
  
  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch(console.error);
