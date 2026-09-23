// 🌍 ບ່ອນດຽວທີ່ຕັ້ງຄ່າ URL ຂອງ Backend — ແກ້ບັນຫາ hardcode "http://localhost:5001" ຢູ່ທຸກ component
// ປ່ຽນຄ່າໄດ້ຜ່ານ frontend/.env -> VITE_API_URL=https://your-domain.com
export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ✅ ສ້າງ headers ພ້ອມແນບ Authorization Bearer token ອັດຕະໂນມັດ (ຖ້າມີ token ໃນ localStorage)
// ໃຊ້ຮ່ວມກັບ fetch() ທຸກບ່ອນທີ່ຕ້ອງການ Login ກ່ອນ (ຕອນນີ້ເກືອບທຸກ API ຕ້ອງການ Token ແລ້ວ)
export function authHeaders(extra = {}) {
  const token = localStorage.getItem('token');
  return {
    ...extra,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// ✅ ຕໍ່ URL ຮູບພາບໃຫ້ຄົບ (ຮອງຮັບທັງ path ແບບ relative "/uploads/xxx" ແລະ URL ເຕັມເກົ່າ)
export function resolveImageUrl(image) {
  if (!image) return 'https://via.placeholder.com/40';
  if (image.startsWith('http')) return image;
  return `${API_BASE_URL}${image}`;
}

// ✅ fetch ແບບປອດໄພ — ໃຊ້ແທນ fetch() ທຳມະດາ ສຳລັບ GET ທີ່ຄາດຫວັງ array (products, orders, categories...)
// ຖ້າ Token ໝົດອາຍຸ/ບໍ່ຖືກຕ້ອງ (401) ຈະລ້າງ session ແລ້ວກັບໄປໜ້າ Login ທັນທີ ແທນທີ່ຈະ crash ເປັນໜ້າຂາວ
// ຖ້າ status ອື່ນ (403, 500...) ຫຼື ຄ່າທີ່ໄດ້ບໍ່ແມ່ນ array ຈະສົ່ງຄືນ [] ພ້ອມ log error ໄວ້ໃນ console
export async function fetchArray(url) {
  try {
    const res = await fetch(url, { headers: authHeaders() });

    if (res.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('employee');
      alert('⚠️ Session ໝົດອາຍຸ ຫຼື ບໍ່ຖືກຕ້ອງ, ກະລຸນາ Login ໃໝ່');
      window.location.href = '/';
      return [];
    }

    const data = await res.json().catch(() => null);

    if (!res.ok || !Array.isArray(data)) {
      console.error('API error for', url, data);
      return [];
    }

    return data;
  } catch (err) {
    console.error('Network error for', url, err);
    return [];
  }
}
