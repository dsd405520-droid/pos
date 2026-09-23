import { useState, useEffect } from 'react';
import { API_BASE_URL, authHeaders } from '../api';

export default function StockInModal({ isOpen, onClose, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  // ດຶງລາຍຊື່ສິນຄ້າທັງໝົດມາໃສ່ Dropdown
  useEffect(() => {
    if (isOpen) {
      fetch(`${API_BASE_URL}/api/products`, { headers: authHeaders() })
        .then(res => res.json())
        .then(data => setProducts(data))
        .catch(err => console.error('Error loading products:', err));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId || !quantity) {
      alert('ກະລຸນາເລືອກສິນຄ້າ ແລະ ໃສ່ຈຳນວນ');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/stock/in`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          productId: selectedProductId,
          quantity: Number(quantity),
          costPrice: Number(costPrice) || 0,
          note: note
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert('✅ ເພີ່ມ Stock ສຳເລັດແລ້ວ!');
        onSuccess(); // ໂຫຼດຂໍ້ມູນໜ້າຫຼັກໃໝ່
        onClose();   // ປິດ Modal
        setSelectedProductId('');
        setQuantity('');
        setCostPrice('');
        setNote('');
      } else {
        alert('❌ ຜິດພາດ: ' + data.message);
      }
    } catch (err) {
      console.error('Error submitting stock in:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອຕໍ່ກັບ server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-lg space-y-4">
        <div className="flex justify-between items-center border-b pb-3">
          <h3 className="text-lg font-bold text-gray-800">📦 ຮັບສິນຄ້າເຂົ້າສາງ (Stock In)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ເລືອກສິນຄ້າ</label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">-- ກະລຸນາເລືອກສິນຄ້າ --</option>
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} (ຄົງເຫລືອ: {p.stock || 0})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ຈຳນວນທີ່ຮັບເຂົ້າ (+)</label>
            <input
              type="number"
              min="1"
              placeholder="ຕົວຢ່າງ: 50"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ລາຄາຕົ້ນທຶນຕໍ່ໜ່ວຍ (ກີບ)</label>
            <input
              type="number"
              placeholder="ຕົວຢ່າງ: 15000"
              value={costPrice}
              onChange={(e) => setCostPrice(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ໝາຍເຫດ / ຜູ້ Supplier</label>
            <input
              type="text"
              placeholder="ຕົວຢ່າງ: ຮັບຈາກບໍລິສັດ A ປະຈຳວັນ..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-gray-200 text-gray-700 py-2 rounded-lg hover:bg-gray-300 text-sm font-medium"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              {loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ Stock In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}