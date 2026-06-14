const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

async function run() {
  console.log('Connecting to database...');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected! Fetching qualities...');
  const collections = await mongoose.connection.db.listCollections().toArray();
  console.log('Collections in database:', collections.map(c => c.name));
  
  const Quality = mongoose.model('Quality', new mongoose.Schema({}, { strict: false }), 'qualities');
  const count = await Quality.countDocuments();
  console.log('Total qualities:', count);
  const sample = await Quality.find().limit(5);
  console.log('Sample qualities:', sample);
  
  await mongoose.disconnect();
  console.log('Disconnected.');
}

run().catch(console.error);
