import { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import ReceiptModal from './components/ReceiptModal';
import EmployeeManagement from './components/EmployeeManagement';
import { API_BASE_URL, authHeaders, resolveImageUrl } from './api';

// ✨ CSS ອະນິເມຊັນຕອນເລື່ອນໜ້າ (ແກ້ໄຂຄ່າໄດ້ງ່າຍທີ່ນີ້): ບັດສິນຄ້າເລື່ອນຂຶ້ນ/ລົງ + ຄ່ອຍໆປາກົດ ເມື່ອເຂົ້າມາໃນໜ້າຈໍ
// ເປີດ/ປິດ ຈາກຄ່າ POS_SCROLL_ANIMATION ລຸ່ມນີ້ (false = ບໍ່ມີອະນິເມຊັນ) — ຖ້າເຄື່ອງຊ້າ ຫຼື ສິນຄ້າຫຼາຍຈົນກະຕຸກ ໃຫ້ປິດ
const POS_SCROLL_ANIMATION = true;

// 🎞️ ໂໝດສະໄລ້ອັດຕະໂນມັດ (Attract mode): ຕອນບໍ່ມີໃຜໃຊ້ງານ ໜ້າສິນຄ້າຈະຄ່ອຍໆເລື່ອນລົງສຸດ ແລ້ວເລື່ອນຂຶ້ນສຸດ ສະຫຼັບໄປມາ
// ແລະ ຢຸດທັນທີເມື່ອມີການກົດ/ຄລິກ/ເລື່ອນ/ແຕະ/ຍິງບາໂຄດ. ແກ້ຄ່າຄວາມໄວ ແລະ ເວລາລໍໄດ້ງ່າຍຈາກຕົວເລກລຸ່ມນີ້
const AUTO_SLIDE_IDLE_MS = 8000;     // ບໍ່ມີການໃຊ້ງານຈັກ 8 ວິນາທີ ຈຶ່ງເລີ່ມເລື່ອນເອງ
const AUTO_SLIDE_SPEED = 45;         // ຄວາມໄວ (ພິກເຊວ/ວິນາທີ) — ຍິ່ງນ້ອຍຍິ່ງຊ້າ ແລະ ນຸ່ມ
const AUTO_SLIDE_END_PAUSE_MS = 1800; // ຢຸດພັກຕອນຮອດສຸດເທິງ/ສຸດລຸ່ມ ກ່ອນເລື່ອນກັບ
const AUTO_SLIDE_STORAGE_KEY = 'pos_auto_slide'; // ຈື່ການເປີດ/ປິດ ໄວ້ໃນເຄື່ອງ
const POS_SCROLL_CSS = `
  .pos-reveal { opacity: 0; }
  .pos-reveal.pos-in {
    animation: pos-reveal-in 0.38s cubic-bezier(0.2, 0.7, 0.3, 1) var(--reveal-delay, 0ms) both;
  }
  @keyframes pos-reveal-in {
    from { opacity: 0; transform: translateY(var(--reveal-from, 22px)) scale(0.97); }
    to   { opacity: 1; transform: none; }
  }
  .pos-card-hover { transition: transform 0.15s ease, box-shadow 0.15s ease; }
  .pos-card-hover:hover { transform: translateY(-3px); box-shadow: 0 6px 16px rgba(15, 23, 42, 0.12) !important; }
  .pos-card-hover:active { transform: scale(0.97); }
  @media (prefers-reduced-motion: reduce) {
    .pos-reveal { opacity: 1; }
    .pos-reveal.pos-in { animation: none; }
    .pos-card-hover, .pos-card-hover:hover, .pos-card-hover:active { transition: none; transform: none; }
  }
`;

// 🃏 ບັດສິນຄ້າໜຶ່ງໃບ — ເບິ່ງ IntersectionObserver ວ່າເຂົ້າ/ອອກຈາກໜ້າຈໍເມື່ອໃດ ແລ້ວສະຫຼັບ class ເພື່ອຫຼິ້ນອະນິເມຊັນ
// ໃຊ້ wrapper ຂ້າງນອກເປັນຕົວເຄື່ອນໄຫວ ເພື່ອບໍ່ໃຫ້ທັບຄ່າ opacity ຂອງບັດ "ສິນຄ້າໝົດ" (0.4) ທີ່ຕັ້ງໄວ້ຢູ່ຂ້າງໃນ
function ProductCard({ product: p, index, scrollDirRef, onAdd }) {
  const wrapRef = useRef(null);
  const [inView, setInView] = useState(!POS_SCROLL_ANIMATION);

  useEffect(() => {
    if (!POS_SCROLL_ANIMATION) return undefined;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // ເລື່ອນລົງ → ບັດຂຶ້ນມາຈາກລຸ່ມ, ເລື່ອນຂຶ້ນ → ບັດລົງມາຈາກເທິງ
          el.style.setProperty('--reveal-from', scrollDirRef.current === 'up' ? '-22px' : '22px');
          setInView(true);
        } else {
          // ອອກຈາກໜ້າຈໍແລ້ວ: ຕັ້ງກັບເປັນຊ່ອນ ເພື່ອໃຫ້ຫຼິ້ນອີກເທື່ອເມື່ອເລື່ອນກັບມາ
          setInView(false);
        }
      },
      { threshold: 0.08 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollDirRef]);

  const inStock = p.stock > 0;

  return (
    <div
      ref={wrapRef}
      className={POS_SCROLL_ANIMATION ? `pos-reveal${inView ? ' pos-in' : ''}` : undefined}
      style={POS_SCROLL_ANIMATION ? { '--reveal-delay': `${(index % 6) * 35}ms`, display: 'flex' } : { display: 'flex' }}
    >
      <div
        onClick={() => inStock && onAdd(p)}
        className={inStock ? 'pos-card-hover' : undefined}
        style={{
          width: '100%', boxSizing: 'border-box',
          background: '#fff', padding: '14px', borderRadius: '12px', cursor: inStock ? 'pointer' : 'not-allowed',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)', opacity: inStock ? 1 : 0.4, textAlign: 'center',
          border: '1px solid #e2e8f0'
        }}
      >
        <img src={resolveImageUrl(p.image)} alt={p.name} style={{ width: '100%', height: '110px', objectFit: 'cover', borderRadius: '8px' }} />
        <h4 style={{ margin: '10px 0 4px', fontSize: '14px', color: '#334155', fontWeight: '600' }}>{p.name}</h4>
        <p style={{ margin: '0', color: '#2563eb', fontWeight: '700', fontSize: '14px' }}>{p.price.toLocaleString()} ກີບ</p>
        <p style={{ margin: '4px 0 2px', fontSize: '11px', color: '#64748b' }}>SKU: {p.sku || '-'}</p>
        <p style={{ margin: '2px 0 0', fontSize: '12px', fontWeight: '500', color: inStock ? '#16a34a' : '#dc2626' }}>
          ຄົງເຫຼືອ: {p.stock} {p.unit || ''}
        </p>
        {Number(p.conversionRate) > 1 && (
          <p style={{ margin: '1px 0 0', fontSize: '10px', color: '#94a3b8' }}>
            ≈ {Math.floor((p.stock || 0) / p.conversionRate)} {p.purchaseUnit || p.unit}
            {((p.stock || 0) % p.conversionRate) > 0 && ` + ${(p.stock || 0) % p.conversionRate} ${p.unit}`}
          </p>
        )}
      </div>
    </div>
  );
}

function App() {
  // 🔐 State ສຳລັບການ Login ແລະ ຈັດການກະ (Shift)
  const [employee, setEmployee] = useState(null);
  const [shopSettings, setShopSettings] = useState(null); // 🏦 ຄ່າຮ້ານ (ໂດຍສະເພາະ QR ຮັບເງິນໂອນຈິງ)
  const [currentShift, setCurrentShift] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false); // ✅ ກວດ session ເກົ່າແລ້ວ (ກັນໜ້າ Login ກະພິບຕອນ refresh)
  
  // State ສຳລັບໜ້າ Login
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [needsShiftOpen, setNeedsShiftOpen] = useState(false);
  const [tempEmployee, setTempEmployee] = useState(null);
  const [startingCash, setStartingCash] = useState('');

  // 🧭 State ຂອງລະບົບ POS ແລະ Admin
  const [activeTab, setActiveTab] = useState('pos');
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [receipt, setReceipt] = useState(null);

  // 💳 State ສຳລັບການເລືອກວິທີຊຳລະເງິນ (Cash ຫຼື QR Code)
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState('cash'); // 'cash' ຫຼື 'qr'
  const [cashReceived, setCashReceived] = useState('');
  const [isCheckingQR, setIsCheckingQR] = useState(false);
  // 🎞️ ເປີດ/ປິດໂໝດສະໄລ້ອັດຕະໂນມັດ (ຈື່ຄ່າໄວ້ໃນເຄື່ອງ, ເລີ່ມຕົ້ນ = ເປີດ)
  const [autoSlideOn, setAutoSlideOn] = useState(() => {
    try { return localStorage.getItem(AUTO_SLIDE_STORAGE_KEY) !== 'off'; } catch { return true; }
  });
  const productScrollRef = useRef(null);
  const [qrVerified, setQrVerified] = useState(false); // ✅ ພະນັກງານຕ້ອງຕິກຢືນຢັນວ່າກວດເບິ່ງເງິນເຂົ້າຈິງແລ້ວ ກ່ອນຢືນຢັນການຊຳລະ QR
  
  // ⌨️ State ສຳລັບເກັບ Buffer ຂອງບາໂຄດທີ່ກຳລັງຍິງເຂົ້າມາ
  const [barcodeBuffer, setBarcodeBuffer] = useState('');
  const barcodeTimerRef = useRef(null);
  // ✨ ຕິດຕາມທິດທາງການເລື່ອນຂອງພື້ນທີ່ສິນຄ້າ (ຂຶ້ນ/ລົງ) ເພື່ອໃຫ້ບັດເຄື່ອນໄຫວເຂົ້າມາຖືກທິດ
  const scrollDirRef = useRef('down');
  const lastScrollTopRef = useRef(0);
  const handleProductScroll = (e) => {
    const top = e.currentTarget.scrollTop;
    if (top !== lastScrollTopRef.current) {
      scrollDirRef.current = top > lastScrollTopRef.current ? 'down' : 'up';
      lastScrollTopRef.current = top;
    }
  };

  const toggleAutoSlide = () => {
    setAutoSlideOn((prev) => {
      const next = !prev;
      try { localStorage.setItem(AUTO_SLIDE_STORAGE_KEY, next ? 'on' : 'off'); } catch { /* ບໍ່ເປັນຫຍັງ */ }
      return next;
    });
  };

  // 🎞️ ໂໝດສະໄລ້ອັດຕະໂນມັດ: ເຮັດວຽກສະເພາະຕອນ "ວ່າງຈິງ" — ລູກຄ້າບໍ່ມີສິນຄ້າໃນກະຕ່າ ແລະ ບໍ່ມີໜ້າຕ່າງຈ່າຍເງິນ/ໃບບິນ/ເປີດກະ ຄ້າງຢູ່
  const slideAllowed = Boolean(employee) && !needsShiftOpen && (activeTab === 'pos' || employee?.role === 'cashier')
    && cart.length === 0 && !isCashModalOpen && !receipt;
  useEffect(() => {
    if (!autoSlideOn || !slideAllowed) return undefined;
    // ຄົນທີ່ຕັ້ງຄ່າລະບົບໃຫ້ "ຫຼຸດການເຄື່ອນໄຫວ" ຈະບໍ່ເຫັນການເລື່ອນອັດຕະໂນມັດ
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;

    let idleTimer = null;
    let rafId = null;
    let running = false;
    let dir = 1;          // 1 = ເລື່ອນລົງ, -1 = ເລື່ອນຂຶ້ນ
    let pos = 0;          // ຕຳແໜ່ງແບບທົດສະນິຍົມ (browser ປັດ scrollTop ເປັນເລກເຕັມ ຖ້າບວກເທື່ອລະໜ້ອຍຈະບໍ່ຂະຫຍັບ)
    let last = 0;
    let pauseUntil = 0;
    let mouseAnchor = null;

    const step = (t) => {
      const el = productScrollRef.current;
      if (!running || !el) return;
      if (!last) last = t;
      const dt = Math.min(t - last, 50); // ກັນກະໂດດ ຖ້າແທັບຖືກໜ່ວງ
      last = t;
      const max = el.scrollHeight - el.clientHeight;
      if (max > 4 && t >= pauseUntil) {
        pos += dir * AUTO_SLIDE_SPEED * (dt / 1000);
        if (pos >= max) { pos = max; dir = -1; pauseUntil = t + AUTO_SLIDE_END_PAUSE_MS; }
        else if (pos <= 0) { pos = 0; dir = 1; pauseUntil = t + AUTO_SLIDE_END_PAUSE_MS; }
        el.scrollTop = pos;
      }
      rafId = requestAnimationFrame(step);
    };

    const start = () => {
      const el = productScrollRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      pos = el.scrollTop;
      dir = pos >= max - 1 ? -1 : 1;
      last = 0;
      pauseUntil = 0;
      running = true;
      rafId = requestAnimationFrame(step);
    };

    const stop = () => {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = null;
    };

    const armIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(start, AUTO_SLIDE_IDLE_MS);
    };

    // ການໃຊ້ງານໃດໆ (ກົດ/ແຕະ/ເລື່ອນລໍ້/ພິມ ຫຼື ຍິງບາໂຄດ ເຊິ່ງເຄື່ອງຍິງສົ່ງມາເປັນການພິມ) → ຢຸດທັນທີ ແລ້ວເລີ່ມນັບເວລາວ່າງໃໝ່
    const onActivity = () => { mouseAnchor = null; stop(); armIdle(); };
    // ເມົາສ໌ສັ່ນເລັກນ້ອຍບໍ່ນັບ — ຕ້ອງຂະຫຍັບເກີນ ~8 ພິກເຊວ ຈຶ່ງຖືວ່າກຳລັງຈະໃຊ້ງານ
    const onMouseMove = (e) => {
      if (!mouseAnchor) { mouseAnchor = { x: e.clientX, y: e.clientY }; return; }
      if (Math.hypot(e.clientX - mouseAnchor.x, e.clientY - mouseAnchor.y) > 8) onActivity();
    };

    const events = ['pointerdown', 'wheel', 'keydown', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, onActivity, { passive: true }));
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    armIdle();

    return () => {
      clearTimeout(idleTimer);
      stop();
      events.forEach((ev) => window.removeEventListener(ev, onActivity));
      window.removeEventListener('mousemove', onMouseMove);
    };
  }, [autoSlideOn, slideAllowed]);

  // 📦 ດຶງຂໍ້ມູນສິນຄ້າຈາກ Server
  const fetchProducts = useCallback((isBackground = false) => {
    fetch(`${API_BASE_URL}/api/products`, { headers: authHeaders() })
      .then(async (res) => {
        // 🔒 Token ໝົດອາຍຸ/ບໍ່ຖືກຕ້ອງ → ລ້າງ session ແລ້ວກັບໄປໜ້າ Login (ແທນທີ່ຈະ crash ເປັນໜ້າຂາວ)
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('employee');
          window.location.reload();
          return;
        }
        const data = await res.json();
        // ຮັບສະເພາະ array — ຖ້າບໍ່ແມ່ນ (error object) ຈະຄົງລາຍການເກົ່າໄວ້ ບໍ່ໃຫ້ .map/.find ພັງ
        if (Array.isArray(data)) setProducts(data);
        else if (!isBackground) console.error('Unexpected products response:', data);
      })
      .catch((err) => {
        if (!isBackground) {
          console.error('Error fetching products:', err);
        }
      });
  }, []);

  // 🛒 ເພີ່ມສິນຄ້າເຂົ້າກະຕ່າຍ
  const addToCart = useCallback((product) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item._id === product._id);
      if (existing) {
        return prevCart.map((item) =>
          item._id === product._id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prevCart, { ...product, quantity: 1 }];
    });
  }, []);

  // 🔍 ປະມວນລະຫັດບາໂຄດທີ່ຍິງເຂົ້າມາ
  const processScannedBarcode = useCallback((code) => {
    const foundProduct = products.find((p) => p.sku === code);

    if (foundProduct) {
      if (foundProduct.stock > 0) {
        addToCart(foundProduct);
      } else {
        alert('❌ ສິນຄ້ານີ້ໝົດສະຕັອກແລ້ວ!');
      }
    } else {
      alert(`⚠️ ບໍ່ພົບສິນຄ້າທີ່ມີລະຫັດບາໂຄດ: "${code}"`);
    }
  }, [products, addToCart]);

  const removeFromCart = useCallback((productId) => {
    setCart((prevCart) => {
      return prevCart
        .map((item) => {
          if (item._id === productId) {
            return { ...item, quantity: item.quantity - 1 };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  }, []);

  useEffect(() => {
    if (employee) {
      fetchProducts(false); // ໂຫຼດປົກກະຕິເມື່ອ Login ເຂົ້າມາ
      // 🏦 ດຶງຄ່າຮ້ານ (QR ຈິງ) ນຳ — ໃຊ້ສະແດງຕອນເລືອກຊຳລະຜ່ານ QR
      fetch(`${API_BASE_URL}/api/settings`, { headers: authHeaders() })
        .then((res) => res.json())
        .then((data) => setShopSettings(data))
        .catch((err) => console.error('Error fetching shop settings:', err));
    }
  }, [employee, fetchProducts]);

  // 🔄 ກູ້ຄືນ Session ເມື່ອ refresh ໜ້າເວັບ — ກວດ token ກັບ server ກ່ອນສະເໝີ (ບໍ່ເຊື່ອ localStorage ຢ່າງດຽວ)
  //   - token ໝົດອາຍຸ/ບໍ່ຖືກຕ້ອງ (401)      → ລ້າງ session ແລ້ວສະແດງໜ້າ Login
  //   - admin                                → ເຂົ້າລະບົບເລີຍ
  //   - cashier ທີ່ຍັງມີກະເປີດ               → ເຂົ້າ POS ພ້ອມກະເກົ່າ
  //   - cashier ທີ່ບໍ່ມີກະເປີດ               → ສະແດງຟອມເປີດກະ (ຍັງບໍ່ເຂົ້າ POS ຈົນກວ່າຈະເປີດກະ)
  useEffect(() => {
    const token = localStorage.getItem('token');
    const empStr = localStorage.getItem('employee');
    if (!token || !empStr) {
      setSessionChecked(true);
      return;
    }

    let emp;
    try {
      emp = JSON.parse(empStr);
    } catch {
      localStorage.removeItem('token');
      localStorage.removeItem('employee');
      setSessionChecked(true);
      return;
    }

    fetch(`${API_BASE_URL}/api/shifts/my`, { headers: authHeaders() })
      .then(async (res) => {
        if (res.status === 401) {
          localStorage.removeItem('token');
          localStorage.removeItem('employee');
          return;
        }
        const data = await res.json().catch(() => null);
        if (!res.ok || !data) return; // server ມີບັນຫາ → ໃຫ້ Login ໃໝ່

        if (emp.role === 'admin') {
          setEmployee(emp);
        } else if (data.shift) {
          setEmployee(emp);
          setCurrentShift(data.shift);
        } else {
          setTempEmployee(emp);
          setNeedsShiftOpen(true);
        }
      })
      .catch((err) => console.error('Restore session error:', err))
      .finally(() => setSessionChecked(true));
  }, []);

  // 🔄 ລະບົບ Auto-Refresh ດຶງຂໍ້ມູນສິນຄ້າອັດຕະໂນມັດທຸກໆ 10 ວິນາທີ
  useEffect(() => {
    if (!employee) return;

    const intervalId = setInterval(() => {
      fetchProducts(true); // ສົ່ງ true ໄປນຳ ເພື່ອດຶງແບບງຽບໆ ບໍ່ໃຫ້ໜ້າຈໍຂັດຂ້ອງ
    }, 3000);

    return () => clearInterval(intervalId);
  }, [employee, fetchProducts]);

  // 🌍 ຕັ້ງຄ່າ Global Keydown Listener ສຳລັບຮັບຄ່າບາໂຄດທົ່ວທັງໜ້າຈໍ
  useEffect(() => {
    if (!employee || employee.role !== 'cashier' || activeTab !== 'pos') return;

    const handleGlobalKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

      if (e.key === 'Enter') {
        if (barcodeBuffer.trim().length > 0) {
          processScannedBarcode(barcodeBuffer.trim());
          setBarcodeBuffer('');
        }
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        return;
      }

      if (e.key.length === 1) {
        setBarcodeBuffer((prev) => prev + e.key);
      }

      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
      barcodeTimerRef.current = setTimeout(() => {
        setBarcodeBuffer('');
      }, 300);
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
      if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
    };
  }, [employee, activeTab, barcodeBuffer, products, processScannedBarcode]);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, pin: loginPin }),
      });
      const data = await res.json();

      if (!res.ok) return alert('❌ ' + (data.error || 'Login ບໍ່ສຳເລັດ'));

      // 🔒 ບັນທຶກ Token ໄວ້ໃນ localStorage — ຂາດອັນນີ້ໄປກ່ອນໜ້ານີ້ ເຮັດໃຫ້ທຸກ API call ຫຼັງ Login ຖືກປະຕິເສດ (401)
      localStorage.setItem('token', data.token);
      // 🔒 ບັນທຶກ employee ໄວ້ນຳ — ໃຫ້ໜ້າ /admin (ຄົນລະ page, mount ແຍກຈາກ App.jsx) ຮູ້ວ່າໃຜ login ຢູ່ ໂດຍບໍ່ຕ້ອງຜ່ານ state ຂອງ App.jsx
      localStorage.setItem('employee', JSON.stringify(data.employee));

      if (data.employee.role === 'admin') {
        setEmployee(data.employee);
      } else {
        setTempEmployee(data.employee);
        setNeedsShiftOpen(true);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່ Server');
    }
  };

  const handleOpenShift = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE_URL}/api/shifts/open`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ 
          employeeId: tempEmployee._id, 
          employeeName: tempEmployee.name, 
          startingCash: Number(startingCash) 
        }),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem('employee', JSON.stringify(tempEmployee));
        setEmployee(tempEmployee);
        setCurrentShift(data.shift);
        setNeedsShiftOpen(false);
      } else {
        alert('❌ ' + data.error);
      }
    } catch (err) {
      console.error('Open shift error:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເປີດກະ');
    }
  };

  const handleCloseShift = async () => {
    if (!currentShift) return;
    const actualCashInput = prompt('ກະລຸນານັບເງິນສົດຕົວຈິງໃນລິ້ນຊັກແລ້ວປ້ອນຈຳນວນເງິນລົງທີ່ນີ້:');
    if (actualCashInput === null) return;
    if (actualCashInput.trim() === '' || !Number.isFinite(Number(actualCashInput)) || Number(actualCashInput) < 0) {
      return alert('❌ ກະລຸນາປ້ອນຈຳນວນເງິນສົດຕົວຈິງເປັນຕົວເລກ (0 ຫຼື ຫຼາຍກວ່າ)');
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/shifts/close/${currentShift._id}`, {
        method: 'PUT',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ actualCash: Number(actualCashInput) }),
      });
      const data = await res.json();

      if (res.ok) {
        alert(`✅ ປິດກະສຳເລັດ!\n- ເງິນໃນລິ້ນຊັກຕົວຈິງ: ${data.shift.actualCash.toLocaleString()} ກີບ\n- ເງິນທີ່ຄວນຈະມີ: ${data.shift.expectedCash.toLocaleString()} ກີບ`);
        handleLogout();
      } else {
        alert('❌ ' + data.error);
      }
    } catch (err) {
      console.error('Close shift error:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການປິດກະ');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token'); // 🔒 ລ້າງ Token ອອກຕອນ Logout ດ້ວຍ
    localStorage.removeItem('employee');
    setEmployee(null);
    setCurrentShift(null);
    setTempEmployee(null);
    setLoginUsername('');
    setLoginPin('');
    setStartingCash('');
    setNeedsShiftOpen(false);
    setCart([]);
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const openCashDrawer = () => {
    console.log('🗄️ Sending signal to Open Cash Drawer...');
  };

  const handleCheckoutClick = () => {
    if (cart.length === 0) return alert('ກະລຸນາເລືອກສິນຄ້າກ່ອນ!');
    setIsCashModalOpen(true);
    setPaymentType('cash');
    setCashReceived('');
    setQrVerified(false);
  };

  const handleConfirmPayment = async () => {
    const received = Number(cashReceived);
    if (isNaN(received) || received < totalAmount) {
      return alert('❌ ຈຳນວນເງິນທີ່ຮັບມາໜ້ອຍກວ່າຍອດລວມສິນຄ້າ!');
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ 
          items: cart, 
          paymentMethod: 'Cash',
          cashReceived: received
        }),
      });

      const data = await response.json();
      if (response.ok) {
        openCashDrawer();
        setIsCashModalOpen(false);
        setReceipt({
          orderId: data.order._id,
          items: [...cart],
          totalAmount: data.order.totalAmount,
          cashReceived: data.order.cashReceived,
          changeAmount: data.order.changeAmount,
          date: new Date().toLocaleString(),
          employeeId: data.order.employeeId,
          paymentMethod: data.order.paymentMethod
        });
        setCart([]);
        fetchProducts(false);
      } else {
        if (data.code === 'NO_OPEN_SHIFT') {
          alert('⚠️ ' + data.error);
          window.location.reload(); // ກັບໄປຟອມເປີດກະ
          return;
        }
        alert('Checkout failed: ' + data.error);
      }
    } catch (err) {
      console.error('Checkout error:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່');
    }
  };

  const handleConfirmQRPayment = async () => {
    if (!qrVerified) return alert('❌ ກະລຸນາຕິກຊ່ອງຢືນຢັນວ່າ ກວດເບິ່ງເງິນເຂົ້າຈິງແລ້ວ ກ່ອນ');
    setIsCheckingQR(true);

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ 
          items: cart, 
          paymentMethod: 'QR Code',
          cashReceived: totalAmount
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setIsCheckingQR(false);
        setIsCashModalOpen(false);

        setReceipt({
          orderId: data.order._id,
          items: [...cart],
          totalAmount: data.order.totalAmount,
          cashReceived: data.order.cashReceived,
          changeAmount: data.order.changeAmount,
          date: new Date().toLocaleString(),
          employeeId: data.order.employeeId,
          paymentMethod: data.order.paymentMethod
        });
        setCart([]);
        fetchProducts(false);
        alert('✅ ຊຳລະເງິນຜ່ານ QR Code ສໍາເລັດແລ້ວ!');
      } else {
        setIsCheckingQR(false);
        if (data.code === 'NO_OPEN_SHIFT') {
          alert('⚠️ ' + data.error);
          window.location.reload(); // ກັບໄປຟອມເປີດກະ
          return;
        }
        alert('Checkout failed: ' + data.error);
      }
    } catch (err) {
      setIsCheckingQR(false);
      console.error('Checkout error:', err);
      alert('ເກີດຂໍ້ຜິດພາດໃນການເຊື່ອມຕໍ່');
    }
  };

  if (!sessionChecked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f1f5f9', color: '#64748b' }}>
        ກຳລັງກວດສອບການເຂົ້າສູ່ລະບົບ...
      </div>
    );
  }

  if (!employee) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f1f5f9' }}>
        <div style={{ background: '#fff', padding: '30px', borderRadius: '12px', boxShadow: '0 4px 15px rgba(0,0,0,0.05)', width: '380px' }}>
          
          {!needsShiftOpen ? (
            <form onSubmit={handleLogin}>
              <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#1e293b' }}>🔐 ເเข้าສູ່ລະບົບ POS</h2>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#475569' }}>Username</label>
                <input type="text" value={loginUsername} onChange={(e) => setLoginUsername(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
              </div>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#475569' }}>ລະຫັດ PIN</label>
                <input type="password" maxLength="6" value={loginPin} onChange={(e) => setLoginPin(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
              </div>
              <button type="submit" style={{ width: '100%', padding: '12px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ເຂົ້າສູ່ລະບົບ</button>
            </form>
          ) : (
            <form onSubmit={handleOpenShift}>
              <h2 style={{ textAlign: 'center', marginBottom: '10px', color: '#1e293b' }}>📥 ເປີດກະການຂາຍ (Open Shift)</h2>
              <p style={{ textAlign: 'center', fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>ສະບາຍດີ, <b>{tempEmployee.name}</b><br/>ກະລຸນາປ້ອນເງິນທອນຕັ້ງຕົ້ນໃນລິ້ນຊັກ</p>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '5px', color: '#475569' }}>ຈຳນວນເງິນສົດຕັ້ງຕົ້ນ (ກີບ)</label>
                <input type="number" value={startingCash} onChange={(e) => setStartingCash(e.target.value)} placeholder="ຕົວຢ່າງ: 500000" style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box' }} required />
              </div>
              <button type="submit" style={{ width: '100%', padding: '12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ເລີ່ມຕົ້ນຂາຍ (Open Shift)</button>
            </form>
          )}

        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', margin: 0 }}>
      
      <div style={{ background: '#1e293b', color: '#fff', padding: '12px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>🏪 Retail POS System</h1>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            👤 ຜູ້ໃຊ້: <b style={{ color: '#fff' }}>{employee.name}</b> ({employee.role === 'admin' ? '👑 Admin' : '🛍️ Cashier'})
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {employee.role === 'admin' && (
            <>
              <button 
                onClick={() => setActiveTab('pos')}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', background: activeTab === 'pos' ? '#2563eb' : '#334155', color: '#fff' }}
              >
                🛒 ຂາຍໜ້າຮ້ານ (POS)
              </button>
              <button 
                onClick={() => setActiveTab('employees')}
                style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', background: activeTab === 'employees' ? '#2563eb' : '#334155', color: '#fff' }}
              >
                👥 ຈັດການພະນັກງານ
              </button>
              <a 
                href="/admin"
                style={{ padding: '8px 16px', borderRadius: '6px', background: '#7c3aed', color: '#fff', textDecoration: 'none', fontWeight: '600', fontSize: '13px', cursor: 'pointer' }}
              >
                🛠️ Admin Dashboard
              </a>
            </>
          )}

          {employee.role === 'cashier' && (
            <button 
              onClick={handleCloseShift}
              style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
            >
              🔒 ປິດກະ (Close Shift)
            </button>
          )}

          <button 
            onClick={handleLogout}
            style={{ background: '#64748b', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
          >
            ອອກຈາກລະບົບ
          </button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
        {activeTab === 'pos' || employee.role === 'cashier' ? (
          <div style={{ display: 'flex', width: '100%', height: '100%' }}>
            <div ref={productScrollRef} onScroll={handleProductScroll} style={{ flex: 2, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              <style>{POS_SCROLL_CSS}</style>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h2 style={{ color: '#1e293b', margin: 0, fontSize: '22px', fontWeight: '700' }}>ລະບົບຂາຍສິນຄ້າ (ຍິງບາໂຄດໄດ້ທົ່ວໜ້າຈໍ)</h2>
                {/* 🖲️ ຄົງປຸ່ມ ຣີເຟຣຊສິນຄ້າ ເກົ່າໄວ້ຄືເກົ່າ */}
                <button 
                  onClick={() => fetchProducts(false)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '6px', 
                    padding: '8px 12px', background: '#f8fafc', 
                    color: '#475569', fontSize: '13px', fontWeight: '600', 
                    borderRadius: '8px', border: '1px solid #cbd5e1', cursor: 'pointer' 
                  }}
                >
                  ຣີເຟຣຊສິນຄ້າ
                </button>

                {/* 🎞️ ປິດ/ເປີດ ການເລື່ອນອັດຕະໂນມັດຕອນວ່າງ — ຈື່ຄ່າໄວ້ໃນເຄື່ອງ */}
                <button
                  onClick={toggleAutoSlide}
                  title={autoSlideOn ? 'ປິດການເລື່ອນອັດຕະໂນມັດຕອນວ່າງ' : 'ເປີດການເລື່ອນອັດຕະໂນມັດຕອນວ່າງ'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '8px 12px', background: autoSlideOn ? '#eff6ff' : '#f8fafc',
                    color: autoSlideOn ? '#2563eb' : '#94a3b8', fontSize: '13px', fontWeight: '600',
                    borderRadius: '8px', border: `1px solid ${autoSlideOn ? '#bfdbfe' : '#cbd5e1'}`, cursor: 'pointer'
                  }}
                >
                  {autoSlideOn ? '🎞️ ສະໄລ້ອັດຕະໂນມັດ: ເປີດ' : '🎞️ ສະໄລ້ອັດຕະໂນມັດ: ປິດ'}
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: '16px' }}>
                {products.map((p, i) => (
                  <ProductCard key={p._id} product={p} index={i} scrollDirRef={scrollDirRef} onAdd={addToCart} />
                ))}
              </div>
            </div>

            <div style={{ flex: 1, background: '#fff', padding: '24px', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' }}>
              <h3 style={{ marginTop: 0, color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '12px', fontSize: '18px', fontWeight: '700' }}>🛍️ ຕະຕະລາງສິນຄ້າ</h3>
              
              <div style={{ flex: 1, overflowY: 'auto', margin: '10px 0' }}>
                {cart.length === 0 ? (
                  <p style={{ color: '#94a3b8', textAlign: 'center', marginTop: '120px', fontSize: '14px' }}>ຍັງບໍ່ມີສິນຄ້າໃນຕະຕະລາງ</p>
                ) : (
                  cart.map((item) => (
                    <div key={item._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', borderBottom: '1px solid #f8fafc', paddingBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={resolveImageUrl(item.image)} alt={item.name} style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #f1f5f9' }} />
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b' }}>{item.name}</div>
                          <div style={{ fontSize: '12px', color: '#64748b' }}>{item.price.toLocaleString()} x {item.quantity}</div>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13px' }}>
                          {(item.price * item.quantity).toLocaleString()}
                        </div>
                        <button 
                          onClick={() => removeFromCart(item._id)}
                          style={{ background: '#fee2e2', color: '#ef4444', border: 'none', borderRadius: '6px', width: '26px', height: '26px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div style={{ borderTop: '2px solid #f1f5f9', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: '600', marginBottom: '16px', color: '#1e293b' }}>
                  <span>ລວມທັງໝົດ:</span>
                  <span style={{ color: '#16a34a', fontSize: '20px', fontWeight: '700' }}>{totalAmount.toLocaleString()} ກີບ</span>
                </div>
                <button 
                  onClick={handleCheckoutClick}
                  style={{ width: '100%', padding: '14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' }}
                >
                  ຊຳລະເງິນ (Checkout)
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
            <EmployeeManagement />
          </div>
        )}
      </div>

      <ReceiptModal receipt={receipt} onClose={() => setReceipt(null)} />

      {/* 💵 Modal ຊຳລະເງິນ (ຮອງຮັບທັງ ເງິນສົດ ແລະ QR Code) */}
      {isCashModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', padding: '30px', borderRadius: '16px', width: '520px', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 15px', color: '#1e293b', fontSize: '22px', fontWeight: 'bold' }}>💳 ເລືອກວິທີການຊຳລະເງິນ</h3>
            
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button 
                onClick={() => setPaymentType('cash')}
                style={{ flex: 1, padding: '12px', background: paymentType === 'cash' ? '#2563eb' : '#f1f5f9', color: paymentType === 'cash' ? '#fff' : '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                💵 ເງິນສົດ (Cash)
              </button>
              <button 
                onClick={() => setPaymentType('qr')}
                style={{ flex: 1, padding: '12px', background: paymentType === 'qr' ? '#2563eb' : '#f1f5f9', color: paymentType === 'qr' ? '#fff' : '#475569', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                📱 ສະແກນ QR Code
              </button>
            </div>

            <div style={{ marginBottom: '16px', background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', color: '#64748b' }}>
                <span>ຍອດລວມທັງໝົດ:</span>
                <span style={{ fontWeight: 'bold', color: '#16a34a', fontSize: '20px' }}>{totalAmount.toLocaleString()} ກີບ</span>
              </div>
            </div>

            {paymentType === 'cash' ? (
              <>
                <div style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', marginBottom: '6px', color: '#334155' }}>ຈຳນວນເງິນທີ່ລູກຄ້າໃຫ້ມາ (ກີບ)</label>
                  <input 
                    type="number" 
                    autoFocus
                    value={cashReceived} 
                    onChange={(e) => setCashReceived(e.target.value)} 
                    placeholder="ປ້ອນຈຳນວນເງິນ..." 
                    style={{ width: '100%', padding: '14px', borderRadius: '8px', border: '2px solid #cbd5e1', fontSize: '20px', fontWeight: 'bold', boxSizing: 'border-box' }} 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
                  <button onClick={() => setCashReceived(totalAmount.toString())} style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>ພໍດີ</button>
                  <button onClick={() => setCashReceived('20000')} style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>20,000</button>
                  <button onClick={() => setCashReceived('50000')} style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>50,000</button>
                  <button onClick={() => setCashReceived('100000')} style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>100,000</button>
                  <button onClick={() => setCashReceived('200000')} style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>200,000</button>
                  <button onClick={() => setCashReceived('500000')} style={{ padding: '10px', background: '#e2e8f0', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>500,000</button>
                </div>

                {Number(cashReceived) >= totalAmount && (
                  <div style={{ marginBottom: '20px', background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', color: '#166534' }}>ເງິນທອນ: </span>
                    <span style={{ fontSize: '22px', fontWeight: 'bold', color: '#16a34a' }}>{(Number(cashReceived) - totalAmount).toLocaleString()} ກີບ</span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setIsCashModalOpen(false)} style={{ flex: 1, padding: '12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ຍົກເລີກ</button>
                  <button 
                    onClick={handleConfirmPayment}
                    disabled={Number(cashReceived) < totalAmount}
                    style={{ flex: 1, padding: '12px', background: Number(cashReceived) < totalAmount ? '#94a3b8' : '#16a34a', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: Number(cashReceived) < totalAmount ? 'not-allowed' : 'pointer' }}
                  >
                    ຢືນຢັນການຊຳລະເງິນສົດ
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                {shopSettings && shopSettings.shopQRImage ? (
                  <>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '15px' }}>ກະລຸນາໃຫ້ລູກຄ້າສະແກນ QR Code ດ້ານລຸ່ມນີ້ເພື່ອຊຳລະເງິນ</p>
                    <div style={{ background: '#f1f5f9', padding: '20px', borderRadius: '12px', display: 'inline-block', marginBottom: '20px', border: '1px solid #cbd5e1' }}>
                      <img
                        src={resolveImageUrl(shopSettings.shopQRImage)}
                        alt="Payment QR Code"
                        style={{ width: '220px', height: '220px', objectFit: 'contain' }}
                      />
                      <div style={{ marginTop: '8px', fontWeight: 'bold', color: '#1e293b' }}>ຈຳນວນ: {totalAmount.toLocaleString()} ກີບ</div>
                    </div>
                    {/* ⚠️ ລະບົບບໍ່ໄດ້ຕໍ່ API ທະນາຄານ — ບໍ່ສາມາດກວດສອບອັດຕະໂນມັດວ່າເງິນເຂົ້າແທ້ຫຼືບໍ່, ຄາຊເຊຍຕ້ອງເບິ່ງເອງ */}
                    <div style={{ background: '#fff7ed', border: '1px solid #fdba74', color: '#9a3412', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', marginBottom: '16px', textAlign: 'left' }}>
                      ⚠️ ລະບົບບໍ່ໄດ້ເຊື່ອມຕໍ່ທະນາຄານໂດຍກົງ — ກະລຸນາເບິ່ງແອັບທະນາຄານ/SMS ຢືນຢັນວ່າ<strong>ເງິນເຂົ້າແທ້ຈິງ</strong>ກ່ອນກົດປຸ່ມຢືນຢັນລຸ່ມນີ້
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', cursor: 'pointer', textAlign: 'left', fontSize: '13px', color: '#166534', fontWeight: '600' }}>
                      <input
                        type="checkbox"
                        checked={qrVerified}
                        onChange={(e) => setQrVerified(e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      ຂ້ອຍກວດເບິ່ງແອັບທະນາຄານ/SMS ແລ້ວວ່າໄດ້ຮັບເງິນຈິງ
                    </label>
                  </>
                ) : (
                  <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '10px', padding: '20px', marginBottom: '20px' }}>
                    ⚠️ ຮ້ານຍັງບໍ່ໄດ້ຕັ້ງ QR ຮັບເງິນໂອນ — ກະລຸນາໃຫ້ admin ໄປຕັ້ງຄ່າໃນໜ້າ "ຕັ້ງຄ່າຮ້ານ" ກ່ອນ ຈຶ່ງຈະໃຊ້ຮັບເງິນຜ່ານ QR ໄດ້
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={() => setIsCashModalOpen(false)} style={{ flex: 1, padding: '12px', background: '#e2e8f0', color: '#334155', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ຍົກເລີກ</button>
                  <button 
                    onClick={handleConfirmQRPayment}
                    disabled={isCheckingQR || !qrVerified || !(shopSettings && shopSettings.shopQRImage)}
                    style={{ flex: 1, padding: '12px', background: (isCheckingQR || !qrVerified || !(shopSettings && shopSettings.shopQRImage)) ? '#94a3b8' : '#2563eb', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: (isCheckingQR || !qrVerified || !(shopSettings && shopSettings.shopQRImage)) ? 'not-allowed' : 'pointer' }}
                  >
                    {isCheckingQR ? 'ກຳລັງບັນທຶກ...' : '✅ ຢືນຢັນວ່າໄດ້ຮັບເງິນແລ້ວ'}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}

export default App;