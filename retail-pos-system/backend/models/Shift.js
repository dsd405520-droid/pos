const mongoose = require('mongoose');

const shiftSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
  startingCash: { type: Number, required: true }, // ເງິນທອນຕັ້ງຕົ້ນໃນລິ້ນຊັກ
  expectedCash: { type: Number, default: 0 },   // ເງິນສົດທີ່ຄວນຈະມີ (ຄຳນວນຈາກລະບົບ)
  actualCash: { type: Number, default: 0 },     // ເງິນສົດຕົວຈິງທີ່ພະນັກງານນັບໄດ້ຕອນປິດກະ
  totalSales: { type: Number, default: 0 },     // ยອດຂາຍລວມໃນກະນີ້
  status: { type: String, enum: ['open', 'closed'], default: 'open' }
});

module.exports = mongoose.model('Shift', shiftSchema);