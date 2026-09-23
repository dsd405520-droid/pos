// ✅ ຖອນການຕິດຕັ້ງ Windows Service ຂອງ Backend
// ໃຊ້ຕອນຢາກແກ້ໄຂ/ຍົກເລີກການຮັນເປັນ Service (ເຊັ່ນ ກ່ອນຍ້າຍ path ໂຟນເດີ ຫຼື ອັບເດດໂຄດໃຫຍ່)
//
// ວິທີໃຊ້ (ຮັນຢູ່ Command Prompt ແບບ "Run as Administrator"):
//   node uninstall-service.js

const path = require('path');
const Service = require('node-windows').Service;

const svc = new Service({
  name: 'RetailPOSBackend',
  script: path.join(__dirname, 'server.js')
});

svc.on('uninstall', () => {
  console.log('✅ ຖອນການຕິດຕັ້ງ Service ສຳເລັດແລ້ວ');
});

svc.on('error', (err) => {
  console.error('❌ ເກີດຂໍ້ຜິດພາດ:', err);
});

console.log('⏳ ກຳລັງຖອນການຕິດຕັ້ງ Service "RetailPOSBackend"...');
svc.uninstall();
