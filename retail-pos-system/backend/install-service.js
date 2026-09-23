// ✅ ຕິດຕັ້ງ Backend ໃຫ້ຮັນເປັນ Windows Service (ຮັນເບື້ອງຫຼັງຕະຫຼອດ, ບໍ່ຕ້ອງເປີດ terminal ຄ້າງໄວ້)
//
// ວິທີໃຊ້ (ຮັນຢູ່ Command Prompt ແບບ "Run as Administrator" ເທົ່ານັ້ນ):
//   1. cd ໄປໂຟນເດີ backend
//   2. npm install   (ຖ້າຍັງບໍ່ໄດ້ຕິດຕັ້ງ)
//   3. node install-service.js
//
// ຫຼັງຈາກນັ້ນ service ຊື່ "RetailPOSBackend" ຈະຖືກສ້າງຂຶ້ນ, ຈະເປີດເອງທຸກຄັ້ງທີ່ເປີດ Windows
// ແລະ restart ອັດຕະໂນມັດຖ້າ crash — ກວດເບິ່ງ/ຢຸດ/ລຶບໄດ້ຈາກ Windows "Services" (services.msc)
//
// ໝາຍເຫດ: ໃຊ້ໄດ້ສະເພາະໃນ Windows ເທົ່ານັ້ນ (ໃຊ້ package "node-windows")

const path = require('path');
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'RetailPOSBackend',
  description: 'Retail POS System - Backend API Server (Node.js + Express + MongoDB)',
  script: path.join(__dirname, 'server.js'),
  nodeOptions: [],
  workingDirectory: __dirname,
  // ✅ Restart ອັດຕະໂນມັດຖ້າ crash, ແຕ່ຢຸດຖ້າ crash ຖີ່ເກີນໄປ (ກັນ loop ບໍ່ຮູ້ຈົບ)
  maxRestarts: 10,
  wait: 2,
  grow: 0.5
});

svc.on('install', () => {
  console.log('✅ ຕິດຕັ້ງ Service ສຳເລັດແລ້ວ! ກຳລັງເປີດ Service...');
  svc.start();
});

svc.on('start', () => {
  console.log('🚀 RetailPOSBackend ກຳລັງຮັນຢູ່ເບື້ອງຫຼັງແລ້ວ!');
  console.log('   - ເປີດ browser ໄປທີ່ http://localhost:5001 ເພື່ອທົດສອບ');
  console.log('   - ກວດ/ຢຸດ/ລຶບ service ໄດ້ຈາກ Windows "Services" (ພິມ services.msc ໃນ Start Menu)');
});

svc.on('alreadyinstalled', () => {
  console.log('⚠️ Service ນີ້ຕິດຕັ້ງໄວ້ແລ້ວ. ຖ້າຢາກຕິດຕັ້ງໃໝ່, ໃຫ້ຮັນ uninstall-service.js ກ່ອນ.');
});

svc.on('error', (err) => {
  console.error('❌ ເກີດຂໍ້ຜິດພາດ:', err);
  console.error('   ກະລຸນາເປີດ Command Prompt ແບບ "Run as Administrator" ແລ້ວລອງໃໝ່.');
});

console.log('⏳ ກຳລັງຕິດຕັ້ງ Service "RetailPOSBackend"...');
svc.install();
