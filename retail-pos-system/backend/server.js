require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { verifyToken, requireRole } = require('./middleware/auth');
const printer = require('./printer'); // 🖨️ ບໍລິການພິມໃບບິນ (ESC/POS + Windows driver)

const app = express();

// 🛠️ 1. Middleware ຕ້ອງຢູ່ເທິງສຸດສະເໝີ!
// CORS: ຮັບຫຼາຍ origin ໄດ້ ຜ່ານ CORS_ORIGIN ໃນ .env ຄັນດ້ວຍ comma (ເຊັ່ນ: http://localhost:5173,http://192.168.1.50:5173)
const rawCors = (process.env.CORS_ORIGIN ?? '').trim();
const allowedOrigins = rawCors
  ? rawCors.split(',').map((s) => s.trim()).filter(Boolean)
  : ['*'];

app.use(cors({
  origin(origin, callback) {
    if (allowedOrigins.includes('*') || !origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, false);
  },
}));
app.use(express.json());

// 📦 Serve frontend build (production) ວາງກ່ອນ middleware auth — ຈະບໍ່ຖືກບັງຄັບ login
// ໃນ Docker ຈະຖືກຊີ້ໂດຍ FRONTEND_DIST (bind mount); ໃນ local ໃຊ້ ../frontend/dist ຕາມເດີມ
const frontendDist = process.env.FRONTEND_DIST || path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');
if (fs.existsSync(frontendDist) && fs.existsSync(frontendIndex)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) return next();
    res.sendFile(frontendIndex);
  });
}

// 📂 ຕັ້ງຄ່າ Folder ຈັດເກັບຮູບພາບ (ຖ້າຫາກຍັງບໍ່ມີໃຫ້ສ້າງອັດຕະໂນມັດ)
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 🧨 ກວດ magic bytes ຂອງໄຟລ໌ຮູບພາບຈິງ — mimetype ທີ່ client ສົ່ງມາເປັນປອມໄດ້ 100%
//    ຕ້ອງໃຊ້ລາຍເຊັນຂອງໄຟລ໌ (file signature) ເປັນຊັ້ນປ້ອງກັນສຸດທ້າຍ
const IMAGE_SIGNATURES = [
  { ext: '.jpg', mime: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: '.png',
    mime: 'image/png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a,
  },
  { ext: '.gif', mime: 'image/gif', test: (b) => b.slice(0, 6).toString('ascii') === 'GIF87a' || b.slice(0, 6).toString('ascii') === 'GIF89a' },
  {
    ext: '.webp',
    mime: 'image/webp',
    test: (b) => b.slice(0, 4).toString('ascii') === 'RIFF' && b.slice(8, 12).toString('ascii') === 'WEBP',
  },
];

// ຄືນ true ຖ້າໄຟລ໌ເປັນຮູບພາບຈິງ (jpg/png/gif/webp)
function isRealImageFile(filePath) {
  let fd;
  try {
    fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(12);
    const bytesRead = fs.readSync(fd, buf, 0, 12, 0);
    if (bytesRead < 4) return false;
    return IMAGE_SIGNATURES.some((sig) => sig.test(buf));
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* ignore */ }
    }
  }
}

// 🛡️ Middleware ຫຼັງ multer — ລຶບໄຟລ໌ທີ່ເປັນຮູບປອມ ແລະຢືນຢັນ magic bytes ຕົງກັບຮູບພາບຈິງ
// ★ ຕ້ອງໃສ່ຕໍ່ຈາກ upload.single(...) ໃນທຸກ route ທີ່ຮັບອັບໂຫຼດຮູບ ບໍ່ດັ່ງນັ້ນການກວດນີ້ຈະບໍ່ຖືກໃຊ້ວຽກຈິງ
function verifyUploadedImage(req, res, next) {
  if (!req.file) return next();
  if (!isRealImageFile(req.file.path)) {
    try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    return res.status(400).json({ error: 'ໄຟລ໌ນີ້ບໍ່ແມ່ນຮູບພາບ (jpg, png, gif, webp) ຈິງ' });
  }
  return next();
}

// 💰 ປັດເສດຕົວເລກເງິນໃຫ້ມີແຕ່ 2 ຕຳແໜ່ງ ປ້ອງກັນ floating point error (0.1 + 0.2 = 0.30000000000000004)
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// ⚙️ ແປງ error ຈາກ Mongoose/Mongo ໃຫ້ເປັນ { status, message } ທີ່ເໝາະສະແດງໃຫ້ user ເຫັນ
//    ໃຊ້ຮ່ວມກັນທັງໃນ catch ຂອງແຕ່ລະ route (ເພື່ອໃຫ້ໄດ້ status ທີ່ຖືກຕ້ອງ ບໍ່ແມ່ນ 500 ໝົດ)
//    ແລະໃນ global error handler ທ້າຍໄຟລ໌ (ສຳລັບ error ທີ່ຫຼຸດ try/catch ຂອງ route ມາ)
function classifyError(err) {
  if (err && err.name === 'CastError') {
    return { status: 400, message: 'ຮູບແບບລະຫັດ (ID) ບໍ່ຖືກຕ້ອງ' };
  }
  if (err && err.name === 'ValidationError') {
    return { status: 400, message: Object.values(err.errors).map((e) => e.message).join(', ') };
  }
  if (err && err.code === 11000) {
    return { status: 409, message: 'ຂໍ້ມູນນີ້ມີຢູ່ແລ້ວ (ຊື່/ລະຫັດຊ້ຳ)' };
  }
  return { status: 500, message: (err && err.message) || 'ເກີດຂໍ້ຜິດພາດຢູ່ເຊີເວີ' };
}

// 🧯 ໃຊ້ໃນ catch ຂອງ route: ตอบ response ດ້ວຍ status/message ທີ່ຈັດປະເພດແລ້ວ
function sendError(res, err, fallbackMessage) {
  const { status, message } = classifyError(err);
  console.error('Request error:', err);
  return res.status(status).json({ error: status === 500 && fallbackMessage ? fallbackMessage : message });
}

// ຕັ້ງຄ່າ Multer ສຳລັບອັບໂຫຼດໄຟລ໌ຮູບພາບ
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // ⚠️ ຕ້ອງໃຊ້ path ແບບ absolute — ຖ້າໃຊ້ 'uploads/' ຈະອີງກັບ working directory ຂອງ process
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // 🛡️ ບໍ່ໃຊ້ extension ຈາກ file.originalname ໂດຍກົງ — ໃຊ້ mapping ຈາກ mimetype ທີ່ກວດຜ່ານແລ້ວແທນ
    const extByMime = {
      'image/jpeg': '.jpg',
      'image/pjpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
    };
    const ext = extByMime[String(file.mimetype || '').toLowerCase()] || '.jpg';
    cb(null, uniqueSuffix + ext);
  }
});
// 🛡️ ອະນຸຍາດສະເພາະໄຟລ໌ຮູບພາບ (jpg, png, gif, webp) + ຈຳກັດຂະໜາດ 5MB
const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/pjpeg',
  'image/png',
  'image/gif',
  'image/webp',
]);
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const mime = String(file.mimetype || '').toLowerCase();
    const ext = path.extname(file.originalname || '').toLowerCase();
    const mimeOk = ALLOWED_IMAGE_MIME.has(mime);
    const extOk = allowedImageTypes.test(ext.replace(/^\./, '')) && ext.startsWith('.');
    if (mimeOk && extOk) {
      cb(null, true);
    } else {
      cb(new Error('ອະນຸຍາດສະເພາະໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, webp)'));
    }
  }
});

// ໃຫ້ Server ສາມາດເປີດເບິ່ງຮູບຜ່ານ URL ໄດ້ (path ແບບ relative, frontend ຈະຕໍ່ host ເອງ)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔗 ເຊື່ອມຕໍ່ MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/retail_pos';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB Connected Successfully! ->', MONGO_URI);
  backfillEmployeeCodes();
})
.catch((err) => console.log('MongoDB Connection Error:', err));

async function backfillEmployeeCodes() {
  try {
    const Employee = require('./models/Employee');

    const existing = await Employee.find({ employeeCode: { $regex: /^EMP\d+$/ } }).select('employeeCode');
    let maxNum = 0;
    for (const emp of existing) {
      const match = emp.employeeCode.match(/(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }

    const missing = await Employee.find({
      $or: [{ employeeCode: { $exists: false } }, { employeeCode: null }, { employeeCode: '' }]
    }).sort({ createdAt: 1 });

    if (missing.length === 0) return;

    for (const emp of missing) {
      maxNum += 1;
      emp.employeeCode = 'EMP' + String(maxNum).padStart(4, '0');
      await emp.save();
    }
    console.log(`🆔 ຕື່ມລະຫັດພະນັກງານໃຫ້ ${missing.length} ຄົນທີ່ຍັງບໍ່ມີແລ້ວ`);
  } catch (err) {
    console.error('⚠️ ຕື່ມລະຫັດພະນັກງານບໍ່ສຳເລັດ:', err.message);
  }
}

const authRoutes = require('./routes/auth');
const shiftRoutes = require('./routes/shifts');
const employeeRoutes = require('./routes/employeeRoutes');
const Order = require('./models/Order');//patched
const Shift = require('./models/Shift');

// --- Schemas & Models ---

const productSchema = new mongoose.Schema({
  sku: { type: String, unique: true, sparse: true },
  name: String,
  price: Number,
  costPrice: { type: Number, default: 0 },
  stock: Number,
  image: String,
  category: { type: String, default: 'ທົ່ວໄປ' },
  unit: { type: String, default: 'ອັນ' },
  purchaseUnit: { type: String, default: '' },
  conversionRate: { type: Number, default: 1 },
  productType: { type: String, enum: ['packaged', 'fresh'], default: 'packaged' },
  receivedDate: { type: Date, default: null },
  expiryDate: { type: Date, default: null }
});
async function generateUniqueSku() {
  for (let i = 0; i < 20; i++) {
    const candidate = String(Math.floor(100000 + Math.random() * 900000));
    const exists = await Product.exists({ sku: candidate });
    if (!exists) return candidate;
  }
  return String(Date.now());
}

const Product = mongoose.model('Product', productSchema);

const stockLogSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },
  purchaseQuantity: { type: Number, default: null },
  purchaseUnit: { type: String, default: '' },
  costPrice: { type: Number, default: 0 },
  note: { type: String, default: 'ຮັບສິນຄ້າເຂົ້າຮ້ານ' },
  createdAt: { type: Date, default: Date.now }
});
const StockLog = mongoose.model('StockLog', stockLogSchema);

const settingSchema = new mongoose.Schema({
  shopName: { type: String, default: '' },
  shopQRImage: { type: String, default: '' },
  shopAddress: { type: String, default: '' },
  shopPhone: { type: String, default: '' },
  receiptFooter: { type: String, default: '' },
  printerEnabled: { type: Boolean, default: false },
  printerMethod: { type: String, default: 'network-escpos' },
  printerIp: { type: String, default: '' },
  printerPort: { type: Number, default: 9100 },
  printerName: { type: String, default: '' },
  updatedAt: { type: Date, default: Date.now }
});
const Setting = mongoose.model('Setting', settingSchema);

const categorySchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true }
});
const Category = mongoose.model('Category', categorySchema);

const unitSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true }
});
const Unit = mongoose.model('Unit', unitSchema);

// --- API Endpoints & Routes Registration ---

app.use('/api/auth', authRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/employees', employeeRoutes);

app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1, time: new Date().toISOString() });
});

app.use(verifyToken);

// --- 📂 API ສຳລັບ Category (ໝວດໝູ່) ---
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/categories', requireRole('admin'), async (req, res) => {
  try {
    const newCat = new Category({ name: req.body.name });
    await newCat.save();
    res.status(201).json(newCat);
  } catch (err) {
    const { status, message } = classifyError(err);
    res.status(status === 500 ? 400 : status).json({ error: status === 500 ? 'Category already exists or invalid' : message });
  }
});

app.delete('/api/categories/:id', requireRole('admin'), async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    sendError(res, err);
  }
});

// --- 📏 API ສຳລັບ Unit (ໜ່ວຍນັບ) ---
app.get('/api/units', async (req, res) => {
  try {
    const units = await Unit.find();
    res.json(units);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/units', requireRole('admin'), async (req, res) => {
  try {
    const newUnit = new Unit({ name: req.body.name });
    await newUnit.save();
    res.status(201).json(newUnit);
  } catch (err) {
    const { status, message } = classifyError(err);
    res.status(status === 500 ? 400 : status).json({ error: status === 500 ? 'Unit already exists or invalid' : message });
  }
});

app.delete('/api/units/:id', requireRole('admin'), async (req, res) => {
  try {
    await Unit.findByIdAndDelete(req.params.id);
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    sendError(res, err);
  }
});

// --- ⚙️ API ສຳລັບຕັ້ງຄ່າຮ້ານ (Setting) ---
app.get('/api/settings', async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) setting = { shopName: '', shopQRImage: '' };
    res.json(setting);
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/settings', requireRole('admin'), upload.single('qrImage'), verifyUploadedImage, async (req, res) => {
  const isTrue = (v) => v === true || v === 'true' || v === 'on' || v === '1';
  try {
    let setting = await Setting.findOne();
    if (!setting) setting = new Setting();

    if (req.body.shopName !== undefined) setting.shopName = req.body.shopName;
    if (req.body.shopAddress !== undefined) setting.shopAddress = req.body.shopAddress;
    if (req.body.shopPhone !== undefined) setting.shopPhone = req.body.shopPhone;
    if (req.body.receiptFooter !== undefined) setting.receiptFooter = req.body.receiptFooter;
    if (req.body.printerEnabled !== undefined) setting.printerEnabled = isTrue(req.body.printerEnabled);
    if (req.body.printerMethod !== undefined) setting.printerMethod = req.body.printerMethod;
    if (req.body.printerIp !== undefined) setting.printerIp = String(req.body.printerIp).trim();
    if (req.body.printerPort !== undefined) setting.printerPort = Number(req.body.printerPort) || 9100;
    if (req.body.printerName !== undefined) setting.printerName = String(req.body.printerName).trim();

    if (isTrue(req.body.clearQR)) {
      setting.shopQRImage = '';
    } else if (req.file) {
      setting.shopQRImage = `/uploads/${req.file.filename}`;
    } else if (req.body.shopQRImage !== undefined && req.body.shopQRImage !== '') {
      setting.shopQRImage = req.body.shopQRImage;
    }

    setting.updatedAt = new Date();
    await setting.save();
    res.json({ message: 'ບັນທຶກຄ່າຮ້ານສຳເລັດ', setting });
  } catch (err) {
    sendError(res, err);
  }
});

// --- 🖨️ API ສຳລັບເຄື່ອງພິມໃບບິນ (Receipt Printer) ---
function buildPrinterConfig(setting) {
  const envBool = process.env.PRINTER_ENABLED === 'true';
  return {
    enabled: setting?.printerEnabled ?? envBool,
    method: setting?.printerMethod || process.env.PRINTER_METHOD || 'network-escpos',
    ip: setting?.printerIp || process.env.PRINTER_IP || '',
    port: setting?.printerPort || Number(process.env.PRINTER_PORT || 9100),
    name: setting?.printerName || process.env.PRINTER_NAME || '',
  };
}

app.post('/api/print/receipt', async (req, res) => {
  try {
    const receipt = req.body.receipt || req.body;
    if (!receipt || !Array.isArray(receipt.items)) {
      return res.status(400).json({ error: 'ຂໍ້ມູນໃບບິນບໍ່ຖືກຕ້ອງ (ຕ້ອງມີ items)' });
    }

    const setting = await Setting.findOne();
    const cfg = buildPrinterConfig(setting);
    const shop = {
      shopName: setting?.shopName || 'RETAIL POS STORE',
      shopAddress: setting?.shopAddress || '',
      shopPhone: setting?.shopPhone || '',
      footer: setting?.receiptFooter || '',
    };

    const result = await printer.printReceipt(cfg, receipt, shop);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/print/test', requireRole('admin'), async (req, res) => {
  try {
    const setting = await Setting.findOne();
    const cfg = buildPrinterConfig(setting);
    const shop = {
      shopName: setting?.shopName || 'RETAIL POS STORE',
    };
    const result = await printer.printTestPage(cfg, shop);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

// --- 📦 API ສຳລັບ Product ---

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/products', requireRole('admin'), upload.single('image'), verifyUploadedImage, async (req, res) => {
  try {
    const { sku, name, price, importQuantity, importPrice, category, unit, purchaseUnit, conversionRate, productType, expiryDate } = req.body;

    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`;
    } else if (req.body.image) {
      imagePath = req.body.image;
    }

    const isFresh = productType === 'fresh';
    const rate = isFresh ? 1 : (Number(conversionRate) || 1);
    const impQty = Number(importQuantity) || 0;
    const impPrice = Number(importPrice) || 0;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'ກະລຸນາໃສ່ຊື່ສິນຄ້າ' });
    }
    // 💰 ລາຄາຂາຍຕ້ອງ > 0 ບໍ່ແມ່ນແຄ່ >= 0 — ລາຄາ 0 = ສິນຄ້າຟຮາ, ລາຄາຕົດລົງ = POST /api/orders ສ້າງ order ລວມຕົດລົງ
    //    ແລ້ changeAmount ກາຍເປັນບວກ → ຮ້ານຕ້ອງຈ່າຍເງິນໃຫ້ລູກຄ້າ (see POST /api/orders)
    if (price === undefined || price === '' || !Number.isFinite(Number(price)) || Number(price) <= 0) {
      return res.status(400).json({ error: 'ລາຄາຂາຍຕ້ອງເປັນຕົວເລກທີ່ມາກວ່າ 0' });
    }
    if (impQty < 0 || impPrice < 0) {
      return res.status(400).json({ error: 'ຈຳນວນ ຫຼື ລາຄານຳເຂົ້າຕ້ອງບໍ່ຕິດລົບ' });
    }
    if (isFresh && !Number.isInteger(impQty)) {
      return res.status(400).json({ error: 'ຈຳນວນແພັກຂອງສິນຄ້າສົດຕ້ອງເປັນເລກເຕັມ' });
    }
    let parsedExpiry = null;
    if (isFresh && expiryDate) {
      parsedExpiry = new Date(expiryDate);
      if (Number.isNaN(parsedExpiry.getTime())) {
        return res.status(400).json({ error: 'ວັນໝົດອາຍຸບໍ່ຖືກຕ້ອງ' });
      }
    }

    const totalPieces = impQty * rate;
    const perPieceCost = rate > 0 ? Number((impPrice / rate).toFixed(2)) : 0;

    const newProduct = new Product({
      sku: (sku && sku.trim()) || await generateUniqueSku(),
      name,
      price: Number(price),
      costPrice: perPieceCost,
      stock: totalPieces,
      image: imagePath,
      category,
      unit,
      purchaseUnit: isFresh ? unit : (purchaseUnit || unit),
      conversionRate: rate,
      productType: isFresh ? 'fresh' : 'packaged',
      receivedDate: isFresh ? new Date() : null,
      expiryDate: parsedExpiry
    });

    await newProduct.save();

    if (impQty > 0) {
      const stockLog = new StockLog({
        productId: newProduct._id,
        quantity: totalPieces,
        purchaseQuantity: impQty,
        purchaseUnit: newProduct.purchaseUnit,
        costPrice: impPrice,
        note: 'ນຳເຂົ້າສິນຄ້າໃໝ່ (ຄັ້ງທຳອິດ)'
      });
      await stockLog.save();
    }

    res.status(201).json({ message: 'Product added successfully!', product: newProduct });
  } catch (err) {
    sendError(res, err);
  }
});

app.put('/api/products/:id', requireRole('admin'), upload.single('image'), verifyUploadedImage, async (req, res) => {
  try {
    const { sku, name, price, costPrice, stock, category, unit, purchaseUnit, conversionRate, expiryDate } = req.body;

    // 🛡️ ປ້ອງຄວາມຖືກຕ້ອງຂອງຕົວເລກ — ເດີມຊະໂນໃຊ້ input ຂອງ browser ຢ່າງດຽວ
    //    ຖ້າບໍ່ກວດ: price ຕົດລົງ/0 → order ລວມຕົດລົງ → ຈ່າຍເງິນໃຫ້ລູກຄ້າ
    //    ແລະ stock/conversionRate ຕົດລົງ → ການຮັບສິນຄ້າເຂົ້າຫຼີກສິນຄ້າໃນສາງ
    if (price !== undefined && price !== '') {
      if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
        return res.status(400).json({ error: 'ລາຄາຂາຍຕ້ອງເປັນຕົວເລກທີ່ມາກວ່າ 0' });
      }
    }
    if (stock !== undefined && stock !== '') {
      if (!Number.isFinite(Number(stock)) || Number(stock) < 0) {
        return res.status(400).json({ error: 'ຈຳນວນສິນຄ້າຕ້ອງເປັນຕົວເລກ 0 ຂຶ້ນໄປ' });
      }
    }
    if (conversionRate !== undefined && conversionRate !== '') {
      const rate = Number(conversionRate);
      if (!Number.isFinite(rate) || rate <= 0) {
        return res.status(400).json({ error: 'ອັດຕະໂນດັບຕ້ອງເປັນຕົວເລກທີ່ມາກວ່າ 0' });
      }
    }

    // ກຳມະກວານໃສ່ແຕ່ field ທີ່ client ສົ່ງມາຈິງ — ຖ້າ Number(undefined) ຖືກເຂົ້າ updateData
    // mongoose ຈະ throw CastError "Cast to Number failed for NaN" ແລ້ classifyError
    // ຕອກ "ຮູບແບບລະຫັດ (ID) ບໍ່ຖືກຕ້ອງ" — ຂໍ້ຄວາມຜິດພາດໃຫ້ admin
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (price !== undefined && price !== '') updateData.price = Number(price);
    if (stock !== undefined && stock !== '') updateData.stock = Number(stock);
    if (category !== undefined) updateData.category = category;
    if (unit !== undefined) {
      updateData.unit = unit;
      updateData.purchaseUnit = purchaseUnit || unit;
    } else if (purchaseUnit !== undefined) {
      updateData.purchaseUnit = purchaseUnit;
    }
    if (conversionRate !== undefined && conversionRate !== '') {
      updateData.conversionRate = Number(conversionRate);
    }

    if (sku && String(sku).trim() !== '') {
      updateData.sku = String(sku).trim();
    }

    if (costPrice !== undefined && costPrice !== '') {
      const rateForCost = Number(conversionRate) || 1;
      updateData.costPrice = Number((Number(costPrice) / rateForCost).toFixed(2)) || 0;
    }

    if (expiryDate !== undefined) {
      const newExpiry = expiryDate ? new Date(expiryDate) : null;
      if (newExpiry && Number.isNaN(newExpiry.getTime())) {
        return res.status(400).json({ error: 'ວັນໝົດອາຍຸບໍ່ຖືກຕ້ອງ' });
      }
      const existing = await Product.findById(req.params.id).select('expiryDate');
      const oldT = existing && existing.expiryDate ? new Date(existing.expiryDate).getTime() : null;
      const newT = newExpiry ? newExpiry.getTime() : null;
      if (oldT !== newT) {
        updateData.expiryDate = newExpiry;
        updateData.receivedDate = new Date();
      }
    }

    if (req.file) {
      updateData.image = `/uploads/${req.file.filename}`;
    } else if (req.body.image) {
      updateData.image = req.body.image;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    );
    if (!updatedProduct) return res.status(404).json({ error: 'ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ' });
    res.json({ message: 'Product updated successfully!', product: updatedProduct });
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/products/:id', requireRole('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully!' });
  } catch (err) {
    sendError(res, err);
  }
});

app.post('/api/stock/in', requireRole('admin'), async (req, res) => {
  try {
    const { productId, quantity, costPrice, note, expiryDate } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ' });
    }

    const purchaseQty = Number(quantity);
    const costNumber = Number(costPrice);

    if (!purchaseQty || purchaseQty <= 0) {
      return res.status(400).json({ message: 'ຈຳນວນສິນຄ້າຕ້ອງຫຼາຍກວ່າ 0' });
    }

    // 🛡️ ກວດ conversionRate > 0 ກ່ອນ: ຂໍ້ມູນເກົາທີ່ rate ຕົດລົງ (ເກົາ POST/PUT /api/products ກວດແລ້ວ)
    //    ເຮັດໃຫ້ `|| 1` ບໍ່ຊ່ວມ → ຄິດ totalPieces ເປັນຕົດລົງ ແລະ ຫຍອຍ stock
    const conversionRate = Number(product.conversionRate);
    if (!Number.isFinite(conversionRate) || conversionRate <= 0) {
      return res.status(400).json({
        message: `ອັດຕະໂນດັບຂອງ "${product.name}" ບໍ່ຖືກຕ້ອງ (ຕ້ອງເປັນຈຳນວນທີ່ໃຊົ່ນໄດ້) ກະລຸນາແກ້ໃຫ້ admin ຕັ້ງຄືນ`
      });
    }

    const totalPieces = round2(purchaseQty * conversionRate);

    // 🔒 ເພີ່ມ stock ດ້ວຍ $inc ໃນ query ໜຶ່ງດຽວ = atomic, ບໍ່ lost update
    //    ຖ້າຂຽງໃຊ້ read-modify-write (product.stock = ...; product.save())
    //    request ພ້ອມກັນ 2 ອັນຈະເຮັດໃຫ້ increment ຫາຍໜຶ່ງຫາຍ
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: productId, conversionRate: { $gt: 0 } },
      { $inc: { stock: totalPieces } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(400).json({ message: 'ສິນຄ້າມີການປ່ຽນແປງລະຫວ່ງຂອງອັດຕະໂນດັບ — ກະລຸນາລອງໃໝ່' });
    }

    if (costNumber > 0) {
      await Product.findByIdAndUpdate(productId, {
        $set: { costPrice: Number((costNumber / conversionRate).toFixed(2)) }
      });
    }
    if (product.productType === 'fresh') {
      const freshFields = { receivedDate: new Date() };
      if (expiryDate) {
        const parsedExpiry = new Date(expiryDate);
        if (!isNaN(parsedExpiry.getTime())) freshFields.expiryDate = parsedExpiry;
      }
      await Product.findByIdAndUpdate(productId, { $set: freshFields });
    }

    await new StockLog({
      productId,
      quantity: totalPieces,
      purchaseQuantity: purchaseQty,
      purchaseUnit: product.purchaseUnit || product.unit,
      costPrice: costNumber || 0,
      note: note || 'ຮັບສິນຄ້າເຂົ້າຮ້ານ',
      createdAt: new Date()
    }).save();

    res.status(200).json({
      success: true,
      message: `ເພີ່ມ Stock ສຳເລັດແລ້ວ (+${totalPieces} ${product.unit})`,
      updatedStock: updatedProduct.stock
    });

  } catch (err) {
    sendError(res, err, 'Internal Server Error');
  }
});

app.get('/api/stock/logs', requireRole('admin'), async (req, res) => {
  try {
    const logs = await StockLog.find()
      .populate('productId', 'name sku unit')
      .sort({ createdAt: -1 });
    res.status(200).json(logs);
  } catch (err) {
    sendError(res, err, 'Internal Server Error');
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { items, paymentMethod, cashReceived } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ບໍ່ມີສິນຄ້າໃນລາຍການ' });
    }

    const employeeId = req.user.id;

    const activeShift = await Shift.findActiveFor(req.user.id);
    if (!activeShift && req.user.role !== 'admin') {
      return res.status(400).json({ code: 'NO_OPEN_SHIFT', error: 'ຍັງບໍ່ໄດ້ເປີດກະ ຫຼື ກະຖືກປິດແລ້ວ — ກະລຸນາເປີດກະກ່ອນຂາຍ' });
    }
    const validShiftId = activeShift ? activeShift._id : null;

    const ALLOWED_METHODS = ['cash', 'qr code', 'transfer'];
    const rawMethod = String(paymentMethod || '').trim();
    const methodKey = rawMethod.toLowerCase();
    if (!ALLOWED_METHODS.includes(methodKey)) {
      return res.status(400).json({ error: 'ວິທີຊຳລະເງິນບໍ່ຖືກຕ້ອງ (ຮອງຮັບພຽງ Cash / QR Code / Transfer)' });
    }
    const canonicalMethod = methodKey === 'qr code' ? 'QR Code' : methodKey === 'transfer' ? 'Transfer' : 'Cash';

    const productsInOrder = await Product.find({ _id: { $in: items.map(i => i._id) } });
    const verifiedItems = [];
    let verifiedTotal = 0;

    for (const item of items) {
      const product = productsInOrder.find(p => p._id.toString() === item._id);
      if (!product) {
        return res.status(400).json({ error: `ບໍ່ພົບສິນຄ້າ: ${item.name || item._id}` });
      }
      const qty = Number(item.quantity) || 0;
      if (qty <= 0 || !Number.isFinite(qty)) {
        return res.status(400).json({ error: `ຈຳນວນສິນຄ້າ "${product.name}" ບໍ່ຖືກຕ້ອງ` });
      }
      // ປ້ອງຂໍ້ມູນເກົາ/ຂໍ້ມູນທີ່ເຄົາທີ່ມີລາຄາ <= 0: ຖ້າບໍ່ກວດ total ຈະເປັນຕົດລົງ
      // ແລະ changeAmount ຈະເປັນບວກ ທ້າຮ້ານຕ້ອງຈ່າຍເງິນໃຫ້ລູກຄ້າ
      const unitPrice = Number(product.price);
      if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({ error: `ລາຄາຂາຍຍ່ອຍຂອງ "${product.name}" ບໍ່ຖືກຕ້ອງ (ຕ້ອງເປັນຈຳນວນທີ່ໃຊົ່ນໄດ້) ກະລຸນາແກ້ໃຫ້ admin ຕັ້ງລາຄາໃໝ່` });
      }
      verifiedItems.push({
        _id: product._id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        costPrice: product.costPrice || 0,
        unit: product.unit,
        image: product.image,
        quantity: qty,
      });
      verifiedTotal += round2(Number(product.price) * qty);
    }
    verifiedTotal = round2(verifiedTotal);

    const received = round2(Number(cashReceived) || 0);
    if (received < verifiedTotal) {
      return res.status(400).json({ error: `ຈຳນວນເງິນທີ່ຮັບມາ (${received.toLocaleString()}) ນ້ອຍກວ່າຍອດລວມ (${verifiedTotal.toLocaleString()})` });
    }
    const changeAmount = round2(received - verifiedTotal);

    const decremented = [];
    for (const item of verifiedItems) {
      const updated = await Product.findOneAndUpdate(
        { _id: item._id, stock: { $gte: item.quantity } },
        { $inc: { stock: -item.quantity } },
        { new: true }
      );
      if (!updated) {
        for (const done of decremented) {
          await Product.findByIdAndUpdate(done._id, { $inc: { stock: done.quantity } });
        }
        return res.status(400).json({ error: `ສິນຄ້າ "${item.name}" ໃນສາງບໍ່ພຽງພໍ ຫຼື ຖືກຄົນອື່ນຊື້ໄປພ້ອມກັນ` });
      }
      decremented.push(item);
    }

    try {
      const newOrder = new Order({
        items: verifiedItems,
        totalAmount: verifiedTotal,
        employeeId,
        shiftId: validShiftId,
        paymentMethod: canonicalMethod,
        cashReceived: received,
        changeAmount: changeAmount,
      });
      await newOrder.save();
      res.status(201).json({ message: 'Order created successfully!', order: newOrder });

      if (validShiftId) {
        try {
          await Shift.findByIdAndUpdate(validShiftId, { $inc: { totalSales: verifiedTotal } });
        } catch (shiftErr) {
          console.error('Error updating shift totalSales:', shiftErr);
        }
      }
    } catch (saveErr) {
      for (const done of decremented) {
        await Product.findByIdAndUpdate(done._id, { $inc: { stock: done.quantity } });
      }
      throw saveErr;
    }
  } catch (err) {
    sendError(res, err);
  }
});

app.get('/api/dashboard/stats', requireRole('admin'), async (req, res) => {
  try {
    const orders = await Order.find();
    const totalProducts = await Product.countDocuments();

    let totalToday = 0;
    let cashToday = 0;
    let qrToday = 0;
    let totalMonth = 0;

    const now = new Date();
    const localNow = new Date(now.getTime() + (7 * 60 * 60 * 1000));
    const todayStr = localNow.toISOString().slice(0, 10);
    const currentMonthStr = todayStr.slice(0, 7);

    orders.forEach(order => {
      if (order.createdAt) {
        const orderDate = new Date(order.createdAt);
        const localOrderDate = new Date(orderDate.getTime() + (7 * 60 * 60 * 1000));
        const orderDateStr = localOrderDate.toISOString().slice(0, 10);
        const orderMonthStr = orderDateStr.slice(0, 7);

        const amount = Number(order.totalAmount || 0);

        if (orderMonthStr === currentMonthStr) {
          totalMonth += amount;
        }

        if (orderDateStr === todayStr) {
          totalToday += amount;

          const rawMethod = (order.paymentMethod || 'Cash').toString().toLowerCase();
          const isQR = rawMethod.includes('qr') || rawMethod.includes('transfer') || rawMethod.includes('scan');

          if (isQR) {
            qrToday += amount;
          } else {
            cashToday += amount;
          }
        }
      }
    });

    const recentOrders = await Order.find().sort({ createdAt: -1 }).limit(5);

    res.json({
      totalToday,
      cashToday,
      qrToday,
      totalMonth,
      totalProducts,
      recentOrders
    });
  } catch (err) {
    sendError(res, err, 'Server error');
  }
});

app.get('/api/orders', requireRole('admin'), async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    sendError(res, err);
  }
});

app.delete('/api/orders/:id', requireRole('admin'), async (req, res) => {
  try {
    // 🔒 ລຶບ order ດ້ວຍ findOneAndDelete ກ່ອນ ແລ້ຄືນ stock.
    //    - atomic claim: 2 request ພ້ອມກັນ ຈະໄດ້ order ພຽງອັນໜຶ່ງ → ຄືນ stock 1 ຄັ້ງ (ບໍ່ 2 ຄັ້ງ)
    //    - ທິດທານ: ຖ້າຄືນ stock ກ່ອນ ແລ້ delete ລົ້ມ → ໄດ້ສິນຄ້າຟຮາ + order ຍັງຢູ່
    //      ແລະກົດ delete ອີກເທື່ອງໄດ້ (ຄືນ stock ຊົ້ວ) = ການກວດດາວຊີ້ລາຄາໄດ້ເລີຍ
    //    - ຖ້າຄືນ stock ລົ້ມ → order ຖືກລຶບແລ້ວ = ຂໍ້ມູນບັນທຶກຜິດ (ປອດໄພ, ກົດຊົ້ວບໍ່ໄດ້)
    const order = await Order.findOneAndDelete({ _id: req.params.id });
    if (!order) return res.status(404).json({ error: 'ບໍ່ພົບຂໍ້ມູນບິນນີ້' });

    const items = Array.isArray(order.items) ? order.items : [];
    for (const item of items) {
      if (item._id && item.quantity) {
        try {
          await Product.findByIdAndUpdate(item._id, { $inc: { stock: item.quantity } });
        } catch (stockErr) {
          console.error(`Error restoring stock for product ${item._id} on order delete:`, stockErr);
        }
      }
    }

    if (order.shiftId) {
      try {
        await Shift.findByIdAndUpdate(order.shiftId, { $inc: { totalSales: -Number(order.totalAmount || 0) } });
      } catch (shiftErr) {
        console.error('Error updating shift totalSales on order delete:', shiftErr);
      }
    }

    res.json({ message: 'Order deleted and stock restored successfully!' });
  } catch (err) {
    sendError(res, err);
  }
});

// 🚫 ບໍ່ພົບ API — ຕອບເປັນ JSON ແທນ HTML
app.use('/api', (req, res) => {
  res.status(404).json({ error: `ບໍ່ພົບ API: ${req.method} ${req.originalUrl}` });
});

// 🛡️ ຈັດການ error ທີ່ຫຼຸດ try/catch ຂອງ route ມາ (ເຊັ່ນ error ຈາກ multer, express.json() ຫຼື middleware ອື່ນ)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  if (err instanceof multer.MulterError || (err && err.message && err.message.includes('ໄຟລ໌ຮູບພາບ'))) {
    return res.status(400).json({ error: err.message });
  }

  if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
    return res.status(400).json({ error: 'ຮູບແບບຄຳຮ້ອງ (JSON) ບໍ່ຖືກຕ້ອງ' });
  }

  const { status, message } = classifyError(err);
  if (status === 500) console.error('Unhandled error:', err);
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});