import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI as string).then(async () => {
  const users = await mongoose.connection.collection('users').find({}).toArray();
  console.log(users.map(u => ({ username: u.username, profilePhoto: u.profilePhoto })));
  process.exit(0);
});
