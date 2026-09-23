// ສະຄຣິບສ້າງບັນຊີ Admin ຄົນທຳອິດ (ຮັນຄັ້ງດຽວ)
// ວິທີໃຊ້:  node seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/retail_pos';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to', MONGO_URI);

  const exists = await Employee.findOne({ username: 'admin' });
  if (exists) {
    console.log('⚠️  ບັນຊີ "admin" ມີຢູ່ແລ້ວ, ຂ້າມການສ້າງ');
  } else {
    const admin = new Employee({
      name: 'Administrator',
      username: 'admin',
      pin: '123456',          // ⚠️ ປ່ຽນທັນທີຫຼັງ Login ຄັ້ງທຳອິດ! ຈະຖືກ hash ອັດຕະໂນມັດຕອນບັນທຶກ
      role: 'admin',
      status: 'active'
    });
    await admin.save();
    console.log('✅ ສ້າງບັນຊີ Admin ສຳເລັດ -> username: admin | pin: 123456');
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err);
  process.exit(1);
});
