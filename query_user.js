const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const users = await mongoose.connection.collection('users').find({ profilePhoto: { $ne: null, $ne: '' } }).toArray();
  console.log(users.map(u => u.profilePhoto));
  process.exit(0);
});
