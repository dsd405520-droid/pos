const fs = require('fs');
const path = require('path');
const { logError } = require('./logger'); // 📥 ນຳເຂົ້າ logger.js ທີ່ຢູ່ໃນໂຟນເດີດຽວກັນ

// ກຳນົດເສັ້ນທາງໂຟນເດີຫຼັກ ແລະ ໂຟນເດີສຳຮອງ
const DATA_DIR = path.join(__dirname, '..'); // ປັບຂຶ້ນມາໜຶ່ງລະດັບໃຫ້ຊີ້ໄປທີ່ backend/ ຫຼັກ (ບ່ອນເກັບໄຟລ໌ JSON ຕົວຈິງ)
const BACKUP_ROOT = path.join(__dirname, '../backups'); // ໂຟນເດີເກັບຊຸດສຳຮອງ

// ບອກລາຍຊື່ໄຟລ໌ JSON ທີ່ຈຳເປັນຕ້ອງກວດສອບ
const requiredFiles = [
    'products.json',
    'categories.json',
    'orders.json',
    'employees.json',
    'shifts.json',
    'stocklogs.json',
    'settings.json',
    'units.json'
];

/**
 * ຟັງຊັນສຳລັບກູ້ຄືນຂໍ້ມູນຈາກຊຸດສຳຮອງທີ່ກຳນົດ
 * @param {string} backupFolderName - ຊື່ໂຟນເດີສຳຮອງ (ຕົວຢ່າງ: '20260924_040621')
 */
function restoreBackup(backupFolderName) {
    const backupFolderPath = path.join(BACKUP_ROOT, backupFolderName);
    const tempSafetyDir = path.join(__dirname, 'temp_safety_backup');

    try {
        console.log(`[1/5] ກວດສອບຄວາມພ້ອມຂອງຊຸດສຳຮອງ: ${backupFolderName}...`);
        if (!fs.existsSync(backupFolderPath)) {
            throw new Error(`ບໍ່ພົບໂຟນເດີສຳຮອງທີ່ລະບຸ: ${backupFolderName}`);
        }

        // 1. ກວດສອບການມີຢູ່ຂອງໄຟລ໌ທັງໝົດໃນຊຸດສຳຮອງ
        for (const file of requiredFiles) {
            const filePath = path.join(backupFolderPath, file);
            if (!fs.existsSync(filePath)) {
                throw new Error(`ບໍ່ພົບໄຟລ໌ທີ່ຈຳເປັນໃນຊຸດສຳຮອງ: ${file}`);
            }
        }

        console.log('[2/5] ກວດສອບຄວາມຖືກຕ້ອງຂອງ Syntax JSON ແລະ ໂຄງສ້າງຂໍ້ມູນ...');
        // 2. ກວດສອບ Syntax ຂອງ JSON ແລະ ໂຄງສ້າງຂໍ້ມູນ (Data Integrity Check)
        for (const file of requiredFiles) {
            const filePath = path.join(backupFolderPath, file);
            const fileContent = fs.readFileSync(filePath, 'utf8');

            // ກວດສອບວ່າໄຟລ໌ຫວ່າງເປົ່າ ຫຼື ບໍ່
            if (!fileContent.trim()) {
                throw new Error(`ໄຟລ໌ ${file} ມີຄ່າຫວ່າງເປົ່າ (Empty)`);
            }

            try {
                const parsedData = JSON.parse(fileContent);
                
                // ກວດສອບເບື້ອງຕົ້ນວ່າໄຟລ໌ລາຍການຕ່າງໆ ຄວນເປັນຮູບແບບ Array
                const arrayFiles = ['products.json', 'orders.json', 'categories.json', 'employees.json', 'shifts.json', 'stocklogs.json', 'units.json'];
                if (arrayFiles.includes(file) && !Array.isArray(parsedData)) {
                    throw new Error(`ໂຄງສ້າງຂໍ້ມູນໃນ ${file} ບໍ່ຖືກຕ້ອງ (ຕ້ອງເປັນ Array)`);
                }
            } catch (jsonError) {
                throw new Error(`ໄຟລ໌ ${file} ເສຍຫາຍ ຫຼື Syntax ຜິດພາດ: ${jsonError.message}`);
            }
        }

        console.log('[3/5] ສ້າງໄຟລ໌ສຳຮອງຄວາມປອດໄພຊົ່ວຄາວ (Pre-restore Safety Backup)...');
        // 3. ສຳຮອງຂໍ້ມູນປະຈຸບັນກ່ອນ Restore ເພື່ອປ້ອງກັນເຫດສຸກເສີນ
        if (!fs.existsSync(tempSafetyDir)) {
            fs.mkdirSync(tempSafetyDir, { recursive: true });
        }
        for (const file of requiredFiles) {
            const targetPath = path.join(DATA_DIR, file);
            if (fs.existsSync(targetPath)) {
                fs.copyFileSync(targetPath, path.join(tempSafetyDir, file));
            }
        }

        console.log('[4/5] ກຳລັງດຳເນີນການກູ້ຄືນຂໍ້ມູນ (Restoring files)...');
        // 4. ທຳການກັອບປີ້ໄຟລ໌ຈາກຊຸດສຳຮອງມາທັບໄຟລ໌ປະຈຸບັນ
        for (const file of requiredFiles) {
            const srcPath = path.join(backupFolderPath, file);
            const destPath = path.join(DATA_DIR, file);
            fs.copyFileSync(srcPath, destPath);
        }

        console.log('[5/5] ລຶບໄຟລ໌ສຳຮອງຄວາມປອດໄພຊົ່ວຄາວ...');
        // 5. ລຶບໂຟນເດີຊົ່ວຄາວເມື່ອ Restore ສຳເລັດ
        if (fs.existsSync(tempSafetyDir)) {
            fs.rmSync(tempSafetyDir, { recursive: true, force: true });
        }

        console.log('✅ ກູ້ຄືນຂໍ້ມູນ (Restore) ສຳເລັດສົມບູນແລ້ວ!');

    } catch (error) {
        console.error(`❌ ເກີດຂໍ້ຜິດພາດ, ຍົກເລີກການ Restore: ${error.message}`);

        // 📝 ບັນທຶກ Error ລົງໄຟລ໌ Log ອັດຕະໂນມັດຜ່ານ logger.js
        logError(error, 'RESTORE_PROCESS');

        // ກົນໄກກູ້ຄືນອັດຕະໂນມັດ (Rollback) ຖ້າເກີດຄວາມຜິດພາດຂຶ້ນລະຫວ່າງທາງ
        if (fs.existsSync(tempSafetyDir)) {
            console.log('🔄 ກຳລັງກູ້ຄືນສະຖານະເກົ່າ (Rollback)...');
            try {
                for (const file of requiredFiles) {
                    const safetyFile = path.join(tempSafetyDir, file);
                    if (fs.existsSync(safetyFile)) {
                        fs.copyFileSync(safetyFile, path.join(DATA_DIR, file));
                    }
                }
                console.log('🔄 Rollback ສຳເລັດ, ຂໍ້ມູນເກົ່າປອດໄພ.');
            } catch (rollbackError) {
                console.error(`❌ Rollback ບໍ່ສຳເລັດ: ${rollbackError.message}`);
                // ບັນທຶກ Log กรณี Rollback ຜິດພາດຕື່ມອີກຊັ້ນ
                logError(rollbackError, 'RESTORE_ROLLBACK_FAILED');
            }
            // ລຶບໂຟນເດີຊົ່ວຄາວ
            fs.rmSync(tempSafetyDir, { recursive: true, force: true });
        }
    }
}

// ຕົວຢ່າງການເອີ້ນໃຊ້ງານ (ສາມາດຮັບຄ່າ Argument ຈາກ Command Line ได้)
const targetBackupName = process.argv[2]; // ຕົວຢ່າງ: node restore.js 20260924_040621
if (!targetBackupName) {
    console.log('ກະລຸນາລະບຸຊື່ໂຟນເດີສຳຮອງທີ່ຕ້ອງການ Restore ຕົວຢ່າງ: node restore.js <Backup_Folder_Name>');
} else {
    restoreBackup(targetBackupName);
}