const mongoose = require('mongoose');

// 🛒 Schema & Model ສຳລັບການຂາຍ (Order) - ຮອງຮັບຫຼາຍວິທີຊຳລະເງິນ
const orderSchema = new mongoose.Schema({
  items: Array,
  totalAmount: Number,
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
  shiftId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shift' },
  paymentMethod: { type: String, default: 'Cash' }, // 💵 ປະເພດຊຳລະເງິນ
  cashReceived: { type: Number, default: 0 },       // ເງິນສົດທີ່ຮັບມາ
  changeAmount: { type: Number, default: 0 },       // ເງິນທອນ
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);