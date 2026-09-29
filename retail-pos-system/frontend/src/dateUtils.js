// 🕐 ຕົວຊ່ວຍກຳນວນວັນ/ເດືອນໃນເວລາລາວ (ICT = UTC+7) — ໃຫ້ຕົງກັບ backend ທີ່ໃຊ້ +07:00 ໃນ /api/dashboard/stats ແລະ routes/shifts.js
// ⚠️ ຫ້າໃຊ້ toISOString() ຈະໄດ້ວັນໂນ UTC → ບິນເວລາ 17:00 ຂຶ້ນໄປຂອງວັນຖັດໄປ ທຳໃຫ້ການກັ່ນຕອງຜິດພາດ
const ICT_OFFSET_MINUTES = 7 * 60;

// 📅 ຄືກາຍ "YYYY-MM-DD" ຂອງວັນຕາມເວລາລາວ
// - dateStr: ຖ້າໃສ່ string 'YYYY-MM-DD' (ເຊັ່ນຄຳຈາກ <input type="date">) ຈະສ່ງຄືນຕາມນັ້ນ
// - value: Date | string | number ໃດໆ
// ຄືນ string ວ່າງ '' ຖ້າວັນທີບໍ່ຖືກຕ້ອງ (ເພື່ອບ່ຽງກັນ ObjectId ໃນ URL ເປັນ string)
export function localDateKey(value, dateStr) {
  if (dateStr) return dateStr;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return new Date(d.getTime() + ICT_OFFSET_MINUTES * 60 * 1000).toISOString().slice(0, 10);
}

// 📆 ຄືກາຍ "YYYY-MM" ຂອງເດືອນຕາມເວລາລາວ
export function localMonthKey(value) {
  const key = localDateKey(value);
  return key ? key.slice(0, 7) : '';
}
