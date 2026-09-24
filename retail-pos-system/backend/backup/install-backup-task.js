// 🕒 ຕິດຕັ້ງ Windows Scheduled Task ສຳລັບສຳຮອງຂໍ້ມູນອັດຕະໂນມັດທຸກຄືນ
//
// ວິທີໃຊ້ (Command Prompt ແບບ Run as Administrator ຫຼື ບັນຊີທີ່ເຂົ້າໃຊ້ຄອມຢູ່):
//   node backup/install-backup-task.js
//
// ພາລາມິເຕີ (ບໍ່ບັງຄັບ):
//   node backup/install-backup-task.js 03:00     ກຳນົດເວລາຮັນກັບ HH:MM 24 ຊົ່ວໂມງ (ຄ່າເລີ່ມຕົ້ນ 02:30)
//   node backup/install-backup-task.js 02:30 /RU SYSTEM   ຮັນໃນຊື່ SYSTEM ແມ້ບໍ່ໄດ້ login (ຕ້ອງ Admin)

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const TASK_NAME = 'RetailPOSBackup';
const timeArg = (process.argv[2] || '02:30');
const extra = process.argv.slice(3).join(' ');

const nodeExe = process.execPath;
const backupScript = path.join(__dirname, 'backup.js');

if (!fs.existsSync(backupScript)) {
  console.error('❌ ບໍ່ພົບໄຟລ໌ backup.js');
  process.exit(1);
}

//  Format HH:MM ທີ່ຖືກຕ້ອງ
if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeArg)) {
  console.error('❌ ເວລາບໍ່ຖືກຕ້ອງ ຄວນເປັນ HH:MM (ເຊັ່ນ 02:30)');
  process.exit(1);
}

const command = `"${nodeExe}" "${backupScript}"`;
const args = [
  '/Create',
  '/F',
  '/TN',
  TASK_NAME,
  '/TR',
  command,
  '/SC',
  'DAILY',
  '/ST',
  timeArg,
].concat(extra.length ? extra.split(' ') : []);

console.log('⏳ ກຳລັງສ້າງ Task "RetailPOSBackup"...');
try {
  const out = execFileSync('schtasks', args, { encoding: 'utf8' });
  console.log(out.trim());
  console.log(`✅ ຕິດຕັ້ງສຳເລັດ! ຈະສຳຮອງຂໍ້ມູນອັດຕະໂນມັດເວລາ ${timeArg} ທຸກໆຄືນ`);
  console.log('   - ກວດສອບ: schtasks /Query /TN "RetailPOSBackup"');
  console.log('   - ຮັນທົດສອບທັນທີ: schtasks /Run /TN "RetailPOSBackup"');
  console.log('   - ລຶບ:  node backup/uninstall-backup-task.js');
} catch (err) {
  console.error('❌ ຕິດຕັ້ງບໍ່ສຳເລັດ:', (err.stderr || err.message).toString().trim());
  process.exit(1);
}