// 🖨️ ການບໍລິການພິມໃບບິນ / ໃບເສັດ (Receipt Printer)
//
// ຮອງຮັບການເຊື່ອມຕໍ່ເຄື່ອງພິມໃບເສັດທຸກຍີ່ຫໍ້ທີ່ຮອງຮັບພາສາ ESC/POS ໄດ້ (Epson, Xprinter, Star, Gprinter, ฯລຯ):
//   1. network-escpos — ພິມຜ່ານເນັດກັບ IP:port ຂອງເຄື່ອງພິມ (ປົກກະຕິ port 9100) — ເຄື່ອງທີ່ມີສາຍ LAN/WiFi
//   2. windows         — ພິມຜ່ານ Windows Printer Driver ທີ່ລົງຕິດຕັ້ງໄວ້ໃນເຄື່ອງ (USB ກໍ່ໄດ້ ຖ້າຕິດຕັ້ງ driver ແລ້ວ)
//
// ຫຼັກການເຮັດວຽກ: ສ້າງ Buffer ຄຳສັ່ງ ESC/POS ແລ້ວສົ່ງອອກທາງ TCP ຫຼື ທາງ Windows raw queue ໂດຍບໍ່ຕ້ອງຕິດຕັ້ງ package ເພີ່ມ

const net = require('net');
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const COL_WIDTH = 32; // 80mm ພິມໄດ້ 32 ຕົວອັກສອນ/ແຖວ (font A)
const CHARSET = parseInt(process.env.PRINTER_CHARSET || '0', 10) || 0; // 0=PC437, 16=Thai CP874 (ຂຶ້ນກັບຮຸ່ນເຄື່ອງ)

// ---------- ການຈັດຮູບແບບຕົວໜັງສື ----------

function center(text, width = COL_WIDTH) {
  const s = String(text);
  if (s.length >= width) return s.slice(0, width);
  const pad = Math.max(0, Math.floor((width - s.length) / 2));
  return ' '.repeat(pad) + s + ' '.repeat(width - s.length - pad);
}

function row(key, value, width = COL_WIDTH) {
  const k = String(key);
  const v = String(value);
  if (k.length + v.length >= width) return k + ' ' + v;
  return k + ' '.repeat(width - k.length - v.length) + v;
}

function nfmt(n) {
  return Number(n || 0).toLocaleString('en-US');
}

// ---------- ສ້າງຄຳສັ່ງ ESC/POS ----------

const tx = (...nums) => Buffer.from(nums);

function textLine(str) {
  return Buffer.concat([Buffer.from(String(str), 'utf8'), Buffer.from([0x0A])]);
}

// 🧾 ສ້າງ Buffer ໃບບິນທັງໝົດ
function buildReceipt({ shop, billNo, dateStr, empId, items, paymentMethod, total, cashReceived, changeAmount }) {
  const out = [];

  // ເລີ່ມຕົ້ນ + ກຳນົດຊຸດຕົວອັກສອນ
  out.push(tx(0x1B, 0x40));
  out.push(tx(0x1D, 0x74, CHARSET));

  // ----- ຫົວໃບບິນ -----
  out.push(tx(0x1B, 0x61, 0x01, 0x1D, 0x21, 0x11));          // ກາງ + ຕົວໃຫຍ່ 2 ເທົ່າ
  out.push(textLine(shop.shopName || 'RETAIL POS STORE'));
  out.push(tx(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x01));          // ຂະໜາດປົກກະຕິ + ຕົວໜາ
  out.push(textLine(center(shop.shopAddress || '')));
  out.push(textLine(center(shop.shopPhone || '')));
  out.push(tx(0x1B, 0x45, 0x00, 0x1B, 0x61, 0x00));          // ຍົກເລີກ ແລ້ວຊ້າຍ
  out.push(textLine('-'.repeat(COL_WIDTH)));

  // ----- ຂໍ້ມູນບິນ -----
  out.push(textLine(row('ເລກທີບິນ: #' + billNo, dateStr)));
  out.push(textLine(row('ພະນັກງານ:', empId)));

  // ບາໂຄດ CODE128 ຂອງເລກບິນ (ຖ້າມີເລກ ສົ່ງໄດ້)
  const barcode = String(billNo).replace(/[^0-9]/g, '').slice(0, 14);
  if (barcode.length >= 3) {
    out.push(tx(0x1D, 0x48, 0x02));                          // HRI ຢູ່ລຸ່ມບາໂຄດ
    out.push(tx(0x1D, 0x68, 0x40));                          // ຄວາມສູງ 64 dots
    out.push(tx(0x1D, 0x77, 0x03));                          // ຄວາມກວ້າງ 3 dots
    out.push(tx(0x1B, 0x61, 0x01));                          // ກາງ
    const data = Buffer.from(barcode, 'ascii');
    out.push(Buffer.concat([tx(0x1D, 0x6B, 0x49), data, tx(0x00)])); // TYPE 73 (CODE128)
    out.push(tx(0x1B, 0x61, 0x00));
    out.push(textLine(''));
  }

  out.push(textLine('-'.repeat(COL_WIDTH)));

  // ----- ລາຍການສິນຄ້າ -----
  const list = Array.isArray(items) ? items : [];
  list.forEach((i) => {
    const name = String(i.name || 'ສິນຄ້າ');
    const qty = Number(i.quantity || 1);
    const price = Number(i.price || 0);
    const sub = qty * price;
    out.push(textLine(name));
    out.push(textLine(row(`${qty} x ${nfmt(price)}`, nfmt(sub))));
  });
  out.push(textLine('-'.repeat(COL_WIDTH)));

  // ----- ຍອດລວມ + ການຊຳລະ -----
  out.push(textLine(row('ວິທີຊຳລະ:', paymentMethod || 'Cash')));
  out.push(tx(0x1B, 0x45, 0x01, 0x1D, 0x21, 0x11));
  out.push(textLine(row('ຍອດລວມ:', nfmt(total) + ' ກີບ')));
  out.push(tx(0x1D, 0x21, 0x00, 0x1B, 0x45, 0x00));
  if (cashReceived !== undefined && cashReceived !== null) {
    out.push(textLine(row('ຮັບເງິນມາ:', nfmt(cashReceived))));
    out.push(textLine(row('ເງິນທອນ:', nfmt(changeAmount || 0))));
  }
  out.push(textLine('-' .repeat(COL_WIDTH)));

  // ----- ທ້າຍໃບບິນ -----
  out.push(tx(0x1B, 0x61, 0x01));
  out.push(textLine(center(shop.footer || 'ຂອບໃຈທີ່ໃຊ້ບໍລິການ!')));
  out.push(tx(0x1B, 0x61, 0x00));
  out.push(textLine(''));
  out.push(textLine(''));

  // ຕັດໃບບິນ + ເປີດລິ້ນຊັກເງິນ
  out.push(tx(0x1B, 0x64, 0x02));       // ຢອກກະດາດ 2 ແຖວ
  out.push(tx(0x1D, 0x56, 0x30));       // ຕັດໃບ ແບບ partial
  out.push(tx(0x1B, 0x70, 0x00, 0x19)); // ເປີດລິ້ນຊັກ (drawer) kick 2

  return Buffer.concat(out);
}

// 🧪 ສ້າງ Buffer ເພື່ອທົດສອບພິມ
function buildTestPage(shop) {
  const out = [];
  out.push(tx(0x1B, 0x40));
  out.push(tx(0x1D, 0x74, CHARSET));
  out.push(tx(0x1B, 0x61, 0x01, 0x1D, 0x21, 0x11));
  out.push(textLine((shop.shopName || 'RETAIL POS STORE') + ''));
  out.push(tx(0x1D, 0x21, 0x00));
  out.push(textLine(center('--- PRINT TEST ---')));
  out.push(tx(0x1B, 0x61, 0x00));
  out.push(textLine(''));
  out.push(textLine('ວັນທີ່: ' + new Date().toLocaleString('th-TH')));
  out.push(textLine('ຖ້າທ່ານເຫັນອັກສອນນີ້ ສະແດງວ່າເຄື່ອງພິມເຊື່ອມຕໍ່ສຳເລັດ!'));
  out.push(textLine(''));
  out.push(textLine(''));
  out.push(tx(0x1B, 0x64, 0x02));
  out.push(tx(0x1D, 0x56, 0x30));
  return Buffer.concat(out);
}

// ---------- ການສົ່ງອອກພິມ ----------

// 🌐 ພິມຜ່ານເນັດ TCP (IP:port, ປົກກະຕິ 9100)
function printNetwork(ip, port, buffer) {
  return new Promise((resolve, reject) => {
    if (!ip) return reject(new Error('ຍັງບໍ່ໄດ້ຕັ້ງ IP ຂອງເຄື່ອງພິມ'));
    const socket = net.createConnection({ host: ip, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error(`ຕິດຕໍ່ເຄື່ອງພິມບໍ່ໄດ້ (${ip}:${port}) — ກວດສາຍ LAN/IP ໃຫ້ຖືກ`));
    }, 5000);
    socket.on('connect', () => {
      socket.write(buffer, () => {
        setTimeout(() => {
          clearTimeout(timer);
          socket.end();
          resolve();
        }, 300);
      });
    });
    socket.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// 🪟 ພິມຜ່ານ Windows Printer Driver (ຊື່ທີ່ຕັ້ງໃນ Control Panel -> Devices & Printers)
function printWindowsRaw(printerName, buffer) {
  return new Promise((resolve, reject) => {
    if (!printerName) return reject(new Error('ຍັງບໍ່ໄດ້ຕັ້ງຊື່ເຄື່ອງພິມ (Printer Name)'));
    const tmpFile = path.join(__dirname, 'tmp-print.bin');
    try {
      fs.writeFileSync(tmpFile, buffer);
    } catch (err) {
      return reject(err);
    }
    execFile(
      'cmd',
      ['/c', 'copy', '/b', tmpFile, `\\\\localhost\\${printerName}`],
      { windowsHide: true },
      (err, stdout, stderr) => {
        try { fs.unlinkSync(tmpFile); } catch {}
        if (err) {
          return reject(new Error(`ພິມຜ່ານ Windows ບໍ່ສຳເລັດ: "${printerName}" (${String(stderr || err.message).trim()})`));
        }
        resolve();
      }
    );
  });
}

// 🎛️ ສົ່ງພິມຕາມວິທີທີ່ຕັ້ງຄ່າ
async function printReceipt(cfg, receipt, shop) {
  if (!cfg.enabled) throw new Error('ຍັງບໍ່ໄດ້ເປີດໃຊ້ເຄື່ອງພິມ (Enable Printer) ໃນໜ້າຕັ້ງຄ່າ');

  const billNo =
    receipt._id || receipt.id || receipt.orderId || receipt.billNo || receipt.code ||
    receipt.receiptNo || receipt.bill_id || receipt.number || '000000';
  const displayId = typeof billNo === 'string' ? billNo : billNo.toString();

  const dateRaw = receipt.date || receipt.createdAt || new Date().toISOString();
  const d = new Date(dateRaw);
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = isNaN(d)
    ? String(dateRaw)
    : `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

  const empRaw = receipt.employeeId || receipt.cashierId || receipt.empId || 'EMP-01';
  let empStr = typeof empRaw === 'object' ? empRaw.toString() : String(empRaw);
  const displayEmpId = empStr.length > 10 ? `#${empStr.slice(-8)}` : empStr;

  const items = Array.isArray(receipt.items) ? receipt.items : [];
  const total = receipt.totalAmount || receipt.total ||
    items.reduce((s, i) => s + Number(i.quantity || 1) * Number(i.price || 0), 0);

  const payload = {
    shop,
    billNo: displayId,
    dateStr,
    empId: displayEmpId,
    items,
    paymentMethod: receipt.paymentMethod,
    total,
    cashReceived: receipt.cashReceived,
    changeAmount: receipt.changeAmount,
  };

  const buffer = buildReceipt(payload);

  if (cfg.method === 'windows') {
    await printWindowsRaw(cfg.name, buffer);
    return { ok: true, method: 'windows', printedWith: cfg.name };
  }
  await printNetwork(cfg.ip, cfg.port, buffer);
  return { ok: true, method: 'network-escpos', printedWith: `${cfg.ip}:${cfg.port}` };
}

// 🧪 ທົດສອບພິມ
async function printTestPage(cfg, shop) {
  if (!cfg.enabled) throw new Error('ຍັງບໍ່ໄດ້ເປີດໃຊ້ເຄື່ອງພິມ (Enable Printer) ໃນໜ້າຕັ້ງຄ່າ');
  const buffer = buildTestPage(shop);
  if (cfg.method === 'windows') {
    await printWindowsRaw(cfg.name, buffer);
    return { ok: true, method: 'windows', printedWith: cfg.name };
  }
  await printNetwork(cfg.ip, cfg.port, buffer);
  return { ok: true, method: 'network-escpos', printedWith: `${cfg.ip}:${cfg.port}` };
}

module.exports = { buildReceipt, printReceipt, printTestPage, printNetwork, printWindowsRaw };