const fs = require('fs');
const path = require('path');

// กำນົດໂຟນເດີ logs ให้อยູ່ໃນໂຟນເດີ backend/logs (ສາມາດປັບປຸງໄດ້ຕາມຕ້ອງການ)
const LOG_DIR = path.join(__dirname, '../logs');

// ตรวจສອບ ແລະ ສ້າງໂຟນເດີ logs ຖ້າຫາກຍັງບໍ່ມີ
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * ຟັງຊັນສຳລັບບັນທຶກ Error Log ລົງໄຟລ໌
 * @param {Error} error - Object ຂອງ Error
 * @param {string} context - ບໍລິບົດ ຫຼື ຈຸດທີ່ເກີດ Error (ຕົວຢ່າງ: 'RESTORE_PROCESS', 'CREATE_ORDER')
 */
function logError(error, context = 'GENERAL') {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0]; // ວັນທີຮູບແບບ YYYY-MM-DD
    const timeStr = now.toTimeString().split(' ')[0];  // ເວລາຮູບແບບ HH:MM:SS
    const logFilePath = path.join(LOG_DIR, `error-${dateStr}.log`);

    const logEntry = `[${timeStr}] [CONTEXT: ${context}] ERROR: ${error.message}\nSTACK: ${error.stack || 'No stack trace'}\n----------------------------------------\n`;

    // ບັນທຶກລົງໄຟລ໌ແບບ Append (ເພີ່ມຕໍ່ທ້າຍເລື້ອຍໆ)
    fs.appendFile(logFilePath, logEntry, (err) => {
        if (err) {
            console.error('❌ ບໍ່ສາມາດບັນທຶກ Error Log ລົງໄຟລ໌ໄດ້:', err);
        }
    });
}

module.exports = { logError };