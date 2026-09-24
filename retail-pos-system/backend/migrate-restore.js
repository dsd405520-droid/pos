// Restore dump ເຂົ້າ container mongo (RUN INSIDE pos_backend container)
// ອ່ານ /tmp/migration-restore/*.json (EJSON) ແລ້ວ drop+insert ໃສ່ mongodb:27017/retail_pos
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const { EJSON } = require('bson');

const DEST_URI = process.env.DEST_URI || 'mongodb://mongodb:27017/retail_pos';
const SRC_DIR = '/tmp/migration-restore';

(async () => {
  await mongoose.connect(DEST_URI);
  console.log('Connected to', DEST_URI);
  const db = mongoose.connection.db;
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.json') && f !== 'dump-info.json');
  for (const f of files) {
    const name = f.slice(0, -5);
    const docs = EJSON.parse(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'));
    await db.collection(name).deleteMany({});
    if (docs.length) await db.collection(name).insertMany(docs, { ordered: false });
    console.log('  restored', name, docs.length);
  }
  console.log('RESTORE DONE');
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });