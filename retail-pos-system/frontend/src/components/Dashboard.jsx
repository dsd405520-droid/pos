import { useState, useEffect } from 'react';
import { API_BASE_URL, authHeaders, fetchArray } from '../api';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

// ⏹️ ລົງທະບຽນ Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalToday: 0,
    cashToday: 0,
    qrToday: 0,
    totalMonth: 0,
    totalProducts: 0,
    recentOrders: []
  });

  const [allOrders, setAllOrders] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]); // 🚨 State ສຳລັບເກັບສິນຄ້າໃກ້ໝົດ
  const [loading, setLoading] = useState(true);

  // 📅 State ສຳລັບກັ່ນຕອງຕາມຊ່ວງເວລາ (Filter by Date)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      // 1. ดึงสถิติทั่วไป (ຄາດຫວັງ object, ບໍ່ແມ່ນ array — ກວດ res.ok ເອງ)
      const resStats = await fetch(`${API_BASE_URL}/api/dashboard/stats`, { headers: authHeaders() });
      if (resStats.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        alert('⚠️ Session ໝົດອາຍຸ ຫຼື ບໍ່ຖືກຕ້ອງ, ກະລຸນາ Login ໃໝ່');
        window.location.href = '/';
        return;
      }
      const dataStats = await resStats.json().catch(() => null);
      if (resStats.ok && dataStats && typeof dataStats === 'object') {
        setStats(dataStats);
      } else {
        console.error('Dashboard stats error:', dataStats);
      }

      // 2. ดึงรายการออร์เดอร์ทั้งหมดมาทำกราฟและจัดอันดับสินค้า
      const dataOrders = await fetchArray(`${API_BASE_URL}/api/orders`);
      setAllOrders(dataOrders);

      // 3. ດຶງຂໍ້ມູນສິນຄ້າທັງໝົດມາກວດສອບ Stock ໃກ້ໝົດ (<= 5 ຊິ້ນ)
      const dataProducts = await fetchArray(`${API_BASE_URL}/api/products`);
      const lowStock = dataProducts.filter(p => Number(p.stock || 0) <= 5);
      setLowStockProducts(lowStock);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 🔍 กรองออร์เดอร์ตามช่วงเวลาที่ Admin เลือก (Custom Date Range)
  const filteredOrders = allOrders.filter((order) => {
    if (!startDate && !endDate) return true;
    const orderDate = new Date(order.createdAt).toISOString().slice(0, 10);
    if (startDate && endDate) {
      return orderDate >= startDate && orderDate <= endDate;
    }
    if (startDate) {
      return orderDate >= startDate;
    }
    if (endDate) {
      return orderDate <= endDate;
    }
    return true;
  });

  // คำนวณยอดขายรวมตามช่วงเวลาที่ filter
  const filterTotalRevenue = filteredOrders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0
  );

  // 🏆 คำนวณสินค้าขายดี Top 5 (จากออร์เดอร์ทั้งหมดหรือที่กรอง)
  const productSalesMap = {};
  filteredOrders.forEach((order) => {
    if (order.items && Array.isArray(order.items)) {
      order.items.forEach((item) => {
        const name = item.name || 'ສິນຄ້າບໍ່ລະບຸຊື່';
        if (!productSalesMap[name]) {
          productSalesMap[name] = { quantity: 0, revenue: 0 };
        }
        productSalesMap[name].quantity += Number(item.quantity || 0);
        productSalesMap[name].revenue += Number(item.price || 0) * Number(item.quantity || 0);
      });
    }
  });

  const topProducts = Object.keys(productSalesMap)
    .map((name) => ({
      name,
      quantity: productSalesMap[name].quantity,
      revenue: productSalesMap[name].revenue,
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5); // ເອົາ 5 ອັນດັບແຳລກ

  // 📊 เตรียมข้อมูลสำหรับ กราฟแท่งยอดขาย 7 วันย้อนหลัง
  const getLast7DaysData = () => {
    const days = [];
    const revenues = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateString = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' });
      days.push(dateString);

      const targetDateStr = d.toDateString();
      const dayTotal = allOrders
        .filter((order) => new Date(order.createdAt).toDateString() === targetDateStr)
        .reduce((sum, order) => sum + Number(order.totalAmount || 0), 0);

      revenues.push(dayTotal);
    }
    return { days, revenues };
  };

  const chartInfo = getLast7DaysData();
  const chartData = {
    labels: chartInfo.days,
    datasets: [
      {
        label: 'ຍອດຂາຍ (ກີບ)',
        data: chartInfo.revenues,
        backgroundColor: 'rgba(59, 130, 246, 0.7)', // ສີຟ້າ
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
      title: { display: false },
    },
  };

  return (
    <div className="p-6 max-w-6xl mx-auto bg-white rounded-xl shadow-md space-y-6 mt-6">
      
      {/* 🚨 Low Stock Alert Badge (ແຈ້ງເຕືອນສິນຄ້າໃກ້ໝົດ) */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h4 className="text-sm font-bold text-red-800">ແຈ້ງເຕືອນສິນຄ້າໃກ້ໝົດສາງ (Low Stock Alert)</h4>
              <p className="text-xs text-red-600">ມີສິນຄ້າເຫຼືອຕ່ຳກວ່າ 5 ຊິ້ນ ຈຳນວນ {lowStockProducts.length} ລາຍການ ຄວນຕຸ່ນເພີ່ມດ່ວນ!</p>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {lowStockProducts.map(p => (
              <span key={p._id} className="bg-red-100 text-red-700 text-xs px-2.5 py-1 rounded-md font-semibold border border-red-200">
                {p.name} ({p.stock} {p.unit || 'ຊິ້ນ'})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 🏷️ Header */}
      <div className="flex justify-between items-center border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">📊 Dashboard (ພາບລວມຍອດຂາຍ ແລະ ວິເຄາະ)</h2>
        <button 
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition flex items-center gap-1"
        >
          🔄 ຣີເຟຣດຂໍ້ມູນ
        </button>
      </div>
      
      {/* 💳 ບັດສະຫຼຸບຂໍ້ມູນ */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* 1. ຍອດຂາຍມື້ນີ້ */}
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 shadow-sm">
          <p className="text-sm text-blue-600 font-medium">ຍອດຂາຍລວມມື້ນີ້</p>
          <h3 className="text-2xl font-bold text-blue-800 mt-1">
            {Number(stats.totalToday || 0).toLocaleString()} <span className="text-sm font-normal">ກີບ</span>
          </h3>
          <div className="mt-2 text-xs text-gray-600 border-t border-blue-200 pt-2 flex justify-between">
            <span>💵 ເງິນສົດ: <strong className="text-gray-800">{Number(stats.cashToday || 0).toLocaleString()}</strong></span>
            <span>📱 QR: <strong className="text-gray-800">{Number(stats.qrToday || 0).toLocaleString()}</strong></span>
          </div>
        </div>

        {/* 2. ຍອດຂາຍເດືອນນີ້ */}
        <div className="bg-green-50 p-4 rounded-xl border border-green-200 shadow-sm">
          <p className="text-sm text-green-600 font-medium">ຍອດຂາຍເດືອນນີ້</p>
          <h3 className="text-2xl font-bold text-green-800 mt-1">
            {Number(stats.totalMonth || 0).toLocaleString()} <span className="text-sm font-normal">ກີບ</span>
          </h3>
        </div>

        {/* 3. ສິນຄ້າທັງໝົດໃນລະບົບ */}
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-200 shadow-sm">
          <p className="text-sm text-yellow-600 font-medium">ສິນຄ້າທັງໝົດໃນລະບົບ</p>
          <h3 className="text-2xl font-bold text-yellow-800 mt-1">
            {stats.totalProducts || 0} <span className="text-sm font-normal">ລາຍການ</span>
          </h3>
        </div>

        {/* 4. ຈຳນວນບິນມື້ນີ້ */}
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 shadow-sm">
          <p className="text-sm text-purple-600 font-medium">ຈຳນວນບິນມື້ນີ້</p>
          <h3 className="text-2xl font-bold text-purple-800 mt-1">
            {stats.recentOrders ? stats.recentOrders.length : 0} <span className="text-sm font-normal">ບິນ</span>
          </h3>
        </div>
      </div>

      {/* 📅 ส่วนกรองข้อมูลตามช่วงเวลา (Filter by Date) */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-sm font-semibold text-gray-700">📅 ເລືອກຊ່ວງວັນທີ:</span>
          <input 
            type="date" 
            value={startDate} 
            onChange={(e) => setStartDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
          />
          <span className="text-gray-500">ເຖິງ</span>
          <input 
            type="date" 
            value={endDate} 
            onChange={(e) => setEndDate(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm bg-white"
          />
          {(startDate || endDate) && (
            <button 
              onClick={() => { setStartDate(''); setEndDate(''); }}
              className="text-xs text-red-500 hover:underline ml-2"
            >
              ລ້າງຄ່າ
            </button>
          )}
        </div>
        <div className="text-sm font-bold text-gray-800">
          ຍອດຂາຍຕາມຊ່ວງເວລາທີ່ເລືອກ: <span className="text-green-600">{filterTotalRevenue.toLocaleString()} ກີບ</span> ({filteredOrders.length} ບິນ)
        </div>
      </div>

      {/* 📈 กราฟแสดงยอดขาย 7 วันย้อนหลัง */}
      <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
        <h3 className="text-md font-bold text-gray-800 mb-4">📈 ກຣາຟສະແດງຍອດຂາຍ 7 ວັນຍອນຫຼັງ</h3>
        <div className="h-64 flex items-center justify-center">
          {loading ? (
            <p className="text-gray-400">ກຳລັງໂຫຼດກຣາຟ...</p>
          ) : (
            <Bar data={chartData} options={chartOptions} />
          )}
        </div>
      </div>

      {/* 🏆 สินค้าขายดี Top 5 & ประวัติการขายล่าสุด */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* สินค้าขายดี */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-md font-bold text-gray-800 mb-3">🏆 ສິນຄ້າຂາຍດີ (Top 5)</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">ຊື່ສິນຄ້າ</th>
                  <th className="px-3 py-2 text-center font-medium text-gray-500">ຈຳນວນຂາຍ</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">ລາຍຮັບລວມ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {topProducts.length > 0 ? (
                  topProducts.map((prod, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-medium text-gray-800">{prod.name}</td>
                      <td className="px-3 py-2 text-center text-blue-600 font-semibold">{prod.quantity}</td>
                      <td className="px-3 py-2 text-right text-green-600 font-semibold">{prod.revenue.toLocaleString()} ກີບ</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="3" className="px-3 py-4 text-center text-gray-400">ຍັງບໍ່ມີຂໍ້ມູນການຂາຍໃນຊ່ວງເວລານີ້</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ⏱️ ປະຫວັດການຂາຍຫຼ້າສຸດ */}
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-md font-bold text-gray-800 mb-3">⏱️ ປະຫວັດການຂາຍຫຼ້າສຸດ</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">ລະຫັດບິນ</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-500">ວິທີຊຳລະ</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">ລາຄາລວມ</th>
                  <th className="px-3 py-2 text-right font-medium text-gray-500">ວັນເວລາ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stats.recentOrders && stats.recentOrders.length > 0 ? (
                  stats.recentOrders.map((order) => {
                    const rawMethod = (order.paymentMethod || order.payment || order.type || 'Cash').toString().toLowerCase();
                    const isQR = rawMethod.includes('qr') || rawMethod.includes('transfer') || rawMethod.includes('scan');

                    return (
                      <tr key={order._id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-medium text-gray-800">#{order._id.slice(-6)}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${isQR ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                            {isQR ? '📱 QR' : '💵 ເງິນສົດ'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-green-600">
                          {Number(order.totalAmount).toLocaleString()} ກີບ
                        </td>
                        <td className="px-3 py-2 text-right text-gray-500 text-xs">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan="4" className="px-3 py-4 text-center text-gray-400">ຍັງບໍ່ມີປະຫວັດການຂາຍ</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}