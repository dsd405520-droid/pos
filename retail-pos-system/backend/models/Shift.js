const mongoose = require('mongoose');

// ⏱️ ກະທີ່ເປີດຄ້າງເກີນເວລານີ້ ຖືວ່າ "ລືມປິດກະ" (ບໍ່ນັບເປັນກະທີ່ກຳລັງໃຊ້ງານອີກຕໍ່ໄປ)
const STALE_HOURS = 16;
const STALE_MS = STALE_HOURS * 60 * 60 * 1000;

const shiftSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  startingCash: { type: Number, required: true }, // ເງິນທອນຕັ້ງຕົ້ນໃນລິ້ນຊັກ
  expectedCash: { type: Number, default: 0 },     // ເງິນສົດທີ່ຄວນຈະມີ (ຄຳນວນຈາກລະບົບ)
  actualCash: { type: Number, default: 0 },       // ເງິນສົດຕົວຈິງທີ່ພະນັກງານນັບໄດ້ຕອນປິດກະ
  totalSales: { type: Number, default: 0 },       // ຍອດຂາຍລວມໃນກະນີ້
  status: { type: String, enum: ['open', 'closed'], default: 'open' },
  autoClosed: { type: Boolean, default: false }   // ລະບົບປິດໃຫ້ເອງ (ພະນັກງານລືມປິດກະ) — actualCash ບໍ່ໜ້າເຊື່ອຖື
});

// 🔎 ກະທີ່ກຳລັງໃຊ້ງານຂອງພະນັກງານ: ຕ້ອງ open ແລະ ບໍ່ຄ້າງເກີນ STALE_HOURS
shiftSchema.statics.findActiveFor = function (employeeId) {
  return this.findOne({
    employee: employeeId,
    status: 'open',
    startTime: { $gte: new Date(Date.now() - STALE_MS) },
  }).sort({ startTime: -1 });
};

shiftSchema.statics.STALE_MS = STALE_MS;

module.exports = mongoose.model('Shift', shiftSchema);