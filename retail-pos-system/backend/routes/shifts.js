const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const Shift = require('../models/Shift');
const Order = require('../models/Order');
const Employee = require('../models/Employee');
const { verifyToken, requireRole } = require('../middleware/auth');

// 🔒 ຕ້ອງ Login ກ່ອນຈຶ່ງເປີດ/ປິດກະໄດ້
router.use(verifyToken);

// 💳 ວິທີຊຳລະທີ່ບໍ່ເຂົ້າລິ້ນຊັກ (QR / ໂອນ) — ໃຊ້ກົດດຽວກັນທັງຕອນປິດກະ ແລະ ໜ້າປະຫວັດກະ
function isNonCash(paymentMethod) {
  const method = String(paymentMethod || 'Cash').toLowerCase();
  return method.includes('qr') || method.includes('transfer') || method.includes('scan');
}

// 📊 ຄຳນວນຍອດຂາຍຂອງຫຼາຍກະໃນຄັ້ງດຽວ → Map(shiftId -> { totalSales, cashSales, nonCashSales, orderCount })
async function totalsByShift(shiftIds) {
  const map = new Map();
  if (shiftIds.length === 0) return map;
  const orders = await Order.find({ shiftId: { $in: shiftIds } }).select('shiftId totalAmount paymentMethod');
  for (const order of orders) {
    const key = String(order.shiftId);
    if (!map.has(key)) map.set(key, { totalSales: 0, cashSales: 0, nonCashSales: 0, orderCount: 0 });
    const t = map.get(key);
    const amount = Number(order.totalAmount || 0);
    t.totalSales += amount;
    t.orderCount += 1;
    if (isNonCash(order.paymentMethod)) t.nonCashSales += amount;
    else t.cashSales += amount;
  }
  return map;
}

// 💰 ຄິດໄລ່ຍອດຂາຍ + ເງິນສົດທີ່ຄວນຈະມີ ຈາກບິນທັງໝົດຂອງກະ
//   - totalSales = ຍອດຂາຍລວມທຸກວິທີຊຳລະ
//   - expectedCash = startingCash + ຍອດຂາຍທີ່ເປັນເງິນສົດ (QR/ໂອນ ບໍ່ນັບໃສ່ລິ້ນຊັກ)
async function computeTotals(shift) {
  const orders = await Order.find({ shiftId: shift._id }).select('totalAmount paymentMethod createdAt');
  let totalSales = 0;
  let cashSales = 0;
  let lastOrderAt = null;
  for (const order of orders) {
    const amount = Number(order.totalAmount || 0);
    totalSales += amount;
    if (!isNonCash(order.paymentMethod)) cashSales += amount;
    if (order.createdAt && (!lastOrderAt || order.createdAt > lastOrderAt)) lastOrderAt = order.createdAt;
  }
  return {
    totalSales,
    expectedCash: Number(shift.startingCash || 0) + cashSales,
    lastOrderAt,
  };
}

// 📜 ປະຫວັດກະທັງໝົດ (ສະເພາະ admin) — ກັ່ນຕອງຕາມວັນທີ / ພະນັກງານ / ສະຖານະ
//   ຍອດຂາຍ ແລະ ເງິນທີ່ຄວນມີ ຄຳນວນສົດຈາກບິນ (ບໍ່ເຊື່ອຄ່າທີ່ເກັບໄວ້ໃນກະ ເພາະກະເກົ່າກ່ອນແກ້ບັກເປັນ 0)
//   ສ່ວນຕ່າງ (difference) = ເງິນນັບໄດ້ - ເງິນຄວນມີ ; ຄິດສະເພາະກະທີ່ພະນັກງານປິດເອງ
//   (ກະທີ່ລະບົບປິດໃຫ້ ບໍ່ມີເງິນນັບໄດ້ຈິງ → difference = null)
const MAX_SHIFT_ROWS = 300;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { from, to, status, employee } = req.query;
    const filter = {};

    // ວັນທີຖືວ່າເປັນເວລາທ້ອງຖິ່ນ (ລາວ UTC+7)
    if (from !== undefined && from !== '') {
      if (!DATE_RE.test(from)) return res.status(400).json({ error: 'ຮູບແບບວັນທີ (from) ບໍ່ຖືກຕ້ອງ' });
      filter.startTime = { ...(filter.startTime || {}), $gte: new Date(`${from}T00:00:00+07:00`) };
    }
    if (to !== undefined && to !== '') {
      if (!DATE_RE.test(to)) return res.status(400).json({ error: 'ຮູບແບບວັນທີ (to) ບໍ່ຖືກຕ້ອງ' });
      filter.startTime = { ...(filter.startTime || {}), $lte: new Date(`${to}T23:59:59.999+07:00`) };
    }
    if (status !== undefined && status !== '') {
      if (!['open', 'closed'].includes(status)) return res.status(400).json({ error: 'status ຕ້ອງເປັນ open ຫຼື closed' });
      filter.status = status;
    }
    if (employee !== undefined && employee !== '') {
      if (!mongoose.isValidObjectId(employee)) return res.status(400).json({ error: 'employee ບໍ່ຖືກຕ້ອງ' });
      filter.employee = employee;
    }

    const [total, shifts] = await Promise.all([
      Shift.countDocuments(filter),
      Shift.find(filter).sort({ startTime: -1 }).limit(MAX_SHIFT_ROWS),
    ]);

    const totals = await totalsByShift(shifts.map((s) => s._id));

    const rows = shifts.map((s) => {
      const t = totals.get(String(s._id)) || { totalSales: 0, cashSales: 0, nonCashSales: 0, orderCount: 0 };
      const startingCash = Number(s.startingCash || 0);
      const expectedCash = startingCash + t.cashSales;
      const countable = s.status === 'closed' && !s.autoClosed;
      return {
        _id: s._id,
        employee: s.employee,
        employeeName: s.employeeName,
        startTime: s.startTime,
        endTime: s.endTime || null,
        status: s.status,
        autoClosed: !!s.autoClosed,
        startingCash,
        totalSales: t.totalSales,
        cashSales: t.cashSales,
        nonCashSales: t.nonCashSales,
        orderCount: t.orderCount,
        expectedCash,
        actualCash: countable ? Number(s.actualCash || 0) : null,
        difference: countable ? Number(s.actualCash || 0) - expectedCash : null,
      };
    });

    const summary = {
      shiftCount: rows.length,
      openCount: rows.filter((r) => r.status === 'open').length,
      autoClosedCount: rows.filter((r) => r.autoClosed).length,
      totalSales: rows.reduce((sum, r) => sum + r.totalSales, 0),
      totalShort: rows.reduce((sum, r) => sum + (r.difference !== null && r.difference < 0 ? r.difference : 0), 0),
      totalOver: rows.reduce((sum, r) => sum + (r.difference !== null && r.difference > 0 ? r.difference : 0), 0),
    };

    res.json({ shifts: rows, summary, total, truncated: total > rows.length });
  } catch (err) {
    console.error('List shifts error:', err);
    res.status(500).json({ error: 'ບໍ່ສາມາດດຶງປະຫວັດກະໄດ້' });
  }
});

// 📥 ດຶງກະທີ່ກຳລັງເປີດຢູ່ຂອງຜູ້ໃຊ້ປັດຈຸບັນ (ໃຊ້ກູ້ຄືນ session ເມື່ອ refresh ແລະ ກວດວ່າ token ຍັງໃຊ້ໄດ້)
router.get('/my', async (req, res) => {
  try {
    const shift = await Shift.findActiveFor(req.user.id);
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

    // ອະນຸຍາດ startingCash = 0 (ເປົ່າລິ້ນຊັກ) ໄດ້
    if (startingCash === undefined || startingCash === null || startingCash === '' || !Number.isFinite(cash) || cash < 0) {
      return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄົບຖ້ວນ: ກະລຸນາປ້ອນເງິນຕັ້ງຕົ້ນ (0 ກໍ່ປ້ອນໄດ້)' });
    }

    // 🔒 ໃຊ້ພະນັກງານຈາກ Token ເທົ່ານັ້ນ — ບໍ່ເຊື່ອ employeeId ຈາກ body
    const employee = await Employee.findById(req.user.id);
    if (!employee || employee.status !== 'active') {
      return res.status(403).json({ error: 'ບັນຊີພະນັກງານບໍ່ຖືກຕ້ອງ ຫຼື ຖືກປິດການໃຊ້ງານ' });
    }

    const openShifts = await Shift.find({ employee: employee._id, status: 'open' });
    const staleBefore = Date.now() - Shift.STALE_MS;

    // 🛡️ ຍັງມີກະທີ່ກຳລັງໃຊ້ງານຢູ່ (ບໍ່ຄ້າງ) → ບໍ່ໃຫ້ເປີດຊ້ຳ
    const active = openShifts.find((s) => new Date(s.startTime).getTime() >= staleBefore);
    if (active) {
      const startLabel = new Date(active.startTime).toLocaleString('th-TH');
      return res.status(400).json({
        code: 'SHIFT_ALREADY_OPEN',
        error: `ທ່ານມີກະເປີດຢູ່ແລ້ວ (ເລີ່ມ ${startLabel}) — ກະລຸນາປິດກະກ່ອນ ຈຶ່ງເປີດໃໝ່ໄດ້`,
      });
    }

    // 🧹 ກະເກົ່າທີ່ຄ້າງ (ລືມປິດ / ຂໍ້ມູນເກົ່າກ່ອນແກ້ບັກ) → ປິດໃຫ້ອັດຕະໂນມັດ ແລ້ວຈຶ່ງເປີດກະໃໝ່ໄດ້
    for (const stale of openShifts) {
      const totals = await computeTotals(stale);
      stale.totalSales = totals.totalSales;
      stale.expectedCash = totals.expectedCash;
      stale.endTime = totals.lastOrderAt || stale.startTime;
      stale.status = 'closed';
      stale.autoClosed = true;
      await stale.save();
    }

    const newShift = new Shift({
      employee: employee._id,
      employeeName: employee.name,
      startingCash: cash,
      status: 'open',
      startTime: new Date(),
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
    const actual = Number(actualCash);
    if (actualCash === undefined || actualCash === null || actualCash === '' || !Number.isFinite(actual) || actual < 0) {
      return res.status(400).json({ error: 'ກະລຸນາປ້ອນຈຳນວນເງິນສົດຕົວຈິງເປັນຕົວເລກ (0 ຫຼື ຫຼາຍກວ່າ)' });
    }

    const shift = await Shift.findById(req.params.id);
    if (!shift) return res.status(404).json({ error: 'ບໍ່ພົບຂໍ້ມູນກະ' });

    // 🔒 ອະນຸຍາດສະເພາະເຈົ້າຂອງກະ ຫຼື admin ເທົ່ານັ້ນ ໃຫ້ປິດກະນີ້ໄດ້
    if (req.user.role !== 'admin' && shift.employee?.toString() !== req.user.id) {
      return res.status(403).json({ error: 'ທ່ານບໍ່ມີສິດປິດກະຂອງຄົນອື່ນ' });
    }

    // 🛡️ ກະທີ່ປິດແລ້ວ ຫ້າມປິດຊ້ຳ (ບໍ່ໃຫ້ຂຽນທັບ actualCash / endTime)
    if (shift.status === 'closed') {
      return res.status(400).json({ error: 'ກະນີ້ຖືກປິດໄປແລ້ວ' });
    }

    const totals = await computeTotals(shift);
    shift.totalSales = totals.totalSales;
    shift.expectedCash = totals.expectedCash;
    shift.actualCash = actual;
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