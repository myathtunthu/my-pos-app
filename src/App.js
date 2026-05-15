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
  Edit3, Save, AlertTriangle, LogOut, Eye, EyeOff, ShoppingCart, Tag, ShieldCheck, Cloud
} from 'lucide-react';

// ─── Permission Options ─────────────────────────────────────────────────────
const PERMISSION_OPTIONS = [
  { key: 'create_sale', label: 'အရောင်းလုပ်ခွင့်' },
  { key: 'view_sales', label: 'အရောင်းမှတ်တမ်းကြည့်ခွင့်' },
  { key: 'accept_payment', label: 'ကြွေးဆပ်လက်ခံခွင့်' },
  { key: 'view_inventory', label: 'ကုန်လက်ကျန်ကြည့်ခွင့်' },
  { key: 'create_purchase', label: 'အဝယ်လုပ်ခွင့်' },
  { key: 'create_expense', label: 'စရိတ်ထည့်ခွင့်' },
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
  const w = window.open('', '_blank', 'width=360,height=640');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
<style>body{font-family:monospace;font-size:14px;width:300px;margin:auto;padding:12px}
h2,p{text-align:center;margin:4px 0}hr{border:none;border-top:1px dashed #000}
table{width:100%}th{border-bottom:1px solid}td{padding:5px 0;vertical-align:top}
.tot{font-size:16px;font-weight:bold;text-align:right}.ft{text-align:center;font-size:11px;margin-top:12px}</style>
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
  const appId = process.env.REACT_APP_APP_ID || 'cyber-pos-v17';

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
    setTimeout(() => setToast(null), 4000);
  }, []);

  const [setupMode, setSetupMode] = useState(null);
  const [setupDone, setSetupDone] = useState(false);

  useEffect(() => {
    if (!fbUser) return;
    (async () => {
      const usersSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'pos_users'));
      const hasAdmin = usersSnap.docs.some(d => d.data().role === 'admin');
      setSetupMode(!hasAdmin);
    })();
  }, [fbUser, db, appId]);

  const handleSetup = async (username, password, shopName) => {
    const tenantId = `tenant_${username.trim()}_${Date.now()}`;
    const userRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pos_users'), {
      username: username.trim(),
      password: simpleHash(password),
      role: 'admin',
      permissions: [],
      tenantId: tenantId,
      createdAt: Date.now(),
    });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pos_settings', tenantId), {
      shopName: shopName.trim() || `${username.trim()}'s POS`,
    });
    setCurrentUser({ id: userRef.id, username: username.trim(), role: 'admin', tenantId, permissions: [] });
    setSetupDone(true);
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
    const b = ['artifacts', appId, 'public', 'data'];
    const u1 = onSnapshot(collection(db, ...b, 'pos_users'), s => {
      setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setAuthLoading(false);
    });
    const u2 = onSnapshot(collection(db, ...b, 'pos_records'), s => {
      setAllRecords(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setAppLoading(false);
    });
    const u3 = onSnapshot(collection(db, ...b, 'pos_products'), s => {
      setAllProducts(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    });
    const u4 = onSnapshot(collection(db, ...b, 'pos_settings'), s => {
      setAllSettings(s.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { u1(); u2(); u3(); u4(); };
  }, [fbUser, db, appId]);

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
      showToast(`${prod.name} (1) ခု ထည့်ပြီး ✓`);
    } else showToast('Barcode မတွေ့ပါ', 'err');
    setBarcodeInput('');
  };

  const getNextInvoiceNo = async () => {
    const ref = doc(db, 'artifacts', appId, 'public', 'data', 'counters', `invoice_${currentTenant}`);
    try {
      const n = await runTransaction(db, async t => {
        const s = await t.get(ref); const c = s.exists() ? s.data().value || 0 : 0;
        t.set(ref, { value: c + 1 }, { merge: true }); return c + 1;
      });
      return `INV-${String(n).padStart(6, '0')}`;
    } catch { return `INV-${Date.now().toString().slice(-6)}`; }
  };

  const submitSale = async () => {
    if (!cart.length) { showToast('Cart ထဲ ပစ္စည်းမရှိပါ', 'err'); return; }
    if (paymentType === 'Credit' && !personName.trim()) { showToast('အကြွေးဆိုလျှင် ဝယ်သူအမည် ထည့်ပါ', 'err'); return; }
    setAppLoading(true);
    const ts = tsFromDate(entryDate); const ds = toDateStr(ts);
    const gp = cart.reduce((s, i) => s + ((i.unitPrice - i.costPrice) * i.quantity), 0);
    const tp = gp - cartTotals.itemDiscounts - cartTotals.globalDisc;
    try {
      const inv = await getNextInvoiceNo();
      const b = ['artifacts', appId, 'public', 'data'];
      const batch = writeBatch(db);
      const ref = doc(collection(db, ...b, 'pos_records'));
      const data = {
        tenantId: currentTenant, type: 'Sale', invoiceNo: inv,
        personName: personName || 'Walk-in Customer', item: cart.map(i => i.name).join(', '),
        itemsDetail: cart.map(i => ({ name: i.name, quantity: i.quantity, unitPrice: i.unitPrice, costPrice: i.costPrice, itemDiscountAmt: i.itemDiscountAmt })),
        amount: cartTotals.total, subtotal: cartTotals.sub, discount: cartTotals.globalDisc + cartTotals.itemDiscounts,
        profit: tp, paymentType, remainingDebt: paymentType === 'Credit' ? cartTotals.total : 0,
        createdAt: ts, date: ds, createdBy: currentUser.username,
      };
      batch.set(ref, data);
      cart.forEach(i => {
        const p = products.find(x => x.id === i.productId);
        if (p) batch.update(doc(db, ...b, 'pos_products', p.id), { stock: Math.max(0, (Number(p.stock) || 0) - i.quantity) });
      });
      await batch.commit();
      clearCart(); setAppLoading(false);
      showToast('အရောင်းစာရင်း သိမ်းပြီးပါပြီ ✓');
      setReceiptModal({ show: true, record: data });
    } catch { setAppLoading(false); showToast('Error', 'err'); }
  };

  const submitPurchase = async () => {
    if (!cart.length) { showToast('Cart ထဲ ပစ္စည်းမရှိပါ', 'err'); return; }
    setAppLoading(true);
    const ts = tsFromDate(entryDate); const ds = toDateStr(ts);
    try {
      const inv = await getNextInvoiceNo();
      const b = ['artifacts', appId, 'public', 'data'];
      const batch = writeBatch(db);
      cart.forEach((i, idx) => {
        const ref = doc(collection(db, ...b, 'pos_records'));
        batch.set(ref, {
          tenantId: currentTenant, type: 'Purchase', invoiceNo: `${inv}-${idx+1}`,
          personName: personName || 'Supplier', item: i.name, quantity: i.quantity, unitPrice: i.unitPrice,
          amount: (i.unitPrice * i.quantity) - (i.itemDiscountAmt || 0),
          paymentType: 'Cash', createdAt: ts, date: ds, createdBy: currentUser.username,
        });
        const p = products.find(x => x.id === i.productId);
        if (p) batch.update(doc(db, ...b, 'pos_products', p.id), { stock: (Number(p.stock) || 0) + i.quantity, costPrice: i.unitPrice });
      });
      await batch.commit();
      clearCart(); setAppLoading(false);
      showToast('အဝယ်စာရင်း + Stock သိမ်းပြီးပါပြီ ✓');
    } catch { setAppLoading(false); showToast('Error', 'err'); }
  };

  const submitExpense = async () => {
    const a = parseFloat(expenseAmt);
    if (!expenseTitle || isNaN(a) || a <= 0) { showToast('အချက်အလက် ဖြည့်ပါ', 'err'); return; }
    const ts = tsFromDate(entryDate);
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pos_records'), {
      tenantId: currentTenant, type: 'Expense', personName: 'Expense', item: expenseTitle,
      amount: a, paymentType: 'Cash', createdAt: ts, date: toDateStr(ts), createdBy: currentUser.username,
    });
    setExpenseTitle(''); setExpenseAmt('');
    showToast('အသုံးစရိတ် သိမ်းပြီးပါပြီ ✓');
  };

  const submitPayment = async () => {
    let amt = parseFloat(payModal.amt);
    if (isNaN(amt) || amt <= 0) return;
    const ts = tsFromDate(payModal.date);
    const unpaid = records.filter(r => r.type === 'Sale' && r.personName === payModal.name && (Number(r.remainingDebt) || 0) > 0).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const b = ['artifacts', appId, 'public', 'data'];
    const batch = writeBatch(db);
    let paid = 0;
    for (const r of unpaid) {
      if (amt <= 0) break;
      const pay = Math.min(Number(r.remainingDebt) || 0, amt);
      batch.update(doc(db, ...b, 'pos_records', r.id), { remainingDebt: (Number(r.remainingDebt) || 0) - pay });
      amt -= pay; paid += pay;
    }
    if (paid > 0) {
      const inv = await getNextInvoiceNo();
      batch.set(doc(collection(db, ...b, 'pos_records')), {
        tenantId: currentTenant, type: 'Payment', invoiceNo: inv, personName: payModal.name,
        item: 'ကြွေးဆပ်ငွေ', amount: paid, paymentType: 'Cash', createdAt: ts, date: toDateStr(ts), createdBy: currentUser.username,
      });
      await batch.commit();
      setPayModal({ show: false, name: '', debt: 0, amt: '', date: todayISO() });
      showToast('ကြွေးဆပ်ငွေ လက်ခံပြီးပါပြီ ✓');
    } else showToast('ကြွေးကျန် မရှိပါ', 'err');
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pos_records', confirmDel.id));
    setConfirmDel(null); showToast('မှတ်တမ်းဖျက်ပြီးပါပြီ');
  };

  const sendTg = async text => {
    if (!tgToken || !tgChatId) { showToast('Telegram Config မရှိပါ', 'err'); return; }
    try {
      const r = await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: tgChatId, text, parse_mode: 'Markdown' }),
      });
      r.ok ? showToast('Telegram ပို့ပြီးပါပြီ ✓') : showToast('ပို့မရပါ', 'err');
    } catch { showToast('Internet စစ်ဆေးပါ', 'err'); }
  };

  const sendDailyReport = () => {
    let m = `*📅 ${selDate} အနှစ်ချုပ်*\n━━━━━━━━━━━━━━\n📈 *အရောင်း*: ${fmt(stats.sales)} Ks\n📉 *အဝယ်*: ${fmt(stats.purchases)} Ks\n💸 *စရိတ်*: ${fmt(stats.expenses)} Ks\n💰 *အသားတင်အမြတ်*: ${fmt(stats.profit)} Ks\n🏦 *လက်ကျန်*: ${fmt(stats.balance)} Ks\n⚠️ *ကြွေးမြီ*: ${fmt(stats.debt)} Ks`;
    if (lowStock.length) m += '\n\n🚨 *Stock နည်းနေသောပစ္စည်းများ*:\n' + lowStock.slice(0, 10).map(p => `• ${p.name} (${p.stock})`).join('\n');
    sendTg(m);
  };

  const sendInventoryReport = () => {
    const totalItems = products.length;
    const totalValue = products.reduce((acc, p) => acc + ((Number(p.costPrice)||0) * (Number(p.stock)||0)), 0);
    let m = `*📦 Inventory Report*\n━━━━━━━━━━━━━━\n🔹 စုစုပေါင်း: ${totalItems} မျိုး\n💰 တန်ဖိုး: ${fmt(totalValue)} Ks\n\n`;
    const ls = products.filter(p => (Number(p.stock)||0) <= (Number(p.minStock)||5));
    if (ls.length) m += `🚨 *Stock နည်းနေသူများ (${ls.length})*:\n` + ls.slice(0, 15).map(p => `• ${p.name} (${p.stock})`).join('\n');
    else m += '✅ Stock နည်းသောပစ္စည်း မရှိပါ။';
    sendTg(m);
  };

  const getRecordsCSV = () => {
    const h = 'Date,InvoiceNo,Type,Name,Item,Amount,Profit,Discount,PayType,RemainingDebt,CreatedBy';
    return [h, ...records.map(r => `"${r.date||''}","${r.invoiceNo||''}","${r.type||''}","${r.personName||''}","${r.item||''}",${r.amount||0},${r.profit||0},${r.discount||0},"${r.paymentType||'Cash'}",${r.remainingDebt||0},"${r.createdBy||''}"`)].join('\n');
  };

  const getProductsCSV = () => {
    const h = 'Name,Category,Barcode,CostPrice,Price,Stock,MinStock,Unit';
    return [h, ...products.map(p => `"${p.name||''}","${p.category||'General'}","${p.barcode||''}",${p.costPrice||0},${p.price||0},${p.stock||0},${p.minStock||5},"${p.unit||''}"`)].join('\n');
  };

  const exportAllCSV = () => { downloadFile(`Records_${todayISO()}.csv`, getRecordsCSV()); downloadFile(`Products_${todayISO()}.csv`, getProductsCSV()); showToast('CSV Download ပြီး ✓'); };

  const sendTgDoc = async (fn, txt) => {
    if (!tgToken || !tgChatId) return false;
    try {
      const b = new Blob(['\uFEFF' + txt], { type: 'text/csv' });
      const fd = new FormData(); fd.append('chat_id', tgChatId); fd.append('document', b, fn);
      return (await fetch(`https://api.telegram.org/bot${tgToken}/sendDocument`, { method: 'POST', body: fd })).ok;
    } catch { return false; }
  };

  const backupToTelegram = async () => {
    if (!tgToken || !tgChatId) { showToast('Telegram Config ထည့်ပါ', 'err'); return; }
    setAppLoading(true);
    const ok1 = await sendTgDoc(`Records_${todayISO()}.csv`, getRecordsCSV());
    const ok2 = await sendTgDoc(`Products_${todayISO()}.csv`, getProductsCSV());
    setAppLoading(false);
    ok1 && ok2 ? showToast('Backup ပြီး ✓') : showToast('Error', 'err');
  };

  const handleImportAll = async e => {
    const files = Array.from(e.target.files);
    if (!files.length || !files[0].name.endsWith('.csv')) { showToast('CSV သာ', 'err'); return; }
    setAppLoading(true);
    const b = ['artifacts', appId, 'public', 'data'];
    const existingSigs = new Set(records.map(r => `${r.date}_${r.type}_${r.amount}`));
    const tasks = [];
    for (const f of files) {
      const text = await new Promise(res => { const r = new FileReader(); r.onload = ev => res(ev.target.result); r.readAsText(f); });
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length <= 1) continue;
      for (let i = 1; i < lines.length; i++) {
        const row = parseCSVLine(lines[i]);
        if (row.length < 5) continue;
        const [dateStr, invNo, type, personName, item] = row;
        const amount = parseFloat(row[5] || row[4]); if (isNaN(amount)) continue;
        const sig = `${dateStr}_${type}_${amount}`;
        if (existingSigs.has(sig)) continue;
        let createdAt = Date.now();
        const [dp, tp] = (dateStr || '').split(', ');
        if (dp) { const [d, m, y] = dp.split('/'); if (d && m && y) { const t = new Date(`${y}-${m}-${d}T${tp || '12:00:00'}`); if (!isNaN(t)) createdAt = t.getTime(); } }
        tasks.push(() => addDoc(collection(db, ...b, 'pos_records'), {
          tenantId: currentTenant, type, invoiceNo: invNo || '', personName, item, amount,
          profit: parseFloat(row[6]) || 0, discount: parseFloat(row[7]) || 0,
          paymentType: row[8] || 'Cash', remainingDebt: parseFloat(row[9]) || 0,
          createdBy: row[10] || 'imported', createdAt, date: dateStr,
        }));
        existingSigs.add(sig);
      }
    }
    for (let i = 0; i < tasks.length; i += 50) await Promise.all(tasks.slice(i, i + 50).map(fn => fn()));
    setAppLoading(false);
    showToast(`Import ပြီး (${tasks.length}) ✓`);
    if (fileRef.current) fileRef.current.value = '';
  };

  const saveSettings = async () => {
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pos_settings', currentTenant), { shopName, tgToken, tgChatId }, { merge: true });
    showToast('ဆက်တင်သိမ်းပြီး ✓');
  };

  let histBal = 0;
  const histRecords = records.filter(r => (r.type === 'Sale' || r.type === 'Payment') && r.personName === historyModal.name)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map(r => { histBal += r.type === 'Sale' ? (Number(r.amount) || 0) : -(Number(r.amount) || 0); return { ...r, runningBal: histBal }; }).reverse();

  if (setupMode === null || authLoading || appLoading) return (
    <div className="min-h-[100dvh] bg-[#080c14] flex flex-col items-center justify-center">
      <Cpu className="text-cyan-500 animate-pulse mb-4" size={56} />
      <p className="text-cyan-400 font-bold text-lg">Loading...</p>
    </div>
  );

  const isSecretSetup = window.location.pathname === '/mttadminacc';

  if (isSecretSetup && fbUser && !setupDone) return <SetupScreen onSetup={handleSetup} />;
  if (setupMode && fbUser && !setupDone && !isSecretSetup) return <SetupScreen onSetup={handleSetup} />;
  if (!currentUser) return <AuthScreen allUsers={allUsers} onLogin={setCurrentUser} />;

  return (
    <div className="min-h-[100dvh] w-full bg-[#080c14] pb-[100px] text-slate-100 antialiased font-sans overflow-x-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[400] animate-bounce max-w-[90vw]">
          <div className={`flex items-center gap-2 px-6 py-4 rounded-2xl border text-base font-bold shadow-2xl ${toast.type==='err'?'bg-rose-950 border-rose-500/40 text-rose-200':'bg-emerald-950 border-emerald-500/40 text-emerald-200'}`}>
            {toast.type==='err'?<AlertCircle size={20}/>:<CheckCircle size={20}/>}{toast.msg}
          </div>
        </div>
      )}

      {/* Low Stock Banner */}
      {lowStock.length>0 && hasPermission('manage_inventory') && (
        <div className="bg-amber-950/80 border-b border-amber-600/30 px-4 py-2 text-amber-300 text-sm font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className="animate-pulse flex-shrink-0"/> Stock နည်း: {lowStock.slice(0,3).map(p=>`${p.name}(${p.stock||0})`).join(' · ')}{lowStock.length>3?` +${lowStock.length-3}`:''}
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 w-full bg-[#0d1120]/95 backdrop-blur border-b border-cyan-500/20 px-4 sm:px-6 h-20 flex items-center justify-between shadow-[0_0_20px_rgba(6,182,212,0.08)]">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(6,182,212,0.5)]">
            <Cpu size={24} className="text-white animate-pulse" />
          </div>
          <div>
            <p className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 uppercase leading-tight">{shopName}</p>
            <p className="text-xs text-cyan-400/70 font-bold uppercase tracking-widest mt-0.5">v18 · {currentUser.username} ({currentUser.role})</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasPermission('settings') && <button onClick={()=>setShowSettings(true)} className="p-3 text-cyan-400 hover:text-cyan-200 transition-colors rounded-xl hover:bg-white/5"><SettingsIcon size={24}/></button>}
          <button onClick={()=>setCurrentUser(null)} className="p-3 text-rose-400 hover:text-rose-200 transition-colors rounded-xl hover:bg-white/5"><LogOut size={24}/></button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-2xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
        {/* ═══ ENTRY ═══ */}
        {view==='Entry' && (
          <div className="space-y-6">
            <div className="bg-[#0d1120] p-1.5 rounded-2xl flex border border-cyan-500/15 overflow-x-auto">
              {hasPermission('create_sale') && <button onClick={()=>{setEntryTab('Sale');clearCart();}} className={`flex-1 py-4 text-sm font-black rounded-xl whitespace-nowrap transition-all ${entryTab==='Sale'?'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]':'text-cyan-600 hover:text-cyan-400'}`}>🛒 အရောင်း</button>}
              {hasPermission('create_purchase') && <button onClick={()=>{setEntryTab('Purchase');clearCart();}} className={`flex-1 py-4 text-sm font-black rounded-xl whitespace-nowrap transition-all ${entryTab==='Purchase'?'bg-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.3)]':'text-blue-600 hover:text-blue-400'}`}>📦 အဝယ်</button>}
              {hasPermission('create_expense') && <button onClick={()=>{setEntryTab('Expense');clearCart();}} className={`flex-1 py-4 text-sm font-black rounded-xl whitespace-nowrap transition-all ${entryTab==='Expense'?'bg-amber-600 text-white shadow-[0_0_15px_rgba(217,119,6,0.3)]':'text-amber-600 hover:text-amber-400'}`}>💸 စရိတ်</button>}
            </div>
            <div className="bg-[#0d1120] p-5 sm:p-6 rounded-3xl border border-cyan-500/15 shadow-xl space-y-5">
              <div>
                <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">ရက်စွဲ</label>
                <input type="date" value={entryDate} onChange={e=>setEntryDate(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-4 text-lg font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-all" />
              </div>

              {entryTab==='Expense' && (
                <>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">အသုံးစရိတ်အမည်</label>
                    <input value={expenseTitle} onChange={e=>setExpenseTitle(e.target.value)} placeholder="ဥပမာ: မီတာခ" className="w-full bg-black/50 border border-amber-500/20 rounded-xl px-4 py-4 text-lg font-bold text-slate-200 outline-none placeholder-slate-600 focus:border-amber-400 transition-all" />
                  </div>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">ပမာဏ (Ks)</label>
                    <input type="number" value={expenseAmt} onChange={e=>setExpenseAmt(e.target.value)} placeholder="0" className="w-full bg-black/50 border border-amber-500/20 rounded-xl px-4 py-4 text-2xl font-black text-amber-400 outline-none placeholder-slate-600 focus:border-amber-400 transition-all" />
                  </div>
                  <button onClick={submitExpense} className="w-full py-5 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-black rounded-xl text-lg active:scale-95 transition-all shadow-lg">✓ သိမ်းမည်</button>
                </>
              )}

              {(entryTab==='Sale'||entryTab==='Purchase') && (
                <>
                  <div>
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest block mb-2">
                      {entryTab==='Sale' ? 'ဝယ်သူအမည် (အကြွေးဆိုလျှင် မဖြစ်မနေ)' : 'Supplier'}
                    </label>
                    <input value={personName} onChange={e=>setPersonName(e.target.value)} placeholder={entryTab==='Sale'?'Walk-in Customer':'Supplier'} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-4 text-lg font-bold text-slate-200 outline-none placeholder-slate-600 focus:border-cyan-400 transition-all" />
                  </div>

                  {/* Add to Cart Section */}
                  <div className="bg-black/40 p-5 rounded-2xl border border-cyan-500/10 space-y-4">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-widest">ပစ္စည်းရှာဖွေထည့်သွင်းမည်</p>

                    {/* Barcode Box + Scan Button in one row */}
                    <div className="flex gap-3 items-center">
                      <div className="relative flex-1">
                        <ScanBarcode size={20} className="absolute left-4 top-4 text-blue-400" />
                        <input
                          value={barcodeInput}
                          onChange={e=>setBarcodeInput(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && handleBarcodeSubmit(e)}
                          placeholder="Barcode ရိုက်ထည့်ပါ..."
                          className="w-full bg-blue-950/20 border border-blue-500/30 rounded-xl pl-12 pr-4 py-4 text-lg font-bold text-blue-300 outline-none focus:border-blue-400 focus:bg-blue-950/40 transition-all placeholder-blue-700"
                        />
                      </div>
                      <button
                        onClick={()=>setShowScanner(true)}
                        className="p-4 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400 hover:bg-blue-600/30 active:scale-95 transition-all flex-shrink-0"
                      >
                        <ScanBarcode size={24} />
                      </button>
                    </div>

                    {/* Categories */}
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {categories.map(c=><button key={c} onClick={()=>setSelCategory(c)} className={`px-5 py-3 rounded-xl text-sm font-black whitespace-nowrap transition-all ${selCategory===c?'bg-cyan-600 text-white':'bg-[#0d1120] text-slate-400 border border-white/5 hover:border-cyan-500/30'}`}>{c}</button>)}
                    </div>

                    {/* Searchable Dropdown */}
                    <div className="relative" ref={searchRef}>
                      <div className="relative">
                        <Search size={20} className="absolute left-4 top-4 text-cyan-500" />
                        <input
                          value={prodSearch}
                          onChange={e=>{setProdSearch(e.target.value);setShowProdDropdown(true);setSelProdId('');}}
                          onFocus={()=>setShowProdDropdown(true)}
                          placeholder="ပစ္စည်းအမည်ဖြင့် ရှာဖွေပါ..."
                          className="w-full bg-black border border-cyan-500/20 rounded-xl pl-12 pr-12 py-4 text-lg font-bold text-slate-200 outline-none focus:border-cyan-400 placeholder-slate-600 transition-all"
                        />
                        {prodSearch && <button onClick={()=>{setProdSearch('');setSelProdId('');setUnitPrice('');}} className="absolute right-4 top-4 text-slate-500 hover:text-slate-300 p-1"><X size={20}/></button>}
                      </div>

                      {showProdDropdown && (
                        <div className="absolute z-50 w-full bg-[#0d1120] border border-cyan-500/40 rounded-xl mt-1 max-h-56 overflow-y-auto shadow-2xl">
                          {filteredProdsForDropdown.length===0?<p className="px-5 py-4 text-base text-slate-500 text-center">မတွေ့ပါ</p>:filteredProdsForDropdown.slice(0,20).map(p=>(
                            <div key={p.id} onClick={()=>{setSelProdId(p.id);setProdSearch(p.name);setUnitPrice(String(entryTab==='Sale'?p.price||0:p.costPrice||0));setShowProdDropdown(false);}} className="px-5 py-4 border-b border-white/5 hover:bg-cyan-900/30 cursor-pointer transition-all flex justify-between items-center">
                              <div>
                                <p className="text-base font-black text-slate-200">{p.name}</p>
                                <p className="text-sm text-cyan-500 font-bold mt-0.5">{p.category||'General'} · {fmt(entryTab==='Sale'?p.price:p.costPrice)} Ks</p>
                              </div>
                              <span className={`text-xs font-black px-3 py-1.5 rounded-lg ${(p.stock||0) <= (p.minStock||5) ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>Stock: {p.stock||0}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unit Price & Quantity */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase block mb-1.5">{entryTab==='Sale'?'ရောင်းဈေး':'ဝယ်ဈေး'}</label>
                        <input type="number" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} placeholder="0" className="w-full bg-black border border-cyan-500/20 rounded-xl px-4 py-4 text-lg font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-all placeholder-slate-700" />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-600 uppercase block mb-1.5">အရေအတွက်</label>
                        <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="1" className="w-full bg-black border border-cyan-500/20 rounded-xl px-4 py-4 text-lg font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-all placeholder-slate-700" />
                      </div>
                    </div>

                    <button onClick={addToCart} className="w-full py-4 bg-cyan-600/20 border-2 border-cyan-500/40 text-cyan-400 rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-cyan-600/30 transition-all active:scale-95">
                      <PlusCircle size={22}/> ခြင်းထဲထည့်မည်
                    </button>
                  </div>

                  {/* Cart List */}
                  {cart.length>0 && (
                    <div className="space-y-4">
                      <div className="max-h-64 overflow-y-auto space-y-3 pr-1">
                        {cart.map(item=>(
                          <div key={item.id} className="bg-black/40 p-4 rounded-2xl border border-cyan-500/10">
                            <div className="flex justify-between items-start">
                              <div className="flex-1 min-w-0">
                                <p className="text-lg font-black text-white truncate">{item.name}</p>
                                <p className="text-sm text-cyan-400 font-bold mt-1">{fmt(item.unitPrice)} × {item.quantity} = {fmt(item.unitPrice*item.quantity)} Ks</p>
                                {item.costPrice>0 && entryTab==='Sale' && <p className="text-xs text-emerald-600 mt-0.5">Margin: +{fmt((item.unitPrice-item.costPrice)*item.quantity)} Ks</p>}
                              </div>
                              <button onClick={()=>removeFromCart(item.id)} className="text-slate-600 hover:text-rose-400 ml-3 p-2 flex-shrink-0"><X size={20}/></button>
                            </div>
                            {/* Item Discount */}
                            {entryTab==='Sale' && (
                              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-white/5">
                                <span className="text-xs font-black text-amber-500/80 uppercase flex items-center gap-1.5"><Tag size={14}/> Disc (Ks):</span>
                                <input type="number" value={item.itemDiscountAmt||''} onChange={e=>updateItemDiscount(item.id,e.target.value)} placeholder="0" className="w-28 bg-black/50 border border-amber-500/20 rounded-lg px-3 py-2 text-base font-bold text-amber-400 outline-none focus:border-amber-400 transition-all" />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Global Discount (Sale Only) */}
                      {entryTab==='Sale' && (
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label className="text-[10px] font-black text-slate-600 uppercase block mb-1.5">Global Discount</label>
                            <input type="number" value={globalDiscountAmt} onChange={e=>setGlobalDiscountAmt(e.target.value)} placeholder="0" className="w-full bg-black/50 border border-amber-500/20 rounded-xl px-4 py-4 text-lg font-bold text-amber-400 outline-none focus:border-amber-400 transition-all placeholder-slate-700" />
                          </div>
                          <div className="flex rounded-xl overflow-hidden border-2 border-white/5 mt-5">
                            <button onClick={()=>setGlobalDiscountType('%')} className={`px-5 py-4 text-base font-black transition-all ${globalDiscountType==='%'?'bg-amber-600 text-white':'bg-[#0d1120] text-slate-500'}`}>%</button>
                            <button onClick={()=>setGlobalDiscountType('flat')} className={`px-5 py-4 text-base font-black transition-all ${globalDiscountType==='flat'?'bg-amber-600 text-white':'bg-[#0d1120] text-slate-500'}`}>Ks</button>
                          </div>
                        </div>
                      )}

                      {/* Totals */}
                      <div className="bg-black/40 p-5 rounded-2xl space-y-2 border border-cyan-500/10">
                        <div className="flex justify-between text-base text-slate-500"><span>Subtotal</span><span className="font-bold">{fmt(cartTotals.sub)} Ks</span></div>
                        {cartTotals.itemDiscounts>0 && <div className="flex justify-between text-base text-amber-500"><span>Item Discounts</span><span className="font-bold">−{fmt(cartTotals.itemDiscounts)} Ks</span></div>}
                        {cartTotals.globalDisc>0 && <div className="flex justify-between text-base text-amber-400"><span>Global Discount</span><span className="font-bold">−{fmt(cartTotals.globalDisc)} Ks</span></div>}
                        <div className="flex justify-between text-2xl font-black text-cyan-300 pt-3 mt-3 border-t border-white/10"><span>TOTAL</span><span>{fmt(cartTotals.total)} Ks</span></div>
                      </div>

                      {/* Payment Type (Sale Only) */}
                      {entryTab==='Sale' && (
                        <div className="grid grid-cols-2 gap-4">
                          <button onClick={()=>setPaymentType('Cash')} className={`py-5 rounded-2xl text-base font-black transition-all border-2 ${paymentType==='Cash'?'bg-cyan-500/20 text-cyan-300 border-cyan-500/40':'bg-black/40 text-slate-500 border-white/5 hover:border-cyan-500/20'}`}>💵 လက်ငင်း</button>
                          <button onClick={()=>setPaymentType('Credit')} className={`py-5 rounded-2xl text-base font-black transition-all border-2 ${paymentType==='Credit'?'bg-rose-500/20 text-rose-300 border-rose-500/40':'bg-black/40 text-slate-500 border-white/5 hover:border-rose-500/20'}`}>💳 အကြွေး</button>
                        </div>
                      )}

                      <button onClick={entryTab==='Sale'?submitSale:submitPurchase} className={`w-full py-5 rounded-2xl font-black text-white text-xl active:scale-95 transition-all shadow-xl ${entryTab==='Sale'?'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-cyan-500/20':'bg-gradient-to-r from-blue-700 to-indigo-700 shadow-blue-500/20'}`}>
                        ✓ {entryTab==='Sale'?'အရောင်း':'အဝယ်'} သိမ်းမည်
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* ═══ DASHBOARD ═══ */}
        {view==='Dashboard' && (
          <div className="space-y-5">
            <div className="grid grid-cols-4 gap-1.5 bg-[#0d1120] p-1.5 rounded-2xl border border-cyan-500/15">
              {[['Today','ဒီနေ့'],['Week','၇ရက်'],['Month','၁လ'],['AllTime','အားလုံး']].map(([k,l])=><button key={k} onClick={()=>setDashPeriod(k)} className={`py-4 text-sm font-black rounded-xl transition-all ${dashPeriod===k?'bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.3)]':'text-cyan-600 hover:text-cyan-400'}`}>{l}</button>)}
            </div>
            {dashPeriod==='Today' && (
              <div className="flex items-center gap-4 bg-[#0d1120] p-5 rounded-2xl border border-cyan-500/15">
                <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} className="flex-1 bg-black border border-cyan-500/20 rounded-xl px-4 py-4 text-lg font-bold text-cyan-400 outline-none" />
                <button onClick={sendDailyReport} className="bg-blue-600/20 border border-blue-500/40 text-blue-400 p-4 rounded-xl hover:bg-blue-600/40 active:scale-95 transition-all"><Send size={22}/></button>
              </div>
            )}
            <div className={`p-8 rounded-3xl border relative overflow-hidden ${stats.balance>=0?'border-cyan-500/30 bg-cyan-950/15':'border-rose-500/30 bg-rose-950/15'}`}>
              <p className="text-sm font-black text-cyan-600 uppercase tracking-[0.3em] mb-2">ငွေလက်ကျန် (စုစုပေါင်း)</p>
              <p className={`text-5xl font-black tracking-tighter ${stats.balance>=0?'text-cyan-400':'text-rose-400'}`}>{fmt(stats.balance)} <span className="text-lg font-normal opacity-40">Ks</span></p>
            </div>
            <div className={`p-6 rounded-2xl border flex items-center justify-between ${stats.profit>=0?'border-emerald-500/20 bg-emerald-950/10':'border-rose-500/20 bg-rose-950/10'}`}>
              <div className="flex items-center gap-4">
                <div className={`p-4 rounded-2xl ${stats.profit>=0?'bg-emerald-500/10 text-emerald-400':'bg-rose-500/10 text-rose-400'}`}><DollarSign size={28}/></div>
                <div><p className="text-sm font-black text-slate-400 uppercase tracking-widest">အသားတင် အမြတ်</p><p className="text-xs text-slate-600">(ရောင်းအမြတ် − Discount − စရိတ်)</p></div>
              </div>
              <p className={`text-3xl font-black ${stats.profit>=0?'text-emerald-400':'text-rose-400'}`}>{stats.profit>=0?'+':''}{fmt(stats.profit)}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[['အရောင်း',stats.sales,'text-cyan-400'],['အဝယ်',stats.purchases,'text-blue-400'],['ကြွေးမြီ',stats.debt,'text-rose-400'],['Discount',stats.disc,'text-amber-400'],['စရိတ်',stats.expenses,'text-orange-400']].map(([l,v,c])=><div key={l} className={`bg-[#0d1120] p-6 rounded-2xl border border-white/5`}><p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-2">{l}</p><p className={`text-2xl font-black ${c}`}>{fmt(v)}</p></div>)}
            </div>
          </div>
        )}

        {/* ═══ REPORTS ═══ */}
        {view==='Reports' && (
          <div className="space-y-5">
            <div className="bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/15 shadow-xl space-y-5">
              <h3 className="font-black text-white flex items-center gap-3 text-xl"><PieChart size={24} className="text-cyan-500"/> အမြတ်အရှုံး အစီရင်ခံစာ</h3>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="text-xs font-black text-slate-500 uppercase mb-2 block">စတင်ရက်</label><input type="date" value={repStart} onChange={e=>setRepStart(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-4 text-lg font-bold text-cyan-400 outline-none"/></div>
                <div><label className="text-xs font-black text-slate-500 uppercase mb-2 block">ဆုံးရက်</label><input type="date" value={repEnd} onChange={e=>setRepEnd(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-4 text-lg font-bold text-cyan-400 outline-none"/></div>
              </div>
              <div className="space-y-4 pt-4">
                {[['စုစုပေါင်း အရောင်း',reportStats.sales,'cyan'],['စုစုပေါင်း အဝယ်',reportStats.purchases,'blue'],['အသုံးစရိတ်များ',reportStats.expenses,'amber']].map(([l,v,c])=><div key={l} className={`flex justify-between p-5 rounded-xl bg-${c}-950/20 border border-${c}-500/10`}><span className="text-base font-bold text-slate-300">{l}</span><span className="text-xl font-black text-cyan-400">{fmt(v)} Ks</span></div>)}
                <div className="flex justify-between p-6 rounded-xl bg-emerald-950/30 border border-emerald-500/30"><span className="text-base font-black text-emerald-200 uppercase tracking-widest">အသားတင် အမြတ်</span><span className="text-3xl font-black text-emerald-400">{fmt(reportStats.profit - reportStats.expenses)} Ks</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ LEDGER ═══ */}
        {view==='Ledger' && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1"><Search size={22} className="absolute left-4 top-4 text-slate-600"/><input value={ledSearch} onChange={e=>setLedSearch(e.target.value)} placeholder="အမည် / Invoice No ဖြင့် ရှာပါ..." className="w-full pl-12 pr-4 py-4 bg-[#0d1120] border border-white/5 rounded-xl text-lg font-bold text-slate-200 outline-none focus:border-cyan-500/30 placeholder-slate-600 transition-all" /></div>
              <button onClick={()=>setShowFilterSheet(true)} className={`px-5 rounded-xl border transition-all ${ledFilter!=='All'?'bg-cyan-600/20 border-cyan-500 text-cyan-400':'bg-[#0d1120] border-white/5 text-slate-500'}`}><Filter size={24}/></button>
            </div>

            {ledFilter==='Debtors' ? (
              <div className="space-y-4">
                <p className="text-sm font-black text-slate-500 uppercase tracking-widest px-1">ကြွေးကျန်သူများ</p>
                {debtors.length===0?<div className="text-center py-16 text-slate-500 font-bold text-lg">ကြွေးကျန်သူ မရှိပါ</div>:debtors.map(d=>(
                  <div key={d.n} className="bg-[#0d1120] p-6 rounded-2xl border border-rose-500/10 flex items-center justify-between hover:border-rose-500/30 transition-all">
                    <div className="flex items-center gap-5">
                      <div className="bg-rose-500/10 p-4 rounded-xl text-rose-400"><User size={28}/></div>
                      <div>
                        <p className="font-black text-rose-100 text-xl cursor-pointer hover:text-cyan-400" onClick={()=>setHistoryModal({show:true,name:d.n})}>{d.n}</p>
                        {hasPermission('accept_payment') && (
                          <button onClick={()=>setPayModal({show:true,name:d.n,debt:d.a,amt:'',date:todayISO()})} className="mt-3 text-sm font-black text-blue-400 bg-blue-500/10 px-4 py-2.5 rounded-xl border border-blue-500/15 flex items-center gap-2 active:scale-95">
                            <CreditCard size={18}/> ကြွေးဆပ်မည်
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-3xl font-black text-rose-500">{fmt(d.a)}</p>
                      <p className="text-xs text-rose-700 font-black uppercase mt-1">ကျန်ရှိကြွေးမြီ</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRecs.length===0 && <div className="text-center py-16 text-slate-500 font-bold text-lg">မှတ်တမ်းမရှိသေးပါ</div>}
                {filteredRecs.map(r=>(
                  <div key={r.id} className="bg-[#0d1120] p-5 rounded-2xl border border-white/5 hover:border-cyan-500/10 transition-all group">
                    <div className="flex items-start gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${r.type==='Sale'?'bg-cyan-500/10 text-cyan-400':r.type==='Purchase'?'bg-blue-500/10 text-blue-400':r.type==='Expense'?'bg-amber-500/10 text-amber-400':'bg-emerald-500/10 text-emerald-400'}`}>
                        {r.type==='Sale'?<ArrowUpRight size={24}/>:r.type==='Purchase'?<ArrowDownRight size={24}/>:r.type==='Expense'?<FileText size={24}/>:<Banknote size={24}/>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex gap-3 items-center flex-wrap">
                          <p className="font-black text-white text-xl">{r.personName||'−'}</p>
                          {r.invoiceNo && <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2 py-1 rounded">{r.invoiceNo}</span>}
                        </div>
                        <p className="text-base text-slate-500 font-bold mt-2 truncate">{r.item||'−'}</p>
                        <p className="text-xs text-slate-600 font-mono mt-1.5">{r.date||'−'}</p>
                        {hasPermission('view_reports') && r.type==='Sale' && (r.profit||0)>0 && <p className="text-xs text-emerald-600 font-bold mt-1">Profit: +{fmt(r.profit)} Ks</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className={`font-black text-2xl ${r.type==='Purchase'||r.type==='Expense'?'text-orange-400':'text-cyan-400'}`}>
                          {r.type==='Purchase'||r.type==='Expense'?'−':'+'}
                          {fmt(r.amount)}
                        </p>
                        {(Number(r.remainingDebt)||0)>0 && <span className="text-sm font-black text-rose-400 bg-rose-500/10 px-3 py-1 rounded-lg block mt-2">ကျန်: {fmt(r.remainingDebt)}</span>}
                        <div className="flex gap-3 justify-end mt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          {['Sale','Purchase','Payment'].includes(r.type) && <button onClick={()=>setReceiptModal({show:true,record:r})} className="p-2.5 text-slate-500 hover:text-cyan-400 transition-colors rounded-xl bg-black/40"><Receipt size={18}/></button>}
                          {hasPermission('delete_records') && <button onClick={()=>setConfirmDel(r)} className="p-2.5 text-slate-500 hover:text-rose-500 transition-colors rounded-xl bg-black/40"><Trash2 size={18}/></button>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ ADMIN ═══ */}
        {view==='Admin' && (
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-1.5 bg-[#0d1120] p-1.5 rounded-2xl border border-cyan-500/15">
              {hasPermission('manage_products') && <button onClick={()=>setAdminTab('Products')} className={`py-4 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 ${adminTab==='Products'?'bg-cyan-600 text-white':'text-slate-500 hover:text-slate-300'}`}>📦 Products</button>}
              {(hasPermission('manage_inventory')||hasPermission('view_inventory')) && <button onClick={()=>setAdminTab('Inventory')} className={`py-4 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 ${adminTab==='Inventory'?'bg-cyan-600 text-white':'text-slate-500 hover:text-slate-300'}`}>📊 Inventory</button>}
              {hasPermission('manage_users') && <button onClick={()=>setAdminTab('Users')} className={`py-4 text-sm font-black rounded-xl transition-all flex items-center justify-center gap-2 ${adminTab==='Users'?'bg-cyan-600 text-white':'text-slate-500 hover:text-slate-300'}`}>👥 Users</button>}
            </div>

            {adminTab==='Products' && hasPermission('manage_products') && <ProductsTab products={products} db={db} appId={appId} currentTenant={currentTenant} showToast={showToast} />}
            {adminTab==='Inventory' && (hasPermission('manage_inventory')||hasPermission('view_inventory')) && <InventoryTab products={products} db={db} appId={appId} hasPermission={hasPermission} sendInventoryReport={sendInventoryReport} />}
            {adminTab==='Users' && hasPermission('manage_users') && <UsersTab posUsers={posUsers} db={db} appId={appId} currentTenant={currentTenant} showToast={showToast} currentUser={currentUser} />}
          </div>
        )}
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 w-full bg-[#0d1120]/95 backdrop-blur border-t border-cyan-500/10 z-40" style={{paddingBottom:'max(env(safe-area-inset-bottom),0.8rem)'}}>
        <div className="max-w-2xl mx-auto flex items-end justify-around px-4 pt-3 pb-4">
          {hasPermission('view_reports') && <button onClick={()=>setView('Dashboard')} className={`flex flex-col items-center gap-1.5 transition-all ${view==='Dashboard'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><LayoutDashboard size={26}/><span className="text-[10px] font-black uppercase tracking-widest">Dash</span></button>}
          {hasPermission('view_sales') && <button onClick={()=>setView('Ledger')} className={`flex flex-col items-center gap-1.5 transition-all ${view==='Ledger'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><Database size={26}/><span className="text-[10px] font-black uppercase tracking-widest">Ledger</span></button>}
          {(hasPermission('create_sale')||hasPermission('create_purchase')||hasPermission('create_expense')) && (
            <div className="relative -top-6">
              <button onClick={()=>setView('Entry')} className={`w-20 h-20 rounded-2xl flex items-center justify-center border-[6px] border-[#080c14] shadow-[0_0_25px_rgba(6,182,212,0.4)] active:scale-95 transition-all ${view==='Entry'?'bg-cyan-500 text-white':'bg-[#0d1120] border-cyan-500/20 text-cyan-500 hover:bg-cyan-950'}`}>
                <ShoppingCart size={32}/>
              </button>
            </div>
          )}
          {hasPermission('view_reports') && <button onClick={()=>setView('Reports')} className={`flex flex-col items-center gap-1.5 transition-all ${view==='Reports'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><BarChart3 size={26}/><span className="text-[10px] font-black uppercase tracking-widest">Report</span></button>}
          {(hasPermission('manage_products')||hasPermission('manage_inventory')||hasPermission('manage_users')) && <button onClick={()=>setView('Admin')} className={`flex flex-col items-center gap-1.5 transition-all ${view==='Admin'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><ShieldAlert size={26}/><span className="text-[10px] font-black uppercase tracking-widest">Admin</span></button>}
        </div>
      </div>

      {/* Modals (same as before, compact for space) */}
      {confirmDel && <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"><div className="bg-[#0d1120] p-8 rounded-3xl border border-rose-500/25 text-center max-w-sm w-full shadow-2xl"><Trash2 size={48} className="mx-auto text-rose-500 mb-5"/><h3 className="text-2xl font-black text-white mb-3">ဖျက်ရန် သေချာပါသလား?</h3><p className="text-base text-slate-500 mb-8">ဖျက်ပြီးသော မှတ်တမ်းကို နောက်ပြန်မရပါ</p><div className="flex gap-4"><button onClick={()=>setConfirmDel(null)} className="flex-1 py-4 bg-slate-800 rounded-xl font-black text-lg text-white">မလုပ်တော့</button><button onClick={doDelete} className="flex-1 py-4 bg-rose-600 rounded-xl font-black text-lg text-white">ဖျက်မည်</button></div></div></div>}

      {showScanner && <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm"><div className="bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/20 w-full max-w-lg mx-4"><div className="flex justify-between items-center mb-4"><h3 className="font-black text-white text-xl">Barcode / QR ဖတ်မည်</h3><button onClick={()=>setShowScanner(false)} className="text-slate-400 hover:text-rose-400 p-2"><X size={28}/></button></div><div id="barcode-reader" className="w-full overflow-hidden rounded-xl" style={{minHeight:'220px'}}></div></div></div>}
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
  const handleSubmit = e => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setErr('အားလုံးဖြည့်ပါ'); return; }
    onSetup(username, password, shopName);
  };
  return (
    <div className="min-h-[100dvh] bg-[#080c14] flex items-center justify-center p-4">
      <div className="bg-[#0d1120] p-8 sm:p-10 rounded-3xl border border-cyan-500/25 shadow-[0_0_40px_rgba(6,182,212,0.15)] w-full max-w-md">
        <div className="text-center mb-8"><MonitorPlay size={56} className="mx-auto text-cyan-500 mb-5"/><h2 className="text-3xl font-black text-white uppercase">Cyber POS</h2><p className="text-base text-cyan-400 font-bold mt-2">Admin အကောင့်ဖွင့်ပါ</p></div>
        {err && <p className="text-base font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-6 text-center">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-5">
          <input required value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="ဆိုင်အမည်" className="w-full px-5 py-5 bg-black/50 border border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Admin Username" className="w-full px-5 py-5 bg-black/50 border border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <div className="relative"><input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full px-5 py-5 bg-black/50 border border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400 transition-all pr-14 placeholder-slate-600"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-5 top-5 text-slate-500 hover:text-slate-300">{show?<EyeOff size={24}/>:<Eye size={24}/>}</button></div>
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-5 rounded-xl text-xl active:scale-95 transition-all shadow-lg shadow-cyan-500/20">Admin အကောင့်ဖွင့်မည်</button>
        </form>
      </div>
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
    if (user) onLogin(user);
    else setErr('Username သို့မဟုတ် Password မှားနေပါသည်');
  };
  return (
    <div className="min-h-[100dvh] bg-[#080c14] flex items-center justify-center p-4">
      <div className="bg-[#0d1120] p-8 sm:p-10 rounded-3xl border border-cyan-500/25 shadow-[0_0_40px_rgba(6,182,212,0.15)] w-full max-w-md">
        <div className="text-center mb-8"><MonitorPlay size={56} className="mx-auto text-cyan-500 mb-5"/><h2 className="text-3xl font-black text-white uppercase">Cyber POS</h2><p className="text-base text-cyan-400 font-bold mt-2">PRO VERSION 18</p></div>
        {err && <p className="text-base font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-4 rounded-xl mb-6 text-center">{err}</p>}
        <form onSubmit={handleLogin} className="space-y-5">
          <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username" className="w-full px-5 py-5 bg-black/50 border border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <div className="relative"><input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full px-5 py-5 bg-black/50 border border-cyan-500/20 rounded-xl text-slate-200 font-bold text-xl outline-none focus:border-cyan-400 transition-all pr-14 placeholder-slate-600"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-5 top-5 text-slate-500 hover:text-slate-300">{show?<EyeOff size={24}/>:<Eye size={24}/>}</button></div>
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-5 rounded-xl text-xl active:scale-95 transition-all shadow-lg shadow-cyan-500/20">Login ဝင်မည်</button>
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
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pos_products', editing.id), payload, { merge: true });
        showToast('ပြင်ဆင်ပြီး ✓'); setEditing(null);
      } else {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pos_products'), { ...payload, tenantId: currentTenant, stock: 0, createdAt: Date.now() });
        showToast('ထည့်ပြီး ✓'); setAdding(false);
      }
      resetForm();
    } catch { showToast('Error', 'err'); }
  };

  const startEdit = p => { setEditing(p); setForm({ name: p.name || '', category: p.category || '', barcode: p.barcode || '', costPrice: String(p.costPrice || ''), price: String(p.price || ''), minStock: String(p.minStock || '5'), unit: p.unit || 'ခု' }); setAdding(false); };
  const cancelEdit = () => { setEditing(null); resetForm(); };

  return (
    <div className="bg-[#0d1120] border border-cyan-500/15 rounded-3xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-white flex items-center gap-3 text-xl"><Package size={24}/> ကုန်ပစ္စည်းများ</h3>
        <button onClick={()=>{setAdding(!adding);cancelEdit();}} className="bg-cyan-900/40 text-cyan-400 px-5 py-3 rounded-xl font-black text-base flex items-center gap-2 hover:bg-cyan-900/60 transition-all"><Plus size={20}/> ထည့်မည်</button>
      </div>
      {(adding||editing) && (
        <form onSubmit={handleSave} className="bg-black/40 p-6 rounded-2xl border border-cyan-500/15 mb-6 space-y-5">
          <p className="text-sm font-black text-cyan-400 uppercase tracking-widest">{editing?'✏ ပြင်ဆင်မည်':'+ ထည့်သွင်းမည်'}</p>
          <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="ပစ္စည်းအမည်" className="w-full px-4 py-4 bg-black border border-cyan-500/15 rounded-xl text-lg font-bold text-slate-200 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="အမျိုးအစား (ဥပမာ - Food)" className="px-4 py-4 bg-black border border-cyan-500/15 rounded-xl text-lg font-bold text-slate-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
            <div className="flex gap-3">
              <input value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})} placeholder="Barcode Code" className="flex-1 px-4 py-4 bg-black border border-cyan-500/15 rounded-xl text-lg font-bold text-slate-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
              <button type="button" onClick={()=>setShowProductScanner(true)} className="p-4 bg-blue-600/20 border border-blue-500/40 rounded-xl text-blue-400 hover:bg-blue-600/30 active:scale-95 transition-all flex-shrink-0"><ScanBarcode size={22}/></button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input required type="number" value={form.costPrice} onChange={e=>setForm({...form,costPrice:e.target.value})} placeholder="ဝယ်/အရင်းဈေး" className="px-4 py-4 bg-black border border-blue-500/15 rounded-xl text-lg font-bold text-blue-300 outline-none focus:border-blue-400 transition-all placeholder-slate-600"/>
            <input required type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="ရောင်းဈေး" className="px-4 py-4 bg-black border border-cyan-500/15 rounded-xl text-lg font-bold text-cyan-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="Unit (ခု/kg)" className="px-4 py-4 bg-black border border-cyan-500/15 rounded-xl text-lg font-bold text-slate-300 outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
            <input type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})} placeholder="Min Stock" className="px-4 py-4 bg-black border border-amber-500/15 rounded-xl text-lg font-bold text-amber-300 outline-none focus:border-amber-400 transition-all placeholder-slate-600"/>
          </div>
          {form.price && form.costPrice && +form.price>0 && (
            <p className="text-base text-emerald-400 font-bold bg-emerald-950/30 border border-emerald-500/15 px-5 py-4 rounded-xl">
              Margin: {(+form.price-+form.costPrice).toLocaleString()} Ks ({((+form.price-+form.costPrice)/+form.price*100).toFixed(1)}%)
            </p>
          )}
          <div className="flex gap-4 pt-2">
            <button type="submit" className="flex-1 py-5 bg-cyan-600 text-white rounded-xl font-black text-lg flex items-center justify-center gap-2 hover:bg-cyan-500 transition-all"><Save size={20}/> သိမ်းမည်</button>
            <button type="button" onClick={()=>{setAdding(false);cancelEdit();}} className="px-6 py-5 bg-slate-800 text-slate-400 rounded-xl font-black text-lg hover:bg-slate-700 transition-all">မလုပ်တော့</button>
          </div>
        </form>
      )}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        {products.length===0 && <p className="text-center text-slate-500 text-lg py-12">ကုန်ပစ္စည်း မရှိသေးပါ</p>}
        {products.map(p=>(
          <div key={p.id} className="bg-black/30 p-5 rounded-2xl border border-cyan-500/8 hover:border-cyan-500/20 transition-all group">
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <div className="flex gap-3 items-center mb-2 flex-wrap">
                  <p className="font-black text-white text-xl truncate">{p.name}</p>
                  <span className="text-xs bg-slate-800 px-3 py-1.5 rounded-lg text-slate-300">{p.category||'General'}</span>
                </div>
                <div className="flex items-center gap-4 mt-2 flex-wrap">
                  <span className="text-base text-blue-400 font-bold">ဝယ်: {fmt(p.costPrice)}</span>
                  <span className="text-base text-cyan-400 font-bold">ရောင်း: {fmt(p.price)}</span>
                  {p.price>0 && p.costPrice>0 && <span className="text-sm text-emerald-500 font-bold">{((p.price-p.costPrice)/p.price*100).toFixed(0)}% margin</span>}
                </div>
                {p.barcode && <p className="text-sm font-mono text-slate-600 mt-2">BC: {p.barcode}</p>}
              </div>
              <div className="flex gap-3 ml-4 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
                <button onClick={()=>startEdit(p)} className="p-3 bg-indigo-950/50 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-900/50 transition-all"><Edit3 size={20}/></button>
                <button onClick={async ()=>{await deleteDoc(doc(db,'artifacts',appId,'public','data','pos_products',p.id));}} className="p-3 bg-rose-950/50 border border-rose-500/20 text-rose-400 rounded-xl hover:bg-rose-900/50 transition-all"><Trash2 size={20}/></button>
              </div>
            </div>
          </div>
        ))}
      </div>
      {showProductScanner && <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80"><div className="bg-[#0d1120] p-6 rounded-3xl border border-cyan-500/20 w-full max-w-lg mx-4"><div className="flex justify-between items-center mb-4"><h3 className="font-black text-white text-xl">Barcode ဖတ်မည်</h3><button onClick={()=>setShowProductScanner(false)} className="text-slate-400 hover:text-rose-400 p-2"><X size={28}/></button></div><div id="product-barcode-reader" className="w-full overflow-hidden rounded-xl" style={{minHeight:'220px'}}></div></div></div>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// INVENTORY TAB
// ════════════════════════════════════════════════════════════════
function InventoryTab({ products, db, appId, hasPermission, sendInventoryReport }) {
  const canManage = hasPermission('manage_inventory');
  return (
    <div className="bg-[#0d1120] border border-blue-500/15 rounded-3xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-white flex items-center gap-3 text-xl"><Boxes size={24}/> ကုန်လက်ကျန်</h3>
        <button onClick={sendInventoryReport} className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-4 py-3 rounded-xl font-black text-sm flex items-center gap-2 active:scale-95 hover:bg-blue-600/30 transition-all"><Send size={18}/> Telegram သို့ပို့မည်</button>
      </div>
      <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
        {products.length===0 && <p className="text-center text-slate-500 text-lg py-12">ကုန်ပစ္စည်း မရှိသေးပါ</p>}
        {products.map(p=>(
          <div key={p.id} className={`p-5 rounded-2xl border flex justify-between items-center transition-all ${(Number(p.stock)||0)<=(Number(p.minStock)||5)?'bg-amber-950/20 border-amber-500/20':'bg-black/30 border-cyan-500/8'}`}>
            <div className="pr-4">
              <p className="font-black text-white text-xl">{p.name}</p>
              <p className="text-base text-slate-400 font-bold mt-1.5">{fmt(p.price)} Ks · min: {p.minStock||5} {p.unit}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className="text-xs text-slate-500 font-black uppercase">Stock</span>
              <input
                type="number"
                defaultValue={p.stock||0}
                readOnly={!canManage}
                onBlur={async e=>{if(!canManage)return;const v=Number(e.target.value);if(v!==(p.stock||0))await setDoc(doc(db,'artifacts',appId,'public','data','pos_products',p.id),{stock:v},{merge:true});}}
                className={`w-28 text-center font-black text-xl px-3 py-3 rounded-xl outline-none border transition-all ${!canManage?'bg-black text-slate-500 border-white/5 cursor-not-allowed':(Number(p.stock)||0)<=(Number(p.minStock)||5)?'bg-amber-950/40 border-amber-500/40 text-amber-300 focus:border-amber-400':'bg-black/50 border-blue-500/30 text-blue-300 focus:border-blue-400'}`}
              />
            </div>
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

  const handleAdd = async e => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) return;
    if (posUsers.some(u => u.username === form.username.trim())) { showToast('Username ရှိပြီးသားပါ', 'err'); return; }
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pos_users'), {
        tenantId: currentTenant, username: form.username.trim(),
        password: simpleHash(form.password), role: form.role,
        permissions: form.role === 'staff' ? DEFAULT_STAFF_PERMS : [],
        createdAt: Date.now(),
      });
      setForm({ username: '', password: '', role: 'staff' }); setAdding(false);
      showToast('အကောင့်ဖွင့်ပြီးပါပြီ ✓');
    } catch { showToast('Error', 'err'); }
  };

  const togglePermission = async (user, permKey) => {
    const newPerms = user.permissions?.includes(permKey) ? user.permissions.filter(p => p !== permKey) : [...(user.permissions || []), permKey];
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pos_users', user.id), { permissions: newPerms }, { merge: true });
  };

  return (
    <div className="bg-[#0d1120] border border-indigo-500/15 rounded-3xl p-6 shadow-lg">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-black text-white flex items-center gap-3 text-xl"><Users size={24}/> ကိုယ့်ဆိုင်ဝန်ထမ်းများ</h3>
        <button onClick={()=>setAdding(!adding)} className="bg-indigo-900/40 text-indigo-400 px-5 py-3 rounded-xl font-black text-base flex items-center gap-2 hover:bg-indigo-900/60 transition-all"><Plus size={20}/> ထည့်မည်</button>
      </div>
      {adding && (
        <form onSubmit={handleAdd} className="bg-black/40 p-6 rounded-2xl border border-indigo-500/15 mb-6 space-y-5">
          <input required value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Username" className="w-full px-4 py-4 bg-black border border-indigo-500/15 rounded-xl text-lg font-bold text-slate-200 outline-none focus:border-indigo-400 transition-all placeholder-slate-600"/>
          <div className="relative"><input required type={show?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" className="w-full px-4 py-4 bg-black border border-indigo-500/15 rounded-xl text-lg font-bold text-slate-200 outline-none focus:border-indigo-400 transition-all pr-14 placeholder-slate-600"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-5 top-5 text-slate-500"><EyeOff size={22}/></button></div>
          <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full px-4 py-4 bg-black border border-indigo-500/15 rounded-xl text-lg font-bold text-slate-200 outline-none focus:border-indigo-400 transition-all">
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
          <div className="flex gap-4 pt-2">
            <button type="submit" className="flex-1 py-5 bg-indigo-600 text-white rounded-xl font-black text-lg hover:bg-indigo-500 transition-all">✓ ဖွင့်မည်</button>
            <button type="button" onClick={()=>setAdding(false)} className="px-6 py-5 bg-slate-800 text-slate-400 rounded-xl font-black text-lg hover:bg-slate-700 transition-all">မလုပ်တော့</button>
          </div>
        </form>
      )}
      <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
        {posUsers.map(u=>(
          <div key={u.id} className="bg-black/30 p-5 rounded-2xl border border-indigo-500/8">
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-950/60 flex items-center justify-center text-indigo-400 font-black text-xl">{u.username?.[0]?.toUpperCase()||'?'}</div>
                <div>
                  <p className="font-black text-white text-xl">{u.username}</p>
                  <span className={`text-xs font-black px-3 py-1 rounded uppercase ${u.role==='admin'?'bg-indigo-500/20 text-indigo-400':'bg-cyan-500/20 text-cyan-400'}`}>{u.role}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={()=>setEditingPerms(editingPerms===u.id?null:u.id)} className="text-sm text-indigo-400 bg-indigo-500/10 px-4 py-2.5 rounded-xl border border-indigo-500/20 flex items-center gap-2 active:scale-95 hover:bg-indigo-500/20 transition-all">
                  <ShieldCheck size={18}/> {editingPerms===u.id?'ပိတ်မည်':'ခွင့်ပြုချက်'}
                </button>
                {u.username!==currentUser.username && (
                  <button onClick={async ()=>{if(u.role==='admin'&&posUsers.filter(x=>x.role==='admin').length<=1){showToast('Admin အနည်းဆုံး ၁ ခုရှိရပါမည်','err');return;}await deleteDoc(doc(db,'artifacts',appId,'public','data','pos_users',u.id));}} className="text-rose-500 hover:text-rose-300 p-3 transition-colors"><Trash2 size={22}/></button>
                )}
              </div>
            </div>
            {editingPerms===u.id && (
              <div className="mt-5 p-5 bg-black/60 rounded-2xl border border-indigo-500/20 grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-4">
                {PERMISSION_OPTIONS.map(perm=>(
                  <label key={perm.key} className={`flex items-center gap-3 text-base font-bold ${u.role==='admin'?'text-slate-600':'text-slate-300'} cursor-pointer`}>
                    <input type="checkbox" checked={u.role==='admin'?true:u.permissions?.includes(perm.key)} onChange={()=>togglePermission(u,perm.key)} disabled={u.role==='admin'} className="accent-indigo-500 w-5 h-5 rounded"/>
                    <span className="leading-tight">{perm.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
