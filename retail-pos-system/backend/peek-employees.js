require('dotenv').config();
const mongoose = require('mongoose');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/retail_pos', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  const admins = await mongoose.connection.db.collection('employees')
    .find({})
    .project({ username: 1, role: 1, status: 1, name: 1 })
    .toArray();
  console.log(JSON.stringify(admins, null, 2));
  process.exit(0);
})();