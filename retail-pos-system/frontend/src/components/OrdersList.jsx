import { useState, useEffect } from 'react';
import { API_BASE_URL, authHeaders, fetchArray } from '../api';

export default function OrdersList() {
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null); // ສຳລັບເບິ່ງລາຍລະອຽດບິນ

  // 🔍 State ສຳລັບຄົ້ນຫາ ແລະ ກັ່ນຕອງວັນທີ
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchOrders = async () => {
    const data = await fetchArray(`${API_BASE_URL}/api/orders`);
    setOrders(data);
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleDeleteOrder = async (id) => {
    if (window.confirm('ທ່ານຕ້ອງການລຶບ/ຍົກເລີກບິນນີ້ແທ້ບໍ? ສະຕັອກສິນຄ້າໃນບິນນີ້ຈະຖືກຄືນກັບໄປໃນສາງອັດຕະໂນມັດ')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/orders/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) {
          fetchOrders();
          setSelectedOrder(null);
          alert('ລຶບບິນສຳເລັດແລ້ວ — ສະຕັອກສິນຄ້າຖືກຄືນກັບໄປໃນສາງແລ້ວ');
        }
      } catch (err) {
        console.error('Error deleting order:', err);
      }
    }
  };

  // 🔍 กรองรายการออร์เดอร์ (Search ID + Date Filter)
  const filteredOrders = orders.filter((order) => {
    const orderIdStr = order._id ? order._id.toString().toLowerCase() : '';
    const shortId = orderIdStr.slice(-6);
    const query = searchQuery.toLowerCase().trim();

    // 1. เงื่อนไขการค้นหาข้อความ (รหัสบิลเต็ม หรือ 6 ตัวท้าย)
    const matchesSearch = query === '' || orderIdStr.includes(query) || shortId.includes(query);

    // 2. เงื่อนไขช่วงวันที่ (Date Range Filter)
    if (!startDate && !endDate) return matchesSearch;
    
    const orderDate = new Date(order.createdAt).toISOString().slice(0, 10);
    let matchesDate = true;

    if (startDate && endDate) {
      matchesDate = orderDate >= startDate && orderDate <= endDate;
    } else if (startDate) {
      matchesDate = orderDate >= startDate;
    } else if (endDate) {
      matchesDate = orderDate <= endDate;
    }

    return matchesSearch && matchesDate;
  });

  return (
    <div className="bg-white p-6 rounded-xl shadow-md space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b pb-4">
        <h2 className="text-xl font-bold text-gray-800">📋 ປະຫວັດການຂາຍ ແລະ ບິນທັງໝົດ</h2>
        <button 
          onClick={fetchOrders}
          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-sm font-medium transition flex items-center gap-1"
        >
          🔄 ຣີເຟຣດຂໍ້ມູນ
        </button>
      </div>

      {/* 🔍 ໂຊນຄົ້ນຫາ ແລະ ກັ່ນຕອງວັນທີ */}
      <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex flex-col md:flex-row justify-between items-center gap-4">
        {/* ຊ່ອງຄົ້ນຫາລະຫັດບິນ */}
        <div className="w-full md:w-72">
          <input 
            type="text"
            placeholder="🔍 ຄົ້ນຫາດ້ວຍລະຫັດບິນ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* ຊ່ອງເລືອກຊ່ວງວັນທີ */}
        <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
          <span className="text-sm font-semibold text-gray-700">📅 ວັນທີ:</span>
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
          {(searchQuery || startDate || endDate) && (
            <button 
              onClick={() => { setSearchQuery(''); setStartDate(''); setEndDate(''); }}
              className="text-xs text-red-500 hover:underline ml-2 font-medium"
            >
              ລ້າງຄ່າ
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ລະຫັດບິນ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ຈຳນວນສິນຄ້າ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ຍອດເງິນລວມ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ວັນທີ-ເວລາ</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ຈັດການ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredOrders.length > 0 ? (
              filteredOrders.map((order) => (
                <tr key={order._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">#{order._id.slice(-6)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {order.items ? order.items.reduce((sum, item) => sum + item.quantity, 0) : 0} ລາຍການ
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-green-600">
                    {Number(order.totalAmount).toLocaleString()} ກີບ
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(order.createdAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-center space-x-2">
                    <button
                      onClick={() => setSelectedOrder(order)}
                      className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600 text-xs font-medium"
                    >
                      ເບິ່ງໃບເສັດ
                    </button>
                    <button
                      onClick={() => handleDeleteOrder(order._id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 text-xs font-medium"
                    >
                      ລຶບ
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="5" className="px-4 py-6 text-center text-sm text-gray-500">
                  ບໍ່ພົບຂໍ້ມູນປະຫວັດການຂາຍຕາມເງື່ອນໄຂທີ່ຄົ້ນຫາ
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal ສະແດງລາຍລະອຽດໃບເສັດ */}
      {selectedOrder && (() => {
        const empIdRaw = selectedOrder.employeeId || selectedOrder.cashierId || selectedOrder.empId || 'EMP-01';
        const empStr = typeof empIdRaw === 'object' ? empIdRaw.toString() : String(empIdRaw);
        const displayEmpId = empStr.length > 10 ? `#${empStr.slice(-5)}` : empStr;

        // 🔍 ປັບປຸງການເຊັກປະເພດການຊຳລະໃຫ້ຮອງຮັບທັງພິມໃຫຍ່/ພິມນ້ອຍ ແລະ ຫຼາຍຊື່ Field
        const rawMethod = (selectedOrder.paymentMethod || selectedOrder.payment || selectedOrder.type || 'Cash').toString().toLowerCase();
        const isQR = rawMethod.includes('qr') || rawMethod.includes('transfer') || rawMethod.includes('scan');

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg space-y-4">
              <div className="flex justify-between items-center border-b pb-3">
                <h3 className="text-lg font-bold text-gray-800">🧾 ລາຍລະອຽດໃບເສັດ</h3>
                <button 
                  onClick={() => setSelectedOrder(null)}
                  className="text-gray-400 hover:text-gray-600 font-bold text-xl"
                >
                  &times;
                </button>
              </div>

              <div className="text-sm text-gray-600 space-y-1">
                <p><strong>ລະຫັດບິນ:</strong> #{selectedOrder._id}</p>
                <p><strong>ວັນທີ:</strong> {new Date(selectedOrder.createdAt).toLocaleString()}</p>
                <p><strong>ລະຫັດພະນັກງານ:</strong> {displayEmpId}</p>
              </div>

              {/* 💳 ส่วนສະແດງວິທີຊຳລະເງິນທີ່ແກ້ໄຂແລ້ວ */}
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm space-y-1">
                <p className="flex justify-between">
                  <span className="text-gray-500">ວິທີຊຳລະ:</span>
                  <span className={`font-semibold ${isQR ? 'text-blue-600' : 'text-green-600'}`}>
                    {isQR ? '📱 ສະແກນ QR Code' : '💵 ເງິນສົດ (Cash)'}
                  </span>
                </p>

                {!isQR && (
                  <>
                    <p className="flex justify-between">
                      <span className="text-gray-500">ຮັບເງິນສົດ:</span>
                      <span className="font-medium">{Number(selectedOrder.cashReceived || 0).toLocaleString()} ກີບ</span>
                    </p>
                    <p className="flex justify-between">
                      <span className="text-gray-500">ເງິນທອນ:</span>
                      <span className="font-medium text-orange-600">{Number(selectedOrder.changeAmount || 0).toLocaleString()} ກີບ</span>
                    </p>
                  </>
                )}
              </div>

              <div className="border-t border-b py-3 max-h-48 overflow-y-auto space-y-2">
                {selectedOrder.items && selectedOrder.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{item.name} (x{item.quantity})</span>
                    <span className="font-medium">{Number(item.price * item.quantity).toLocaleString()} ກີບ</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between items-center font-bold text-base text-gray-800 pt-2">
                <span>ຍອດລວມທັງໝົດ:</span>
                <span className="text-green-600">{Number(selectedOrder.totalAmount).toLocaleString()} ກີບ</span>
              </div>

              <button
                onClick={() => setSelectedOrder(null)}
                className="w-full bg-gray-700 text-white py-2 rounded-lg hover:bg-gray-800 text-sm font-medium"
              >
                ປິດໜ້າຕ່າງ
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}