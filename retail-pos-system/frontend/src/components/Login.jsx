import { useState } from 'react';
import { API_BASE_URL, authHeaders } from '../api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [startingCash, setStartingCash] = useState('');
  const [needsShiftOpen, setNeedsShiftOpen] = useState(false);
  const [employeeData, setEmployeeData] = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      // 1. ກວດສອບ Username ແລະ PIN ກັບ Backend
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });
      const data = await res.json();

      if (!res.ok) return alert('❌ ' + data.error);

      // 🟢 ບັນທຶກ token ໄວ້ໃນ localStorage ເພື່ອໃຫ້ຢູ່ໄດ້ 12 ຊົ່ວໂມງ ບໍ່ຫຼຸດງ່າຍໆ
      localStorage.setItem('token', data.token);

      if (data.employee.role === 'admin') {
        // ຖ້າເປັນ Admin ໃຫ້ເຂົ້າລະບົບເລີຍ
        onLoginSuccess(data.employee, null);
      } else {
        // ຖ້າເປັນ Cashier ໃຫ້ຖາມເງິນຕັ້ງຕົ້ນກ່ອນເປີດກະ
        setEmployeeData(data.employee);
        setNeedsShiftOpen(true);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່');
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      // 2. ສ້າງ Shift ໃໝ່ໃນ Database
      const res = await fetch(`${API_BASE_URL}/api/shifts/open`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ 
          employeeId: employeeData._id, 
          employeeName: employeeData.name, 
          startingCash: Number(startingCash) 
        }),
      });
      const data = await res.json();

      if (res.ok) {
        onLoginSuccess(employeeData, data.shift);
      } else {
        alert('❌ ' + data.error);
      }
    } catch (err) {
      console.error('Open shift error:', err);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f1f5f9' }}>
      <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '380px' }}>
        
        {!needsShiftOpen ? (
          <form onSubmit={handleLogin}>
            <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#1e293b' }}>🔐 ເຂົ້າສູ່ລະບົບ POS</h2>
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#475569' }}>Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#475569' }}>ລະຫັດ PIN</label>
              <input type="password" maxLength="6" value={pin} onChange={(e) => setPin(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ເຂົ້າສູ່ລະບົບ</button>
          </form>
        ) : (
          <form onSubmit={handleOpenShift}>
            <h2 style={{ textAlign: 'center', marginBottom: '10px', color: '#1e293b' }}>📥 ເປີດກະການຂາຍ (Open Shift)</h2>
            <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>ສະບາຍດີ, <b>{employeeData.name}</b><br/>ກະລຸນາປ້ອນເງິນທອນຕັ້ງຕົ້ນໃນລິ້ນຊັກ</p>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#475569' }}>ຈຳນວນເງິນສົດຕັ້ງຕົ້ນ (ກີບ)</label>
              <input type="number" value={startingCash} onChange={(e) => setStartingCash(e.target.value)} placeholder="ຕົວຢ່າງ: 500000" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1' }} required />
            </div>
            <button type="submit" style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ເລີ່ມຕົ້ນຂາຍ (Open Shift)</button>
          </form>
        )}

      </div>
    </div>
  );
}