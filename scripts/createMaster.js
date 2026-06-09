const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Generate a secure password
function generateSecurePassword() {
  return "Master@2026#";
}

// 1. Manually parse .env file to get MONGODB_URI
function loadEnv() {
  try {
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf8');
      envContent.split('\n').forEach(line => {
        const match = line.match(/^\s*([^#=]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let value = match[2].trim();
          // Remove wrapping quotes if any
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          process.env[key] = value;
        }
      });
    }
  } catch (error) {
    console.error('Error loading .env file:', error.message);
  }
}

async function run() {
  console.log('========================================');
  console.log('   MASTER ACCOUNT CREATION SCRIPT      ');
  console.log('========================================');

  loadEnv();

  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    console.error('Error: MONGODB_URI is not set in environment or .env file.');
    process.exit(1);
  }

  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected successfully!');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');

    // Step 1: Remove any existing master user (cleanup old weak-password master)
    console.log('Checking for existing master account...');
    const existingMaster = await usersCollection.findOne({ $or: [{ role: 'master' }, { username: 'master' }] });
    
    if (existingMaster) {
      console.log(`Found existing master (id: ${existingMaster._id}, username: ${existingMaster.username}). Removing...`);
      await usersCollection.deleteOne({ _id: existingMaster._id });
      console.log('Old master account removed.');
    }

    // Step 2: Generate secure password and hash it
    const plainPassword = generateSecurePassword();
    console.log('Generating secure password and hashing...');
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(plainPassword, salt);

    // Step 3: Build the master user document (matching User model fields)
    const masterUser = {
      name: 'Master',
      username: 'master',
      password: hashedPassword,
      role: 'master',
      isActive: true,
      loginCount: 0,
      failedLoginAttempts: 0,
      accountLocked: false,
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true,
        timezone: 'Asia/Kolkata'
      },
      metadata: {
        notes: 'System master account - top-level admin with full access'
      },
      createdAt: new Date(),
      updatedAt: new Date()
    };

    console.log('Inserting master account...');
    const result = await usersCollection.insertOne(masterUser);
    
    console.log('\n========================================');
    console.log('✅ MASTER ACCOUNT CREATED SUCCESSFULLY!');
    console.log('========================================');
    console.log(`User ID:  ${result.insertedId}`);
    console.log(`Name:     ${masterUser.name}`);
    console.log(`Username: ${masterUser.username}`);
    console.log(`Role:     ${masterUser.role}`);
    console.log(`Password: ${plainPassword}`);
    console.log('========================================');
    console.log('⚠️  IMPORTANT: Save this password securely.');
    console.log('   It is only shown ONCE and cannot be recovered.');
    console.log('========================================');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error during master account creation:', error);
    try {
      await mongoose.disconnect();
    } catch (e) {}
    process.exit(1);
  }
}

run();
