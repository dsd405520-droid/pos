import { useState, useEffect } from 'react';
import Dashboard from './components/Dashboard';
import AdminPanel from './components/AdminPanel';
import OrdersList from './components/OrdersList'; // 1. ນຳເຂົ້າ Component ປະຫວັດການຂາຍ
import StoreSettings from './components/StoreSettings'; // ⚙️ ໜ້າຕັ້ງຄ່າຮ້ານ (QR ຮັບເງິນໂອນຈິງ)

export default function AdminPage() {
  const [currentTab, setCurrentTab] = useState('dashboard');

  // 🔒 ກວດສິດເຂົ້າໜ້ານີ້ຕັ້ງແຕ່ຕົ້ນ — ແກ້ບັນຫາ "ໜ້າຂາວ" ຕອນເຂົ້າ /admin ໂດຍກົງ
  // (ໜ້ານີ້ mount ແຍກຈາກ App.jsx ຄົນລະ route, ຖ້າບໍ່ກວດເອງ ຈະບໍ່ຮູ້ວ່າ login ຫຼືບໍ່,
  //  ແລ້ວ Dashboard/AdminPanel ຈະ fetch API ຖືກ 401/403 ຄືນເປັນ error object ແທນ array,
  //  ພໍເອົາໄປ .filter()/.map() ຈະ crash ທັນທີ ໂດຍບໍ່ຂຶ້ນຂໍ້ຄວາມຫຍັງ)
  const [authState, setAuthState] = useState('checking'); // 'checking' | 'ok' | 'denied'

  useEffect(() => {
    const token = localStorage.getItem('token');
    const employeeRaw = localStorage.getItem('employee');

    if (!token || !employeeRaw) {
      setAuthState('denied');
      return;
    }

    try {
      const employee = JSON.parse(employeeRaw);
      if (employee.role !== 'admin') {
        setAuthState('denied');
        return;
      }
      setAuthState('ok');
    } catch {
      setAuthState('denied');
    }
  }, []);

  if (authState === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <p className="text-gray-500">ກຳລັງກວດສອບສິດເຂົ້າໃຊ້...</p>
      </div>
    );
  }

  if (authState === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="bg-white p-8 rounded-xl shadow-md text-center max-w-sm">
          <p className="text-4xl mb-3">🔒</p>
          <h2 className="text-lg font-bold text-gray-800 mb-2">ຕ້ອງ Login ກ່ອນ</h2>
          <p className="text-sm text-gray-500 mb-5">
            ທ່ານຍັງບໍ່ໄດ້ Login ຫຼື ບໍ່ມີສິດ Admin — ກະລຸນາ Login ດ້ວຍບັນຊີ Admin ກ່ອນເຂົ້າໜ້ານີ້
          </p>
          <a
            href="/"
            className="inline-block bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700"
          >
            ⬅️ ໄປໜ້າ Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-gray-100">
      
      {/* Sidebar ແຖບເມນູດ້ານຊ້າຍ */}
      <aside className="w-64 bg-white shadow-md flex flex-col justify-between">
        <div>
          <div className="p-4 border-b border-gray-200">
            <h1 className="text-lg font-bold text-gray-800">🛠️ Admin Control</h1>
            <p className="text-xs text-gray-500 mt-0.5">Retail POS System</p>
          </div>

          <nav className="p-4 space-y-2">
            <button
              onClick={() => setCurrentTab('dashboard')}
              className={`w-full text-left px-4 py-2.5 rounded-lg font-medium transition ${
                currentTab === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📊 ພາບລວມຍອດຂາຍ (Dashboard)
            </button>

            <button
              onClick={() => setCurrentTab('products')}
              className={`w-full text-left px-4 py-2.5 rounded-lg font-medium transition ${
                currentTab === 'products'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📦 ຈັດການສິນຄ້າ & ສະຕັອກ
            </button>

            <button
              onClick={() => setCurrentTab('orders')}
              className={`w-full text-left px-4 py-2.5 rounded-lg font-medium transition ${
                currentTab === 'orders'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              📋 ປະຫວັດການຂາຍ / ບິນ
            </button>

            <button
              onClick={() => setCurrentTab('settings')}
              className={`w-full text-left px-4 py-2.5 rounded-lg font-medium transition ${
                currentTab === 'settings'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              ⚙️ ຕັ້ງຄ່າຮ້ານ
            </button>
          </nav>
        </div>

        {/* ປຸ່ມກັບໄປໜ້າ POS */}
        <div className="p-4 border-t border-gray-200">
          <a 
            href="/" 
            className="block text-center w-full bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 font-medium text-sm transition"
          >
            ⬅️ ກັບໄປໜ້າຂາຍ (POS)
          </a>
        </div>
      </aside>

      {/* Main Content ພື້ນທີ່ສະແດງຜົນຕາມເມນູທີ່ເລືອກ */}
      <main className="flex-1 p-8 overflow-y-auto">
        {currentTab === 'dashboard' && <Dashboard />}
        {currentTab === 'products' && <AdminPanel />}
        {currentTab === 'orders' && <OrdersList />}
        {currentTab === 'settings' && <StoreSettings />}
      </main>

    </div>
  );
}