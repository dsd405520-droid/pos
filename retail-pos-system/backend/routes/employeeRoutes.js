const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee');
const { verifyToken, requireRole } = require('../middleware/auth');

// 🔒 ສະເພາະ Admin ເທົ່ານັ້ນທີ່ຈັດການພະນັກງານໄດ້
router.use(verifyToken, requireRole('admin'));

// ✅ ກວດ PIN ຕ້ອງເປັນຕົວເລກ 4-6 ຫຼັກ ເທົ່ານັ້ນ
function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin);
}

// 🆔 ສ້າງລະຫັດພະນັກງານອັດຕະໂນມັດ ຕໍ່ຈາກເລກສູງສຸດທີ່ມີຢູ່ໃນ DB ແລ້ວ (ຮູບແບບ EMP0001, EMP0002, ...)
async function generateEmployeeCode() {
  const existing = await Employee.find({ employeeCode: { $regex: /^EMP\d+$/ } }).select('employeeCode');
  let maxNum = 0;
  for (const emp of existing) {
    const match = emp.employeeCode.match(/(\d+)$/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }
  return 'EMP' + String(maxNum + 1).padStart(4, '0');
}

// ດຶງລາຍຊື່ພະນັກງານທັງໝົດ (ບໍ່ສົ່ງ pin ທີ່ hash ແລ້ວອອກໄປ)
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find().select('-pin');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ເພີ່ມພະນັກງານໃໝ່ (ໃຊ້ .save() ເພື່ອໃຫ້ pre-save hook hash pin ໃຫ້ອັດຕະໂນມັດ)
router.post('/', async (req, res) => {
  try {
    if (!isValidPin(req.body.pin)) {
      return res.status(400).json({ error: 'PIN ຕ້ອງເປັນຕົວເລກ 4-6 ຫຼັກ ເທົ່ານັ້ນ' });
    }
    const employeeCode = await generateEmployeeCode(); // 🆔 ສ້າງລະຫັດອັດຕະໂນມັດ, ບໍ່ໃຫ້ client ກຳນົດເອງ
    const newEmployee = new Employee({ ...req.body, employeeCode });
    const saved = await newEmployee.save();
    const { pin, ...safe } = saved.toObject();
    res.status(201).json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ແກ້ໄຂຂໍ້ມູນພະນັກງານ (ຖ້າມີການປ່ຽນ pin ຈະຖືກ hash ໃໝ່ໃຫ້ອັດຕະໂນມັດ)
router.put('/:id', async (req, res) => {
  try {
    if (req.body.pin !== undefined && !isValidPin(req.body.pin)) {
      return res.status(400).json({ error: 'PIN ຕ້ອງເປັນຕົວເລກ 4-6 ຫຼັກ ເທົ່ານັ້ນ' });
    }
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ error: 'ບໍ່ພົບພະນັກງານ' });

    const { employeeCode, ...updateFields } = req.body; // 🆔 ບໍ່ໃຫ້ແກ້ໄຂ employeeCode ຜ່ານ update
    Object.assign(employee, updateFields);
    const updated = await employee.save(); // ຜ່ານ .save() ເພື່ອໃຫ້ hook hash pin ເຮັດວຽກ
    const { pin, ...safe } = updated.toObject();
    res.json(safe);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ລຶບ (ຫຼື ປ່ຽນສະຖານະ) ພະນັກງານ
router.delete('/:id', async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'ລຶບພະນັກງານສຳເລັດແລ້ວ' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
