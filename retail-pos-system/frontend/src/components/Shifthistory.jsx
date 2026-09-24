import { useState, useEffect, useCallback } from 'react';
import { API_BASE_URL, authHeaders, fetchArray } from '../api';

// 🗓️ ວັນທີ YYYY-MM-DD ຂອງເວລາທ້ອງຖິ່ນ (ຫຼີກ toISOString ທີ່ເປັນ UTC ເຊິ່ງອາດເລື່ອນວັນ)
const toDateInput = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

const fmtDateTime = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  if (isNaN(d)) return '-';
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
};

const money = (n) => Number(n || 0).toLocaleString('en-US');

export default function ShiftHistory() {
  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(today.getDate() - 6);

  const [from, setFrom] = useState(toDateInput(weekAgo));
  const [to, setTo] = useState(toDateInput(today));
  const [status, setStatus] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [employees, setEmployees] = useState([]);

  const [data, setData] = useState({ shifts: [], summary: null, total: 0, truncated: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchArray(`${API_BASE_URL}/api/employees`).then(setEmployees);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (status) params.set('status', status);
      if (employeeId) params.set('employee', employeeId);

      const res = await fetch(`${API_BASE_URL}/api/shifts?${params.toString()}`, { headers: authHeaders() });

      if (res.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('employee');
        window.location.href = '/';
        return;
      }

      const json = await res.json().catch(() => null);
      if (!res.ok || !json || !Array.isArray(json.shifts)) {
        setError((json && json.error) || 'ດຶງຂໍ້ມູນບໍ່ສຳເລັດ');
        setData({ shifts: [], summary: null, total: 0, truncated: false });
      } else {
        setData(json);
      }
    } catch (err) {
      console.error('Load shifts error:', err);
      setError('ເຊື່ອມຕໍ່ Server ບໍ່ໄດ້');
    } finally {
      setLoading(false);
    }
  }, [from, to, status, employeeId]);

  useEffect(() => {
    load();
  }, [load]);

  const { shifts, summary } = data;

  const statusBadge = (s) => {
    if (s.status === 'open') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">🟢 ເປີດຢູ່</span>;
    }
    if (s.autoClosed) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">⚠️ ລະບົບປິດໃຫ້</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">ປິດແລ້ວ</span>;
  };

  const diffCell = (s) => {
    if (s.difference === null) {
      return <span className="text-gray-400" title="ບໍ່ມີເງິນນັບໄດ້ຈິງ (ກະຍັງເປີດ ຫຼື ລະບົບປິດໃຫ້)">-</span>;
    }
    if (s.difference === 0) return <span className="text-green-600 font-semibold">0 ✓</span>;
    if (s.difference < 0) return <span className="text-red-600 font-bold">{money(s.difference)} (ຂາດ)</span>;
    return <span className="text-amber-600 font-bold">+{money(s.difference)} (ເກີນ)</span>;
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800">🕐 ປະຫວັດກະ (Shifts)</h2>
        <p className="text-sm text-gray-500 mt-1">
          ເງິນຄວນມີ = ເງິນຕັ້ງຕົ້ນ + ຍອດຂາຍເງິນສົດ (QR/ໂອນ ບໍ່ນັບ) · ສ່ວນຕ່າງ = ເງິນນັບໄດ້ − ເງິນຄວນມີ
        </p>
      </div>

      {/* ຕົວກັ່ນຕອງ */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">ຈາກວັນທີ</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">ຫາວັນທີ</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">ພະນັກງານ</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm min-w-[160px]">
            <option value="">ທັງໝົດ</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>{emp.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">ສະຖານະ</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
            <option value="">ທັງໝົດ</option>
            <option value="open">ເປີດຢູ່</option>
            <option value="closed">ປິດແລ້ວ</option>
          </select>
        </div>
        <button onClick={load} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition">
          🔄 ໂຫຼດໃໝ່
        </button>
      </div>

      {/* ສະຫຼຸບ */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">ຈຳນວນກະ</p>
            <p className="text-xl font-bold text-gray-800">{summary.shiftCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">ເປີດຢູ່ {summary.openCount} · ລະບົບປິດໃຫ້ {summary.autoClosedCount}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">ຍອດຂາຍລວມ (ກີບ)</p>
            <p className="text-xl font-bold text-gray-800">{money(summary.totalSales)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">ເງິນຂາດລວມ (ກີບ)</p>
            <p className={`text-xl font-bold ${summary.totalShort < 0 ? 'text-red-600' : 'text-gray-800'}`}>{money(summary.totalShort)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">ເງິນເກີນລວມ (ກີບ)</p>
            <p className={`text-xl font-bold ${summary.totalOver > 0 ? 'text-amber-600' : 'text-gray-800'}`}>{money(summary.totalOver)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4">
            <p className="text-xs text-gray-500">ສຸດທິ (ເກີນ − ຂາດ)</p>
            <p className={`text-xl font-bold ${summary.totalOver + summary.totalShort < 0 ? 'text-red-600' : 'text-gray-800'}`}>
              {money(summary.totalOver + summary.totalShort)}
            </p>
          </div>
        </div>
      )}

      {data.truncated && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-2 mb-4">
          ⚠️ ມີທັງໝົດ {data.total} ກະ ແຕ່ສະແດງສະເພາະ {shifts.length} ກະຫຼ້າສຸດ — ກະລຸນາແຄບຊ່ວງວັນທີລົງ
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2 mb-4">❌ {error}</div>
      )}

      {/* ຕາຕະລາງ */}
      <div className="bg-white rounded-xl shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-left">
            <tr>
              <th className="px-4 py-3 font-semibold">ພະນັກງານ</th>
              <th className="px-4 py-3 font-semibold">ເລີ່ມ</th>
              <th className="px-4 py-3 font-semibold">ປິດ</th>
              <th className="px-4 py-3 font-semibold">ສະຖານະ</th>
              <th className="px-4 py-3 font-semibold text-right">ເງິນຕັ້ງຕົ້ນ</th>
              <th className="px-4 py-3 font-semibold text-right">ຍອດຂາຍ</th>
              <th className="px-4 py-3 font-semibold text-right">ເງິນຄວນມີ</th>
              <th className="px-4 py-3 font-semibold text-right">ເງິນນັບໄດ້</th>
              <th className="px-4 py-3 font-semibold text-right">ສ່ວນຕ່າງ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading && (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-400">ກຳລັງໂຫຼດ...</td></tr>
            )}
            {!loading && shifts.length === 0 && (
              <tr><td colSpan="9" className="px-4 py-8 text-center text-gray-400">ບໍ່ພົບຂໍ້ມູນກະໃນຊ່ວງທີ່ເລືອກ</td></tr>
            )}
            {!loading && shifts.map((s) => (
              <tr key={s._id} className={s.difference !== null && s.difference < 0 ? 'bg-red-50' : 'hover:bg-gray-50'}>
                <td className="px-4 py-3 font-medium text-gray-800">{s.employeeName}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDateTime(s.startTime)}</td>
                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{s.status === 'open' ? '-' : fmtDateTime(s.endTime)}</td>
                <td className="px-4 py-3">{statusBadge(s)}</td>
                <td className="px-4 py-3 text-right">{money(s.startingCash)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="font-medium">{money(s.totalSales)}</div>
                  <div className="text-xs text-gray-400">
                    ສົດ {money(s.cashSales)} · QR/ໂອນ {money(s.nonCashSales)} · {s.orderCount} ບິນ
                  </div>
                </td>
                <td className="px-4 py-3 text-right">{money(s.expectedCash)}</td>
                <td className="px-4 py-3 text-right">{s.actualCash === null ? <span className="text-gray-400">-</span> : money(s.actualCash)}</td>
                <td className="px-4 py-3 text-right whitespace-nowrap">{diffCell(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 mt-3">
        ໝາຍເຫດ: ກະທີ່ &quot;ລະບົບປິດໃຫ້&quot; ແມ່ນກະທີ່ພະນັກງານລືມປິດ ຈຶ່ງບໍ່ມີເງິນນັບໄດ້ຈິງ ແລະ ບໍ່ຄຳນວນສ່ວນຕ່າງ.
      </p>
    </div>
  );
}