const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://krish1509soni:mqYQZaMl2qjtNkWL@cluster0.hb5hrbq.mongodb.net/CRM_AdminPanel?retryWrites=true&w=majority&appName=Cluster0';

// Import the sort function from processUtils equivalent logic
const DEFAULT_PROCESS_PRIORITIES = {
  'FOB Send': 1,
  'In House': 2,
  'ready to dispatch': 3,
  'folding': 4,
  'Finish': 5,
  'washing': 6,
  'loop': 7,
  'in printing': 8,
  'jigar': 9,
  'In Dyeing': 10,
  'setting': 11,
  'long jet': 12,
  'Soflina WR': 13,
  'Drum': 14,
  'Charkha': 15,
  'Lot No Greigh': 16
};

function getProcessPriority(processName) {
  if (!processName) return 0;
  const nameLower = processName.trim().toLowerCase();
  const foundKey = Object.keys(DEFAULT_PROCESS_PRIORITIES).find(
    key => key.toLowerCase() === nameLower
  );
  if (foundKey) {
    return DEFAULT_PROCESS_PRIORITIES[foundKey];
  }
  return 0;
}

function sortProcessesByPriority(processes) {
  return processes.sort((a, b) => {
    const priorityA = getProcessPriority(a);
    const priorityB = getProcessPriority(b);
    if (priorityA > 0 && priorityB > 0) {
      return priorityA - priorityB;
    }
    if (priorityA > 0 && priorityB === 0) return -1;
    if (priorityA === 0 && priorityB > 0) return 1;
    return a.localeCompare(b);
  });
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    const db = mongoose.connection.db;
    const orderId = '6a2bfd79948ba677abd355a3'; // FY2627-002
    
    const order = await db.collection('orders').findOne({ _id: new mongoose.Types.ObjectId(orderId) });
    if (!order) {
      console.log('Order not found');
      process.exit(1);
    }

    console.log('Order ID:', order.orderId);
    
    // Find mill inputs for this order
    const millInputs = await db.collection('millinputs').find({ order: order._id }).toArray();
    console.log(`Found ${millInputs.length} mill inputs for order ObjectId.`);
    
    // Fallback search by orderId (string) just in case
    const millInputsStr = await db.collection('millinputs').find({ orderId: order.orderId }).toArray();
    console.log(`Found ${millInputsStr.length} mill inputs by orderId string.`);

    const activeMillInputs = millInputs.length > 0 ? millInputs : millInputsStr;

    // Get qualities
    const qualities = await db.collection('qualities').find().toArray();
    const qualityMap = new Map(qualities.map(q => [q._id.toString(), q]));

    // Attach quality objects to order items
    order.items = (order.items || []).map(item => ({
      ...item,
      quality: item.quality ? qualityMap.get(item.quality.toString()) || null : null
    }));

    // Process items like the route GET handler does:
    order.items.forEach((item) => {
      if (activeMillInputs.length > 0) {
        const itemQualityId = item.quality?._id?.toString() || item.quality?.toString();
        const itemQualityName = item.quality?.name || item.quality;
        
        console.log(`\nItem Quality ID: "${itemQualityId}" | Name: "${itemQualityName}"`);

        let qualityProcessData = null;
        const allProcesses = [];

        for (const millInputData of activeMillInputs) {
          // Check main quality
          const mainQualityId = millInputData.quality?.toString();
          // Find quality name from map
          const mainQualityObj = qualityMap.get(mainQualityId);
          const mainQualityName = mainQualityObj?.name;
          
          console.log(`  Checking Mill Input - Main quality ID: "${mainQualityId}" (Name: "${mainQualityName}") | Process: "${millInputData.processName}"`);

          if (mainQualityId === itemQualityId || mainQualityName === itemQualityName) {
            if (millInputData.processName && millInputData.processName.trim() !== '') {
              allProcesses.push(millInputData.processName.trim());
            }
          }

          // Check additional meters
          if (millInputData.additionalMeters) {
            millInputData.additionalMeters.forEach((additional) => {
              const addQualityId = additional.quality?.toString();
              const addQualityObj = qualityMap.get(addQualityId);
              const addQualityName = addQualityObj?.name;
              
              console.log(`    Checking Additional Meters - Quality ID: "${addQualityId}" (Name: "${addQualityName}") | Process: "${additional.processName}"`);

              if (addQualityId === itemQualityId || addQualityName === itemQualityName) {
                if (additional.processName && additional.processName.trim() !== '') {
                  allProcesses.push(additional.processName.trim());
                }
              }
            });
          }
        }

        console.log('  Collected processes:', allProcesses);
        const uniqueProcesses = [...new Set(allProcesses)];
        const sortedProcesses = sortProcessesByPriority(uniqueProcesses);
        console.log('  Sorted processes:', sortedProcesses);

        if (sortedProcesses.length > 0) {
          qualityProcessData = {
            mainProcess: sortedProcesses[0],
            additionalProcesses: sortedProcesses.slice(1)
          };
        }
        
        item.processData = qualityProcessData;
      } else {
        item.processData = { mainProcess: '', additionalProcesses: [] };
      }
      
      console.log('  FINAL item.processData:', item.processData);
    });

    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
