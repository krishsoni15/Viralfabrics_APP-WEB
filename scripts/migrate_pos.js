const mongoose = require('mongoose');

const uri = 'mongodb+srv://krish1509soni:mqYQZaMl2qjtNkWL@cluster0.hb5hrbq.mongodb.net/CRM_AdminPanel?retryWrites=true&w=majority&appName=Cluster0';

function getCurrentFinancialYear(date) {
  let now = date ? new Date(date) : new Date();
  
  // Calculate IST time correctly
  const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(utcTime + istOffset);

  const month = istDate.getMonth(); // 0-indexed (0=Jan, 3=Apr)
  const year = istDate.getFullYear();

  const fyStartYear = month >= 3 ? year : year - 1;
  const fyEndYear = fyStartYear + 1;

  const startCode = String(fyStartYear).slice(-2);
  const endCode = String(fyEndYear).slice(-2);

  return `${startCode}${endCode}`;
}

async function run() {
  await mongoose.connect(uri);
  console.log('Connected to DB');

  const PurchaseOrder = mongoose.connection.db.collection('purchaseorders');
  const Counter = mongoose.connection.db.collection('counters');

  // Find all active purchase orders
  const query = {
    $or: [
      { softDeleted: false },
      { softDeleted: { $exists: false } }
    ]
  };

  const pos = await PurchaseOrder.find(query).toArray();
  console.log(`Found ${pos.length} active purchase orders to migrate.`);

  // Group POs by companyHeader and financialYear calculated from poDate
  const groups = {};

  for (const po of pos) {
    const company = po.companyHeader;
    const poDate = po.poDate ? new Date(po.poDate) : new Date();
    const fyCode = getCurrentFinancialYear(poDate);
    const key = `${company}_FY${fyCode}`;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push({
      po,
      fyCode,
      company,
      poDate
    });
  }

  // Iterate over each group, sort chronologically, and update
  for (const [key, items] of Object.entries(groups)) {
    console.log(`\nProcessing group: ${key} (${items.length} items)`);

    // Sort by poDate ascending, then by createdAt ascending
    items.sort((a, b) => {
      const dateDiff = a.poDate.getTime() - b.poDate.getTime();
      if (dateDiff !== 0) return dateDiff;
      
      const createdA = a.po.createdAt ? new Date(a.po.createdAt).getTime() : 0;
      const createdB = b.po.createdAt ? new Date(b.po.createdAt).getTime() : 0;
      return createdA - createdB;
    });

    let seq = 1;
    for (const item of items) {
      const formattedPoNumber = `FY${item.fyCode}-${String(seq).padStart(3, '0')}`;
      
      console.log(`  Updating PO ID ${item.po._id}: "${item.po.poNumber}" (${item.po.poDate.toISOString().split('T')[0]}) -> "${formattedPoNumber}" (FY: ${item.fyCode})`);
      
      await PurchaseOrder.updateOne(
        { _id: item.po._id },
        {
          $set: {
            poNumber: formattedPoNumber,
            financialYear: item.fyCode
          }
        }
      );

      seq++;
    }

    const maxSequence = seq - 1;
    const counterId = key === 'Viral Fabrics_FY2627' ? 'po_viral_fabrics_FY2627' :
                      key === 'Viral Fabrics_FY2526' ? 'po_viral_fabrics_FY2526' :
                      key === 'Viral Enterprise_FY2627' ? 'po_viral_enterprise_FY2627' :
                      key === 'Viral Enterprise_FY2526' ? 'po_viral_enterprise_FY2526' :
                      key.toLowerCase().replace(/\s+/g, '_'); // fallback

    console.log(`  Updating counter "${counterId}" to sequence: ${maxSequence}`);

    await Counter.updateOne(
      { _id: counterId },
      {
        $set: {
          sequence: maxSequence,
          updatedAt: new Date()
        },
        $setOnInsert: {
          __v: 0,
          createdAt: new Date(),
          metadata: {
            isActive: true,
            category: 'order',
            description: `Auto-created counter for PO in FY 20${key.slice(-4, -2)}-${key.slice(-2)}`
          }
        }
      },
      { upsert: true }
    );
  }

  console.log('\nMigration completed successfully.');
  await mongoose.disconnect();
}

run().catch(console.error);
