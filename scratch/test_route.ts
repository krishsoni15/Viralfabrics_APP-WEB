// @ts-nocheck
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { SignJWT } from 'jose';

// Custom env loader
try {
  const dotenvContent = fs.readFileSync(path.join(process.cwd(), '.env'), 'utf8');
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
const jwtSecret = process.env.JWT_SECRET;

async function run() {
  try {
    await mongoose.connect(uri!);
    const db = mongoose.connection.db;
    const usersCol = db.collection('users');
    const user = await usersCol.findOne({ role: 'superadmin' });
    if (!user) {
      console.error('No superadmin user found');
      return;
    }
    console.log('Found user:', user.username);

    // Generate token
    const secretKey = new TextEncoder().encode(jwtSecret);
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({ 
      id: user._id.toString(), 
      role: user.role,
      username: user.username,
      name: user.name
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secretKey);

    console.log('Generated Token:', token);

    // Test API route
    console.log('Requesting /api/fabric-stickers...');
    try {
      const url = `http://localhost:3000/api/fabric-stickers?token=${token}&qualityName=333&weaverName=Weaver%20A&width=60&gsm=200&content=Cotton&count=30&rxP=120/80&danier=150D&rack=A1`;
      const response = await fetch(url);
      console.log('Response status:', response.status);
      console.log('Response content-type:', response.headers.get('content-type'));
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        console.log('Response data length:', buffer.byteLength);
      } else {
        const bodyText = await response.text();
        console.error('API Error Body:', bodyText);
      }
    } catch (apiErr: any) {
      console.error('API Request failed:', apiErr.message);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
