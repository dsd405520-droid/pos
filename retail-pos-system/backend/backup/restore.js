// ♻️ ກູ້ຄືນຂໍ້ມູນຈາກຊຸດສຳຮອງ
//
// ວິທີໃຊ້:
//   node backup/restore.js               ກູ້ຄືນຊຸດຫຼ້າສຸດ
//   node backup/restore.js <ໂຟນເດີ>    ກູ້ຄືນຊຸດທີ່ລະບຸ (ເຊັ່ນ backend/backups/20260301_023000)
//
// ⚠️ ເຕືອນ: ການກູ້ຄືນຈະລຶບຂໍ້ມູນປັດຈຸບັນຂອງ collection ນັ້ນ ແລ້ວບັນທຶກຄືນຈາກຊຸດສຳຮອງ.
// ແນະນຳໃຫ້ຢຸດ server ກ່ອນກູ້ຄືນ ເພື່ອຫຼີກລ່ຽງຂໍ້ມູນອັບເດດພ້ອມກັນ.

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { EJSON } = require('bson');

const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));

function pickFolder(arg) {
  if (arg) return path.resolve(arg);
  const dirs = fs
    .readdirSync(BACKUP_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{8}_\d{6}$/.test(e.name))
    .map((e) => e.name)
    .sort();
  if (dirs.length === 0) throw new Error('ບໍ່ພົບຊຸດສຳຮອງໃດໆໃນ ' + BACKUP_DIR);
  return path.join(BACKUP_DIR, dirs[dirs.length - 1]);
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/retail_pos';
  const folder = pickFolder(process.argv[2]);

  if (!fs.existsSync(folder)) {
    throw new Error('ບໍ່ພົບໂຟນເດີສຳຮອງ: ' + folder);
  }

  console.log(`♻️ ກູ້ຄືນຂໍ້ມູນຈາກ: ${folder}`);

  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;

  const files = fs.readdirSync(folder).filter((f) => f.endsWith('.json') && f !== 'backup-info.json');
  for (const file of files) {
    const colName = path.basename(file, '.json');
    const docs = EJSON.parse(fs.readFileSync(path.join(folder, file), 'utf8'));
    await db.collection(colName).deleteMany({});
    if (docs.length > 0) {
      await db.collection(colName).insertMany(docs);
    }
    console.log(`   ✔ ${colName}: ກູ້ຄືນ ${docs.length} ລາຍການ`);
  }

  // 📷 ກູ້ຄືນຮູບສິນຄ້ານຳ (ຖ້າມີ)
  const uploadsBackup = path.join(folder, 'uploads');
  if (fs.existsSync(uploadsBackup)) {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    fs.rmSync(uploadsDir, { recursive: true, force: true });
    fs.mkdirSync(uploadsDir, { recursive: true });
    await fs.promises.cp(uploadsBackup, uploadsDir, { recursive: true });
    console.log('   ✔ uploads ກູ້ຄືນສຳເລັດ');
  }

  await mongoose.disconnect();
  console.log('🎉 ກູ້ຄືນຂໍ້ມູນສຳເລັດ!');
}

main().catch((err) => {
  console.error('❌ ກູ້ຄືນຂໍ້ມູນຜິດພາດ:', err.message);
  process.exit(1);
});