const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// 🔒 ອ່ານ JWT_SECRET ຈາກ .env — ຖ້າບໍ່ມີ ຈະສ້າງແບບສຸ່ມ (temporary) ແລະ ອອກຄຳເຕືອນ
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.JWT_SECRET) {
  console.warn('⚠️ ກະລຸນາຕັ້ງ JWT_SECRETໃນ .env — ກຳລັງໃຊ້ secret ທີ່ສ້າງແບບສຸ່ມ (Token ຈະຖືກລຶບເມື່ອ Server restart)');
}

// ✅ ກວດສອບວ່າມີ Token ຖືກຕ້ອງບໍ (ຕ້ອງ Login ກ່ອນຈຶ່ງເຂົ້າໄດ້)
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'ບໍ່ໄດ້ Login ຫຼື Token ບໍ່ຖືກຕ້ອງ (Unauthorized)' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, username, role }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token ໝົດອາຍຸ ຫຼື ບໍ່ຖືກຕ້ອງ, ກະລຸນາ Login ໃໝ່' });
  }
}

// ✅ ອະນຸຍາດສະເພາະ role ທີ່ລະບຸ (ຕ້ອງໃຊ້ຫຼັງ verifyToken ສະເໝີ)
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'ທ່ານບໍ່ມີສິດເຂົ້າເຖິງສ່ວນນີ້ (Forbidden)' });
    }
    next();
  };
}

module.exports = { verifyToken, requireRole, JWT_SECRET };
