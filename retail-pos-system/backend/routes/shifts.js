const express = require('express');
const router = express.Router();
const Shift = require('../models/Shift');
const { verifyToken } = require('../middleware/auth');

// 🔒 ຕ້ອງ Login ກ່ອນຈຶ່ງເປີດ/ປິດກະໄດ້
router.use(verifyToken);

// 📥 ເປີດກະ
router.post('/open', async (req, res) => {
    try {
        const { employeeId, employeeName, startingCash } = req.body;

        // ກວດສອບຂໍ້ມູນເບື້ອງຕົ້ນ
        if (!employeeId || !startingCash) {
            return res.status(400).json({ error: 'ຂໍ້ມູນບໍ່ຄົບຖ້ວນ: ກະລຸນາປ້ອນເງິນຕັ້ງຕົ້ນ' });
        }

        const newShift = new Shift({
            employee: employeeId,       // 👈 ປ່ຽນຈາກ cashier ເປັນ employee ໃຫ້ກົງກັບ Model Shift.js
            employeeName: employeeName, 
            startingCash: startingCash,
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

        shift.actualCash = actualCash;
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