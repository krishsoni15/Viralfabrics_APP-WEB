const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const uri = "mongodb+srv://krish1509soni:mqYQZaMl2qjtNkWL@cluster0.hb5hrbq.mongodb.net/CRM_AdminPanel?retryWrites=true&w=majority&appName=Cluster0";

const logFile = path.join(__dirname, '..', 'output_db.txt');
let logContent = "";

function log(msg, obj) {
  const line = msg + (obj ? " " + JSON.stringify(obj, null, 2) : "") + "\n";
  console.log(msg);
  logContent += line;
}

async function run() {
  try {
    log("Connecting to DB...");
    await mongoose.connect(uri);
    log("Connected to DB successfully");
    
    const db = mongoose.connection.db;
    
    // Find grey info for orderId: "003"
    const greyInfoCollection = db.collection('greyinfo');
    const docs = await greyInfoCollection.find({ orderId: "003" }).toArray();
    log("GreyInfo documents for orderId 003:", docs);
    
    // Also fetch order details for "003"
    const ordersCollection = db.collection('orders');
    const orderDoc = await ordersCollection.findOne({ orderId: "003" });
    log("Order document for 003:", orderDoc);

  } catch (err) {
    log("Error: " + err.message + "\n" + err.stack);
  } finally {
    await mongoose.disconnect();
    fs.writeFileSync(logFile, logContent);
    console.log("Logged output to " + logFile);
  }
}

run();
