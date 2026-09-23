export default function ReceiptModal({ receipt, onClose }) {
  if (!receipt) return null;

  const formattedDate = receipt.date 
    ? receipt.date 
    : (receipt.createdAt ? new Date(receipt.createdAt).toLocaleString() : 'ບໍ່ລະບຸວັນທີ');

  // ດຶງລະຫັດໃບບີນ
  const receiptId = receipt._id || receipt.id || receipt.orderId || receipt.billNo || receipt.code || receipt.receiptNo || receipt.bill_id || receipt.number || '000000';
  const displayId = typeof receiptId === 'string' ? receiptId : receiptId.toString();

  // ດຶງລະຫັດພະນັກງານ (Employee ID) ໃຫ້ຖືກຕ້ອງຕາມ Database
  const empIdRaw = receipt.employeeId || receipt.cashierId || receipt.empId || 'EMP-01';
  const empStr = typeof empIdRaw === 'object' ? empIdRaw.toString() : String(empIdRaw);
  const displayEmpId = empStr.length > 10 ? `#${empStr.slice(-5)}` : empStr;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
      
      {/* 🧾 ໂຄງສ້າງໃບບີນຂະໜາດ 480px ເບິ່ງຊັດເຈນເຕັມຕາ */}
      <div className="receipt-container" style={{ background: '#fff', padding: '35px', borderRadius: '16px', width: '480px', boxShadow: '0 15px 35px rgba(0,0,0,0.15)', fontFamily: 'monospace' }}>
        
        {/* 1. ຫົວໃບບີນ (Store Header) */}
        <div style={{ textAlign: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 'bold', color: '#1e293b' }}>🏪 RETAIL POS STORE</h2>
          <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#475569' }}>ສາຂາ ຫຼັກ 2, ນະຄອນຫຼວງວຽງຈັນ</p>
          <p style={{ margin: '0', fontSize: '12px', color: '#64748b' }}>ໂທ: 020 1234 5678 | Tax ID: C01-12345678</p>
        </div>

        <hr style={{ border: 'dashed 1px #cbd5e1', margin: '12px 0' }} />
        
        {/* 2. ຂໍ້ມູນບິນ ແລະ ລະຫັດພະນັກງານ (Transaction Info) */}
        <div style={{ fontSize: '13px', color: '#334155', marginBottom: '12px', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ເລກທີບິນ:</span>
            <span style={{ fontWeight: 'bold' }}>#{displayId}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ວັນທີ:</span>
            <span>{formattedDate}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ລະຫັດພະນັກງານ:</span>
            <span style={{ fontWeight: 'bold' }}>{displayEmpId}</span>
          </div>
        </div>
        
        <hr style={{ border: 'dashed 1px #cbd5e1', margin: '12px 0' }} />
        
        {/* 3. ລາຍການສິນຄ້າ (Items Body) */}
        <div style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '12px' }}>
          {receipt.items && receipt.items.map((i, index) => (
            <div key={index} style={{ marginBottom: '10px', fontSize: '14px', color: '#334155' }}>
              <div style={{ fontWeight: 'bold', color: '#0f172a' }}>{i.name}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569', fontSize: '13px', marginTop: '2px' }}>
                <span>{i.quantity} x {(i.price || 0).toLocaleString()} ກີບ</span>
                <span style={{ fontWeight: 'bold', color: '#1e293b' }}>{((i.price || 0) * (i.quantity || 0)).toLocaleString()} ກີບ</span>
              </div>
            </div>
          ))}
        </div>

        <hr style={{ border: 'dashed 1px #cbd5e1', margin: '12px 0' }} />
        
        {/* 4. ຍອດລວມ ແລະ ການຊຳລະເງິນ (Summary & Payment) */}
        <div style={{ fontSize: '14px', marginBottom: '16px', color: '#1e293b', lineHeight: '1.6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>ປະເພດການຊຳລະ:</span>
            <span style={{ fontWeight: 'bold' }}>{receipt.paymentMethod || 'ເງິນສົດ (Cash)'}</span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 'bold', marginTop: '8px' }}>
            <span>ຍອດລວມທັງໝົດ:</span>
            <span style={{ color: '#16a34a' }}>{(receipt.totalAmount || receipt.total || 0).toLocaleString()} ກີບ</span>
          </div>

          {/* 💵 ເພີ່ມສ່ວນສະແດງເງິນຮັບ ແລະ ເງິນທອນ */}
          {receipt.cashReceived !== undefined && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', color: '#475569', fontSize: '13px' }}>
                <span>ຮັບເງິນສົດມາ:</span>
                <span>{Number(receipt.cashReceived).toLocaleString()} ກີບ</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', color: '#2563eb', fontSize: '14px', fontWeight: 'bold' }}>
                <span>ເງິນທອນ:</span>
                <span>{Number(receipt.changeAmount || 0).toLocaleString()} ກີບ</span>
              </div>
            </>
          )}
        </div>

        <hr style={{ border: 'dashed 1px #cbd5e1', margin: '12px 0' }} />

        {/* 5. ທ້າຍໃບບີນ (Footer & Thank you) */}
        <div style={{ textAlign: 'center', margin: '14px 0 20px', fontSize: '12px', color: '#64748b', lineHeight: '1.5' }}>
          <p style={{ margin: '0 0 3px', fontWeight: 'bold' }}>🙏 ຂອບໃຈທີ່ໃຊ້ບໍລິການ!</p>
          <p style={{ margin: '0' }}>ສິນຄ້າຊື້ແລ້ວ ບໍ່ຮັບປ່ຽນ ຫຼື ຄືນທຸກກໍລະນີ</p>
        </div>

        {/* ປຸ່ມກົດ (ຈະຖືກເຊື່ອງເວລາສັ່ງ Print) */}
        <div className="no-print" style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={() => window.print()}
            style={{ flex: 1, padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            🖨️ ພິມໃບບີນ
          </button>
          <button 
            onClick={onClose}
            style={{ flex: 1, padding: '12px', background: '#64748b', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
          >
            ✕ ປິດ (ຂາຍຕໍ່)
          </button>
        </div>

      </div>

      {/* CSS ສຳລັບເວລາສັ່ງ Print */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-container, .receipt-container * {
            visibility: visible;
          }
          .receipt-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            box-shadow: none !important;
            padding: 10px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}