const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const employeeSchema = new mongoose.Schema({
  employeeCode: { type: String, unique: true, sparse: true }, // ລະຫັດພະນັກງານ ເຊັ່ນ EMP0001 — ສ້າງອັດຕະໂນມັດ
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true },
  pin: { type: String, required: true }, // PIN 4-6 ຕົວເລກສຳລັບ Login ໄວ (ຈະຖືກ hash ອັດຕະໂນມັດ)
  role: { type: String, enum: ['admin', 'cashier'], default: 'cashier' },
  phone: { type: String },
  status: { type: String, enum: ['active', 'inactive'], default: 'active' }
}, { timestamps: true });

// 🔒 Hash PIN ອັດຕະໂນມັດທຸກຄັ້ງທີ່ສ້າງໃໝ່ ຫຼື ແກ້ໄຂ pin
employeeSchema.pre('save', async function (next) {
  if (!this.isModified('pin')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ ໃຊ້ປຽບທຽບ PIN ຕອນ Login
employeeSchema.methods.comparePin = function (candidatePin) {
  return bcrypt.compare(candidatePin, this.pin);
};

module.exports = mongoose.model('Employee', employeeSchema);
