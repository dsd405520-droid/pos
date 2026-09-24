// 🕒 ຕິດຕັ້ງ Windows Scheduled Task ສຳລັບສຳຮອງຂໍ້ມູນອັດຕະໂນມັດທຸກຄືນ
//
// ວິທີໃຊ້ (Command Prompt ແບບ Run as Administrator ຫຼື ບັນຊີທີ່ເຂົ້າໃຊ້ຄອມຢູ່):
//   node backup/install-backup-task.js
//
// ພາລາມິເຕີ (ບໍ່ບັງຄັບ):
//   node backup/install-backup-task.js 03:00     ກຳນົດເວລາຮັນກັບ HH:MM 24 ຊົ່ວໂມງ (ຄ່າເລີ່ມຕົ້ນ 02:30)
//   node backup/install-backup-task.js 02:30 /RU SYSTEM   ຮັນໃນຊື່ SYSTEM ແມ້ບໍ່ໄດ້ login (ຕ້ອງ Admin)
//
// ຕັ້ງແຕ່ຍ້າຍມາ Docker: ຄຳສັ່ງຈະຮັນ backup.js ພາຍໃນ container pos_backend
// (docker exec) ເພື່ອໃຫ້ສຳຮອງ DB ຂອງ container ໂດຍກົງ — ຜົນອອກທີ່ ./backend/backups ເທິງ host
// ຖ້າຊື່ container ປ່ຽນ ໃຫ້ຕັ້ງ env BACKEND_CONTAINER
const { execFileSync } = require('child_process');
const path = require('path');

const TASK_NAME = 'RetailPOSBackup';
const timeArg = (process.argv[2] || '02:30');
const extra = process.argv.slice(3).join(' ');

const container = process.env.BACKEND_CONTAINER || 'pos_backend';

// Docker CLI ອາດບໍ່ຢູ່ໃນ PATH ຂອງ Scheduled Task ເລີຍຕ້ອງໃຊ້ full path
function findDocker() {
  if (process.env.DOCKER_CLI) return process.env.DOCKER_CLI;
  try {
    const out = execFileSync('where', ['docker'], { encoding: 'utf8' });
    const hit = out.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
    if (hit) return hit;
  } catch {}
  const def = 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe';
  return require('fs').existsSync(def) ? def : 'docker';
}
const dockerPath = findDocker();
// ຫໍ່ດ້ວຍ cmd /c ເພື່ອໃຫ້ schtasks ຮັນ path ທີ່ມີຊ່ອງວ່າງ ແລະ args ໄດ້ຖືກຕ້ອງ (ERROR_BAD_EXE_FORMAT ເກີດຖ້າໃຫ້ aircraft ໂດຍກົງ)
const command = `cmd.exe /c ""${dockerPath}" exec ${container} node backup/backup.js"`;

//  Format HH:MM ທີ່ຖືກຕ້ອງ
if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(timeArg)) {
  console.error('❌ ເວລາບໍ່ຖືກຕ້ອງ ຄວນເປັນ HH:MM (ເຊັ່ນ 02:30)');
  process.exit(1);
}

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
console.log(`   ຄຳສັ່ງ: ${command}`);
try {
  const out = execFileSync('schtasks', args, { encoding: 'utf8' });
  console.log(out.trim());
  console.log(`✅ ຕິດຕັ້ງສຳເລັດ! ຈະສຳຮອງຂໍ້ມູນອັດຕະໂນມັດເວລາ ${timeArg} ທຸກໆຄືນ`);
  console.log('   - ກວດສອບ: schtasks /Query /TN "RetailPOSBackup"');
  console.log('   - ຮັນທົດສອບທັນທີ: schtasks /Run /TN "RetailPOSBackup"');
  console.log('   - ລຶບ:  node backup/uninstall-backup-task.js');
} catch (err) {
  console.error('❌ ຕິດຕັ້ງບໍ່ສຳເລັດ:', (err.stderr || err.message).toString().trim());
  console.error('   (ອາດຕ້ອງຮັນໃນ Command Prompt ທີ່ Run as Administrator)');
  process.exit(1);
}