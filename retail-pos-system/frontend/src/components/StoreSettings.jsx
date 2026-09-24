import { useState, useEffect } from 'react';
import { API_BASE_URL, authHeaders, resolveImageUrl, printTestPage } from '../api';

// ⚙️ ໜ້າຕັ້ງຄ່າຮ້ານ — ຕັ້ງ QR ຮັບເງິນ + ຂໍ້ມູນໃບບິນ + ເຄື່ອງພິມໃບເສັດ
export default function StoreSettings() {
  const [shopName, setShopName] = useState('');
  const [shopAddress, setShopAddress] = useState('');
  const [shopPhone, setShopPhone] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [printerEnabled, setPrinterEnabled] = useState(false);
  const [printerMethod, setPrinterMethod] = useState('network-escpos');
  const [printerIp, setPrinterIp] = useState('');
  const [printerPort, setPrinterPort] = useState(9100);
  const [printerName, setPrinterName] = useState('');
  const [qrImage, setQrImage] = useState(''); // path/URL ປັດຈຸບັນທີ່ບັນທຶກໄວ້ໃນ server
  const [imageMethod, setImageMethod] = useState('upload'); // 'upload' ຫຼື 'url'
  const [qrUrl, setQrUrl] = useState('');
  const [qrFile, setQrFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null); // { ok, text }

  const fetchSettings = () => {
    setLoading(true);
    fetch(`${API_BASE_URL}/api/settings`, { headers: authHeaders() })
      .then((res) => res.json())
      .then((data) => {
        setShopName(data.shopName || '');
        setShopAddress(data.shopAddress || '');
        setShopPhone(data.shopPhone || '');
        setReceiptFooter(data.receiptFooter || '');
        setPrinterEnabled(!!data.printerEnabled);
        setPrinterMethod(data.printerMethod || 'network-escpos');
        setPrinterIp(data.printerIp || '');
        setPrinterPort(data.printerPort || 9100);
        setPrinterName(data.printerName || '');
        setQrImage(data.shopQRImage || '');
      })
      .catch((err) => console.error('Error fetching settings:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('shopName', shopName);
      formData.append('shopAddress', shopAddress);
      formData.append('shopPhone', shopPhone);
      formData.append('receiptFooter', receiptFooter);
      formData.append('printerEnabled', printerEnabled);
      formData.append('printerMethod', printerMethod);
      formData.append('printerIp', printerIp);
      formData.append('printerPort', printerPort);
      formData.append('printerName', printerName);

      if (imageMethod === 'upload' && qrFile) {
        formData.append('qrImage', qrFile);
      } else if (imageMethod === 'url' && qrUrl.trim() !== '') {
        formData.append('shopQRImage', qrUrl.trim());
      }

      const res = await fetch(`${API_BASE_URL}/api/settings`, {
        method: 'PUT',
        headers: authHeaders(), // ບໍ່ໃສ່ Content-Type ເອງ ໃຫ້ browser ຕັ້ງ boundary ຂອງ FormData ໃຫ້
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        alert('✅ ບັນທຶກຄ່າຮ້ານສຳເລັດ');
        setQrFile(null);
        setQrUrl('');
        fetchSettings();
      } else {
        alert('❌ ' + (data.error || 'ບັນທຶກບໍ່ສຳເລັດ'));
      }
    } catch (err) {
      console.error('Save settings error:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການບັນທຶກ');
    } finally {
      setSaving(false);
    }
  };

  // 🧪 ທົດສອບພິມກັບເຄື່ອງພິມກົງກັບຄ່າທີ່ກຳລັງຕັ້ງຢູ່
  const handleTestPrint = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      await printTestPage();
      setTestMsg({ ok: true, text: '✅ ທົດສອບພິມສຳເລັດ — ກວດເບິ່ງເຄື່ອງພິມ' });
    } catch (err) {
      setTestMsg({ ok: false, text: err.message });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return <p className="text-gray-400 text-center mt-10">ກຳລັງໂຫຼດ...</p>;
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-md p-6 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800 border-b pb-4">⚙️ ຕັ້ງຄ່າຮ້ານ</h2>

      <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-4 text-sm">
        ⚠️ QR ທີ່ຕັ້ງທີ່ນີ້ຈະຖືກສະແດງໃຫ້ລູກຄ້າສະແກນຕອນເລືອກຊຳລະແບບ QR ຢູ່ໜ້າຂາຍ —
        ຕ້ອງເປັນ QR ຈິງຂອງບັນຊີຮ້ານ (ຈາກແອັບທະນາຄານ ເຊັ່ນ BCEL One, LDB) ບໍ່ດັ່ງນັ້ນລູກຄ້າຈະໂອນເງິນບໍ່ໄດ້ຈິງ.
        ລະບົບບໍ່ໄດ້ຕໍ່ກັບທະນາຄານ — ພະນັກງານຍັງຕ້ອງເບິ່ງແອັບທະນາຄານເອງວ່າເງິນເຂົ້າແທ້ກ່ອນຢືນຢັນທຸກຄັ້ງ.
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* 🧾 ຂໍ້ມູນທີ່ສະແດງໃນໃບບິນ/ໃບເສັດ */}
        <div className="border-t pt-5">
          <h3 className="text-lg font-bold text-gray-800 mb-1">🧾 ຂໍ້ມູນໃນໃບບິນ (Receipt)</h3>
          <p className="text-sm text-gray-500 mb-4">ຊື່ຮ້ານ, ທີ່ຢູ່, ເບີໂທ ແລະ ຂໍ້ຄວາມບັນທຶກໄວ້ທີ່ນີ້ ຈະສະແດງຢູ່ໃນໃບບິນທັງໝົດ (ໜ້າຈໍ + ພິມອອກເຄື່ອງ)</p>

          <label className="block text-sm font-medium text-gray-600 mb-1">ຊື່ຮ້ານ</label>
          <input
            type="text"
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="ຕົວຢ່າງ: Mini Mart ບ້ານໂພນ"
            className="w-full border border-gray-300 p-2 rounded-lg text-sm mb-4"
          />

          <label className="block text-sm font-medium text-gray-600 mb-1">ທີ່ຢູ່ຮ້ານ</label>
          <input
            type="text"
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
            placeholder="ຕົວຢ່າງ: ສາຂາ ຫຼັກ 2, ນະຄອນຫຼວງວຽງຈັນ"
            className="w-full border border-gray-300 p-2 rounded-lg text-sm mb-4"
          />

          <label className="block text-sm font-medium text-gray-600 mb-1">ເບີໂທຮ້ານ</label>
          <input
            type="text"
            value={shopPhone}
            onChange={(e) => setShopPhone(e.target.value)}
            placeholder="ຕົວຢ່າງ: 020 1234 5678"
            className="w-full border border-gray-300 p-2 rounded-lg text-sm mb-4"
          />

          <label className="block text-sm font-medium text-gray-600 mb-1">ຂໍ້ຄວາມທ້າຍໃບບິນ (Footer)</label>
          <input
            type="text"
            value={receiptFooter}
            onChange={(e) => setReceiptFooter(e.target.value)}
            placeholder="ຕົວຢ່າງ: ຂອບໃຈທີ່ໃຊ້ບໍລິການ!"
            className="w-full border border-gray-300 p-2 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 mb-2">QR ຮັບເງິນໂອນປັດຈຸບັນ</label>
          {qrImage ? (
            <img
              src={resolveImageUrl(qrImage)}
              alt="QR ຮ້ານປັດຈຸບັນ"
              className="w-40 h-40 object-contain border border-gray-200 rounded-lg mb-3"
            />
          ) : (
            <p className="text-sm text-red-600 mb-3">⚠️ ຍັງບໍ່ໄດ້ຕັ້ງ QR — ໜ້າຂາຍຈະສະແດງຄຳເຕືອນແທນ ຈົນກວ່າຈະຕັ້ງ</p>
          )}

          <label className="block text-sm font-medium text-gray-600 mb-1">ວິທີການອັບເດດ QR ໃໝ່</label>
          <div className="flex gap-4 mb-2 text-sm">
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={imageMethod === 'upload'} onChange={() => setImageMethod('upload')} />
              ອັບໂຫຼດໄຟລ໌ (ຖ່າຍຮູບ QR ຈາກແອັບທະນາຄານ)
            </label>
            <label className="flex items-center gap-1.5">
              <input type="radio" checked={imageMethod === 'url'} onChange={() => setImageMethod('url')} />
              ໃສ່ລິ້ງ URL
            </label>
          </div>

          {imageMethod === 'upload' ? (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setQrFile(e.target.files[0])}
              className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white"
            />
          ) : (
            <input
              type="text"
              value={qrUrl}
              onChange={(e) => setQrUrl(e.target.value)}
              placeholder="ວາງລິ້ງຮູບທີ່ນີ້ (https://...)"
              className="w-full border border-gray-300 p-2 rounded-lg text-sm"
            />
          )}
        </div>

        {/* 🖨️ ການຕັ້ງຄ່າເຄື່ອງພິມໃບເສັດ */}
        <div className="border-t pt-5">
          <h3 className="text-lg font-bold text-gray-800 mb-3">🖨️ ເຄື່ອງພິມໃບເສັດ (Receipt Printer)</h3>
          <p className="text-sm text-gray-500 mb-4">
            ເຊື່ອມຕໍ່ເຄື່ອງພິມໃບເສັດຈິງ (Epson, Xprinter, Star, Gprinter...) ເມື່ອກົດ
            "ພິມອອກເຄື່ອງ" ຢູ່ໜ້າພິມໃບບິນ ຂໍ້ມູນຈະຖືກສົ່ງໄປພິມອອກກົງ ໂດຍບໍ່ຕ້ອງກົດເລືອກເຄື່ອງພິມໃນ Windows.
          </p>

          <label className="flex items-center gap-2 mb-4 text-sm">
            <input
              type="checkbox"
              checked={printerEnabled}
              onChange={(e) => setPrinterEnabled(e.target.checked)}
              className="w-4 h-4"
            />
            ເປີດໃຊ້ການພິມອອກເຄື່ອງພິມ (Enable)
          </label>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-600 mb-1">ວິທີເຊື່ອມຕໍ່</label>
            <select
              value={printerMethod}
              onChange={(e) => setPrinterMethod(e.target.value)}
              className="w-full border border-gray-300 p-2 rounded-lg text-sm bg-white"
            >
              <option value="network-escpos">Network ESC/POS — ເຊື່ອມຜ່ານ LAN/WiFi (IP + port 9100)</option>
              <option value="windows">Windows Driver — ໃຊ້ຊື່ເຄື່ອງພິມທີ່ລົງໄວ້ (USB ກໍ່ໄດ້)</option>
            </select>
          </div>

          {printerMethod === 'network-escpos' ? (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-600 mb-1">IP ເຄື່ອງພິມ</label>
                <input
                  type="text"
                  value={printerIp}
                  onChange={(e) => setPrinterIp(e.target.value)}
                  placeholder="ເຊັ່ນ 192.168.1.100"
                  className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">Port</label>
                <input
                  type="number"
                  value={printerPort}
                  onChange={(e) => setPrinterPort(Number(e.target.value))}
                  className="w-full border border-gray-300 p-2 rounded-lg text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">ຊື່ເຄື່ອງພິມໃນ Windows</label>
              <input
                type="text"
                value={printerName}
                onChange={(e) => setPrinterName(e.target.value)}
                placeholder='ຊື່ທີ່ເຫັນໃນ Control Panel -> Devices and Printers (ເຊັ່ນ "Xprinter XP-58")'
                className="w-full border border-gray-300 p-2 rounded-lg text-sm"
              />
            </div>
          )}

          {testMsg && (
            <div
              className={`mb-3 p-3 rounded-lg text-sm font-medium ${
                testMsg.ok ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}
            >
              {testMsg.text}
            </div>
          )}

          <button
            type="button"
            onClick={handleTestPrint}
            disabled={testing || !printerEnabled}
            className="w-full py-2.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-semibold hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200"
          >
            {testing ? 'ກຳລັງພິມທົດສອບ...' : '🧪 ທົດສອບພິມ (Test Print)'}
          </button>
          <p className="text-xs text-gray-400 mt-2">
            ຄຳແນະນຳ: ກົດ "ບັນທຶກຄ່າຮ້ານ" ກ່ອນແລ້ວຄ່ອຍກົດທົດສອບພິມ. 
            ອ່ານ IP ເຄື່ອງພິມໄດ້ຈາກຮຸ່ນທີ່ມີ LAN ຜ່ານໜ້າຈໍເຄື່ອງພິມ ຫຼື ໜັງສືພິມ (Printer Manual).
          </p>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {saving ? 'ກຳລັງບັນທຶກ...' : '💾 ບັນທຶກຄ່າຮ້ານ'}
        </button>
      </form>
    </div>
  );
}