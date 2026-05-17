import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, collection, doc, onSnapshot, deleteDoc, addDoc, setDoc, writeBatch, runTransaction, getDocs
} from 'firebase/firestore';
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from 'firebase/auth';
import {
  PlusCircle, Trash2, Search, X, ArrowUpRight, ArrowDownRight, Settings as SettingsIcon, Plus,
  CreditCard, Banknote, Filter, User, Zap, Cpu, ScanBarcode, Send,
  LayoutDashboard, Database, BarChart3, CheckCircle, PieChart,
  Receipt, Download, Upload, FileText, AlertCircle, Archive,
  ShieldAlert, MonitorPlay, Package, Users, Boxes, DollarSign,
  Edit3, Save, AlertTriangle, LogOut, Eye, EyeOff, ShoppingCart, Tag, ShieldCheck, Cloud, Lock
} from 'lucide-react';

// ─── Permission Options ─────────────────────────────────────────────────────
const PERMISSION_OPTIONS = [
  { key: 'create_sale', label: 'အရောင်းလုပ်ခွင့်' },
  { key: 'view_sales', label: 'အရောင်းမှတ်တမ်းကြည့်ခွင့်' },
  { key: 'accept_payment', label: 'ကြွေးဆပ်လက်ခံခွင့်' },
  { key: 'view_inventory', label: 'ကုန်လက်ကျန်ကြည့်ခွင့်' },
  { key: 'create_purchase', label: 'အဝယ်လုပ်ခွင့်' },
  { key: 'create_expense', label: 'စားရိတ်ထည့်ခွင့်' },
  { key: 'manage_inventory', label: 'ကုန်လက်ကျန်ပြင်ခွင့်' },
  { key: 'manage_products', label: 'ကုန်ပစ္စည်းစီမံခွင့်' },
  { key: 'manage_users', label: 'User စီမံခွင့်' },
  { key: 'delete_records', label: 'မှတ်တမ်းဖျက်ခွင့်' },
  { key: 'view_reports', label: 'Dashboard/Report ကြည့်ခွင့်' },
  { key: 'settings', label: 'ဆက်တင်ပြင်ခွင့်' },
];

const DEFAULT_STAFF_PERMS = ['create_sale', 'view_sales', 'accept_payment', 'view_inventory'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = n => (Number(n) || 0).toLocaleString();
const todayISO = () => new Date().toISOString().split('T')[0];
const tsFromDate = dateStr => {
  if (dateStr === todayISO()) return Date.now();
  const d = new Date(dateStr); d.setHours(12, 0, 0, 0);
  return isNaN(d.getTime()) ? Date.now() : d.getTime();
};
const toDateStr = ts => {
  const d = new Date(ts);
  return d.toLocaleDateString('en-GB') + ', ' + d.toLocaleTimeString('en-GB');
};

const simpleHash = str => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h * 0x01000193) >>> 0;
  }
  return 'h_' + h.toString(16).padStart(8, '0');
};

const parseCSVLine = (text) => {
  let ret = [];
  let inQuote = false;
  let value = '';
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char === '"') {
      if (inQuote && text[i+1] === '"') { value += '"'; i++; }
      else { inQuote = !inQuote; }
    } else if (char === ',' && !inQuote) {
      ret.push(value.trim());
      value = '';
    } else {
      value += char;
    }
  }
  ret.push(value.trim());
  return ret.map(v => v.replace(/^"|"$/g, ''));
};

const downloadFile = (filename, content) => {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
};

const doPrint = (record, shopName) => {
  const items = record.itemsDetail || [{ name: record.item, quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0 }];
  const rows = items.map(i => {
    const discStr = i.itemDiscountAmt > 0 ? `<br><small><i>(-${fmt(i.itemDiscountAmt)} Disc)</i></small>` : '';
    return `<tr><td>${i.name}${discStr}</td><td align="right">${i.quantity}</td><td align="right">${fmt((i.unitPrice * i.quantity) - (i.itemDiscountAmt||0))}</td></tr>`;
  }).join('');
  const w = window.open('', '_blank', 'width=380,height=640');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
<style>body{font-family:monospace;font-size:15px;width:320px;margin:auto;padding:14px}
h2,p{text-align:center;margin:5px 0}hr{border:none;border-top:1px dashed #000}
table{width:100%}th{border-bottom:1px solid}td{padding:6px 0;vertical-align:top}
.tot{font-size:18px;font-weight:bold;text-align:right}.ft{text-align:center;font-size:12px;margin-top:14px}</style>
</head><body>
<h2>${shopName || 'POS System'}</h2>
<p>${record.date || ''}</p>
<p>Inv No: ${record.invoiceNo || '-'}</p><hr>
<table><thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Amt</th></tr></thead>
<tbody>${rows}</tbody></table><hr>
${record.discount > 0 ? `<p align="right">Global Disc: -${fmt(record.discount)} Ks</p>` : ''}
<p class="tot">TOTAL: ${fmt(record.amount)} Ks</p>
<p align="right">${record.paymentType === 'Credit' ? '💳 Credit' : '💵 Cash'}</p>
<p align="right">Cashier: ${record.createdBy || '-'}</p>
<hr><div class="ft">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်</div>
</body></html>`);
  w.document.close(); w.focus(); w.print(); w.close();
};

// ═══════════════════════════════════════════════════════════════════════════
// MAIN APP
// ═══════════════════════════════════════════════════════════════════════════
export default function App() {
  const firebaseConfig = useMemo(() => {
    if (process.env.REACT_APP_FIREBASE_CONFIG) {
      return JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
    }
    return {
      apiKey: "AIzaSyAlpJICmBjeJoRuvJgN2kGpAK7AQDAtN6M",
      authDomain: "mtt-pos.firebaseapp.com",
      databaseURL: "https://mtt-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
      projectId: "mtt-pos",
      storageBucket: "mtt-pos.firebasestorage.app",
      messagingSenderId: "681104952532",
      appId: "1:681104952532:web:d89bcf31615bd6fdf33f41",
      measurementId: "G-SX1E8GFLWL"
    };
  }, []);
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const appId = 'cyber-pos-v17';

  const [fbUser, setFbUser] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allRecords, setAllRecords] = useState([]);
  const [allProducts, setAllProducts] = useState([]);
  const [allSettings, setAllSettings] = useState([]);

  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(true);

  const [toast, setToast] = useState(null);
  const showToast = useCallback((msg, type = 'ok') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // ── Beep Sound ──
  const playBeep = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.frequency.value = 800;
      oscillator.type = 'square';
      gainNode.gain.value = 0.1;
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {}
  }, []);

  const [setupMode, setSetupMode] = useState(null);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    if (!fbUser) return;
    (async () => {
      const usersSnap = await getDocs(collection(db, 'pos_users'));
      const hasAdmin = usersSnap.docs.some(d => d.data().role === 'admin');
      setSetupMode(!hasAdmin);
    })();
  }, [fbUser, db]);

  const handleSetup = async (username, password, shopName) => {
    const tenantId = `tenant_${username.trim()}_${Date.now()}`;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);
    await addDoc(collection(db, 'pos_users'), {
      username: username.trim(),
      password: simpleHash(password),
      role: 'admin',
      permissions: [],
      tenantId: tenantId,
      createdAt: Date.now(),
      expiryDate: expiryDate.toISOString(),
    });
    await setDoc(doc(db, 'pos_settings', tenantId), {
      shopName: shopName.trim() || `${username.trim()}'s POS`,
    });
    showToast('✅ Admin အကောင့် ဖန်တီးပြီးပါပြီ (၇ ရက် အစမ်း)', 'ok');
  };

  const currentTenant = currentUser?.tenantId;
  const posUsers = useMemo(() => allUsers.filter(u => u.tenantId === currentTenant), [allUsers, currentTenant]);
  const records = useMemo(() => allRecords.filter(r => r.tenantId === currentTenant), [allRecords, currentTenant]);
  const products = useMemo(() => allProducts.filter(p => p.tenantId === currentTenant), [allProducts, currentTenant]);
  const tenantSettings = useMemo(() => allSettings.find(s => s.id === currentTenant) || { shopName: 'My POS', tgToken: '', tgChatId: '' }, [allSettings, currentTenant]);

  const [shopName, setShopName] = useState('');
  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');

  useEffect(() => {
    if (currentTenant) {
      setShopName(tenantSettings.shopName || 'My POS');
      setTgToken(tenantSettings.tgToken || '');
      setTgChatId(tenantSettings.tgChatId || '');
    }
  }, [tenantSettings, currentTenant]);

  const [view, setView] = useState('Entry');
  const [adminTab, setAdminTab] = useState('Products');
  const [dashPeriod, setDashPeriod] = useState('Today');
  const [selDate, setSelDate] = useState(todayISO());
  const [repStart, setRepStart] = useState(todayISO());
  const [repEnd, setRepEnd] = useState(todayISO());

  const [entryTab, setEntryTab] = useState('Sale');
  const [entryDate, setEntryDate] = useState(todayISO());
  const [personName, setPersonName] = useState('');
  const [cart, setCart] = useState([]);
  const [prodSearch, setProdSearch] = useState('');
  const [showProdDropdown, setShowProdDropdown] = useState(false);
  const [selProdId, setSelProdId] = useState('');
  const [selCategory, setSelCategory] = useState('All');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [paymentType, setPaymentType] = useState('Cash');
  const [globalDiscountAmt, setGlobalDiscountAmt] = useState('');
  const [globalDiscountType, setGlobalDiscountType] = useState('%');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmt, setExpenseAmt] = useState('');

  const [ledSearch, setLedSearch] = useState('');
  const [ledFilter, setLedFilter] = useState('All');
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const [payModal, setPayModal] = useState({ show: false, name: '', debt: 0, amt: '', date: todayISO() });
  const [receiptModal, setReceiptModal] = useState({ show: false, record: null });
  const [historyModal, setHistoryModal] = useState({ show: false, name: '' });
  const [confirmDel, setConfirmDel] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const fileRef = useRef(null);
  const searchRef = useRef(null);

  const [showScanner, setShowScanner] = useState(false);
  const scannerRef = useRef(null);
  const isStopping = useRef(false);

  const hasPermission = useCallback((perm) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions?.includes(perm);
  }, [currentUser]);

  useEffect(() => {
    const handler = (e) => { if (searchRef.current && !searchRef.current.contains(e.target)) setShowProdDropdown(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    signInAnonymously(auth);
    return onAuthStateChanged(auth, u => { setFbUser(u); if (!u) setAuthLoading(false); });
  }, [auth]);

  useEffect(() => {
    if (!fbUser) return;
    const u1 = onSnapshot(collection(db, 'pos_users'), s => {
      setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setAuthLoading(false);
    });
    const u2 = onSnapshot(collection(db, 'pos_records'), s => {
      setAllRecords(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setAppLoading(false);
    });
    const u3 = onSnapshot(collection(db, 'pos_products'), s => {
      setAllProducts(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });
    const u4 = onSnapshot(collection(db, 'pos_settings'), s => {
      setAllSettings(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [fbUser, db]);

  useEffect(() => {
    if (currentUser) {
      const fresh = allUsers.find(u => u.id === currentUser.id);
      if (fresh && JSON.stringify(fresh.permissions) !== JSON.stringify(currentUser.permissions)) {
        setCurrentUser(fresh);
      }
    }
  }, [allUsers, currentUser]);

  useEffect(() => {
    if (selProdId) {
      const p = products.find(x => x.id === selProdId);
      if (p) {
        setUnitPrice(String(entryTab === 'Sale' ? p.price || '' : p.costPrice || ''));
        setProdSearch(p.name);
      }
    } else setUnitPrice('');
  }, [selProdId, products, entryTab]);

  useEffect(() => {
    if (!showScanner) return;
    if (!window.Html5Qrcode) { showToast('Scanner library မရှိပါ', 'err'); setShowScanner(false); return; }
    let html5QrCode;
    (async () => {
      try {
        if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
        html5QrCode = new window.Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const prod = products.find(p => p.barcode === decodedText.trim() || p.id === decodedText.trim());
            if (prod) {
              const price = entryTab === 'Sale' ? (prod.price || 0) : (prod.costPrice || 0);
              setCart(prev => {
                const ex = prev.find(c => c.productId === prod.id && c.unitPrice === price);
                if (ex) return prev.map(c => c.id === ex.id ? { ...c, quantity: c.quantity + 1 } : c);
                return [...prev, { id: Date.now() + Math.random(), productId: prod.id, name: prod.name, unitPrice: price, costPrice: prod.costPrice || 0, quantity: 1, itemDiscountAmt: 0 }];
              });
              playBeep();
              showToast(`${prod.name} (1) ခု ထည့်ပြီး ✓`);
            } else showToast('Barcode မတွေ့ပါ', 'err');
            (async () => {
              if (isStopping.current) return; isStopping.current = true;
              if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
              isStopping.current = false; setShowScanner(false);
            })();
          }, () => {}
        );
      } catch { showToast('Camera မရပါ', 'err'); setShowScanner(false); }
    })();
    return () => { isStopping.current = true; if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } };
  }, [showScanner]);

  // ─── Data Processing ──────────────────────────────────────────────────────
  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const lowStock = useMemo(() => products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)), [products]);

  const filteredProdsForDropdown = useMemo(() => products.filter(p => {
    const ms = (p.name || '').toLowerCase().includes(prodSearch.toLowerCase()) || (p.barcode || '').includes(prodSearch);
    const mc = selCategory === 'All' || p.category === selCategory;
    return ms && mc;
  }), [products, prodSearch, selCategory]);

  const periodRecs = useMemo(() => {
    const now = Date.now();
    if (dashPeriod === 'Today') return records.filter(r => new Date(r.createdAt || 0).toISOString().split('T')[0] === selDate);
    if (dashPeriod === 'Week') return records.filter(r => now - (r.createdAt || 0) <= 7 * 86400000);
    if (dashPeriod === 'Month') return records.filter(r => now - (r.createdAt || 0) <= 30 * 86400000);
    return records;
  }, [records, dashPeriod, selDate]);

  const stats = useMemo(() => {
    const sum = (arr, fn) => arr.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
    const s = sum(periodRecs.filter(r => r.type === 'Sale'), r => r.amount);
    const p = sum(periodRecs.filter(r => r.type === 'Purchase'), r => r.amount);
    const e = sum(periodRecs.filter(r => r.type === 'Expense'), r => r.amount);
    const gp = sum(periodRecs.filter(r => r.type === 'Sale'), r => r.profit);
    const d = sum(periodRecs.filter(r => r.type === 'Sale'), r => r.discount);
    const db = sum(records.filter(r => r.type === 'Sale'), r => r.remainingDebt);
    const ci = sum(records.filter(r => r.type === 'Sale' && r.paymentType === 'Cash'), r => r.amount) + sum(records.filter(r => r.type === 'Payment'), r => r.amount);
    const co = sum(records.filter(r => r.type === 'Purchase'), r => r.amount) + sum(records.filter(r => r.type === 'Expense'), r => r.amount);
    return { sales: s, purchases: p, expenses: e, profit: gp - e, disc: d, debt: db, balance: ci - co };
  }, [records, periodRecs]);

  const reportStats = useMemo(() => {
    const recs = records.filter(r => {
      if (!r.date) return false;
      const d = r.date.split(',')[0]; const parts = d.split('/');
      if (parts.length !== 3) return false;
      const iso = `${parts[2]}-${parts[1]}-${parts[0]}`;
      return iso >= repStart && iso <= repEnd;
    });
    const sum = (arr, fn) => arr.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
    return {
      sales: sum(recs.filter(r => r.type === 'Sale'), r => r.amount),
      purchases: sum(recs.filter(r => r.type === 'Purchase'), r => r.amount),
      expenses: sum(recs.filter(r => r.type === 'Expense'), r => r.amount),
      profit: sum(recs.filter(r => r.type === 'Sale'), r => r.profit),
    };
  }, [records, repStart, repEnd]);

  const debtors = useMemo(() => {
    const m = {};
    records.forEach(r => { const d = Number(r.remainingDebt) || 0; if (r.type === 'Sale' && d > 0) m[r.personName || '?'] = (m[r.personName || '?'] || 0) + d; });
    return Object.entries(m).map(([n, a]) => ({ n, a })).sort((a, b) => b.a - a.a);
  }, [records]);

  const filteredRecs = useMemo(() => records.filter(r => {
    const q = ledSearch.toLowerCase();
    return ((r.personName || '') + (r.item || '') + (r.invoiceNo || '')).toLowerCase().includes(q) && (ledFilter === 'All' || r.type === ledFilter);
  }), [records, ledSearch, ledFilter]);

  const cartTotals = useMemo(() => {
    const sub = cart.reduce((s, i) => s + (i.unitPrice * i.quantity), 0);
    const id = cart.reduce((s, i) => s + (Number(i.itemDiscountAmt) || 0), 0);
    const aid = sub - id;
    const gd = parseFloat(globalDiscountAmt || 0);
    const gdisc = globalDiscountType === '%' ? aid * gd / 100 : gd;
    return { sub, itemDiscounts: id, globalDisc: gdisc, total: Math.max(aid - gdisc, 0) };
  }, [cart, globalDiscountAmt, globalDiscountType]);

  const addToCart = () => {
    if (!selProdId || !unitPrice || !quantity) { showToast('ပစ္စည်း၊ ဈေးနှုန်း၊ အရေအတွက် ဖြည့်ပါ', 'err'); return; }
    const prod = products.find(p => p.id === selProdId);
    if (!prod) return;
    const price = parseFloat(unitPrice);
    const qty = parseFloat(quantity);
    if (price <= 0 || qty <= 0) return;
    if (entryTab === 'Sale') {
      const cur = Number(prod.stock) || 0;
      const inCart = cart.filter(c => c.productId === prod.id).reduce((s, c) => s + c.quantity, 0);
      if (cur - inCart < qty) { showToast(`Stock မလုံလောက်ပါ (ကျန်: ${cur - inCart} ${prod.unit || 'ခု'})`, 'err'); return; }
    }
    const ex = cart.find(c => c.productId === prod.id && c.unitPrice === price);
    if (ex) setCart(prev => prev.map(c => c.id === ex.id ? { ...c, quantity: c.quantity + qty } : c));
    else setCart(prev => [...prev, { id: Date.now() + Math.random(), productId: prod.id, name: prod.name, unitPrice: price, costPrice: prod.costPrice || 0, quantity: qty, itemDiscountAmt: 0 }]);
    setSelProdId(''); setProdSearch(''); setUnitPrice(''); setQuantity('');
  };

  const removeFromCart = id => setCart(prev => prev.filter(c => c.id !== id));
  const updateItemDiscount = (id, amt) => setCart(prev => prev.map(c => c.id === id ? { ...c, itemDiscountAmt: Number(amt) || 0 } : c));
  const clearCart = () => { setCart([]); setGlobalDiscountAmt(''); setPersonName(''); setPaymentType('Cash'); setSelProdId(''); setProdSearch(''); };

  const handleBarcodeSubmit = e => {
    e.preventDefault();
    const prod = products.find(p => p.barcode === barcodeInput.trim() || p.id === barcodeInput.trim());
    if (prod) {
      const price = entryTab === 'Sale' ? (prod.price || 0) : (prod.costPrice || 0);
      setCart(prev => {
        const ex = prev.find(c => c.productId === prod.id && c.unitPrice === price);
        if (ex) return prev.map(c => c.id === ex.id ? { ...c, quantity: c.quantity + 1 } : c);
        return [...prev, { id: Date.now() + Math.random(), productId: prod.id, name: prod.name, unitPrice: price, costPrice: prod.costPrice || 0, quantity: 1, itemDiscountAmt: 0 }];
      });
      playBeep();
      showToast(`${prod.name} (1) ခု ထည့်ပြီး ✓`);
    } else showToast('Barcode မတွေ့ပါ', 'err');
    setBarcodeInput('');
  };

  const getNextInvoiceNo = async () => {
    const ref = doc(db, 'counters', `invoice_${currentTenant}`);
    try {
      const n = await runTransaction(db, async t => {
        const s = await t.get(ref); const c = s.exists() ? s.data().value || 0 : 0;
        t.set(ref, { value: c + 1 }, { merge: true }); return c + 1;
      });
      return `INV-${String(n).padStart(6, '0')}`;
    } catch { return `INV-${Date.now().toString().slice(-6)}`; }
  };

  const submitSale = async () => { /* ... မပြောင်းလဲပါ ... */ };
  const submitPurchase = async () => { /* ... မပြောင်းလဲပါ ... */ };
  const submitExpense = async () => { /* ... မပြောင်းလဲပါ ... */ };
  const submitPayment = async () => { /* ... မပြောင်းလဲပါ ... */ };
  const doDelete = async () => { /* ... မပြောင်းလဲပါ ... */ };

  const sendTg = async text => { /* ... မပြောင်းလဲပါ ... */ };
  const sendDailyReport = () => { /* ... မပြောင်းလဲပါ ... */ };
  const sendInventoryReport = () => { /* ... မပြောင်းလဲပါ ... */ };
  const getRecordsCSV = () => { /* ... မပြောင်းလဲပါ ... */ };
  const getProductsCSV = () => { /* ... မပြောင်းလဲပါ ... */ };
  const exportAllCSV = () => { /* ... မပြောင်းလဲပါ ... */ };
  const sendTgDoc = async (fn, txt) => { /* ... မပြောင်းလဲပါ ... */ };
  const backupToTelegram = async () => { /* ... မပြောင်းလဲပါ ... */ };
  const handleImportAll = async e => { /* ... မပြောင်းလဲပါ ... */ };

  const saveSettings = async () => { /* ... မပြောင်းလဲပါ ... */ };

  let histBal = 0;
  const histRecords = records.filter(r => (r.type === 'Sale' || r.type === 'Payment') && r.personName === historyModal.name)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map(r => { histBal += r.type === 'Sale' ? (Number(r.amount) || 0) : -(Number(r.amount) || 0); return { ...r, runningBal: histBal }; }).reverse();

  if (setupMode === null || authLoading || appLoading) return (
    <div className="min-h-[100dvh] bg-[#080c14] flex flex-col items-center justify-center">
      <Cpu className="text-cyan-500 animate-pulse mb-5" size={64} />
      <p className="text-cyan-400 font-bold text-xl">Loading POS System...</p>
    </div>
  );

  const isSecretSetup = window.location.pathname === '/mttadminacc';

  // ── Master Admin Dashboard ကို Props အသစ်များဖြင့် ခေါ်မည် ──
  if (isSecretSetup && currentUser && currentUser.role === 'admin' && currentUser.username === 'Myat7291') {
    return (
      <AdminDashboard
        allUsers={allUsers}
        db={db}
        showToast={showToast}
        onSetup={handleSetup}
        allSettings={allSettings}
        allRecords={allRecords}
        allProducts={allProducts}
      />
    );
  }

  if (setupMode && fbUser && !setupDone && !isSecretSetup) return <SetupScreen onSetup={handleSetup} />;
  if (!currentUser) return <AuthScreen allUsers={allUsers} onLogin={setCurrentUser} />;

  return (
    <div className="min-h-[100dvh] w-full bg-[#080c14] pb-[110px] text-slate-100 antialiased font-sans overflow-x-hidden">
      {/* ... ကျန် Main UI များ (ယခင်အတိုင်း မပြောင်းလဲပါ) ... */}
      {/* Toast, Low Stock Banner, Nav, Settings Modal, Main Content, Bottom Nav, Modals */}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// 🔥 အဆင့်မြှင့်ထားသော ADMIN DASHBOARD (Master Admin Only)
// ════════════════════════════════════════════════════════════════
function AdminDashboard({ allUsers, db, showToast, onSetup, allSettings, allRecords, allProducts }) {
  const [showSetup, setShowSetup] = useState(false);
  const [editUser, setEditUser] = useState(null);          // expiry edit mode
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState(null); // { type, user }
  const [editingUser, setEditingUser] = useState(null);    // edit profile user
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [customExpiry, setCustomExpiry] = useState('');    // custom date string

  const admins = allUsers.filter(u => u.role === 'admin');
  const activeAdmins = admins.filter(u => !u.expiryDate || new Date(u.expiryDate) >= new Date());
  const expiredAdmins = admins.filter(u => u.expiryDate && new Date(u.expiryDate) < new Date());

  let displayedAdmins = filter === 'active' ? activeAdmins : filter === 'expired' ? expiredAdmins : admins;
  // search filter
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    displayedAdmins = displayedAdmins.filter(u => u.username.toLowerCase().includes(q));
  }

  // ── Helper to get tenant info ──
  const tenantInfoMap = useMemo(() => {
    const map = {};
    allUsers.forEach(u => {
      if (u.role !== 'admin') return;
      const tid = u.tenantId;
      if (!map[tid]) {
        const setting = allSettings.find(s => s.id === tid);
        const recCount = allRecords.filter(r => r.tenantId === tid).length;
        const prodCount = allProducts.filter(p => p.tenantId === tid).length;
        map[tid] = {
          shopName: setting?.shopName || 'No Shop',
          recordCount: recCount,
          productCount: prodCount,
        };
      }
    });
    return map;
  }, [allUsers, allSettings, allRecords, allProducts]);

  const handleSetExpiry = async (user, days) => {
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + days);
    await setDoc(doc(db, 'pos_users', user.id), { expiryDate: expiry.toISOString() }, { merge: true });
    showToast(`${user.username} အတွက် ${days} ရက် သက်တမ်းတိုးပြီးပါပြီ ✓`);
    setEditUser(null);
    setCustomExpiry('');
  };

  const handleSetExpiryCustom = async (user) => {
    if (!customExpiry) return;
    await setDoc(doc(db, 'pos_users', user.id), { expiryDate: new Date(customExpiry).toISOString() }, { merge: true });
    showToast(`${user.username} အတွက် သက်တမ်းကို ${customExpiry} သို့ ပြောင်းပြီးပါပြီ ✓`);
    setEditUser(null);
    setCustomExpiry('');
  };

  const handleRevoke = async (user) => {
    await setDoc(doc(db, 'pos_users', user.id), { expiryDate: new Date().toISOString() }, { merge: true });
    showToast(`${user.username} ကို ပိတ်သိမ်းပြီးပါပြီ`);
    setConfirmAction(null);
  };

  const handleEditSave = async () => {
    if (!editingUser) return;
    const newUsername = editForm.username.trim();
    if (!newUsername) { showToast('Username လိုအပ်ပါသည်', 'err'); return; }
    // Check duplicate username (except self)
    if (admins.some(u => u.id !== editingUser.id && u.username === newUsername)) {
      showToast('ဤ Username ကို အခြား Admin သုံးထားပါသည်', 'err');
      return;
    }
    const updates = { username: newUsername };
    if (editForm.password.trim()) {
      updates.password = simpleHash(editForm.password);
    }
    try {
      await setDoc(doc(db, 'pos_users', editingUser.id), updates, { merge: true });
      showToast('အကောင့်ပြင်ဆင်ပြီးပါပြီ ✓');
      setEditingUser(null);
      setEditForm({ username: '', password: '' });
    } catch { showToast('Error', 'err'); }
  };

  const startEditProfile = (user) => {
    setEditingUser(user);
    setEditForm({ username: user.username, password: '' });
    setEditUser(null); // close expiry panel if open
  };

  return (
    <div className="min-h-[100dvh] bg-[#080c14] text-slate-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-black text-white">🛡️ Admin Dashboard</h1>
            <p className="text-slate-500 mt-2">POS System Master Control</p>
          </div>
          <button onClick={() => setShowSetup(!showSetup)} className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-black text-lg">
            {showSetup ? 'ပိတ်မည်' : '+ Admin အသစ်ထည့်မည်'}
          </button>
        </div>

        {/* Setup inline */}
        {showSetup && (
          <div className="bg-[#0d1120] p-6 rounded-2xl border-2 border-cyan-500/20 mb-8">
            <h2 className="text-xl font-black text-white mb-4">Admin အကောင့်အသစ် ဖန်တီးရန်</h2>
            <SetupScreen onSetup={(...args) => { onSetup(...args); setShowSetup(false); }} />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0d1120] p-5 rounded-2xl border-2 border-cyan-500/10 text-center">
            <p className="text-3xl font-black text-cyan-400">{admins.length}</p>
            <p className="text-slate-500 text-sm mt-1">စုစုပေါင်း Admin</p>
          </div>
          <div className="bg-[#0d1120] p-5 rounded-2xl border-2 border-emerald-500/10 text-center">
            <p className="text-3xl font-black text-emerald-400">{activeAdmins.length}</p>
            <p className="text-slate-500 text-sm mt-1">သုံးနေဆဲ</p>
          </div>
          <div className="bg-[#0d1120] p-5 rounded-2xl border-2 border-rose-500/10 text-center">
            <p className="text-3xl font-black text-rose-400">{expiredAdmins.length}</p>
            <p className="text-slate-500 text-sm mt-1">သက်တမ်းကုန်</p>
          </div>
        </div>

        {/* Filters + Search */}
        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <div className="flex gap-3">
            {[['all','အားလုံး'],['active','သုံးနေဆဲ'],['expired','သက်တမ်းကုန်']].map(([k,l])=>(
              <button key={k} onClick={()=>setFilter(k)} className={`px-5 py-2.5 rounded-xl font-black text-sm ${filter===k?'bg-cyan-600 text-white':'bg-[#0d1120] text-slate-500 border border-white/5'}`}>{l}</button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={20} className="absolute left-4 top-3.5 text-slate-500" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Admin အမည် ရှာပါ..."
              className="w-full pl-10 pr-4 py-3 bg-[#0d1120] border-2 border-white/5 rounded-xl text-base font-bold text-slate-200 outline-none focus:border-cyan-500/40 placeholder-slate-600"
            />
          </div>
        </div>

        {/* Admin List */}
        <div className="space-y-4">
          {displayedAdmins.map(u => {
            const expired = u.expiryDate && new Date(u.expiryDate) < new Date();
            const tenant = tenantInfoMap[u.tenantId] || { shopName: 'Unknown', recordCount: 0, productCount: 0 };
            const isMaster = u.username === 'Myat7291';
            return (
              <div key={u.id} className={`bg-[#0d1120] p-5 rounded-2xl border-2 ${expired?'border-rose-500/20 bg-rose-950/10':'border-cyan-500/10'}`}>
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <p className="text-xl font-black text-white">{u.username}</p>
                      <span className={`text-xs font-black px-2 py-1 rounded ${expired?'bg-rose-500/20 text-rose-400':'bg-emerald-500/20 text-emerald-400'}`}>
                        {expired ? '❌ သက်တမ်းကုန်' : '✅ သုံးနေဆဲ'}
                      </span>
                      {isMaster && <span className="text-xs font-black px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">👑 Master</span>}
                    </div>
                    <div className="flex gap-4 mt-2 text-sm text-slate-500 flex-wrap">
                      <span>Join: {new Date(u.createdAt||Date.now()).toLocaleDateString('en-GB')}</span>
                      {u.expiryDate && (
                        <span className={expired?'text-rose-400 font-bold':'text-emerald-400'}>
                          Expiry: {new Date(u.expiryDate).toLocaleDateString('en-GB')}
                        </span>
                      )}
                    </div>
                    {/* Tenant Preview */}
                    <div className="mt-3 flex gap-4 text-sm text-slate-400 bg-black/30 p-3 rounded-xl">
                      <span className="flex items-center gap-1.5"><MonitorPlay size={16}/> {tenant.shopName}</span>
                      <span className="flex items-center gap-1.5"><FileText size={16}/> စာရင်း {tenant.recordCount}</span>
                      <span className="flex items-center gap-1.5"><Package size={16}/> ပစ္စည်း {tenant.productCount}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 items-start flex-shrink-0">
                    {editUser === u.id ? (
                      <div className="flex gap-2 items-center flex-wrap">
                        {/* Quick days */}
                        {[7,30,90,365].map(d=>(
                          <button key={d} onClick={()=>handleSetExpiry(u,d)} className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-black">{d}ရက်</button>
                        ))}
                        {/* Custom Date */}
                        <div className="flex items-center gap-1">
                          <input
                            type="date"
                            value={customExpiry}
                            onChange={e=>setCustomExpiry(e.target.value)}
                            className="w-28 px-2 py-1.5 bg-black border border-cyan-500/30 rounded text-xs text-cyan-300"
                          />
                          <button onClick={()=>handleSetExpiryCustom(u)} className="px-2 py-1.5 bg-cyan-700 text-white rounded text-xs font-black">Set</button>
                        </div>
                        <button onClick={()=>{setEditUser(null);setCustomExpiry('');}} className="px-2 py-1.5 bg-slate-700 text-white rounded-lg text-xs">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {!isMaster && (
                          <>
                            <button onClick={()=>setEditUser(u.id)} className="px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-black border border-cyan-500/30">ရက်တိုးမည်</button>
                            <button onClick={()=>setConfirmAction({type:'revoke',user:u})} className="px-3 py-1.5 bg-rose-600/20 text-rose-400 rounded-lg text-xs font-black border border-rose-500/30">ပိတ်မည်</button>
                            <button onClick={()=>startEditProfile(u)} className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg text-xs font-black border border-indigo-500/30"><Edit3 size={14} className="inline mr-1"/>ပြင်မည်</button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Edit Profile Form */}
                {editingUser?.id === u.id && (
                  <div className="mt-4 p-4 bg-black/40 rounded-xl border border-indigo-500/20 space-y-4">
                    <p className="text-sm font-black text-indigo-400 uppercase">အကောင့်ပြင်ဆင်မည်</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <input
                        value={editForm.username}
                        onChange={e=>setEditForm({...editForm, username:e.target.value})}
                        placeholder="Username အသစ်"
                        className="w-full px-4 py-2.5 bg-black border border-indigo-500/20 rounded-lg text-slate-200 font-bold text-sm outline-none focus:border-indigo-400"
                      />
                      <input
                        value={editForm.password}
                        onChange={e=>setEditForm({...editForm, password:e.target.value})}
                        placeholder="Password (မပြောင်းလိုပါက ချန်ထားပါ)"
                        className="w-full px-4 py-2.5 bg-black border border-indigo-500/20 rounded-lg text-slate-200 font-bold text-sm outline-none focus:border-indigo-400"
                      />
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button onClick={()=>{setEditingUser(null);setEditForm({username:'',password:''});}} className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm font-black">မလုပ်တော့</button>
                      <button onClick={handleEditSave} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-black flex items-center gap-1.5"><Save size={16}/> သိမ်းမည်</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Confirmation Modal for Revoke */}
        {confirmAction && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-[#0d1120] p-8 rounded-3xl border-2 border-rose-500/30 text-center max-w-md w-full shadow-2xl">
              <AlertTriangle size={48} className="mx-auto text-rose-400 mb-4" />
              <h3 className="text-2xl font-black text-white mb-2">ပိတ်သိမ်းရန် သေချာပါသလား?</h3>
              <p className="text-base text-slate-400 mb-6">
                <span className="text-rose-300 font-bold">{confirmAction.user.username}</span> ကို ပိတ်သိမ်းပါက ယင်းအကောင့် ပြန်ဝင်မရတော့ပါ။
              </p>
              <div className="flex gap-4">
                <button onClick={()=>setConfirmAction(null)} className="flex-1 py-3 bg-slate-800 rounded-xl font-black text-white">မလုပ်တော့</button>
                <button onClick={()=>handleRevoke(confirmAction.user)} className="flex-1 py-3 bg-rose-600 rounded-xl font-black text-white">ပိတ်မည်</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SETUP SCREEN
// ════════════════════════════════════════════════════════════════
function SetupScreen({ onSetup }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const handleSubmit = e => { e.preventDefault(); if (!username.trim() || !password.trim()) { setErr('အားလုံးဖြည့်ပါ'); return; } onSetup(username, password, shopName); };
  return (
    <div className="bg-[#0d1120] p-8 rounded-3xl border-2 border-cyan-500/25 w-full max-w-md mx-auto">
      <div className="text-center mb-8"><Lock size={48} className="mx-auto text-cyan-400 mb-4"/><h2 className="text-2xl font-black text-white">Admin အကောင့်အသစ်</h2></div>
      {err && <p className="text-sm font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl mb-4 text-center">{err}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="ဆိုင်အမည်" className="w-full px-5 py-4 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-lg outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
        <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Admin Username" className="w-full px-5 py-4 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-lg outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
        <div className="relative"><input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full px-5 py-4 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-lg outline-none focus:border-cyan-400 transition-all pr-12 placeholder-slate-600"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-4 top-4 text-slate-500">{show?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
        <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-4 rounded-xl text-lg active:scale-95 transition-all">Admin အကောင့်ဖွင့်မည်</button>
      </form>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AUTH SCREEN (Login Only)
// ════════════════════════════════════════════════════════════════
function AuthScreen({ allUsers, onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const handleLogin = e => {
    e.preventDefault();
    const user = allUsers.find(u => u.username === username.trim() && u.password === simpleHash(password));
    if (user) {
      if (user.expiryDate && new Date(user.expiryDate) < new Date()) {
        setErr('သင့်အကောင့် သက်တမ်းကုန်သွားပါပြီ။ Admin ကို ဆက်သွယ်ပါ။');
        return;
      }
      onLogin(user);
    } else setErr('Username သို့မဟုတ် Password မှားနေပါသည်');
  };
  return (
    <div className="min-h-[100dvh] bg-[#080c14] flex items-center justify-center p-4">
      <div className="bg-[#0d1120] p-10 sm:p-12 rounded-3xl border-2 border-cyan-500/25 shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-lg">
        <div className="text-center mb-10"><MonitorPlay size={64} className="mx-auto text-cyan-500 mb-6"/><h2 className="text-4xl font-black text-white uppercase">Cyber POS</h2><p className="text-lg text-cyan-400 font-bold mt-3">PRO VERSION 18</p></div>
        {err && <p className="text-lg font-bold text-rose-400 bg-rose-500/10 border-2 border-rose-500/20 p-5 rounded-xl mb-8 text-center">{err}</p>}
        <form onSubmit={handleLogin} className="space-y-6">
          <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <div className="relative"><input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl outline-none focus:border-cyan-400 transition-all pr-16 placeholder-slate-600"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-6 top-6 text-slate-500 hover:text-slate-300">{show?<EyeOff size={30}/>:<Eye size={30}/>}</button></div>
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-6 rounded-xl text-2xl active:scale-95 transition-all shadow-xl shadow-cyan-500/20">Login ဝင်မည်</button>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// PRODUCTS TAB
// ════════════════════════════════════════════════════════════════
function ProductsTab({ products, db, appId, currentTenant, showToast }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', barcode: '', costPrice: '', price: '', minStock: '5', unit: 'ခု' });
  const [showProductScanner, setShowProductScanner] = useState(false);
  const scannerRef = useRef(null);
  const isStopping = useRef(false);

  const resetForm = () => setForm({ name: '', category: '', barcode: '', costPrice: '', price: '', minStock: '5', unit: 'ခု' });

  useEffect(() => {
    if (!showProductScanner) return;
    if (!window.Html5Qrcode) { showToast('Scanner library မရှိပါ', 'err'); setShowProductScanner(false); return; }
    let html5QrCode;
    (async () => {
      try {
        if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
        html5QrCode = new window.Html5Qrcode("product-barcode-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            setForm(prev => ({ ...prev, barcode: decodedText.trim() }));
            showToast('Barcode ဖတ်ပြီး ✓');
            (async () => { if (isStopping.current) return; isStopping.current = true; if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } isStopping.current = false; setShowProductScanner(false); })();
          }, () => {}
        );
      } catch { showToast('Camera မရပါ', 'err'); setShowProductScanner(false); }
    })();
    return () => { isStopping.current = true; if (scannerRef.current) { scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } };
  }, [showProductScanner]);

  const handleSave = async e => {
    e.preventDefault();
    if (!form.name || !form.price || !form.costPrice) { showToast('ဖြည့်ပါ', 'err'); return; }
    const payload = { name: form.name, category: form.category || 'General', barcode: form.barcode, costPrice: +form.costPrice, price: +form.price, minStock: +form.minStock || 5, unit: form.unit || 'ခု' };
    try {
      if (editing) {
        await setDoc(doc(db, 'pos_products', editing.id), payload, { merge: true });
        showToast('ပြင်ဆင်ပြီး ✓'); setEditing(null);
      } else {
        await addDoc(collection(db, 'pos_products'), { ...payload, tenantId: currentTenant, stock: 0, createdAt: Date.now() });
        showToast('ထည့်ပြီး ✓'); setAdding(false);
      }
      resetForm();
    } catch { showToast('Error', 'err'); }
  };

  const startEdit = p => { setEditing(p); setForm({ name: p.name || '', category: p.category || '', barcode: p.barcode || '', costPrice: String(p.costPrice || ''), price: String(p.price || ''), minStock: String(p.minStock || '5'), unit: p.unit || 'ခု' }); setAdding(false); };
  const cancelEdit = () => { setEditing(null); resetForm(); };

  return (
    <div className="bg-[#0d1120] border-2 border-cyan-500/15 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center mb-8"><h3 className="font-black text-white flex items-center gap-4 text-2xl"><Package size={30}/> ကုန်ပစ္စည်းများ</h3><button onClick={()=>{setAdding(!adding);cancelEdit();}} className="bg-cyan-900/40 text-cyan-400 px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3 hover:bg-cyan-900/60 transition-all"><Plus size={24}/> ထည့်မည်</button></div>
      {(adding||editing) && (
        <form onSubmit={handleSave} className="bg-black/40 p-8 rounded-2xl border-2 border-cyan-500/15 mb-8 space-y-6">
          <p className="text-base font-black text-cyan-400 uppercase tracking-widest">{editing?'✏ ပြင်ဆင်မည်':'+ ထည့်သွင်းမည်'}</p>
          <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="ပစ္စည်းအမည်" className="w-full px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl font-bold text-slate-200 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="အမျိုးအစား" className="px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl font-bold text-slate-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
            <div className="flex gap-4 items-stretch"><input value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})} placeholder="Barcode Code" className="min-w-0 flex-1 px-3 py-4 bg-black border-2 border-cyan-500/15 rounded-xl text-xl font-bold text-slate-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/><button type="button" onClick={()=>setShowProductScanner(true)} className="px-4 bg-blue-600/20 border-2 border-blue-500/40 rounded-xl text-blue-400 hover:bg-blue-600/30 active:scale-95 transition-all flex-shrink-0 flex items-center justify-center"><ScanBarcode size={24}/></button></div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <input required type="number" value={form.costPrice} onChange={e=>setForm({...form,costPrice:e.target.value})} placeholder="ဝယ်/အရင်းဈေး" className="px-5 py-5 bg-black border-2 border-blue-500/15 rounded-xl text-xl font-bold text-blue-300 outline-none focus:border-blue-400 transition-all placeholder-slate-600"/>
            <input required type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="ရောင်းဈေး" className="px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl font-bold text-cyan-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="Unit (ခု/kg)" className="px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl font-bold text-slate-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
            <input type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})} placeholder="Min Stock" className="px-5 py-5 bg-black border-2 border-amber-500/15 rounded-xl text-xl font-bold text-amber-300 outline-none focus:border-amber-400 transition-all placeholder-slate-600"/>
          </div>
          {form.price && form.costPrice && +form.price>0 && (<p className="text-lg text-emerald-400 font-bold bg-emerald-950/30 border-2 border-emerald-500/15 px-6 py-5 rounded-xl">Margin: {(+form.price-+form.costPrice).toLocaleString()} Ks ({((+form.price-+form.costPrice)/+form.price*100).toFixed(1)}%)</p>)}
          <div className="flex gap-5 pt-3"><button type="submit" className="flex-1 py-6 bg-cyan-600 text-white rounded-xl font-black text-xl flex items-center justify-center gap-3 hover:bg-cyan-500 transition-all"><Save size={24}/> သိမ်းမည်</button><button type="button" onClick={()=>{setAdding(false);cancelEdit();}} className="px-8 py-6 bg-slate-800 text-slate-400 rounded-xl font-black text-xl hover:bg-slate-700 transition-all">မလုပ်တော့</button></div>
        </form>
      )}
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
        {products.length===0 && <p className="text-center text-slate-500 text-xl py-14">ကုန်ပစ္စည်း မရှိသေးပါ</p>}
        {products.map(p=>(
          <div key={p.id} className="bg-black/30 p-6 rounded-2xl border-2 border-cyan-500/8 hover:border-cyan-500/20 transition-all group">
            <div className="flex justify-between items-start"><div className="flex-1 min-w-0"><div className="flex gap-4 items-center mb-3 flex-wrap"><p className="font-black text-white text-2xl truncate">{p.name}</p><span className="text-sm bg-slate-800 px-4 py-2 rounded-lg text-slate-300">{p.category||'General'}</span></div><div className="flex items-center gap-5 mt-3 flex-wrap"><span className="text-lg text-blue-400 font-bold">ဝယ်: {fmt(p.costPrice)}</span><span className="text-lg text-cyan-400 font-bold">ရောင်း: {fmt(p.price)}</span>{p.price>0 && p.costPrice>0 && <span className="text-base text-emerald-500 font-bold">{((p.price-p.costPrice)/p.price*100).toFixed(0)}% margin</span>}</div>{p.barcode && <p className="text-base font-mono text-slate-600 mt-3">BC: {p.barcode}</p>}</div><div className="flex gap-4 ml-5 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity"><button onClick={()=>startEdit(p)} className="p-4 bg-indigo-950/50 border-2 border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-900/50 transition-all"><Edit3 size={24}/></button><button onClick={async ()=>{await deleteDoc(doc(db,'pos_products',p.id));}} className="p-4 bg-rose-950/50 border-2 border-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-900/50 transition-all"><Trash2 size={24}/></button></div></div>
          </div>
        ))}
      </div>
      {showProductScanner && <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80"><div className="bg-[#0d1120] p-8 rounded-3xl border-2 border-cyan-500/20 w-full max-w-lg mx-4"><div className="flex justify-between items-center mb-6"><h3 className="font-black text-white text-2xl">Barcode ဖတ်မည်</h3><button onClick={()=>setShowProductScanner(false)} className="text-slate-400 hover:text-rose-400 p-2"><X size={32}/></button></div><div id="product-barcode-reader" className="w-full overflow-hidden rounded-xl" style={{minHeight:'260px'}}></div></div></div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// INVENTORY TAB
// ════════════════════════════════════════════════════════════════
function InventoryTab({ products, db, appId, hasPermission, sendInventoryReport }) {
  const canManage = hasPermission('manage_inventory');
  return (
    <div className="bg-[#0d1120] border-2 border-blue-500/15 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center mb-8"><h3 className="font-black text-white flex items-center gap-4 text-2xl"><Boxes size={30}/> ကုန်လက်ကျန်</h3><button onClick={sendInventoryReport} className="bg-blue-600/20 text-blue-400 border-2 border-blue-500/30 px-5 py-4 rounded-xl font-black text-base flex items-center gap-3 active:scale-95 hover:bg-blue-600/30 transition-all"><Send size={22}/> Telegram သို့ပို့မည်</button></div>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {products.length===0 && <p className="text-center text-slate-500 text-xl py-14">ကုန်ပစ္စည်း မရှိသေးပါ</p>}
        {products.map(p=>(
          <div key={p.id} className={`p-6 rounded-2xl border-2 flex justify-between items-center transition-all ${(Number(p.stock)||0)<=(Number(p.minStock)||5)?'bg-amber-950/20 border-amber-500/20':'bg-black/30 border-cyan-500/8'}`}>
            <div className="pr-5"><p className="font-black text-white text-2xl">{p.name}</p><p className="text-lg text-slate-400 font-bold mt-2">{fmt(p.price)} Ks · min: {p.minStock||5} {p.unit}</p></div>
            <div className="flex flex-col items-end gap-3"><span className="text-sm text-slate-500 font-black uppercase">Stock</span><input type="number" defaultValue={p.stock||0} readOnly={!canManage} onBlur={async e=>{if(!canManage)return;const v=Number(e.target.value);if(v!==(p.stock||0))await setDoc(doc(db,'pos_products',p.id),{stock:v},{merge:true});}} className={`w-32 text-center font-black text-2xl px-4 py-4 rounded-xl outline-none border-2 transition-all ${!canManage?'bg-black text-slate-500 border-white/5 cursor-not-allowed':(Number(p.stock)||0)<=(Number(p.minStock)||5)?'bg-amber-950/40 border-amber-500/40 text-amber-300 focus:border-amber-400':'bg-black/50 border-blue-500/30 text-blue-300 focus:border-blue-400'}`}/></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// USERS TAB
// ════════════════════════════════════════════════════════════════
function UsersTab({ posUsers, db, appId, currentTenant, showToast, currentUser }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' });
  const [show, setShow] = useState(false);
  const [editingPerms, setEditingPerms] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');

  const handleAdd = async e => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) return;
    if (!adminPassword.trim()) { showToast('သင့် Admin Password ထည့်ပါ', 'err'); return; }
    if (currentUser.password !== simpleHash(adminPassword)) { showToast('Admin Password မှားနေပါသည်', 'err'); return; }
    if (posUsers.some(u => u.username === form.username.trim())) { showToast('Username ရှိပြီးသားပါ', 'err'); return; }
    try {
      await addDoc(collection(db, 'pos_users'), {
        tenantId: currentTenant, username: form.username.trim(),
        password: simpleHash(form.password), role: form.role,
        permissions: form.role === 'staff' ? DEFAULT_STAFF_PERMS : [],
        createdAt: Date.now(),
      });
      setForm({ username: '', password: '', role: 'staff' }); setAdminPassword(''); setAdding(false);
      showToast('အကောင့်ဖွင့်ပြီးပါပြီ ✓');
    } catch { showToast('Error', 'err'); }
  };

  const togglePermission = async (user, permKey) => {
    const newPerms = user.permissions?.includes(permKey) ? user.permissions.filter(p => p !== permKey) : [...(user.permissions || []), permKey];
    await setDoc(doc(db, 'pos_users', user.id), { permissions: newPerms }, { merge: true });
  };

  return (
    <div className="bg-[#0d1120] border-2 border-indigo-500/15 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center mb-8"><h3 className="font-black text-white flex items-center gap-4 text-2xl"><Users size={30}/> ကိုယ့်ဆိုင်ဝန်ထမ်းများ</h3><button onClick={()=>setAdding(!adding)} className="bg-indigo-900/40 text-indigo-400 px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3 hover:bg-indigo-900/60 transition-all"><Plus size={24}/> ထည့်မည်</button></div>
      {adding && (
        <form onSubmit={handleAdd} className="bg-black/40 p-8 rounded-2xl border-2 border-indigo-500/15 mb-8 space-y-6">
          <input required value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Username" className="w-full px-5 py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-xl font-bold text-slate-200 outline-none focus:border-indigo-400 transition-all placeholder-slate-600"/>
          <div className="relative"><input required type={show?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" className="w-full px-5 py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-xl font-bold text-slate-200 outline-none focus:border-indigo-400 transition-all pr-16 placeholder-slate-600"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-6 top-6 text-slate-500"><EyeOff size={26}/></button></div>
          <div className="relative"><input required type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="သင့် Admin Password" className="w-full px-5 py-5 bg-amber-950/20 border-2 border-amber-500/20 rounded-xl text-xl font-bold text-amber-300 outline-none focus:border-amber-400 transition-all pr-16 placeholder-amber-700"/></div>
          <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full px-5 py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-xl font-bold text-slate-200 outline-none focus:border-indigo-400 transition-all"><option value="staff">Staff</option><option value="admin">Admin</option></select>
          <div className="flex gap-5 pt-3"><button type="submit" className="flex-1 py-6 bg-indigo-600 text-white rounded-xl font-black text-xl hover:bg-indigo-500 transition-all">✓ ဖွင့်မည်</button><button type="button" onClick={()=>setAdding(false)} className="px-8 py-6 bg-slate-800 text-slate-400 rounded-xl font-black text-xl hover:bg-slate-700 transition-all">မလုပ်တော့</button></div>
        </form>
      )}
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
        {posUsers.map(u=>(
          <div key={u.id} className="bg-black/30 p-6 rounded-2xl border-2 border-indigo-500/8">
            <div className="flex justify-between items-center mb-4"><div className="flex items-center gap-5"><div className="w-14 h-14 rounded-xl bg-indigo-950/60 flex items-center justify-center text-indigo-400 font-black text-2xl">{u.username?.[0]?.toUpperCase()||'?'}</div><div><p className="font-black text-white text-2xl">{u.username}</p><span className={`text-sm font-black px-4 py-1.5 rounded uppercase ${u.role==='admin'?'bg-indigo-500/20 text-indigo-400':'bg-cyan-500/20 text-cyan-400'}`}>{u.role}</span></div></div><div className="flex items-center gap-4"><button onClick={()=>setEditingPerms(editingPerms===u.id?null:u.id)} className="text-base text-indigo-400 bg-indigo-500/10 px-5 py-3 rounded-xl border-2 border-indigo-500/20 flex items-center gap-3 active:scale-95 hover:bg-indigo-500/20 transition-all"><ShieldCheck size={22}/> {editingPerms===u.id?'ပိတ်မည်':'ခွင့်ပြုချက်'}</button>{u.username!==currentUser.username && <button onClick={async ()=>{if(u.role==='admin'&&posUsers.filter(x=>x.role==='admin').length<=1){showToast('Admin အနည်းဆုံး ၁ ခုရှိရပါမည်','err');return;}await deleteDoc(doc(db,'pos_users',u.id));}} className="text-rose-500 hover:text-rose-300 p-4 transition-colors"><Trash2 size={26}/></button>}</div></div>
            {editingPerms===u.id && (<div className="mt-6 p-6 bg-black/60 rounded-2xl border-2 border-indigo-500/20 grid grid-cols-1 sm:grid-cols-2 gap-y-5 gap-x-5">{PERMISSION_OPTIONS.map(perm=>(<label key={perm.key} className={`flex items-center gap-4 text-lg font-bold ${u.role==='admin'?'text-slate-600':'text-slate-300'} cursor-pointer`}><input type="checkbox" checked={u.role==='admin'?true:u.permissions?.includes(perm.key)} onChange={()=>togglePermission(u,perm.key)} disabled={u.role==='admin'} className="accent-indigo-500 w-6 h-6 rounded"/><span className="leading-tight">{perm.label}</span></label>))}</div>)}
          </div>
        ))}
      </div>
    </div>
  );
}
