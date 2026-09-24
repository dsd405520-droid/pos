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
const allowedOrigins = (process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (allowedOrigins[0] === '*' || !origin || allowedOrigins.includes(origin)) {
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

// ຕັ້ງຄ່າ Multer ສຳລັບອັບໂຫຼດໄຟລ໌ຮູບພາບ
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
// 🛡️ ອະນຸຍາດສະເພາະໄຟລ໌ຮູບພາບ (jpg, png, gif, webp) + ຈຳກັດຂະໜາດ 5MB — ກັນການອັບໂຫຼດໄຟລ໌ອັນຕະລາຍປອມເປັນຮູບ
const allowedImageTypes = /jpeg|jpg|png|gif|webp/;
const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const extOk = allowedImageTypes.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowedImageTypes.test(file.mimetype);
    if (extOk && mimeOk) {
      cb(null, true);
    } else {
      cb(new Error('ອະນຸຍາດສະເພາະໄຟລ໌ຮູບພາບເທົ່ານັ້ນ (jpg, png, gif, webp)'));
    }
  }
});

// ໃຫ້ Server ສາມາດເປີດເບິ່ງຮູບຜ່ານ URL ໄດ້ (path ແບບ relative, frontend ຈະຕໍ່ host ເອງ)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 🔗 ເຊື່ອມຕໍ່ MongoDB (ອ່ານຈາກ .env ດຽວນີ້ ບໍ່ hardcode ອີກຕໍ່ໄປ — ໃຊ້ໄດ້ທັງ local ແລະ Docker)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/retail_pos';
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB Connected Successfully! ->', MONGO_URI);
  backfillEmployeeCodes(); // 🆔 ຕື່ມລະຫັດພະນັກງານໃຫ້ຄົນເກົ່າອັດຕະໂນມັດ (ຮັນທຸກຄັ້ງທີ່ server ເປີດ, ບໍ່ເປັນຫຍັງ — ຂ້າມຄົນທີ່ມີແລ້ວໃຫ້ເອງ)
})
.catch((err) => console.log('MongoDB Connection Error:', err));

// 🆔 ຕື່ມ employeeCode ໃຫ້ພະນັກງານທີ່ຍັງບໍ່ມີ (ເຊັ່ນ ຄົນທີ່ສ້າງໄວ້ກ່ອນ feature ນີ້ຈະມີ) — ຮັນອັດຕະໂນມັດຕອນ server ເລີ່ມ,
// ບໍ່ຕ້ອງເປີດ script ແຍກຕ່າງຫາກອີກຕໍ່ໄປ. ຮັນຊ້ຳໄດ້ຮ້ອຍເທື່ອກໍ່ບໍ່ເປັນຫຍັງ ເພາະຈະຂ້າມຄົນທີ່ມີລະຫັດແລ້ວ.
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

// 📦 ດຶງ Routes ຕ່າງໆເຂົ້າມາใช้งาน
const authRoutes = require('./routes/auth');
const shiftRoutes = require('./routes/shifts');
const employeeRoutes = require('./routes/employeeRoutes');
const Order = require('./models/Order');
const Shift = require('./models/Shift');

// --- Schemas & Models ---

// 📦 Schema & Model ສຳລັບສິນຄ້າ (Product)
const productSchema = new mongoose.Schema({
  sku: { type: String, unique: true, sparse: true },
  name: String,
  price: Number,
  costPrice: { type: Number, default: 0 }, // 💰 ເພີ່ມລາຄາຕົ້ນທຶນ (ຕໍ່ 1 ຫົວໜ່ວຍຍ່ອຍ)
  stock: Number,        
  image: String,
  category: { type: String, default: 'ທົ່ວໄປ' },
  unit: { type: String, default: 'ອັນ' },              // ຫົວໜ່ວຍຍ່ອຍ — ໃຊ້ຂາຍໜ້າຮ້ານ (ອັນ, ແກ້ວ, ຊິ້ນ...)
  purchaseUnit: { type: String, default: '' },          // ຫົວໜ່ວຍໃຫຍ່ — ໃຊ້ຕອນຊື້ເຂົ້າ (ແພັກ, ແກັດ, ລັງ...)
  conversionRate: { type: Number, default: 1 }          // 1 purchaseUnit = ຈັກ unit (ຫົວໜ່ວຍຍ່ອຍ)
});
const Product = mongoose.model('Product', productSchema);

// 📦 Schema & Model ສຳລັບປະຫວັດການນຳເຂົ້າສິນຄ້າ (StockLog / Stock In History)
const stockLogSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true },        // ຈຳນວນຫົວໜ່ວຍຍ່ອຍທັງໝົດທີ່ເພີ່ມເຂົ້າ stock (ຄິດໄລ່ແລ້ວ)
  purchaseQuantity: { type: Number, default: null }, // ຈຳນວນຫົວໜ່ວຍໃຫຍ່ທີ່ຮັບເຂົ້າຕົວຈິງ (ຕາມທີ່ admin ພິມ)
  purchaseUnit: { type: String, default: '' },       // ຊື່ຫົວໜ່ວຍໃຫຍ່ ຕອນນັ້ນ (ບັນທຶກໄວ້ເຜື່ອສິນຄ້າປ່ຽນຫົວໜ່ວຍພາຍຫຼັງ)
  costPrice: { type: Number, default: 0 },           // ລາຄາຕົ້ນທຶນຕໍ່ 1 ຫົວໜ່ວຍໃຫຍ່ ຕາມທີ່ admin ພິມ
  note: { type: String, default: 'ຮັບສິນຄ້າເຂົ້າຮ້ານ' },
  createdAt: { type: Date, default: Date.now }
});
const StockLog = mongoose.model('StockLog', stockLogSchema);

// ⚙️ Schema & Model ສຳລັບຕັ້ງຄ່າຮ້ານ (Setting) — document ດຽວ (singleton), ໃຊ້ເກັບ QR ຮັບເງິນໂອນຈິງຂອງຮ້ານ
const settingSchema = new mongoose.Schema({
  shopName: { type: String, default: '' },
  shopQRImage: { type: String, default: '' }, // 🏦 ຮູບ QR ຈິງ (ບໍ່ແມ່ນ QR ປອມອີກຕໍ່ໄປ) — admin ອັບໂຫຼດ/ຕັ້ງເອງ
  shopAddress: { type: String, default: '' },   // 🏪 ທີ່ຢູ່ຮ້ານ (ສະແດງໃນໃບບິນ)
  shopPhone: { type: String, default: '' },     // ☎️ ເບີໂທຮ້ານ (ສະແດງໃນໃບບິນ)
  receiptFooter: { type: String, default: '' }, // 📝 ຂໍ້ຄວາມທ້າຍໃບບິນ
  printerEnabled: { type: Boolean, default: false },          // 🖨️ ເປີດ/ປິດ ການພິມອອກເຄື່ອງ
  printerMethod: { type: String, default: 'network-escpos' }, // 'network-escpos' | 'windows'
  printerIp: { type: String, default: '' },                   // IP ເຄື່ອງພິມ (ແບບ network)
  printerPort: { type: Number, default: 9100 },               // Port ເຄື່ອງພິມ (ປົກກະຕິ 9100)
  printerName: { type: String, default: '' },                 // ຊື່ເຄື່ອງພິມໃນ Windows (ແບບ driver)
  updatedAt: { type: Date, default: Date.now }
});
const Setting = mongoose.model('Setting', settingSchema);

// 🏷️ Schema & Model ສຳລັບໝວດໝູ່ (Category)
const categorySchema = new mongoose.Schema({ 
  name: { type: String, unique: true, required: true } 
});
const Category = mongoose.model('Category', categorySchema);

// 📏 Schema & Model ສຳລັບໜ່ວຍນັບ (Unit)
const unitSchema = new mongoose.Schema({ 
  name: { type: String, unique: true, required: true } 
});
const Unit = mongoose.model('Unit', unitSchema);

// --- API Endpoints & Routes Registration ---

app.use('/api/auth', authRoutes);       // 🔓 Public (login)
app.use('/api/shifts', shiftRoutes);    // 🔒 protected inside shifts.js
app.use('/api/employees', employeeRoutes); // 🔒 admin-only, protected inside employeeRoutes.js

// 🩺 ກວດສຸຂະພາບ (healthcheck ຂອງ Docker ໃຊ້) — ບໍ່ຕ້ອງ Login
app.get('/api/health', (req, res) => {
  res.json({ ok: true, db: mongoose.connection.readyState === 1, time: new Date().toISOString() });
});

// 🔒 2. ຈາກຈຸດນີ້ລົງໄປ ທຸກ Route ຕ້ອງ Login ກ່ອນຈຶ່ງເອີ້ນໃຊ້ໄດ້ (ແກ້ບັນຫາ "ບໍ່ມີ Authentication" ທີ່ພົບ)
app.use(verifyToken);

// --- 📂 API ສຳລັບ Category (ໝວດໝູ່) ---
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await Category.find();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/categories', requireRole('admin'), async (req, res) => {
  try {
    const newCat = new Category({ name: req.body.name });
    await newCat.save();
    res.status(201).json(newCat);
  } catch (err) {
    res.status(400).json({ error: 'Category already exists or invalid' });
  }
});

app.delete('/api/categories/:id', requireRole('admin'), async (req, res) => {
  try {
    await Category.findByIdAndDelete(req.params.id);
    res.json({ message: 'Category deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 📏 API ສຳລັບ Unit (ໜ່ວຍນັບ) ---
app.get('/api/units', async (req, res) => {
  try {
    const units = await Unit.find();
    res.json(units);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/units', requireRole('admin'), async (req, res) => {
  try {
    const newUnit = new Unit({ name: req.body.name });
    await newUnit.save();
    res.status(201).json(newUnit);
  } catch (err) {
    res.status(400).json({ error: 'Unit already exists or invalid' });
  }
});

app.delete('/api/units/:id', requireRole('admin'), async (req, res) => {
  try {
    await Unit.findByIdAndDelete(req.params.id);
    res.json({ message: 'Unit deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- ⚙️ API ສຳລັບຕັ້ງຄ່າຮ້ານ (Setting) ---
// ໃຫ້ພະນັກງານທຸກຄົນທີ່ login ແລ້ວອ່ານໄດ້ (ຕ້ອງໃຊ້ຕອນ checkout ເພື່ອສະແດງ QR ຈິງ)
app.get('/api/settings', async (req, res) => {
  try {
    let setting = await Setting.findOne();
    if (!setting) setting = { shopName: '', shopQRImage: '' };
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ສະເພາະ admin ຕັ້ງ/ແກ້ໄຂໄດ້ — ຮັບໄດ້ທັງອັບໂຫຼດໄຟລ໌ (qrImage) ຫຼື ວາງລິ້ງຮູບ (shopQRImage)
app.put('/api/settings', requireRole('admin'), upload.single('qrImage'), async (req, res) => {
  const isTrue = (v) => v === true || v === 'true' || v === 'on' || v === '1';
  try {
    let setting = await Setting.findOne();
    if (!setting) setting = new Setting();

    if (req.body.shopName !== undefined) {
      setting.shopName = req.body.shopName;
    }
    if (req.body.shopAddress !== undefined) {
      setting.shopAddress = req.body.shopAddress;
    }
    if (req.body.shopPhone !== undefined) {
      setting.shopPhone = req.body.shopPhone;
    }
    if (req.body.receiptFooter !== undefined) {
      setting.receiptFooter = req.body.receiptFooter;
    }
    if (req.body.printerEnabled !== undefined) {
      setting.printerEnabled = isTrue(req.body.printerEnabled);
    }
    if (req.body.printerMethod !== undefined) {
      setting.printerMethod = req.body.printerMethod;
    }
    if (req.body.printerIp !== undefined) {
      setting.printerIp = String(req.body.printerIp).trim();
    }
    if (req.body.printerPort !== undefined) {
      setting.printerPort = Number(req.body.printerPort) || 9100;
    }
    if (req.body.printerName !== undefined) {
      setting.printerName = String(req.body.printerName).trim();
    }

    if (req.file) {
      setting.shopQRImage = `/uploads/${req.file.filename}`;
    } else if (req.body.shopQRImage !== undefined && req.body.shopQRImage !== '') {
      setting.shopQRImage = req.body.shopQRImage;
    }

    setting.updatedAt = new Date();
    await setting.save();
    res.json({ message: 'ບັນທຶກຄ່າຮ້ານສຳເລັດ', setting });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- 🖨️ API ສຳລັບເຄື່ອງພິມໃບບິນ (Receipt Printer) ---
// ອ່ານຄ່າເຄື່ອງພິມຈາກຖານຂໍ້ມູນ (ຕັ້ງຢູ່ໜ້າຕັ້ງຄ່າ) ກ່ອນ, ຖ້າບໍ່ມີຈະກັບໄປໃຊ້ຄ່າເລີ່ມຕົ້ນຈາກ .env
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

// 🖨️ ພິມໃບບິນອອກເຄື່ອງພິມຈິງ — ພະນັກງານທຸກຄົນທີ່ login ຢູ່ໃຊ້ໄດ້ (ຕ້ອງການຕອນ checkout)
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
    res.status(500).json({ error: err.message });
  }
});

// 🧪 ທົດສອບພິມ — ສະເພາະ admin
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
    res.status(500).json({ error: err.message });
  }
});

// --- 📦 API ສຳລັບ Product ---

app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ➕ ສ້າງສິນຄ້າໃໝ່ — ຮັບ "ຈຳນວນ/ລາຄານຳເຂົ້າ" ເປັນ ຫົວໜ່ວຍໃຫຍ່ (importQuantity/importPrice),
// ຄິດໄລ່ອອກເປັນ stock (ຫົວໜ່ວຍຍ່ອຍ) + ຕົ້ນທຶນຕໍ່ຫົວໜ່ວຍຍ່ອຍ ໃຫ້ອັດຕະໂນມັດ ແລະ ບັນທຶກເປັນປະຫວັດ Stock In ຄັ້ງທຳອິດນຳ
app.post('/api/products', requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    const { sku, name, price, importQuantity, importPrice, category, unit, purchaseUnit, conversionRate } = req.body;
    
    let imagePath = '';
    if (req.file) {
      imagePath = `/uploads/${req.file.filename}`; // ✅ relative path, frontend ຕໍ່ host ເອງ
    } else if (req.body.image) {
      imagePath = req.body.image;
    }

    const rate = Number(conversionRate) || 1;
    const impQty = Number(importQuantity) || 0;
    const impPrice = Number(importPrice) || 0;
    const totalPieces = impQty * rate;                                   // ຄິດອອກເປັນ ຫົວໜ່ວຍຍ່ອຍ
    const perPieceCost = rate > 0 ? Number((impPrice / rate).toFixed(2)) : 0; // ຕົ້ນທຶນຕໍ່ 1 ຫົວໜ່ວຍຍ່ອຍ

    const newProduct = new Product({ 
      sku: sku || `P${Date.now().toString().slice(-4)}`,
      name, 
      price: Number(price),
      costPrice: perPieceCost,
      stock: totalPieces, 
      image: imagePath, 
      category, 
      unit, 
      purchaseUnit: purchaseUnit || unit,
      conversionRate: rate
    });

    await newProduct.save();

    // 📝 ບັນທຶກການນຳເຂົ້າຄັ້ງທຳອິດນີ້ລົງ Stock In History ນຳ (ຖ້າມີການລະບຸຈຳນວນນຳເຂົ້າ)
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
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/products/:id', requireRole('admin'), upload.single('image'), async (req, res) => {
  try {
    const { sku, name, price, costPrice, stock, category, unit, purchaseUnit, conversionRate } = req.body;
    
    let updateData = { 
      name, 
      price: Number(price),
      stock: Number(stock), 
      category, 
      unit, 
      purchaseUnit: purchaseUnit || unit,
      conversionRate: Number(conversionRate) || 1 
    };

    if (sku && sku.trim() !== '') {
      updateData.sku = sku.trim();
    }

    if (costPrice !== undefined && costPrice !== '') {
      const rateForCost = Number(conversionRate) || 1;
      updateData.costPrice = Number((Number(costPrice) / rateForCost).toFixed(2)) || 0;
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
    res.json({ message: 'Product updated successfully!', product: updatedProduct });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/products/:id', requireRole('admin'), async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: 'Product deleted successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/stock/in', requireRole('admin'), async (req, res) => {
  try {
    const { productId, quantity, costPrice, note } = req.body;

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ message: 'ບໍ່ພົບສິນຄ້ານີ້ໃນລະບົບ' });
    }

    const purchaseQty = Number(quantity);
    const costNumber = Number(costPrice);

    if (!purchaseQty || purchaseQty <= 0) {
      return res.status(400).json({ message: 'ຈຳນວນສິນຄ້າຕ້ອງຫຼາຍກວ່າ 0' });
    }

    const conversionRate = Number(product.conversionRate) || 1;
    const totalPieces = purchaseQty * conversionRate;

    const stockLog = new StockLog({
      productId,
      quantity: totalPieces,
      purchaseQuantity: purchaseQty,
      purchaseUnit: product.purchaseUnit || product.unit,
      costPrice: costNumber || 0,
      note: note || 'ຮັບສິນຄ້າເຂົ້າຮ້ານ',
      createdAt: new Date()
    });
    await stockLog.save();

    product.stock = (product.stock || 0) + totalPieces;
    if (costNumber > 0) {
      product.costPrice = Number((costNumber / conversionRate).toFixed(2));
    }
    await product.save();

    res.status(200).json({ 
      success: true, 
      message: `ເພີ່ມ Stock ສຳເລັດແລ້ວ (+${totalPieces} ${product.unit})`, 
      updatedStock: product.stock 
    });

  } catch (err) {
    console.error('Error stock in:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/api/stock/logs', requireRole('admin'), async (req, res) => {
  try {
    const logs = await StockLog.find()
      .populate('productId', 'name sku unit')
      .sort({ createdAt: -1 });
    res.status(200).json(logs);
  } catch (err) {
    console.error('Error fetching stock logs:', err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const { items, paymentMethod, cashReceived } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'ບໍ່ມີສິນຄ້າໃນລາຍການ' });
    }

    // 🔒 employee ຈາກ Token (req.user.id) ເທົ່ານັ້ນ — ບໍ່ເຊື່ອ employeeId ຈາກ body ອີກຕໍ່ໄປ (ເຄີຍເປັນການປອມແທນເຈົ້າຂອງບັນຊີໄດ້)
    const employeeId = req.user.id;

    // 🔒 ກະ (Shift) ມາຈາກ Token ເທົ່ານັ້ນ — ບໍ່ເຊື່ອ shiftId ຈາກ body
    // cashier ຕ້ອງມີກະທີ່ກຳລັງເປີດຢູ່ຈຶ່ງຂາຍໄດ້ (admin ຂາຍໄດ້ໂດຍບໍ່ຕ້ອງເປີດກະ)
    const activeShift = await Shift.findActiveFor(req.user.id);
    if (!activeShift && req.user.role !== 'admin') {
      return res.status(400).json({ code: 'NO_OPEN_SHIFT', error: 'ຍັງບໍ່ໄດ້ເປີດກະ ຫຼື ກະຖືກປິດແລ້ວ — ກະລຸນາເປີດກະກ່ອນຂາຍ' });
    }
    const validShiftId = activeShift ? activeShift._id : null;

    // 🏷️ Whitelist ວິທີຊຳລະເງິນ — ບໍ່ຮັບຄ່າມົວໆ ຈາກ body
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
      if (qty <= 0) {
        return res.status(400).json({ error: `ຈຳນວນສິນຄ້າ "${product.name}" ບໍ່ຖືກຕ້ອງ` });
      }
      verifiedItems.push({
        _id: product._id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        costPrice: product.costPrice || 0, // 📊 ບັນທຶກຕົ້ນທຶນ ณ ເວລາຂາຍໄວ້ນຳ ເພື່ອຄິດກຳໄລຍ້ອນຫຼັງໄດ້ຖືກຕ້ອງ (ບໍ່ຖືກກະທົບຖ້າຕົ້ນທຶນປ່ຽນພາຍຫຼັງ)
        unit: product.unit,
        image: product.image,
        quantity: qty,
      });
      verifiedTotal += product.price * qty;
    }

    // 💵 ກວດສອບເງິນທີ່ຮັບມາກັບຍອດລວມທີ່ server ຄິດໄລ່ — ບໍ່ພຽງພໍຕ້ອງຕັດອອກທັນທີ (ເຄີຍກວດພຽງ frontend ເທົ່ານັ້ນ)
    const received = Number(cashReceived) || 0;
    if (received < verifiedTotal) {
      return res.status(400).json({ error: `ຈຳນວນເງິນທີ່ຮັບມາ (${received.toLocaleString()}) ນ້ອຍກວ່າຍອດລວມ (${verifiedTotal.toLocaleString()})` });
    }
    const changeAmount = received - verifiedTotal;

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

      // 🕐 ອັບເດດຍອດຂາຍລວມຂອງກະ (Shift) ໃຫ້ທັນເວລາ — ຕອນປິດກະຈະຄິດໄລ່ໃໝ່ຈາກ Order ອີກເທື່ອໜຶ່ງ ເພື່ອຄວາມຖືກຕ້ອງ
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
    res.status(500).json({ error: err.message });
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
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/orders', requireRole('admin'), async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/orders/:id', requireRole('admin'), async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: 'ບໍ່ພົບຂໍ້ມູນບິນນີ້' });

    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item._id && item.quantity) {
          await Product.findByIdAndUpdate(item._id, { $inc: { stock: item.quantity } });
        }
      }
    }

    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: 'Order deleted and stock restored successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
  
// 🛡️ ຈັດການ error ຈາກ multer (ໄຟລ໌ຮູບຜິດປະເພດ, ໃຫຍ່ເກີນ 5MB) ໃຫ້ຕອບເປັນ JSON ແທນ crash ດ້ວຍ stack trace
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError || (err && err.message && err.message.includes('ໄຟລ໌ຮູບພາບ'))) {
    return res.status(400).json({ error: err.message });
  }
  next(err);
});

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});