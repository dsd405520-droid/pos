// 💾 ສຳຮອງຂໍ້ມູນ MongoDB ອັດຕະໂນມັດ
//
// ແມ່ນແລ້ວ: ຂໍ້ມູນຢູ່ໃນ MongoDB ເຄື່ອງດຽວ ຖ້າຮາດດິດເສຍ / ຄອມຂັດຂ້ອງ / ຕິດ virus ຈະສູນເສຍໄປໝົດ.
// ສະຄຣິບນີ້ຈະ:
//   1. ດຶງຂໍ້ມູນທຸກ collection ມາບັນທຶກເປັນໄຟລ໌ JSON (Extended JSON ຮັກສາຊະນິດ ObjectId/Date ໄດ້ຄົບ)
//   2. ຄັດລອກໂຟນເດີ uploads (ຮູບສິນຄ້າ) ໄປນຳ
//   3. ຄັດລອກໄປບ່ອນສຳຮອງພາຍນອກ (ແຟລັຊໄດຣຟ໌ / Google Drive folder) ຕາມ BACKUP_DEST_DIRS
//   4. ລຶບຂໍ້ມູນສຳຮອງເກົ່າທີ່ເກີນ BACKUP_KEEP ອັດຕະໂນມັດ
//   5. ບັນທຶກຜົນໄວ້ທີ່ backup.log
//
// ວິທີໃຊ້:
//   node backup/backup.js
//   (ຫຼື npm run backup)
//
// ຕັ້ງຄ່າໃນ .env:
//   BACKUP_DIR        = ບ່ອນເກັບສຳຮອງຫຼັກ (ຄ່າເລີ່ມຕົ້ນ ./backups)
//   BACKUP_DEST_DIRS  = ບ່ອນຄັດລອກພາຍນອກ ມີຫຼາຍບ່ອນໃຫ້ຄັນດ້ວຍ , (ເຊັ່ນ E:\, D:\MyDrive\POSBackup)
//   BACKUP_KEEP       = ຈຳນວນຊຸດສຳຮອງທີ່ຈະເກັບໄວ້ (ຄ່າເລີ່ມຕົ້ນ 14)

require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { EJSON } = require('bson');

const LOG_FILE = path.join(__dirname, 'backup.log');

function log(msg) {
  const line = `[${new Date().toLocaleString('th-TH')}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// 🧹 ລຶບຊຸດສຳຮອງເກົ່າໃນໂຟນເດີທີ່ກຳນົດ ເຫຼືອໄວ້ແຕ່ keep ຊຸດຫຼ້າສຸດ
function prune(dir, keep) {
  if (!fs.existsSync(dir)) return;
  const entries = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory() && /^\d{8}_\d{6}$/.test(e.name))
    .map((e) => e.name)
    .sort();
  const excess = entries.length - keep;
  for (let i = 0; i < excess; i++) {
    const target = path.join(dir, entries[i]);
    fs.rmSync(target, { recursive: true, force: true });
    log(`🧹 ລຶບຂໍ້ມູນສຳຮອງເກົ່າ: ${target}`);
  }
}

async function main() {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/retail_pos';
  const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(__dirname, '..', 'backups'));
  const DEST_DIRS = (process.env.BACKUP_DEST_DIRS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const KEEP = parseInt(process.env.BACKUP_KEEP || '14', 10) || 14;

  const ts = stamp();
  const backupDir = path.join(BACKUP_DIR, ts);

  log('⏳ ເລີ່ມສຳຮອງຂໍ້ມູນ...');
  log(`   URI: ${MONGO_URI}`);

  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  const db = mongoose.connection.db;
  fs.mkdirSync(backupDir, { recursive: true });

  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  const info = { dbName: db.databaseName, createdAt: new Date().toISOString(), collections: [] };
  let totalDocs = 0;

  for (const { name } of cols) {
    if (name.startsWith('system.')) continue;
    const docs = await db.collection(name).find({}).toArray();
    const file = path.join(backupDir, `${name}.json`);
    await fs.promises.writeFile(file, EJSON.stringify(docs, null, 2), 'utf8');
    totalDocs += docs.length;
    info.collections.push({ name, count: docs.length });
    log(`   ✔ ${name}: ${docs.length} ລາຍການ`);
  }

  // 📷 ສຳຮອງຮູບສິນຄ້າ (uploads) ນຳ
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  info.hasUploads = false;
  if (fs.existsSync(uploadsDir)) {
    await fs.promises.cp(uploadsDir, path.join(backupDir, 'uploads'), { recursive: true });
    info.hasUploads = true;
    log('   ✔ uploads (ຮູບສິນຄ້າ) ສຳຮອງສຳເລັດ');
  }

  await fs.promises.writeFile(path.join(backupDir, 'backup-info.json'), JSON.stringify(info, null, 2), 'utf8');
  log(`✅ ສຳຮອງສຳເລັດ: ${backupDir} (ທັງໝົດ ${totalDocs} ລາຍການ)`);

  // 💾 ຄັດລອກໄປບ່ອນສຳຮອງພາຍນອກ
  for (const dest of DEST_DIRS) {
    const destBase = path.resolve(dest);
    try {
      if (!fs.existsSync(destBase)) {
        log(`⚠️ ບ່ອນສຳຮອງພາຍນອກບໍ່ພົບ (ຂ້າມ): ${destBase}`);
        continue;
      }
      await fs.promises.cp(backupDir, path.join(destBase, ts), { recursive: true });
      log(`✅ ຄັດລອກໄປບ່ອນພາຍນອກ: ${destBase}`);
      prune(destBase, KEEP);
    } catch (err) {
      log(`⚠️ ຄັດລອກໄປ ${destBase} ບໍ່ສຳເລັດ: ${err.message}`);
    }
  }

  prune(BACKUP_DIR, KEEP);
  await mongoose.disconnect();
  log('🎉 ສຳເລັດທຸກຂັ້ນຕອນ!');
}

main().catch((err) => {
  log(`❌ ສຳຮອງຂໍ້ມູນເຫຼືອ/ຜິດພາດ: ${err.message}`);
  process.exit(1);
});