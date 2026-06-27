const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// Custom env loader
try {
  const dotenvContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  dotenvContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = (match[2] || '').trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
} catch (e) {
  console.error('Failed to load .env', e);
}

const uri = process.env.MONGODB_URI;
console.log('Connecting to:', uri);

async function run() {
  try {
    await mongoose.connect(uri);
    console.log('Connected!');
    
    const db = mongoose.connection.db;
    const samplesCol = db.collection('samples');
    const weaversCol = db.collection('samplingweavers');

    const weaverId = '6a16836d47630cb839871cab';
    console.log('Finding weaver...');
    const weaver = await weaversCol.findOne({ _id: new mongoose.Types.ObjectId(weaverId) });
    console.log('Weaver:', weaver);

    console.log('Finding samples...');
    const samples = await samplesCol.find({ weaverId: new mongoose.Types.ObjectId(weaverId) }).toArray();
    console.log('Samples:', JSON.stringify(samples, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
