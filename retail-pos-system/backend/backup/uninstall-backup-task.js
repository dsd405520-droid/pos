// 🗑️ ຖອນການຕິດຕັ້ງ Windows Scheduled Task "RetailPOSBackup"
//
// ວິທີໃຊ້:
//   node backup/uninstall-backup-task.js

const { execFileSync } = require('child_process');

const TASK_NAME = 'RetailPOSBackup';

console.log(`⏳ ກຳລັງລຶບ Task "${TASK_NAME}"...`);
try {
  const out = execFileSync('schtasks', ['/Delete', '/TN', TASK_NAME, '/F'], { encoding: 'utf8' });
  console.log(out.trim());
  console.log('✅ ລຶບ Task ສຳເລັດແລ້ວ');
} catch (err) {
  const msg = (err.stderr || err.message).toString().trim();
  if (msg.includes('does not exist') || msg.includes('ບໍ່ພົບ') || msg.includes('not found')) {
    console.log('ℹ️ ບໍ່ພົບ Task ນີ້ (ອາດລຶບໄປແລ້ວ)');
  } else {
    console.error('❌ ລຶບບໍ່ສຳເລັດ:', msg);
    process.exit(1);
  }
}