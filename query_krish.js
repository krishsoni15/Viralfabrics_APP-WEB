const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const user = await mongoose.connection.collection('users').findOne({ username: 'krish' });
  console.log('krish profile photo:', user?.profilePhoto);
  process.exit(0);
});
