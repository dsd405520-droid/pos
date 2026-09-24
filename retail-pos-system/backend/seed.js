// ສະຄຣິບສ້າງບັນຊີ Admin ຄົນທຳອິດ
// ວິທີໃຊ້:  node seed.js
//
// 🔒 ກົດຄວາມປອດໄພ:
//   - ສ້າງ admin ສະເພາະເມື່ອຍັງບໍ່ມີພະນັກງານໃນລະບົບເລີຍ (ຖ້າມີແລ້ວ ຂ້າມ — ຈຶ່ງບໍ່ສ້າງ admin ກັບຄືນມາເອງຫຼັງລຶບ/ປ່ຽນຊື່)
//   - ບໍ່ມີ PIN ຕາຍຕົວ: ຖ້າຕັ້ງ ADMIN_INITIAL_PIN (ຕົວເລກ 4-6 ຫຼັກ) ຈະໃຊ້ຄ່ານັ້ນ, ຖ້າບໍ່ຕັ້ງ ຈະສຸ່ມ PIN 6 ຫຼັກ ແລ້ວສະແດງຄັ້ງດຽວ
require('dotenv').config();
const crypto = require('crypto');
const mongoose = require('mongoose');
const Employee = require('./models/Employee');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/retail_pos';

async function seed() {
  await mongoose.connect(MONGO_URI);
  console.log('Connected to', MONGO_URI);

  const count = await Employee.countDocuments();
  if (count > 0) {
    console.log(`⚠️  ມີພະນັກງານໃນລະບົບແລ້ວ ${count} ຄົນ, ຂ້າມການສ້າງ admin`);
    await mongoose.disconnect();
    return;
  }

  let pin = (process.env.ADMIN_INITIAL_PIN || '').trim();
  let generated = false;
  if (pin) {
    if (!/^\d{4,6}$/.test(pin)) {
      throw new Error('ADMIN_INITIAL_PIN ຕ້ອງເປັນຕົວເລກ 4-6 ຫຼັກ');
    }
  } else {
    pin = String(crypto.randomInt(100000, 1000000));
    generated = true;
  }

  const admin = new Employee({
    name: 'Administrator',
    username: 'admin',
    pin, // ຖືກ hash ອັດຕະໂນມັດຕອນບັນທຶກ
    role: 'admin',
    status: 'active',
  });
  await admin.save();

  console.log('✅ ສ້າງບັນຊີ Admin ສຳເລັດ -> username: admin');
  if (generated) {
    console.log(`🔑 PIN ຊົ່ວຄາວ (ສະແດງຄັ້ງດຽວ ໃຫ້ຈົດໄວ້ ແລ້ວປ່ຽນທັນທີຫຼັງ Login): ${pin}`);
  } else {
    console.log('🔑 ໃຊ້ PIN ຈາກ ADMIN_INITIAL_PIN — ແນະນຳໃຫ້ປ່ຽນຫຼັງ Login ຄັ້ງທຳອິດ');
  }

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('Seed error:', err.message);
  process.exit(1);
});