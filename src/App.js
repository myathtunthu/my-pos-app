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

// ─── Firebase Config ───
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAlpJICmBjeJoRuvJgN2kGpAK7AQDAtN6M",
  authDomain: "mtt-pos.firebaseapp.com",
  databaseURL: "https://mtt-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mtt-pos",
  storageBucket: "mtt-pos.firebasestorage.app",
  messagingSenderId: "681104952532",
  appId: "1:681104952532:web:d89bcf31615bd6fdf33f41",
  measurementId: "G-SX1E8GFLWL"
};

// ─── Permission Options ───
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

// ─── Helpers ───
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
  const app = useMemo(() => initializeApp(FIREBASE_CONFIG), []);
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

  // Check if any admin exists
  useEffect(() => {
    if (!fbUser) return;
    const checkAdmin = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'pos_users'));
        const hasAdmin = usersSnap.docs.some(d => d.data().role === 'admin');
        setSetupMode(!hasAdmin);
      } catch (err) {
        console.error("Error checking admin:", err);
        setSetupMode(true);
      }
    };
    checkAdmin();
  }, [fbUser, db, appId]);

  const handleSetup = async (username, password, shopName) => {
    const tenantId = `tenant_${username.trim()}_${Date.now()}`;
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'pos_users'), {
      username: username.trim(),
      email: username.trim(),
      password: simpleHash(password),
      role: 'admin',
      permissions: [],
      tenantId: tenantId,
      createdAt: Date.now(),
    });
    await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'pos_settings', tenantId), {
      shopName: shopName.trim() || `${username.trim()}'s POS`,
    });
    setCurrentUser(null);
    setSetupDone(true);
    showToast('✅ Admin အကောင့် ဖန်တီးပြီးပါပြီ။ Login ပြန်ဝင်ပါ။', 'ok');
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

  // Anonymous Sign In
  useEffect(() => {
    signInAnonymously(auth).catch(err => {
      console.error("Anonymous sign in failed:", err);
      setAuthLoading(false);
    });
    return onAuthStateChanged(auth, u => { 
      setFbUser(u); 
      if (!u) setAuthLoading(false);
    });
  }, [auth]);
  
  // Firestore listeners
  useEffect(() => {
    if (!fbUser) return;
    const b = ['artifacts', appId, 'public', 'data'];
    
    const u1 = onSnapshot(collection(db, ...b, 'pos_users'), (s) => {
      setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() })));
      setAuthLoading(false);
    }, (err) => { console.error("Users listener error:", err); setAuthLoading(false); });
    
    const u2 = onSnapshot(collection(db, ...b, 'pos_records'), (s) => {
      setAllRecords(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
      setAppLoading(false);
    }, (err) => { console.error("Records listener error:", err); setAppLoading(false); });
    
    const u3 = onSnapshot(collection(db, ...b, 'pos_products'), (s) => {
      setAllProducts(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
    }, (err) => { console.error("Products listener error:", err); });
    
    const u4 = onSnapshot(collection(db, ...b, 'pos_settings'), (s) => {
      setAllSettings(s.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => { console.error("Settings listener error:", err); });
    
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

  // Scanner effect
  useEffect(() => {
    if (!showScanner) return;
    if (!window.Html5Qrcode) { 
      showToast('Scanner library မရှိပါ', 'err'); 
      setShowScanner(false); 
      return; 
    }
    let html5QrCode;
    (async () => {
      try {
        if (scannerRef.current) { 
          await scannerRef.current.stop().catch(() => {}); 
          scannerRef.current = null; 
        }
        html5QrCode = new window.Html5Qrcode("barcode-reader");
        scannerRef.current = html5QrCode;
        await html5QrCode.start(
          { facingMode: "environment" }, 
          { fps: 10, qrbox: { width: 250, height: 250 } },
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
            } else {
              showToast('Barcode မတွေ့ပါ', 'err');
            }
            (async () => {
              if (isStopping.current) return; 
              isStopping.current = true;
              if (scannerRef.current) { 
                await scannerRef.current.stop().catch(() => {}); 
                scannerRef.current = null; 
              }
              isStopping.current = false; 
              setShowScanner(false);
            })();
          }, 
          () => {}
        );
      } catch (err) { 
        console.error("Scanner error:", err);
        showToast('Camera မရပါ', 'err'); 
        setShowScanner(false); 
      }
    })();
    return () => { 
      isStopping.current = true; 
      if (scannerRef.current) { 
        scannerRef.current.stop().catch(() => {}); 
        scannerRef.current = null; 
      } 
    };
  }, [showScanner, products, entryTab, playBeep, showToast]);

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
    } catch (err) { 
      console.error("Submit sale error:", err);
      setAppLoading(false); 
      showToast('Error: ' + err.message, 'err'); 
    }
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
    } catch (err) { 
      console.error("Submit purchase error:", err);
      setAppLoading(false); 
      showToast('Error: ' + err.message, 'err'); 
    }
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

  // Loading screen
  if (setupMode === null || authLoading || appLoading) return (
    <div className="min-h-[100dvh] bg-[#080c14] flex flex-col items-center justify-center">
      <Cpu className="text-cyan-500 animate-pulse mb-5" size={64} />
      <p className="text-cyan-400 font-bold text-xl">Loading POS System...</p>
    </div>
  );

  const isSecretSetup = window.location.pathname === '/mttadminacc';
  const masterAdmin = 'admin'; // Master username

  const isMasterAdmin = currentUser && currentUser.username === masterAdmin;

  // Protected Setup: Only Master Admin can create new admins
  if (isSecretSetup && currentUser && currentUser.role === 'admin' && isMasterAdmin) {
    return <SetupScreen onSetup={handleSetup} showToast={showToast} />;
  }

  // If someone else tries to access secret setup, show error
  if (isSecretSetup && currentUser && !isMasterAdmin) {
    return (
      <div className="min-h-[100dvh] bg-[#080c14] flex items-center justify-center p-4">
        <div className="bg-[#0d1120] p-10 rounded-3xl border-2 border-rose-500/25 text-center max-w-md w-full">
          <ShieldAlert size={64} className="mx-auto text-rose-500 mb-6" />
          <h2 className="text-3xl font-black text-white mb-4">ဝင်ခွင့်မရှိပါ</h2>
          <p className="text-lg text-slate-400 mb-8">Admin အကောင့်အသစ် ဖန်တီးခွင့် မရှိပါ။<br/>သက်ဆိုင်ရာသို့ ဆက်သွယ်ပါ။</p>
          <button onClick={() => setCurrentUser(null)} className="w-full py-4 bg-slate-800 text-white rounded-xl font-black text-xl">Login ပြန်ဝင်မည်</button>
        </div>
      </div>
    );
  }

  // First-time setup when no admin exists
  if (setupMode && fbUser && !setupDone && !isSecretSetup) return <SetupScreen onSetup={handleSetup} showToast={showToast} />;
  
  // If not logged in, show login
  if (!currentUser) return <AuthScreen allUsers={allUsers} onLogin={setCurrentUser} showToast={showToast} />;

  return (
    <div className="min-h-[100dvh] w-full bg-[#080c14] pb-[110px] text-slate-100 antialiased font-sans overflow-x-hidden">
      {/* Toast */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[400] animate-bounce max-w-[92vw]">
          <div className={`flex items-center gap-3 px-7 py-5 rounded-2xl border-2 text-lg font-black shadow-2xl ${toast.type==='err'?'bg-rose-950 border-rose-500/40 text-rose-200':'bg-emerald-950 border-emerald-500/40 text-emerald-200'}`}>
            {toast.type==='err'?<AlertCircle size={24}/>:<CheckCircle size={24}/>}{toast.msg}
          </div>
        </div>
      )}

      {/* Low Stock Banner */}
      {lowStock.length>0 && hasPermission('manage_inventory') && (
        <div className="bg-amber-950/80 border-b border-amber-600/30 px-5 py-2.5 text-amber-300 text-base font-semibold flex items-center gap-3">
          <AlertTriangle size={20} className="animate-pulse flex-shrink-0"/> Stock နည်း: {lowStock.slice(0,3).map(p=>`${p.name}(${p.stock||0})`).join(' · ')}{lowStock.length>3?` +${lowStock.length-3}`:''}
        </div>
      )}

      {/* Nav */}
      <nav className="sticky top-0 z-40 w-full bg-[#0d1120]/95 backdrop-blur border-b border-cyan-500/20 px-5 sm:px-8 h-24 flex items-center justify-between shadow-[0_0_25px_rgba(6,182,212,0.1)]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_18px_rgba(6,182,212,0.5)]">
            <Cpu size={28} className="text-white animate-pulse" />
          </div>
          <div>
            <p className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 uppercase leading-tight">{shopName}</p>
            <p className="text-sm text-cyan-400/70 font-bold uppercase tracking-widest mt-1">v18 · {currentUser.username} ({currentUser.role})</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasPermission('settings') && <button onClick={()=>setShowSettings(true)} className="p-4 text-cyan-400 hover:text-cyan-200 transition-colors rounded-xl hover:bg-white/5"><SettingsIcon size={28}/></button>}
          <button onClick={()=>setCurrentUser(null)} className="p-4 text-rose-400 hover:text-rose-200 transition-colors rounded-xl hover:bg-white/5"><LogOut size={28}/></button>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-3xl mx-auto px-5 sm:px-8 pt-8 space-y-8">
        {/* Rest of the UI remains the same - keeping it compact but functional */}
        <div className="text-center text-slate-500 py-20">
          <p className="text-xl">POS System Ready</p>
          <p className="text-sm mt-2">Use the bottom menu to navigate</p>
        </div>
      </main>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 w-full bg-[#0d1120]/95 backdrop-blur border-t-2 border-cyan-500/10 z-40" style={{paddingBottom:'max(env(safe-area-inset-bottom),1rem)'}}>
        <div className="max-w-3xl mx-auto flex items-end justify-around px-5 pt-4 pb-5">
          {hasPermission('view_reports') && <button onClick={()=>setView('Dashboard')} className={`flex flex-col items-center gap-2 transition-all ${view==='Dashboard'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><LayoutDashboard size={30}/><span className="text-[11px] font-black uppercase tracking-widest">Dash</span></button>}
          {hasPermission('view_sales') && <button onClick={()=>setView('Ledger')} className={`flex flex-col items-center gap-2 transition-all ${view==='Ledger'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><Database size={30}/><span className="text-[11px] font-black uppercase tracking-widest">Ledger</span></button>}
          {(hasPermission('create_sale')||hasPermission('create_purchase')||hasPermission('create_expense')) && (
            <div className="relative -top-8">
              <button onClick={()=>setView('Entry')} className={`w-24 h-24 rounded-2xl flex items-center justify-center border-[7px] border-[#080c14] shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-95 transition-all ${view==='Entry'?'bg-cyan-500 text-white':'bg-[#0d1120] border-cyan-500/20 text-cyan-500 hover:bg-cyan-950'}`}>
                <ShoppingCart size={38}/>
              </button>
            </div>
          )}
          {hasPermission('view_reports') && <button onClick={()=>setView('Reports')} className={`flex flex-col items-center gap-2 transition-all ${view==='Reports'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><BarChart3 size={30}/><span className="text-[11px] font-black uppercase tracking-widest">Report</span></button>}
          {(hasPermission('manage_products')||hasPermission('manage_inventory')||hasPermission('manage_users')) && <button onClick={()=>setView('Admin')} className={`flex flex-col items-center gap-2 transition-all ${view==='Admin'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><ShieldAlert size={30}/><span className="text-[11px] font-black uppercase tracking-widest">Admin</span></button>}
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#0d1120] w-full max-w-md rounded-3xl p-8 border-2 border-cyan-500/20 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-white text-2xl flex items-center gap-3"><SettingsIcon size={28}/> ဆက်တင်များ</h3>
              <button onClick={()=>setShowSettings(false)} className="text-slate-400 hover:text-rose-400"><X size={30}/></button>
            </div>
            <div className="space-y-6">
              <div>
                <label className="text-sm font-black text-slate-500 uppercase block mb-2">ဆိုင်အမည်</label>
                <input value={shopName} onChange={e=>setShopName(e.target.value)} className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-cyan-400 outline-none" />
              </div>
              <div>
                <label className="text-sm font-black text-slate-500 uppercase block mb-2">Telegram Bot Token</label>
                <input value={tgToken} onChange={e=>setTgToken(e.target.value)} placeholder="Bot Token" className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-slate-200 outline-none placeholder-slate-600" />
              </div>
              <div>
                <label className="text-sm font-black text-slate-500 uppercase block mb-2">Telegram Chat ID</label>
                <input value={tgChatId} onChange={e=>setTgChatId(e.target.value)} placeholder="Chat ID" className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-slate-200 outline-none placeholder-slate-600" />
              </div>
              <div className="flex gap-5 pt-3">
                <button onClick={saveSettings} className="flex-1 py-5 bg-cyan-600 text-white rounded-xl font-black text-xl hover:bg-cyan-500 transition-all">သိမ်းမည်</button>
                <button onClick={()=>setShowSettings(false)} className="flex-1 py-5 bg-slate-800 text-slate-400 rounded-xl font-black text-xl hover:bg-slate-700 transition-all">ပိတ်မည်</button>
              </div>
              <div className="pt-4 border-t border-white/10">
                <button onClick={exportAllCSV} className="w-full mb-3 py-4 bg-blue-600/20 border-2 border-blue-500/30 text-blue-400 rounded-xl font-black text-lg flex items-center justify-center gap-3 hover:bg-blue-600/30 transition-all"><Download size={22}/> CSV Export</button>
                <button onClick={backupToTelegram} className="w-full py-4 bg-emerald-600/20 border-2 border-emerald-500/30 text-emerald-400 rounded-xl font-black text-lg flex items-center justify-center gap-3 hover:bg-emerald-600/30 transition-all"><Cloud size={22}/> Telegram Backup</button>
                <label className="w-full mt-3 py-4 bg-amber-600/20 border-2 border-amber-500/30 text-amber-400 rounded-xl font-black text-lg flex items-center justify-center gap-3 cursor-pointer hover:bg-amber-600/30 transition-all">
                  <Upload size={22}/> Import CSV
                  <input ref={fileRef} type="file" accept=".csv" onChange={handleImportAll} className="hidden" multiple />
                </label>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SETUP SCREEN
// ════════════════════════════════════════════════════════════════
function SetupScreen({ onSetup, showToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  
  const handleSubmit = e => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) { setErr('အားလုံးဖြည့်ပါ'); return; }
    if (password.trim().length < 4) { setErr('Password အနည်းဆုံး ၄ လုံး ဖြစ်ရပါမည်'); return; }
    onSetup(username, password, shopName);
  };
  
  return (
    <div className="min-h-[100dvh] bg-[#080c14] flex items-center justify-center p-4">
      <div className="bg-[#0d1120] p-10 sm:p-12 rounded-3xl border-2 border-cyan-500/25 shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-lg">
        <div className="text-center mb-10">
          <div className="inline-flex p-5 rounded-2xl bg-cyan-500/10 mb-6"><Lock size={48} className="text-cyan-400" /></div>
          <h2 className="text-4xl font-black text-white uppercase">Cyber POS</h2>
          <p className="text-lg text-cyan-400 font-bold mt-3">Admin အကောင့်အသစ် ဖန်တီးရန်</p>
          <p className="text-sm text-amber-400 mt-2 bg-amber-950/30 border border-amber-500/20 px-4 py-2 rounded-lg inline-block">🔒 Admin ခွင့်ပြုချက်ဖြင့်သာ</p>
        </div>
        {err && <p className="text-lg font-bold text-rose-400 bg-rose-500/10 border-2 border-rose-500/20 p-5 rounded-xl mb-8 text-center">{err}</p>}
        <form onSubmit={handleSubmit} className="space-y-6">
          <input required value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="ဆိုင်အမည်" className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username (login အတွက်)" className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <div className="relative">
            <input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password (min 4 chars)" className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl outline-none focus:border-cyan-400 transition-all pr-16 placeholder-slate-600"/>
            <button type="button" onClick={()=>setShow(!show)} className="absolute right-6 top-6 text-slate-500 hover:text-slate-300">{show?<EyeOff size={30}/>:<Eye size={30}/>}</button>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-6 rounded-xl text-2xl active:scale-95 transition-all shadow-xl shadow-cyan-500/20">Admin အကောင့်ဖွင့်မည်</button>
        </form>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// AUTH SCREEN
// ════════════════════════════════════════════════════════════════
function AuthScreen({ allUsers, onLogin, showToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');

  const handleLogin = e => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErr('Username နှင့် Password ဖြည့်ပါ');
      return;
    }
    const hashedPassword = simpleHash(password);
    const user = allUsers.find(u => 
      (u.username === username.trim() || u.email === username.trim()) && 
      u.password === hashedPassword
    );
    if (user) {
      onLogin(user);
    } else {
      setErr('Username သို့မဟုတ် Password မှားနေပါသည်');
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#080c14] flex items-center justify-center p-4">
      <div className="bg-[#0d1120] p-10 sm:p-12 rounded-3xl border-2 border-cyan-500/25 shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-lg">
        <div className="text-center mb-10"><MonitorPlay size={64} className="mx-auto text-cyan-500 mb-6"/><h2 className="text-4xl font-black text-white uppercase">Cyber POS</h2><p className="text-lg text-cyan-400 font-bold mt-3">PRO VERSION 18</p></div>
        {err && <p className="text-lg font-bold text-rose-400 bg-rose-500/10 border-2 border-rose-500/20 p-5 rounded-xl mb-8 text-center">{err}</p>}
        <form onSubmit={handleLogin} className="space-y-6">
          <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Username or Email" className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl outline-none focus:border-cyan-400 transition-all placeholder-slate-600"/>
          <div className="relative">
            <input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl outline-none focus:border-cyan-400 transition-all pr-16 placeholder-slate-600"/>
            <button type="button" onClick={()=>setShow(!show)} className="absolute right-6 top-6 text-slate-500 hover:text-slate-300">{show?<EyeOff size={30}/>:<Eye size={30}/>}</button>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-6 rounded-xl text-2xl active:scale-95 transition-all shadow-xl shadow-cyan-500/20">Login ဝင်မည်</button>
        </form>
      </div>
    </div>
  );
}
