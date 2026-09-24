const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const Order = require('../models/Order');
const Employee = require('../models/Employee');
const { verifyToken } = require('../middleware/auth');

// 🔒 ຕ້ອງ Login ກ່ອນຈຶ່ງເປີດ/ປິດກະໄດ້
router.use(verifyToken);

// 📥 ດຶງກະທີ່ກຳລັງເປີດຢູ່ຂອງຜູ້ໃຊ້ປັດຈຸບັນ (ໃຊ້ກູ້ຄືນ session ເມື່ອ refresh ໜ້າເວັບ)
router.get('/my', async (req, res) => {
  try {
    const shift = await Shift.findOne({ employee: req.user.id, status: 'open' }).sort({ startTime: -1 });
    res.json({ shift: shift || null });
  } catch (err) {
    console.error('Get my shift error:', err);
    res.status(500).json({ error: 'ບໍ່ສາມາດດຶງຂໍ້ມູນກະໄດ້' });
  }
});

// 📥 ເປີດກະ
router.post('/open', async (req, res) => {
  try {
    const { startingCash } = req.body;
    const cash = Number(startingCash);

    // ກວດສອບຂໍ້ມູນ — ອະນຸຍາດ startingCash = 0 (ເປົ່າລິ້ນຊັກ) ໄດ້
    if (startingCash === undefined || startingCash === null || startingCash === '' || isNaN(cash) || cash < 0) {
      return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄົບຖ້ວນ: ກະລຸນາປ້ອນເງິນຕັ້ງຕົ້ນ (0 ກໍ່ປ້ອນໄດ້)' });
    }

    // 🔒 ໃຊ້ພະນັກງານຈາກ Token (req.user.id) ເທົ່ານັ້ນ — ບໍ່ເຊື່ອ employeeId ຈາກ body
    const employee = await Employee.findById(req.user.id);
    if (!employee || employee.status !== 'active') {
      return res.status(403).json({ error: 'ບັນຊີພະນັກງານບໍ່ຖືກຕ້ອງ ຫຼື ຖືກປິດການໃຊ້ງານ' });
    }

    // 🛡️ ປ້ອງກັນການເປີດກະຊ້ຳ ໃນຂະນະທີ່ຍັງມີກະເປີດຢູ່ (ເຄີຍເປັນສາເຫດມີກະຄ້າງເປັນສິບກະ/ຄົນ)
    const existingOpen = await Shift.findOne({ employee: employee._id, status: 'open' });
    if (existingOpen) {
      const startLabel = new Date(existingOpen.startTime).toLocaleString('th-TH');
      return res.status(400).json({ error: `ທ່ານມີກະເປີດຢູ່ແລ້ວ (ເລີ່ມ ${startLabel}) — ກະລຸນາປິດກະກ່ອນ ຈຶ່ງເປີດໃໝ່ໄດ້` });
    }

    const newShift = new Shift({
      employee: employee._id,
      employeeName: employee.name,
      startingCash: cash,
      status: 'open',
      startTime: new Date()
    });

    await newShift.save();
    res.status(201).json({ shift: newShift });
  } catch (err) {
    console.error('Open Shift Error:', err);
    res.status(500).json({ error: 'ບໍ່ສາມາດເປີດກະໄດ້, ກະລຸນາກວດສອບ Database' });
  }
});

// 🛑 ປິດກະ
router.put('/close/:id', async (req, res) => {
  try {
    const { actualCash } = req.body;
    const shift = await Shift.findById(req.params.id);

    if (!shift) return res.status(404).json({ error: 'ບໍ່ພົບຂໍ້ມູນກະ' });

    // 🔒 ອະນຸຍາດສະເພາະເຈົ້າຂອງກະ ຫຼື admin ເທົ່ານັ້ນ ໃຫ້ປິດກະນີ້ໄດ້
    if (req.user.role !== 'admin' && shift.employee?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'ທ່ານບໍ່ມີສິດປິດກະຂອງຄົນອື່ນ' });
    }

    // 💰 ຄິດໄລ່ຍອດຂາຍ + ເງິນສົດທີ່ຄວນຈະມີ ຈາກບິນ (Order) ທັງໝົດຂອງກະນີ້
    //   - totalSales = ຍອດຂາຍລວມທຸກວິທີຊຳລະ
    //   - expectedCash = startingCash + ຍອດຂາຍທີ່ເປັນເງິນສົດ (QR/ໂອນ ບໍ່ນັບໃສ່ລິ້ນຊັກ)
    const orders = await Order.find({ shiftId: shift._id });
    let totalSales = 0;
    let cashSales = 0;
    for (const order of orders) {
      const amount = Number(order.totalAmount || 0);
      totalSales += amount;
      const method = String(order.paymentMethod || 'Cash').toLowerCase();
      const isQR = method.includes('qr') || method.includes('transfer') || method.includes('scan');
      if (!isQR) cashSales += amount;
    }

    shift.totalSales = totalSales;
    shift.expectedCash = Number(shift.startingCash || 0) + cashSales;
    shift.actualCash = Number(actualCash) || 0;
    shift.status = 'closed';
    shift.endTime = new Date();

    await shift.save();
    res.json({ shift });
  } catch (err) {
    console.error('Close Shift Error:', err);
    res.status(500).json({ error: 'ບໍ່ສາມາດປິດກະໄດ້' });
  }
});

module.exports = router;