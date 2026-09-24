// ແບ່ງ dump ຂໍ້ມູນກ່ອນຍ້າຍໄປ Docker (host-side, ອ່ານຈາກ DB ປັດຈຸບັນ)
// ໃຊ້: OUT_DIR=... node migrate-dump.js   (SRC_URI ຄ່າເລີ່ມ: mongodb://localhost:27017/retail_pos)
require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { EJSON } = require('bson');

const SRC_URI = process.env.SRC_URI || 'mongodb://localhost:27017/retail_pos';
const OUT_DIR = process.env.OUT_DIR;

(async () => {
  if (!OUT_DIR) throw new Error('OUT_DIR ບໍ່ໄດ້ຕັ້ງ');
  await mongoose.connect(SRC_URI);
  console.log('Connected to', SRC_URI);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const db = mongoose.connection.db;
  const cols = await db.listCollections({}, { nameOnly: true }).toArray();
  const info = { source: SRC_URI, createdAt: new Date().toISOString(), collections: [] };
  let total = 0;
  for (const { name } of cols) {
    if (name.startsWith('system.')) continue;
    const docs = await db.collection(name).find({}).toArray();
    await fs.promises.writeFile(path.join(OUT_DIR, name + '.json'), EJSON.stringify(docs, null, 2), 'utf8');
    info.collections.push({ name, count: docs.length });
    total += docs.length;
    console.log('  dumped', name, docs.length);
  }
  await fs.promises.writeFile(path.join(OUT_DIR, 'dump-info.json'), JSON.stringify(info, null, 2), 'utf8');
  console.log('DONE total', total);
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });