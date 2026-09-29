import { useState, useEffect, useCallback } from 'react';
import EmployeeManagement from './EmployeeManagement';
import { API_BASE_URL, authHeaders, resolveImageUrl, fetchArray } from '../api';

// 📦 Stock In Modal Component (ຂະຫຍາຍ Modal ໃຫ້ໃຫຍ່ຂຶ້ນ)
function StockInModal({ isOpen, onClose, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [searchTerm, setSearchTerm] = useState(''); 
  const [quantity, setQuantity] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  // 🥩 ສຳລັບສິນຄ້າສົດ (ຊື້ເປັນກິໂລ ແບ່ງແພັກ): ຮັບເຂົ້າແຕ່ລະຮອບ
  const [kgBought, setKgBought] = useState('');
  const [costPerKg, setCostPerKg] = useState('');
  const [packsMade, setPacksMade] = useState('');
  const [expiryDate, setExpiryDate] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchArray(`${API_BASE_URL}/api/products`).then(data => setProducts(data));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // 🔍 ກອງລາຍການສິນຄ້າຕາມຊື່ ຫຼື SKU ທີ່ພິມຄົ້ນຫາ
  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const selectedProduct = products.find(p => p._id === selectedProductId);
  const purchaseUnitLabel = selectedProduct?.purchaseUnit || selectedProduct?.unit || 'ຫົວໜ່ວຍໃຫຍ່';
  const saleUnitLabel = selectedProduct?.unit || 'ຫົວໜ່ວຍຍ່ອຍ';
  const conversionRate = Number(selectedProduct?.conversionRate) || 1;
  const totalPiecesPreview = Number(quantity) > 0 ? Number(quantity) * conversionRate : 0;

  // 🥩 ສິນຄ້າສົດ: ຕົ້ນທຶນຕໍ່ແພັກ = (ກິໂລ × ລາຄາຕໍ່ກິໂລ) ÷ ຈຳນວນແພັກທີ່ແບ່ງໄດ້ຈິງ
  const isFreshSelected = selectedProduct?.productType === 'fresh';
  const freshPacks = Math.floor(Number(packsMade)) || 0;
  const freshTotalCost = (Number(kgBought) || 0) * (Number(costPerKg) || 0);
  const freshCostPerPack = freshPacks > 0 ? freshTotalCost / freshPacks : 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProductId || (isFreshSelected ? !(freshPacks > 0 && Number(kgBought) > 0) : !quantity)) {
      alert(isFreshSelected ? 'ກະລຸນາເລືອກສິນຄ້າ ແລະ ໃສ່ ຈຳນວນກິໂລທີ່ຊື້ ກັບ ຈຳນວນແພັກທີ່ແບ່ງໄດ້' : 'ກະລຸນາເລືອກສິນຄ້າ ແລະ ໃສ່ຈຳນວນ');
      return;
    }

    setLoading(true);
    try {
      // ສິນຄ້າສົດ: ສົ່ງເປັນ "ຈຳນວນແພັກ" + "ຕົ້ນທຶນຕໍ່ແພັກ" (conversionRate=1) ແລະ ຈົດຈຳນວນກິໂລທີ່ຊື້ໄວ້ໃນໝາຍເຫດ ເພື່ອກວດຍ້ອນຫຼັງໄດ້
      const payload = isFreshSelected
        ? {
            productId: selectedProductId,
            quantity: freshPacks,
            costPrice: Number(freshCostPerPack.toFixed(2)),
            expiryDate: expiryDate || '',
            note: `${note ? note + ' | ' : ''}ຊື້ ${Number(kgBought)} ກິໂລ @ ${(Number(costPerKg) || 0).toLocaleString()}/ກິໂລ → ແບ່ງໄດ້ ${freshPacks} ${saleUnitLabel}`
          }
        : {
            productId: selectedProductId,
            quantity: Number(quantity),
            costPrice: Number(costPrice) || 0,
            note: note
          };
      const res = await fetch(`${API_BASE_URL}/api/stock/in`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (res.ok) {
        alert('✅ ເພີ່ມ Stock ສຳເລັດແລ້ວ!');
        onSuccess();
        onClose();
        setSelectedProductId('');
        setSearchTerm('');
        setQuantity('');
        setCostPrice('');
        setNote('');
        setKgBought('');
        setCostPerKg('');
        setPacksMade('');
        setExpiryDate('');
      } else {
        alert('❌ ຜິດພາດ: ' + data.message);
      }
    } catch (err) {
      console.error('Error submitting stock in:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50">
      {/* 🟢 ປ່ຽນຈາກ max-w-md ເປັນ max-w-2xl ພ້ອມເພີ່ມ padding ໃຫ້ກວ້າງຂຶ້ນ */}
      <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <h3 className="text-xl font-bold text-gray-800">📦 ຮັບສິນຄ້າເຂົ້າສາງ (Stock In)</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 font-bold text-2xl">&times;</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 🔍 ຊ່ອງຄົ້ນຫາສິນຄ້າ */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">ຄົ້ນຫາສິນຄ້າ (ຊື່ ຫຼື SKU)</label>
            <input
              type="text"
              placeholder="ພິມຊື່ ຫຼື SKU ເພື່ອຄົ້ນຫາ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base mb-3 focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
            <select
              value={selectedProductId}
              onChange={(e) => {
                // 🩹 ລ້າງຈຳນວນ/ລາຄາຕົ້ນທຶນ/ໝາຍເຫດເກົ່າ ທຸກຄັ້ງທີ່ປ່ຽນສິນຄ້າ ກັນພິມສົ່ງຄ່າຂອງສິນຄ້າກ່ອນໜ້າຫຼົງໄປໃສ່ອັນໃໝ່
                setSelectedProductId(e.target.value);
                setQuantity('');
                setCostPrice('');
                setNote('');
                setKgBought('');
                setCostPerKg('');
                setPacksMade('');
                setExpiryDate('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            >
              <option value="">-- ເລືອກສິນຄ້າຈາກຜົນຄົ້ນຫາ ({filteredProducts.length} ລາຍການ) --</option>
              {filteredProducts.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.sku ? `[${p.sku}] ` : ''}{p.name} (ຍັງເຫຼືອ: {p.stock || 0} {p.unit})
                </option>
              ))}
            </select>
          </div>

          {isFreshSelected ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ຈຳນວນທີ່ຊື້ມາ (ກິໂລ)</label>
                <input type="number" min="0" step="0.01" placeholder="ຕົວຢ່າງ: 20.5" value={kgBought} onChange={(e) => setKgBought(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ລາຄາຊື້ (ຕໍ່ 1 ກິໂລ, ກີບ)</label>
                <input type="number" min="0" placeholder="ຕົວຢ່າງ: 60000" value={costPerKg} onChange={(e) => setCostPerKg(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ຈຳນວນ {saleUnitLabel} ທີ່ແບ່ງໄດ້ຈິງ</label>
                <input type="number" min="1" step="1" placeholder="ນັບຫຼັງແບ່ງແພັກແລ້ວ" value={packsMade} onChange={(e) => setPacksMade(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">ຄວນຂາຍພາຍໃນ / ວັນໝົດອາຍຸ (ລອດໃໝ່)</label>
                <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                <p className="text-xs text-gray-400 mt-1">ຖ້າຍັງມີແພັກລອດເກົ່າເຫຼືອຢູ່ ໃຫ້ໃສ່ວັນທີ່ໃກ້ສຸດ (ຂອງເກົ່າ) — ລະບົບເກັບວັນໝົດອາຍຸແຕ່ວັນດຽວຕໍ່ສິນຄ້າ</p>
              </div>
              {freshPacks > 0 && Number(kgBought) > 0 && (
                <p className="md:col-span-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  = ເພີ່ມ <b>{freshPacks.toLocaleString()} {saleUnitLabel}</b> | ຕົ້ນທຶນຮວມ <b>{Math.round(freshTotalCost).toLocaleString()} ກີບ</b> | ຕົ້ນທຶນຕໍ່ {saleUnitLabel} ≈ <b>{Math.round(freshCostPerPack).toLocaleString()} ກີບ</b>
                  {selectedProduct?.expiryDate && expiryDate && <> | ⚠️ ວັນໝົດອາຍຸຈະຖືກປ່ຽນເປັນວັນທີ່ໃໝ່ ຖ້າຍັງມີແພັກລອດເກົ່າ ໃຫ້ໃສ່ວັນທີ່ໃກ້ສຸດແທນ</>}
                </p>
              )}
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ຈຳນວນທີ່ຮັບເຂົ້າ ({purchaseUnitLabel})
              </label>
              <input
                type="number"
                min="1"
                placeholder="ຕົວຢ່າງ: 5"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
                required
              />
              {selectedProduct && (
                <p className="text-xs text-blue-600 mt-1 font-medium">
                  = {totalPiecesPreview.toLocaleString()} {saleUnitLabel} (1 {purchaseUnitLabel} = {conversionRate} {saleUnitLabel})
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ລາຄາຕົ້ນທຶນຕໍ່ 1 {purchaseUnitLabel} (ກີບ)
              </label>
              <input
                type="number"
                placeholder="ຕົວຢ່າງ: 15000"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
              />
            </div>
          </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">ໝາຍເຫດ / ຜູ້ Supplier</label>
            <input
              type="text"
              placeholder="ຕົວຢ່າງ: ຮັບຈາກບໍລິສັດ A..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-base focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 bg-gray-200 text-gray-700 py-3 rounded-xl hover:bg-gray-300 text-base font-semibold transition"
            >
              ຍົກເລີກ
            </button>
            <button
              type="submit"
              disabled={loading}
              className="w-1/2 bg-blue-600 text-white py-3 rounded-xl hover:bg-blue-700 text-base font-semibold transition shadow-md"
            >
              {loading ? 'ກຳລັງບັນທຶກ...' : 'ບັນທຶກ Stock In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminPanel({ onLogout }) {
  const [activeTab, setActiveTab] = useState('products');

  // --- State ສຳລັບຈັດການສິນຄ້າ ---
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [stockLogs, setStockLogs] = useState([]); 
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [form, setForm] = useState({
    sku: '',
    name: '',
    price: '',
    stock: '',
    costPrice: '',
    category: '',
    unit: '',
    purchaseUnit: '',
    conversionRate: 1,
    productType: 'packaged', // 🥩 'packaged' (ສິນຄ້າແພັກເກດ) ຫຼື 'fresh' (ຂອງສົດ — ຊື້ເປັນກິໂລ ແບ່ງແພັກຂາຍເອງ)
    expiryDate: '',          // ສະເພາະສິນຄ້າສົດ — ວັນທີ່ຄວນຂາຍໝົດ/ໝົດອາຍຸ
    // 🥩 ຊ່ອງຊ່ວຍຄິດສຳລັບ "ຊື້ເປັນກິໂລ ແບ່ງແພັກ" (ບໍ່ຖືກບັນທຶກເປັນ field ຂອງສິນຄ້າ, ໃຊ້ຄິດ stock/ຕົ້ນທຶນຕໍ່ແພັກ ຕອນເພີ່ມເທົ່ານັ້ນ)
    kgBought: '',            // ຈຳນວນກິໂລທີ່ຊື້ມາ
    costPerKg: '',           // ລາຄາຊື້ຕໍ່ 1 ກິໂລ
    packsMade: '',           // ຈຳນວນແພັກທີ່ແບ່ງໄດ້ຈິງ (ນັບຫຼັງຕັດແຕ່ງ)
    packGrams: ''            // ນ້ຳໜັກຕໍ່ແພັກ (ກຣາມ) — ໃຊ້ຄາດຄະເນຈຳນວນແພັກເທົ່ານັ້ນ
  });

  // 🧹 ຟອມວ່າງ (ໃຊ້ຕອນບັນທຶກສຳເລັດ ແລະ ຕອນກົດ "ຍົກເລີກ") — ລວມຊ່ອງຂອງສິນຄ້າສົດ ບໍ່ໃຫ້ມີຄ່າ undefined
  const buildEmptyForm = () => ({
    sku: '', name: '', price: '', stock: '', costPrice: '',
    category: categories[0]?.name || 'ທົ່ວໄປ',
    unit: units[0]?.name || 'ອັນ',
    purchaseUnit: units[0]?.name || 'ອັນ',
    conversionRate: 1,
    productType: 'packaged',
    expiryDate: '',
    kgBought: '', costPerKg: '', packsMade: '', packGrams: ''
  });
  
  const [imageType, setImageType] = useState('url'); 
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [isStockInOpen, setIsStockInOpen] = useState(false); 

  const [newCatName, setNewCatName] = useState('');
  const [newUnitName, setNewUnitName] = useState('');

  const fetchProducts = useCallback(async () => {
    const data = await fetchArray(`${API_BASE_URL}/api/products`);
    setProducts(data);
  }, []);

  const fetchCategories = useCallback(async () => {
    const data = await fetchArray(`${API_BASE_URL}/api/categories`);
    setCategories(data);
    if (data.length > 0) {
      setForm(prev => (!prev.category ? { ...prev, category: data[0].name } : prev));
    }
  }, []);

  const fetchUnits = useCallback(async () => {
    const data = await fetchArray(`${API_BASE_URL}/api/units`);
    setUnits(data);
    if (data.length > 0) {
      setForm(prev => (!prev.unit ? { ...prev, unit: data[0].name, purchaseUnit: prev.purchaseUnit || data[0].name } : prev));
    }
  }, []);

  const fetchStockLogs = useCallback(async () => {
    const data = await fetchArray(`${API_BASE_URL}/api/stock/logs`);
    setStockLogs(data);
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchUnits();
    fetchStockLogs();
  }, [fetchProducts, fetchCategories, fetchUnits, fetchStockLogs]);

  // 📏 ລາຍຊື່ໜ່ວຍໃນ dropdown: ຖ້າໜ່ວຍປັດຈຸບັນຂອງສິນຄ້າ (ເຊັ່ນ "ແພັກ", "ກິໂລ") ບໍ່ຢູ່ໃນລາຍການ Units
  // ໃຫ້ເພີ່ມເຂົ້າໄປນຳ — ບໍ່ດັ່ງນັ້ນ <select> ຈະສະແດງແຖວທຳອິດ (ເຊັ່ນ "ຖົງ") ທັງທີ່ຄ່າຈິງເປັນອັນອື່ນ
  const unitNames = (current) => {
    const names = units.map((u) => u.name);
    if (current && !names.includes(current)) names.push(current);
    return names.length > 0 ? names : ['ອັນ'];
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/categories`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: newCatName })
      });
      if (res.ok) {
        setNewCatName('');
        fetchCategories();
        alert('ເພີ່ມໝວດໝູ່ສຳເລັດແລ້ວ');
      } else {
        const errData = await res.json();
        alert(errData.error || 'ບໍ່ສາມາດເພີ່ມໝວດໝູ່ໄດ້');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteCategory = async (id) => {
    if (window.confirm('ຕ້ອງການລຶບໝວດໝູ່ນີ້ແທ້ບໍ?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/categories/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (res.ok) {
          fetchCategories();
          alert('ລຶບໝວດໝູ່ສຳເລັດແລ້ວ');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!newUnitName.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/units`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: newUnitName })
      });
      if (res.ok) {
        setNewUnitName('');
        fetchUnits();
        alert('ເພີ່ມໜ່ວຍນັບສຳເລັດແລ້ວ');
      } else {
        const errData = await res.json();
        alert(errData.error || 'ບໍ່ສາມາດເພີ່ມໜ່ວຍນັບໄດ້');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUnit = async (id) => {
    if (window.confirm('ຕ້ອງການລຶບໜ່ວຍນັບນີ້ແທ້ບໍ?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/units/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (res.ok) {
          fetchUnits();
          alert('ລຶບໜ່ວຍນັບສຳເລັດແລ້ວ');
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isFresh = form.productType === 'fresh';
    const freshCreate = isFresh && !editingId;

    // 🥩 ຂອງສົດແບບ "ຊື້ເປັນກິໂລ ແບ່ງແພັກຂາຍ": ຄິດ stock (ແພັກ) ແລະ ຕົ້ນທຶນຕໍ່ແພັກ ຈາກຂໍ້ມູນການຊື້ຈິງ
    //   ຕົ້ນທຶນຕໍ່ແພັກ = (ກິໂລ × ລາຄາຕໍ່ກິໂລ) ÷ ຈຳນວນແພັກທີ່ແບ່ງໄດ້ຈິງ — ຮວມສ່ວນທີ່ເສຍຕອນຕັດແຕ່ງໄວ້ໃນຕົ້ນທຶນແລ້ວ
    let freshPacks = 0;
    let freshCostPerPack = 0;
    if (freshCreate) {
      const kg = Number(form.kgBought);
      const perKg = Number(form.costPerKg) || 0;
      freshPacks = Math.floor(Number(form.packsMade));
      if (!(kg > 0) || !(freshPacks > 0)) {
        alert('ກະລຸນາໃສ່ ຈຳນວນກິໂລທີ່ຊື້ ແລະ ຈຳນວນແພັກທີ່ແບ່ງໄດ້ (ຕ້ອງຫຼາຍກວ່າ 0)');
        return;
      }
      freshCostPerPack = Number(((kg * perKg) / freshPacks).toFixed(2));
    }

    const formData = new FormData();
    formData.append('sku', form.sku);
    formData.append('name', form.name);
    formData.append('category', form.category || (categories[0]?.name || 'ທົ່ວໄປ'));
    // 🥩 ຂອງສົດຂາຍເປັນ "ແພັກ" (ນ້ຳໜັກຄົງທີ່ ລາຄາຕາຍຕົວ) — ຕອນເພີ່ມໃໝ່ບັງຄັບ unit=ແພັກ, conversionRate=1
    const effectiveUnit = freshCreate ? 'ແພັກ' : (form.unit || (units[0]?.name || 'ອັນ'));
    formData.append('unit', effectiveUnit);
    formData.append('purchaseUnit', isFresh ? effectiveUnit : (form.purchaseUnit || form.unit || (units[0]?.name || 'ອັນ')));
    formData.append('conversionRate', isFresh ? 1 : form.conversionRate);
    formData.append('price', form.price);
    formData.append('productType', form.productType);
    if (isFresh) {
      formData.append('expiryDate', form.expiryDate || '');
    }

    if (editingId) {
      // ✏️ ແກ້ໄຂ — ຄ່າ stock ຄື ຈຳນວນປັດຈຸບັນຕົວຈິງ (ຫົວໜ່ວຍຍ່ອຍ), ແກ້ໄຂໂດຍກົງ
      formData.append('stock', form.stock);
      formData.append('costPrice', form.costPrice);
    } else {
      // ➕ ເພີ່ມໃໝ່ — ຄ່າ stock/costPrice ຄື "ຈຳນວນ/ລາຄານຳເຂົ້າ" ຄັ້ງທຳອິດ (ຫົວໜ່ວຍໃຫຍ່), backend ຈະຄິດໄລ່ອອກເປັນຫົວໜ່ວຍຍ່ອຍໃຫ້ເອງ
      if (freshCreate) {
        formData.append('importQuantity', freshPacks);
        formData.append('importPrice', freshCostPerPack);
      } else {
        formData.append('importQuantity', form.stock);
        formData.append('importPrice', form.costPrice);
      }
    }
    
    if (imageType === 'upload' && imageFile) {
      formData.append('image', imageFile);
    } else if (imageType === 'url' && imageUrl) {
      formData.append('image', imageUrl);
    }

    const url = editingId ? `${API_BASE_URL}/api/products/${editingId}` : `${API_BASE_URL}/api/products`;
    const method = editingId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: authHeaders(), body: formData });
      if (res.ok) {
        fetchProducts();
        setForm(buildEmptyForm());
        setImageFile(null);
        setImageUrl('');
        setImageType('url');
        setEditingId(null);
        alert(editingId ? 'ແກ້ໄຂສິນຄ້າສຳເລັດແລ້ວ' : 'ເພີ່ມສິນຄ້າສຳເລັດແລ້ວ');
      } else {
        const errData = await res.json().catch(() => null);
        // 🩹 ສະແດງເຫດຜົນຈິງທີ່ backend ຕອບກັບມາ ແທນຂໍ້ຄວາມທົ່ວໄປ (ຊ່ວຍໃຫ້ຮູ້ວ່າຕິດຫຍັງແທ້)
        let msg = errData?.error || 'ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກຂໍ້ມູນ';
        if (msg.includes('E11000') || msg.toLowerCase().includes('duplicate')) {
          msg = 'ລະຫັດ SKU ນີ້ຊ້ຳກັບສິນຄ້າອື່ນທີ່ມີຢູ່ແລ້ວ ກະລຸນາປ່ຽນ SKU';
        }
        alert(msg);
      }
    } catch (err) {
      console.error('Error saving product:', err);
    }
  };

  const handleEdit = (product) => {
    setForm({
      sku: product.sku || '',
      name: product.name,
      price: product.price,
      stock: product.stock,
      // 🩹 ແກ້ bug: product.costPrice ໃນຖານຂໍ້ມູນເກັບເປັນ "ຕໍ່ 1 ຫົວໜ່ວຍຍ່ອຍ" ສະເໝີ, ແຕ່ຊ່ອງ
      // "ລາຄານຳເຂົ້າ" ໃນຟອມນີ້ສະແດງເປັນ "ຕໍ່ 1 ຫົວໜ່ວຍໃຫຍ່" — ຕ້ອງຄູນກັບ conversionRate ກັບຄືນກ່ອນ
      // ສະແດງ, ບໍ່ດັ່ງນັ້ນຈະໂຊຄ່າຜິດ (ນ້ອຍເກີນຄວາມເປັນຈິງ) ໃນຟອມແກ້ໄຂ
      costPrice: product.costPrice
        ? Number((product.costPrice * (product.conversionRate || 1)).toFixed(2))
        : '',
      category: product.category || (categories[0]?.name || 'ທົ່ວໄປ'),
      unit: product.unit || (units[0]?.name || 'ອັນ'),
      purchaseUnit: product.purchaseUnit || product.unit || (units[0]?.name || 'ອັນ'),
      conversionRate: product.conversionRate || 1,
      productType: product.productType || 'packaged',
      expiryDate: product.expiryDate ? new Date(product.expiryDate).toISOString().slice(0, 10) : '',
      kgBought: '', costPerKg: '', packsMade: '', packGrams: ''
    });
    setImageType('url');
    setImageUrl(product.image || '');
    setImageFile(null);
    setEditingId(product._id);
  };

  const handleDelete = async (id) => {
    if (window.confirm('ທ່ານຕ້ອງການລຶບສິນຄ້ານີ້ແທ້ບໍ?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/products/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (res.ok) {
          fetchProducts();
          alert('ລຶບສິນຄ້າສຳເລັດແລ້ວ');
        }
      } catch (err) {
        console.error('Error deleting product:', err);
      }
    }
  };

  const filteredProducts = products.filter((product) => {
    const matchesSearch = 
      (product.sku && product.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (product.name && product.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // 🥩 ຄ່າສະຫຼຸບຂອງຟອມແກ້ໄຂສິນຄ້າສົດ (ກຳໄລຕໍ່ແພັກ, % ແລະ ຈຳນວນມື້ກ່ອນໝົດອາຍຸ)
  const freshEditProfit = (Number(form.price) || 0) - (Number(form.costPrice) || 0);
  const freshEditMargin = Number(form.price) > 0 ? Number(((freshEditProfit / Number(form.price)) * 100).toFixed(1)) : 0;
  const freshEditDaysLeft = form.expiryDate
    ? Math.ceil((new Date(form.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* 📌 Sidebar */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-lg">
        <div className="p-5 text-xl font-bold border-b border-slate-800 flex items-center gap-2">
          🛠️ <span>Admin Dashboard</span>
        </div>
        
        <div className="flex-1 p-4 flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('products')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${activeTab === 'products' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            📦 ຈັດການສິນຄ້າ
          </button>

          <button 
            onClick={() => setActiveTab('stockin')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${activeTab === 'stockin' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            📥 ປະຫວັດຮັບສິນຄ້າເຂົ້າ
          </button>

          <button 
            onClick={() => setActiveTab('attributes')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${activeTab === 'attributes' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            🏷️ ຈັດການໝວດໝູ່ ແລະ ໜ່ວຍນັບ
          </button>

          <button 
            onClick={() => setActiveTab('employees')}
            className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${activeTab === 'employees' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            👥 ຈັດການພະນັກງານ
          </button>
        </div>

        {onLogout && (
          <div className="p-4 border-t border-slate-800">
            <button onClick={onLogout} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold transition">
              🚪 ອອກຈາກລະບົບ
            </button>
          </div>
        )}
      </div>

      {/* 🖥️ Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        
        {/* Tab 1: ຈັດການສິນຄ້າ */}
        {activeTab === 'products' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">📦 ຈັດການສິນຄ້າ ແລະ ສະຕັອກ (Mini Mart)</h2>
              <button
                onClick={() => setIsStockInOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-medium flex items-center gap-2 shadow-md transition"
              >
                📦 ຮັບສິນຄ້າເຂົ້າ (Stock In)
              </button>
            </div>

            {/* ຟອມເພີ່ມ/ແກ້ໄຂສິນຄ້າ */}
            <div className="bg-white p-6 rounded-xl shadow-md">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                {editingId ? '✏️ ແກ້ໄຂຂໍ້ມູນສິນຄ້າ' : '➕ ເພີ່ມສິນຄ້າໃໝ່'}
              </h3>

              {/* 🥩 ສະຫຼັບປະເພດສິນຄ້າ — ສະແດງສະເພາະຕອນເພີ່ມໃໝ່ (ບໍ່ໃຫ້ປ່ຽນປະເພດຂອງສິນຄ້າທີ່ມີຢູ່ແລ້ວຕອນແກ້ໄຂ) */}
              {!editingId && (
                <div className="flex gap-2 mb-5 border-b border-gray-200 pb-4">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, productType: 'packaged', unit: units[0]?.name || 'ອັນ', purchaseUnit: units[0]?.name || 'ອັນ', conversionRate: 1 })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${form.productType !== 'fresh' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    📦 ສິນຄ້າແພັກເກດ (Mini Mart)
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, productType: 'fresh', unit: 'ແພັກ', purchaseUnit: 'ແພັກ', conversionRate: 1 })}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${form.productType === 'fresh' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                  >
                    🥩 ຂອງສົດ (ຊີ້ນ/ຜັກ/ອື່ນໆ)
                  </button>
                </div>
              )}
              
              <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">ລະຫັດສິນຄ້າ (SKU)</label>
                  <input type="text" placeholder={!editingId && form.productType === 'fresh' ? 'ປ່ອຍວ່າງໄດ້ (ຈະສ້າງໃຫ້ອັດຕະໂນມັດ)' : 'ລະຫັດ SKU...'} value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                  {!editingId && form.productType === 'fresh' && (
                    <p className="text-xs text-gray-400 mt-1">ລະຫັດນີ້ຄືເລກບາໂຄດທີ່ຕິດແພັກ (POS ຈັບຄູ່ບາໂຄດກັບ SKU) — ປ່ອຍວ່າງໄດ້ ລະບົບຈະສ້າງເລກໃຫ້</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">ຊື່ສິນຄ້າ</label>
                  <input type="text" placeholder={!editingId && form.productType === 'fresh' ? 'ຕົວຢ່າງ: ໝູສາມຊັ້ນແຊ່ແຂງ 500 ກຣາມ' : 'ຊື່ສິນຄ້າ...'} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">ໝວດໝູ່</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white">
                    {categories.length > 0 ? categories.map((cat) => <option key={cat._id} value={cat.name}>{cat.name}</option>) : <option value="ທົ່ວໄປ">ທົ່ວໄປ</option>}
                  </select>
                  {!editingId && form.productType === 'fresh' && (
                    <p className="text-xs text-gray-400 mt-1">ຖ້າຍັງບໍ່ມີໝວດ "ຊີ້ນສົດ"/"ຜັກສົດ" ໄປເພີ່ມກ່ອນທີ່ແຖບ "ຈັດການໝວດໝູ່"</p>
                  )}
                </div>

                {!editingId && form.productType === 'fresh' ? (
                  // 🥩 ໂໝດເພີ່ມສິນຄ້າສົດ — "ຊື້ເປັນກິໂລ ແບ່ງແພັກຂາຍເອງ": ຂາຍເປັນ ແພັກ ນ້ຳໜັກຄົງທີ່ ລາຄາຕາຍຕົວ (ສະແກນບາໂຄດ ຄືສິນຄ້າແພັກເກດ)
                  // ຕົ້ນທຶນຕໍ່ແພັກ ຄິດຈາກ (ກິໂລ × ລາຄາຕໍ່ກິໂລ) ÷ ຈຳນວນແພັກທີ່ແບ່ງໄດ້ຈິງ — ຮວມສ່ວນທີ່ເສຍຕອນຕັດແຕ່ງແລ້ວ
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຈຳນວນທີ່ຊື້ມາ (ກິໂລ)</label>
                      <input type="number" min="0" step="0.01" placeholder="ຕົວຢ່າງ: 20.5" value={form.kgBought} onChange={(e) => setForm({ ...form, kgBought: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ລາຄາຊື້ (ຕໍ່ 1 ກິໂລ)</label>
                      <input type="number" min="0" placeholder="ຕົວຢ່າງ: 60000" value={form.costPerKg} onChange={(e) => setForm({ ...form, costPerKg: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ນ້ຳໜັກຕໍ່ແພັກ (ກຣາມ)</label>
                      <input type="number" min="0" placeholder="ຕົວຢ່າງ: 500" value={form.packGrams} onChange={(e) => setForm({ ...form, packGrams: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                      {Number(form.kgBought) > 0 && Number(form.packGrams) > 0 && (
                        <p className="text-xs text-gray-400 mt-1">ຄາດວ່າໄດ້ປະມານ {Math.floor((Number(form.kgBought) * 1000) / Number(form.packGrams))} ແພັກ (ກ່ອນຫັກສ່ວນທີ່ເສຍຕອນຕັດແຕ່ງ)</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຈຳນວນແພັກທີ່ແບ່ງໄດ້ຈິງ</label>
                      <input type="number" min="1" step="1" placeholder="ນັບຫຼັງແບ່ງແພັກແລ້ວ" value={form.packsMade} onChange={(e) => setForm({ ...form, packsMade: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                      <p className="text-xs text-gray-400 mt-1">ນັບແພັກທີ່ແບ່ງໄດ້ຈິງ ຈະກາຍເປັນສະຕັອກເລີ່ມຕົ້ນ</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ລາຄາຂາຍ (ຕໍ່ 1 ແພັກ)</label>
                      <input type="number" min="0" placeholder="ຕົວຢ່າງ: 35000" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຄວນຂາຍພາຍໃນ / ວັນໝົດອາຍຸ</label>
                      <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                      <p className="text-xs text-gray-400 mt-1">ໃສ່ວັນທີ່ໄວ້ ລະບົບຈະສະແດງປ້າຍເຕືອນຕອນໃກ້ໝົດອາຍຸ</p>
                    </div>

                    {Number(form.kgBought) > 0 && Number(form.packsMade) > 0 && (
                      <div className="lg:col-span-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
                        <div>
                          ➡️ ຈະໄດ້ສະຕັອກ = <b>{Math.floor(Number(form.packsMade))} ແພັກ</b>
                          {' '}| ຕົ້ນທຶນຮວມ = <b>{Math.round(Number(form.kgBought) * (Number(form.costPerKg) || 0)).toLocaleString()} ກີບ</b>
                          {' '}| ຕົ້ນທຶນຕໍ່ແພັກ ≈ <b>{Math.round((Number(form.kgBought) * (Number(form.costPerKg) || 0)) / Math.floor(Number(form.packsMade))).toLocaleString()} ກີບ</b>
                        </div>
                        {Number(form.price) > 0 && (
                          <div>
                            💰 ກຳໄລຕໍ່ແພັກ ≈ <b>{Math.round(Number(form.price) - (Number(form.kgBought) * (Number(form.costPerKg) || 0)) / Math.floor(Number(form.packsMade))).toLocaleString()} ກີບ</b>
                          </div>
                        )}
                        {Number(form.packGrams) > 0 && (
                          <div>
                            ⚖️ ໄດ້ຜົນ (yield) ≈ <b>{Math.round((Math.floor(Number(form.packsMade)) * Number(form.packGrams)) / (Number(form.kgBought) * 10))}%</b> ຂອງນ້ຳໜັກທີ່ຊື້ (ສ່ວນທີ່ເຫຼືອແມ່ນເສຍຕອນຕັດແຕ່ງ)
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : !editingId ? (
                  // ➕ ໂໝດເພີ່ມສິນຄ້າໃໝ່ — ພິມຂໍ້ມູນ "ນຳເຂົ້າ" ຄັ້ງທຳອິດ, ລະບົບຄິດໄລ່ stock+ຕົ້ນທຶນ/ໜ່ວຍໃຫ້ເອງ
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຈຳນວນນຳເຂົ້າ</label>
                      <input type="number" min="0" placeholder="ຕົວຢ່າງ: 10" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຊື່ຫົວໜ່ວຍໃຫຍ່ (ນຳເຂົ້າ)</label>
                      <select value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white">
                        {unitNames(form.purchaseUnit).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">ຫົວໜ່ວຍທີ່ຊື້ເຂົ້າຮ້ານ ເຊັ່ນ ແພັກ, ແກັດ, ລັງ</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        ລາຄານຳເຂົ້າ (ຕໍ່ 1 {form.purchaseUnit || 'ຫົວໜ່ວຍໃຫຍ່'})
                      </label>
                      <input type="number" min="0" placeholder="ຕົວຢ່າງ: 24000" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        ຈຳນວນການຂາຍຍ່ອຍ (1 {form.purchaseUnit || '...'} ໄດ້ຈັກ...)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="ນັບເອງ ຕົວຢ່າງ: 6"
                        value={form.conversionRate}
                        onChange={(e) => setForm({ ...form, conversionRate: Number(e.target.value) })}
                        className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1">ໃຫ້ພະນັກງານແກະເບິ່ງ ແລ້ວນັບເອງ ຕົວຢ່າງ 1 ແພັກ ໄດ້ 6 ຕຸກ → ພິມ 6</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ໜ່ວຍການຂາຍຍ່ອຍ (ໜ້າຮ້ານ)</label>
                      <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white">
                        {unitNames(form.unit).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ລາຄາຂາຍຍ່ອຍ (ຕໍ່ 1 {form.unit || 'ໜ່ວຍ'})</label>
                      <input type="number" placeholder="ລາຄາ..." value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                    </div>

                    {Number(form.conversionRate) > 0 && Number(form.stock) > 0 && (
                      <div className="lg:col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                        ➡️ ຈະໄດ້ສະຕັອກເລີ່ມຕົ້ນ = {form.stock} × {form.conversionRate} = <b>{Number(form.stock) * Number(form.conversionRate)} {form.unit || ''}</b>
                        {Number(form.costPrice) > 0 && Number(form.conversionRate) > 0 && (
                          <> | ຕົ້ນທຶນຕໍ່ {form.unit || 'ໜ່ວຍ'} ≈ <b>{Number((form.costPrice / form.conversionRate).toFixed(0)).toLocaleString()} ກີບ</b></>
                        )}
                      </div>
                    )}
                  </>
                ) : form.productType === 'fresh' ? (
                  // 🥩 ໂໝດແກ້ໄຂສິນຄ້າສົດ — ຟອມແຍກ: ໜ່ວຍຂາຍຄົງທີ່ (ບໍ່ໃຫ້ເລືອກ), ບໍ່ມີ "ຫົວໜ່ວຍໃຫຍ່/ອັດຕາການແປງ"
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ໜ່ວຍຂາຍ</label>
                      <div className="w-full border border-gray-200 bg-gray-50 p-2 rounded-lg text-sm font-semibold text-gray-700">🥩 {form.unit || 'ແພັກ'} (ຄົງທີ່)</div>
                      <p className="text-xs text-gray-400 mt-1">ສິນຄ້າສົດຂາຍເປັນ {form.unit || 'ແພັກ'} ນ້ຳໜັກຄົງທີ່ ລາຄາຕາຍຕົວ — ບໍ່ຕ້ອງເລືອກໜ່ວຍ</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຈຳນວນໃນສະຕັອກ ({form.unit || 'ແພັກ'})</label>
                      <input type="number" min="0" step={form.unit === 'ແພັກ' ? '1' : 'any'} placeholder="ຕົວຢ່າງ: 19" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                      <p className="text-xs text-gray-400 mt-1">ແກ້ໄຂໂດຍກົງ (ເຊັ່ນ ນັບສະຕັອກຈິງ) — ຮັບຂອງລອດໃໝ່ ໃຫ້ໃຊ້ປຸ່ມ "📦 ຮັບສິນຄ້າເຂົ້າ" ເພື່ອໃຫ້ມີປະຫວັດ</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຕົ້ນທຶນ (ຕໍ່ 1 {form.unit || 'ແພັກ'})</label>
                      <input type="number" min="0" step="any" placeholder="ຕົວຢ່າງ: 17000" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ລາຄາຂາຍ (ຕໍ່ 1 {form.unit || 'ແພັກ'})</label>
                      <input type="number" min="0" step="any" placeholder="ຕົວຢ່າງ: 25000" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຄວນຂາຍພາຍໃນ / ວັນໝົດອາຍຸ</label>
                      <input type="date" value={form.expiryDate} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                      <p className="text-xs text-gray-400 mt-1">ປ່ຽນວັນທີ່ນີ້ ເມື່ອມີການຮັບຂອງລອດໃໝ່ (ແກ້ໄຂລາຄາ/ຊື່ ບໍ່ກະທົບວັນຮັບເຂົ້າ)</p>
                    </div>

                    {/* 📊 ສະຫຼຸບ: ກຳໄລ + ມູນຄ່າສະຕັອກ + ສະຖານະວັນໝົດອາຍຸ */}
                    {(Number(form.price) > 0 || form.expiryDate) && (
                      <div className="lg:col-span-3 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
                        {Number(form.price) > 0 && Number(form.costPrice) > 0 && (
                          <div>
                            💰 ກຳໄລຕໍ່ {form.unit || 'ແພັກ'} = <b className={freshEditProfit < 0 ? 'text-red-700' : ''}>{Math.round(freshEditProfit).toLocaleString()} ກີບ</b> ({freshEditMargin}%)
                            {freshEditProfit < 0 && <span className="font-semibold"> — ຂາຍຂາດທຶນ</span>}
                          </div>
                        )}
                        {Number(form.stock) > 0 && Number(form.costPrice) > 0 && (
                          <div>
                            📦 ມູນຄ່າສະຕັອກ: ຕາມຕົ້ນທຶນ <b>{Math.round(Number(form.stock) * Number(form.costPrice)).toLocaleString()} ກີບ</b>
                            {Number(form.price) > 0 && <> | ຖ້າຂາຍໝົດ <b>{Math.round(Number(form.stock) * Number(form.price)).toLocaleString()} ກີບ</b></>}
                          </div>
                        )}
                        {freshEditDaysLeft !== null && (
                          <div className={freshEditDaysLeft < 0 ? 'font-bold text-red-700' : ''}>
                            {freshEditDaysLeft < 0
                              ? '⚠️ ໝົດອາຍຸແລ້ວ — ບໍ່ຄວນຂາຍ'
                              : freshEditDaysLeft <= 1
                                ? '⚠️ ໝົດອາຍຸມື້ນີ້/ມື້ອື່ນ'
                                : freshEditDaysLeft <= 3
                                  ? `⏳ ເຫຼືອ ${freshEditDaysLeft} ມື້ກ່ອນໝົດອາຍຸ`
                                  : `📅 ເຫຼືອ ${freshEditDaysLeft} ມື້ກ່ອນໝົດອາຍຸ`}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (
                  // ✏️ ໂໝດແກ້ໄຂ — ຮຽງລຳດັບ ແລະ ໃຊ້ Label ດຽວກັນກັບຟອມເພີ່ມສິນຄ້າໃໝ່ (ຂ້າງເທິງ) ເພື່ອບໍ່ໃຫ້ສັບສົນ,
                  // ຄ່າຕ່າງໆແກ້ໄຂໂດຍກົງ (ບໍ່ນັບເປັນການນຳເຂົ້າໃໝ່) ແລະ ເພີ່ມຊ່ອງລາຄາຕົ້ນທຶນທີ່ເຄີຍຂາດໄປ
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຈຳນວນໃນສະຕັອກ (ຫົວໜ່ວຍຍ່ອຍ)</label>
                      <input type="number" min="0" step="any" placeholder="ຕົວຢ່າງ: 10" value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                      <p className="text-xs text-gray-400 mt-1">ຈຳນວນ ຫົວໜ່ວຍຍ່ອຍ ໃນສະຕັອກປັດຈຸບັນ — ແກ້ໄຂຄ່ານີ້ໂດຍກົງ (ບໍ່ຄິດໄລ່ຈາກ ຈຳນວນນຳເຂົ້າ × ອັດຕາການແປງ ຄືຕອນເພີ່ມສິນຄ້າໃໝ່)</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ຊື່ຫົວໜ່ວຍໃຫຍ່ (ນຳເຂົ້າ)</label>
                      <select value={form.purchaseUnit} onChange={(e) => setForm({ ...form, purchaseUnit: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white">
                        {unitNames(form.purchaseUnit).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <p className="text-xs text-gray-400 mt-1">ຫົວໜ່ວຍທີ່ຊື້ເຂົ້າຮ້ານ ເຊັ່ນ ແພັກ, ແກັດ, ລັງ</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        ລາຄານຳເຂົ້າ (ຕໍ່ 1 {form.purchaseUnit || 'ຫົວໜ່ວຍໃຫຍ່'})
                      </label>
                      <input type="number" min="0" step="any" placeholder="ຕົວຢ່າງ: 24000" value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">
                        ຈຳນວນການຂາຍຍ່ອຍ (1 {form.purchaseUnit || '...'} ໄດ້ຈັກ...)
                      </label>
                      <input
                        type="number"
                        min="1"
                        placeholder="ນັບເອງ ຕົວຢ່າງ: 6"
                        value={form.conversionRate}
                        onChange={(e) => setForm({ ...form, conversionRate: Number(e.target.value) })}
                        className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                        required
                      />
                      <p className="text-xs text-gray-400 mt-1">ໃຫ້ພະນັກງານແກະເບິ່ງ ແລ້ວນັບເອງ ຕົວຢ່າງ 1 ແພັກ ໄດ້ 6 ຕຸກ → ພິມ 6</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ໜ່ວຍການຂາຍຍ່ອຍ (ໜ້າຮ້ານ)</label>
                      <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white">
                        {unitNames(form.unit).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-1">ລາຄາຂາຍຍ່ອຍ (ຕໍ່ 1 {form.unit || 'ໜ່ວຍ'})</label>
                      <input type="number" placeholder="ລາຄາ..." value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
                    </div>

                    {Number(form.conversionRate) > 0 && Number(form.stock) > 0 && (
                      <div className="lg:col-span-3 bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                        ➡️ ສະຕັອກປັດຈຸບັນ = <b>{form.stock} {form.unit || ''}</b>
                        {' '}(≈ {Math.floor(Number(form.stock) / Number(form.conversionRate))} {form.purchaseUnit || ''}
                        {Number(form.stock) % Number(form.conversionRate) > 0 && ` + ${Number(form.stock) % Number(form.conversionRate)} ${form.unit || ''}`})
                        {Number(form.costPrice) > 0 && Number(form.conversionRate) > 0 && (
                          <> | ຕົ້ນທຶນຕໍ່ {form.unit || 'ໜ່ວຍ'} ≈ <b>{Number((form.costPrice / form.conversionRate).toFixed(0)).toLocaleString()} ກີບ</b></>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-medium text-gray-600 mb-2">ວິທີການເພີ່ມຮູບພາບ</label>
                  <div className="flex gap-6 mb-2">
                    <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                      <input type="radio" name="imageType" checked={imageType === 'url'} onChange={() => setImageType('url')} className="mr-2" />
                      <span>ໃສ່ລິ້ງ URL (ຮູບຈາກອິນເຕີເນັດ)</span>
                    </label>
                    <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                      <input type="radio" name="imageType" checked={imageType === 'upload'} onChange={() => setImageType('upload')} className="mr-2" />
                      <span>ອັບໂຫຼດໄຟລ໌ (ຈາກເຄື່ອງ)</span>
                    </label>
                  </div>
                  {imageType === 'upload' ? (
                    <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} className="w-full border border-gray-300 p-1.5 rounded-lg text-sm bg-white" />
                  ) : (
                    <input type="text" placeholder="ວາງລິ້ງຮູບພາບທີ່ນີ້ (https://...)" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
                  )}
                </div>

                <div className="md:col-span-2 lg:col-span-3 flex space-x-2">
                  <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm transition">
                    {editingId ? '💾 ບັນທຶກການແກ້ໄຂ' : '+ ບັນທຶກເພີ່ມສິນຄ້າ'}
                  </button>
                  {editingId && (
                    <button type="button" onClick={() => { setEditingId(null); setForm(buildEmptyForm()); setImageFile(null); setImageUrl(''); setImageType('url'); }} className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 font-medium text-sm transition">
                      ຍົກເລີກ
                    </button>
                  )}
                </div>
              </form>
            </div>

            {/* ຕາຕະລາງສະແດງສິນຄ້າ */}
            <div className="bg-white p-4 rounded-xl shadow-md flex flex-col md:flex-row gap-4 justify-between items-center">
              <input type="text" placeholder="🔍 ຄົ້ນຫາດ້ວຍ ລະຫັດ SKU ຫລື ຊື່ສິນຄ້າ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full md:w-1/2 border border-gray-300 p-2.5 rounded-lg text-sm" />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full md:w-1/3 border border-gray-300 p-2.5 rounded-lg text-sm">
                <option value="all">ທຸກໝວດໝູ່</option>
                {categories.map((cat) => <option key={cat._id} value={cat.name}>{cat.name}</option>)}
              </select>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ຮູບ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ລະຫັດ (SKU)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ຊື່ສິນຄ້າ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ໝວດໝູ່</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ລາຄາ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ສະຕັອກ</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ຈັດການ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((p) => (
                      <tr key={p._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <img src={resolveImageUrl(p.image)} alt={p.name} className="w-10 h-10 object-cover rounded-md border" />
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">{p.sku || `#${p._id.slice(-6)}`}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {p.name}
                          {p.productType === 'fresh' && (
                            <div className="mt-1">
                              <span className="inline-block bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-md font-semibold mr-1">🥩 ຂອງສົດ</span>
                              {p.expiryDate && (() => {
                                const daysLeft = Math.ceil((new Date(p.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
                                if (daysLeft < 0) return <span className="inline-block bg-red-600 text-white text-xs px-2 py-0.5 rounded-md font-semibold">⚠️ ໝົດອາຍຸແລ້ວ</span>;
                                if (daysLeft <= 1) return <span className="inline-block bg-orange-500 text-white text-xs px-2 py-0.5 rounded-md font-semibold">⚠️ ໝົດອາຍຸມື້ນີ້/ມື້ອື່ນ</span>;
                                if (daysLeft <= 3) return <span className="inline-block bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-md font-semibold">ເຫຼືອ {daysLeft} ມື້</span>;
                                return <span className="text-xs text-gray-400">ໝົດອາຍຸ {new Date(p.expiryDate).toLocaleDateString('lo-LA')}</span>;
                              })()}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{p.category}</td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">{Number(p.price).toLocaleString()} ກີບ</td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                          {p.stock} {p.unit}
                          {Number(p.conversionRate) > 1 && (
                            <div className="text-xs text-gray-400 font-normal mt-0.5">
                              ≈ {Math.floor((p.stock || 0) / p.conversionRate)} {p.purchaseUnit || p.unit}
                              {((p.stock || 0) % p.conversionRate) > 0 && ` + ${(p.stock || 0) % p.conversionRate} ${p.unit}`}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-800 mr-3 font-medium">ແກ້ໄຂ</button>
                          <button onClick={() => handleDelete(p._id)} className="text-red-600 hover:text-red-800 font-medium">ລຶບ</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="7" className="px-4 py-6 text-center text-sm text-gray-500">ບໍ່ພົບຂໍ້ມູນສິນຄ້າ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 2: 📥 ປະຫວັດການຮັບສິນຄ້າເຂົ້າ (Stock In History) */}
        {activeTab === 'stockin' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-800">📥 ປະຫວັດການຮັບສິນຄ້າເຂົ້າສາງ (Stock In History)</h2>
              <button
                onClick={() => setIsStockInOpen(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-medium shadow-md transition"
              >
                + ຮັບສິນຄ້າເຂົ້າເພີ່ມ
              </button>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ວັນທີ/ເວລາ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ລະຫັດ (SKU)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ຊື່ສິນຄ້າ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ຈຳນວນທີ່ຮັບ (+)</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ລາຄາຕົ້ນທຶນ</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ໝາຍເຫດ</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stockLogs.length > 0 ? (
                    stockLogs.map((log) => (
                      <tr key={log._id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(log.createdAt).toLocaleString('lo-LA')}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-blue-600">
                          {log.productId?.sku || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                          {log.productId?.name || 'ສິນຄ້າຖືກລຶບ'}
                        </td>
                        <td className="px-4 py-3 text-sm font-bold text-green-600">
                          {log.purchaseQuantity ? (
                            <>+{log.purchaseQuantity} {log.purchaseUnit || ''} <span className="text-gray-400 font-normal">(= {log.quantity} {log.productId?.unit || ''})</span></>
                          ) : (
                            <>+{log.quantity}</>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">
                          {Number(log.costPrice).toLocaleString()} ກີບ
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {log.note}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr><td colSpan="6" className="px-4 py-6 text-center text-sm text-gray-500">ຍັງບໍ່ມີປະຫວັດການຮັບສິນຄ້າເຂົ້າ</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: 🏷️ ຈັດການໝວດໝູ່ ແລະ ໜ່ວຍນັບ */}
        {activeTab === 'attributes' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-800">🏷️ ຈັດການໝວດໝູ່ ແລະ ໜ່ວຍນັບສິນຄ້າ</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">📂 ຈັດການໝວດໝູ່ສິນຄ້າ</h3>
                <form onSubmit={handleAddCategory} className="flex gap-2">
                  <input type="text" placeholder="ຊື່ໝວດໝູ່ໃໝ່..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} className="flex-1 border border-gray-300 p-2 rounded-lg text-sm" required />
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">ເພີ່ມ</button>
                </form>
                <ul className="divide-y divide-gray-200 mt-4 max-h-60 overflow-y-auto">
                  {categories.map((cat) => (
                    <li key={cat._id} className="py-2 flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-800">{cat.name}</span>
                      <button onClick={() => handleDeleteCategory(cat._id)} className="text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 px-2 py-1 rounded">ລຶບ</button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-md space-y-4">
                <h3 className="text-lg font-semibold text-gray-700">📏 ຈັດການໜ່ວຍນັບສິນຄ້າ</h3>
                <form onSubmit={handleAddUnit} className="flex gap-2">
                  <input type="text" placeholder="ຊື່ໜ່ວຍນັບໃໝ່ (ເຊັ່ນ: ກ່ອງ, ແກັດ)..." value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} className="flex-1 border border-gray-300 p-2 rounded-lg text-sm" required />
                  <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm font-medium">ເພີ່ມ</button>
                </form>
                <ul className="divide-y divide-gray-200 mt-4 max-h-60 overflow-y-auto">
                  {units.map((u) => (
                    <li key={u._id} className="py-2 flex justify-between items-center text-sm">
                      <span className="font-medium text-gray-800">{u.name}</span>
                      <button onClick={() => handleDeleteUnit(u._id)} className="text-red-600 hover:text-red-800 font-medium text-xs bg-red-50 px-2 py-1 rounded">ລຶບ</button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: ຈັດການພະນັກງານ */}
        {activeTab === 'employees' && (
          <EmployeeManagement />
        )}

      </div>

      {/* 🎛️ Stock In Modal */}
      <StockInModal
        isOpen={isStockInOpen}
        onClose={() => setIsStockInOpen(false)}
        onSuccess={() => {
          fetchProducts();
          fetchStockLogs();
        }}
        categories={categories}
        units={units}
      />
    </div>
  );
}