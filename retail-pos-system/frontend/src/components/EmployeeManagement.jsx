import { useState, useEffect } from 'react';
import { API_BASE_URL, authHeaders, fetchArray } from '../api';

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    name: '',
    username: '',
    pin: '',
    role: 'cashier',
    phone: '',
    status: 'active'
  });
  const [editingId, setEditingId] = useState(null);
  const [editingCode, setEditingCode] = useState(''); // ລະຫັດພະນັກງານທີ່ກຳລັງແກ້ໄຂ (ສະແດງເທົ່ານັ້ນ, ແກ້ບໍ່ໄດ້)

  const fetchEmployees = async () => {
    const data = await fetchArray(`${API_BASE_URL}/api/employees`);
    setEmployees(data);
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const url = editingId 
      ? `${API_BASE_URL}/api/employees/${editingId}` 
      : `${API_BASE_URL}/api/employees`;
    const method = editingId ? 'PUT' : 'POST';

    // 🔒 ຕອນແກ້ໄຂ: ຖ້າບໍ່ໄດ້ພິມ PIN ໃໝ່ ຢ່າສົ່ງຄ່າຫວ່າງໄປທັບຂອງເກົ່າ (backend ບໍ່ສົ່ງ pin ທີ່ hash ແລ້ວກັບມາໃຫ້ອີກ)
    const payload = { ...form };
    if (editingId && !payload.pin) {
      delete payload.pin;
    }

    try {
      const res = await fetch(url, {
        method,
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved = await res.json();
        fetchEmployees();
        setForm({ name: '', username: '', pin: '', role: 'cashier', phone: '', status: 'active' });
        setEditingId(null);
        setEditingCode('');
        alert(
          editingId
            ? 'ແກ້ໄຂຂໍ້ມູນພະນັກງານສຳເລັດແລ້ວ'
            : `ເພີ່ມພະນັກງານສຳເລັດແລ້ວ! ລະຫັດພະນັກງານ: ${saved.employeeCode || '-'}`
        );
      } else {
        const errorData = await res.json();
        alert('ເກີດຂໍ້ຜິດພາດ: ' + errorData.error);
      }
    } catch (err) {
      console.error('Error saving employee:', err);
    }
  };

  const handleEdit = (emp) => {
    setForm({
      name: emp.name,
      username: emp.username,
      pin: '', // 🔒 ບໍ່ໄດ້ຮັບ pin ຈາກ backend ອີກຕໍ່ໄປ (ຄວາມປອດໄພ) — ປ່ອຍວ່າງໄວ້ຖ້າບໍ່ຕ້ອງການປ່ຽນ PIN
      role: emp.role,
      phone: emp.phone || '',
      status: emp.status
    });
    setEditingId(emp._id);
    setEditingCode(emp.employeeCode || '');
  };

  const handleDelete = async (id) => {
    if (window.confirm('ທ່ານຕ້ອງການລຶບພະນັກງານຄົນນີ້ແທ້ບໍ?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/employees/${id}`, {
          method: 'DELETE',
          headers: authHeaders(),
        });
        if (res.ok) {
          fetchEmployees();
          alert('ລຶບພະນັກງານສຳເລັດແລ້ວ');
        }
      } catch (err) {
        console.error('Error deleting employee:', err);
      }
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">👥 ຈັດການຂໍ້ມູນພະນັກງານ</h2>

      {/* ຟອມເພີ່ມ/ແກ້ໄຂພະນັກງານ */}
      <div className="bg-white p-6 rounded-xl shadow-md">
        <h3 className="text-lg font-semibold text-gray-700 mb-4">
          {editingId ? '✏️ ແກ້ໄຂຂໍ້ມູນພະນັກງານ' : '➕ ເພີ່ມພະນັກງານໃໝ່'}
        </h3>
        
        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ລະຫັດພະນັກງານ (ID)</label>
            <input
              type="text"
              value={editingId ? (editingCode || '-') : 'ຈະຖືກສ້າງອັດຕະໂນມັດ'}
              disabled
              className="w-full border border-gray-200 bg-gray-100 p-2 rounded-lg text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ຊື່ - ນາມສະກຸນ</label>
            <input type="text" placeholder="ຊື່ພະນັກງານ..." value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">Username (ສຳລັບເຂົ້າລະບົບ)</label>
            <input type="text" placeholder="username..." value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ລະຫັດ PIN (4 ຕົວເລກ)</label>
            <input type="password" maxLength="6" placeholder={editingId ? "ປ່ອຍວ່າງໄວ້ຖ້າບໍ່ປ່ຽນ PIN" : "PIN..."} value={form.pin} onChange={(e) => setForm({ ...form, pin: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" required={!editingId} />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ສິດການໃຊ້ງານ (Role)</label>
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm">
              <option value="cashier">ພະນັກງານຂາຍ (Cashier)</option>
              <option value="admin">ເຈົ້າຂອງຮ້ານ / ແອດມິນ (Admin)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ເບີໂທລະສັບ</label>
            <input type="text" placeholder="ເບີໂທ..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">ສະຖານະ</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border border-gray-300 p-2 rounded-lg text-sm">
              <option value="active">ປົກກະຕິ (Active)</option>
              <option value="inactive">ລາອອກ / ພັກງານ (Inactive)</option>
            </select>
          </div>

          <div className="md:col-span-2 lg:col-span-3 flex space-x-2 mt-2">
            <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 font-medium text-sm">
              {editingId ? '💾 ບັນທຶກການແກ້ໄຂ' : '+ ບັນທຶກເພີ່ມພະນັກງານ'}
            </button>
            {editingId && (
              <button type="button" onClick={() => { setEditingId(null); setEditingCode(''); setForm({ name: '', username: '', pin: '', role: 'cashier', phone: '', status: 'active' }); }} className="bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 font-medium text-sm">
                ຍົກເລີກ
              </button>
            )}
          </div>
        </form>
      </div>

      {/* ຕາຕະລາງສະແດງລາຍຊື່ພະນັກງານ */}
      <div className="bg-white p-6 rounded-xl shadow-md overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ລະຫັດ (ID)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ຊື່ພະນັກງານ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ສິດ (Role)</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ເບີໂທ</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ສະຖານະ</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">ຈັດການ</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.length > 0 ? (
              employees.map((emp) => (
                <tr key={emp._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{emp.employeeCode || '-'}</td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{emp.name}</td>
                  <td className="px-4 py-3 text-sm text-blue-600 font-semibold">{emp.username}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${emp.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                      {emp.role === 'admin' ? 'Admin (ເຈົ້າຂອງ)' : 'Cashier (ພະນັກງານ)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{emp.phone || '-'}</td>
                  <td className="px-4 py-3 text-sm">
                    <span className={`px-2 py-1 rounded text-xs ${emp.status === 'active' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                      {emp.status === 'active' ? 'ເຮັດວຽກຢູ່' : 'ລາອອກແລ້ວ'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleEdit(emp)} className="text-blue-600 hover:text-blue-800 mr-3 font-medium text-sm">ແກ້ໄຂ</button>
                    <button onClick={() => handleDelete(emp._id)} className="text-red-600 hover:text-red-800 font-medium text-sm">ລຶບ</button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-4 py-6 text-center text-sm text-gray-500">ບໍ່ມີຂໍ້ມູນພະນັກງານ</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}