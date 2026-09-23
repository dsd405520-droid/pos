const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const Employee = require('../models/Employee');
const { JWT_SECRET } = require('../middleware/auth');

// 🛡️ ຈຳກັດການພະຍາຍາມ login: ສູງສຸດ 8 ຄັ້ງ ຕໍ່ IP ພາຍໃນ 15 ນາທີ — ກັນການ brute-force PIN (4-6 ຫຼັກ)
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 ນາທີ
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'ພະຍາຍາມ login ຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າສັກຄູ່ແລ້ວລອງໃໝ່' },
});

router.post('/login', loginLimiter, async (req, res) => {
    const { username, pin } = req.body;

    if (!username || !pin) {
        return res.status(400).json({ error: 'ກະລຸນາປ້ອນ Username ແລະ PIN' });
    }

    try {
        // 🔎 ຫາ Employee ດ້ວຍ username ຢ່າງດຽວກ່ອນ (ຫ້າມຄົ້ນຫາດ້ວຍ pin ໂດຍກົງ ເພາະ pin ຖືກ hash ໄວ້)
        const employee = await Employee.findOne({ username });
        if (!employee) {
            return res.status(401).json({ error: 'Username ຫຼື PIN ບໍ່ຖືກຕ້ອງ' });
        }

        if (employee.status !== 'active') {
            return res.status(403).json({ error: 'ບັນຊີນີ້ຖືກປິດການໃຊ້ງານແລ້ວ' });
        }

        // 🔒 ປຽບທຽບ PIN ດ້ວຍ bcrypt (ບໍ່ແມ່ນ plain text ອີກຕໍ່ໄປ)
        const isMatch = await employee.comparePin(pin);
        if (!isMatch) {
            return res.status(401).json({ error: 'Username ຫຼື PIN ບໍ່ຖືກຕ້ອງ' });
        }

        // 🎫 ສ້າງ Token ທີ່ມີອາຍຸ 12 ຊົ່ວໂມງ
        const token = jwt.sign(
            { id: employee._id, username: employee.username, role: employee.role },
            JWT_SECRET,
            { expiresIn: '12h' }
        );

        const safeEmployee = {
            _id: employee._id,
            name: employee.name,
            username: employee.username,
            role: employee.role,
            phone: employee.phone,
            status: employee.status
        };

        res.json({
            message: 'Login ສຳເລັດ',
            token,
            employee: safeEmployee
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;