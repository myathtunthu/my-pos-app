import React, { useState, useEffect, useMemo, useRef, useCallback, createContext, useContext } from 'react';
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
  Edit3, Save, AlertTriangle, LogOut, Eye, EyeOff, ShoppingCart, Tag, ShieldCheck, Cloud, Lock, Globe
} from 'lucide-react';

// ─── Language Context ─────────────────────────────────────────────
const translations = {
  mm: {
    app_name: 'MTT POS', version: 'PRO VERSION 18',
    login: 'Login ဝင်မည်', username: 'အသုံးပြုသူအမည်', password: 'စကားဝှက်',
    shop_name: 'ဆိုင်အမည်', sale: 'အရောင်း', purchase: 'အဝယ်', expense: 'စရိတ်',
    save: 'သိမ်းမည်', cancel: 'မလုပ်တော့', settings: 'ဆက်တင်', logout: 'ထွက်မည်',
    dashboard: 'Dashboard', ledger: 'စာရင်း', reports: 'အစီရင်ခံ', admin: 'Admin',
    add: 'ထည့်မည်', delete: 'ဖျက်မည်', edit: 'ပြင်မည်', search: 'ရှာဖွေပါ...',
    total: 'စုစုပေါင်း', cash: 'လက်ငင်း', credit: 'အကြွေး',
    change_password: 'စကားဝှက်ပြောင်းမည်', old_password: 'စကားဝှက်ဟောင်း',
    new_password: 'စကားဝှက်အသစ်', import_csv: 'CSV ထည့်သွင်းမည်',
    export_csv: 'CSV ထုတ်မည်', backup_telegram: 'Telegram Backup',
    no_data: 'ဒေတာမရှိပါ', success: 'အောင်မြင်ပါသည်', error: 'အမှားရှိနေပါသည်',
    stock_low: 'Stock နည်းနေပါသည်', date: 'ရက်စွဲ', customer: 'ဝယ်သူ',
    supplier: 'Supplier', item: 'ပစ္စည်း', price: 'ဈေးနှုန်း', qty: 'အရေအတွက်',
    discount: 'လျှော့စျေး', subtotal: 'Subtotal', global_disc: 'Global Discount',
    pay_cash: 'လက်ငင်း', pay_credit: 'အကြွေး',
    submit_sale: 'အရောင်းသိမ်းမည်', submit_purchase: 'အဝယ်သိမ်းမည်',
    invoice: 'Invoice', print: 'Print', close: 'Close',
    confirm_delete: 'ဖျက်ရန်သေချာပါသလား?', confirm_delete_msg: 'ဖျက်ပြီးသော မှတ်တမ်းကို ပြန်မရပါ',
    opening_balance: 'ဖွင့်လက်ကျန်', closing_balance: 'ပိတ်လက်ကျန်',
    balance_save: 'လက်ကျန်သိမ်းမည်',
  },
  en: {
    app_name: 'MTT POS', version: 'PRO VERSION 18',
    login: 'Login', username: 'Username', password: 'Password',
    shop_name: 'Shop Name', sale: 'Sale', purchase: 'Purchase', expense: 'Expense',
    save: 'Save', cancel: 'Cancel', settings: 'Settings', logout: 'Logout',
    dashboard: 'Dashboard', ledger: 'Ledger', reports: 'Reports', admin: 'Admin',
    add: 'Add', delete: 'Delete', edit: 'Edit', search: 'Search...',
    total: 'Total', cash: 'Cash', credit: 'Credit',
    change_password: 'Change Password', old_password: 'Old Password',
    new_password: 'New Password', import_csv: 'Import CSV',
    export_csv: 'Export CSV', backup_telegram: 'Backup to Telegram',
    no_data: 'No data', success: 'Success', error: 'Error',
    stock_low: 'Low Stock', date: 'Date', customer: 'Customer',
    supplier: 'Supplier', item: 'Item', price: 'Price', qty: 'Qty',
    discount: 'Discount', subtotal: 'Subtotal', global_disc: 'Global Discount',
    pay_cash: 'Cash', pay_credit: 'Credit',
    submit_sale: 'Complete Sale', submit_purchase: 'Complete Purchase',
    invoice: 'Invoice', print: 'Print', close: 'Close',
    confirm_delete: 'Confirm Delete?', confirm_delete_msg: 'Deleted records cannot be recovered.',
    opening_balance: 'Opening Balance', closing_balance: 'Closing Balance',
    balance_save: 'Save Balance',
  }
};

const LanguageContext = createContext();
const useLang = () => useContext(LanguageContext);

// ─── Permission Options ────────────────────────────────────────────
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

// ─── Helpers ────────────────────────────────────────────────────────
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
  let ret = []; let inQuote = false; let value = '';
  for (let i = 0; i < text.length; i++) {
    let char = text[i];
    if (char === '"') {
      if (inQuote && text[i+1] === '"') { value += '"'; i++; }
      else inQuote = !inQuote;
    } else if (char === ',' && !inQuote) { ret.push(value.trim()); value = ''; }
    else value += char;
  }
  ret.push(value.trim());
  return ret.map(v => v.replace(/^"|"$/g, ''));
};
const downloadFile = (filename, content) => {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
};

// ─── Professional Print Voucher ─────────────────────────────────────
const doPrint = (record, shopName) => {
  const items = record.itemsDetail || [{ name: record.item, quantity: 1, unitPrice: record.amount, itemDiscountAmt: 0 }];
  const qrText = `INV:${record.invoiceNo}\nDate:${record.date}\nTotal:${record.amount} Ks`;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(qrText)}`;
  const rows = items.map((i, idx) => {
    const disc = i.itemDiscountAmt > 0 ? `<br><small style="color:#888;">(-${fmt(i.itemDiscountAmt)} Disc)</small>` : '';
    return `<tr><td style="font-size:13px;">${idx+1}. ${i.name}${disc}</td><td align="center">${i.quantity}</td><td align="right">${fmt((i.unitPrice * i.quantity) - (i.itemDiscountAmt || 0))}</td></tr>`;
  }).join('');
  const now = new Date(); const timeStr = now.toLocaleTimeString('en-GB');
  const w = window.open('', '_blank', 'width=400,height=700');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Receipt</title>
  <style>body{font-family:'Courier New',monospace;font-size:13px;width:340px;margin:10px auto;padding:15px;border:1px dashed #000;background:#fff;}.header{text-align:center;border-bottom:1px dashed #000;padding-bottom:10px;margin-bottom:10px;}.shop-name{font-size:18px;font-weight:bold;}.info{font-size:12px;color:#555;margin:2px 0;}table{width:100%;border-collapse:collapse;}th,td{padding:6px 0;border-bottom:1px dotted #ccc;font-size:13px;}th{border-bottom:1px solid #000;}.total-row{font-weight:bold;font-size:16px;border-top:1px solid #000;padding-top:8px;}.footer{text-align:center;margin-top:15px;font-size:11px;color:#555;}.qr{text-align:center;margin:10px 0;}</style></head><body>
  <div class="header"><div class="shop-name">${shopName || 'MTT POS'}</div><div class="info">📅 ${record.date || ''} ${timeStr}</div><div class="info">Invoice: ${record.invoiceNo || ''}</div></div>
  <table><thead><tr><th>Item</th><th>Qty</th><th>Amt</th></tr></thead><tbody>${rows}</tbody></table>
  ${record.discount > 0 ? `<div style="text-align:right;font-size:13px;margin:5px 0;">Global Disc: -${fmt(record.discount)} Ks</div>` : ''}
  <div class="total-row" style="text-align:right;">TOTAL: ${fmt(record.amount)} Ks</div>
  <div class="info" style="text-align:right;margin-top:2px;">${record.paymentType === 'Credit' ? '💳 Credit' : '💵 Cash'}</div>
  <div class="info" style="text-align:right;">Cashier: ${record.createdBy || '-'}</div>
  <div class="qr"><img src="${qrSrc}" width="100" height="100" alt="QR"/></div>
  <div class="footer">ဝယ်ယူအားပေးမှုကို ကျေးဇူးတင်ပါသည်<br>Thank you for your purchase</div>
  <script>window.onload=()=>{window.print();window.close();}</script></body></html>`);
  w.document.close();
};

// ═══════════════════════ MAIN APP COMPONENT ═══════════════════════════
function MainApp() {
  const { t, lang, setLang } = useLang();

  const firebaseConfig = useMemo(() => {
    if (process.env.REACT_APP_FIREBASE_CONFIG) return JSON.parse(process.env.REACT_APP_FIREBASE_CONFIG);
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
    setToast({ msg, type }); setTimeout(() => setToast(null), 4500);
  }, []);

  // Beep
  const playBeep = useCallback((type = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain); gain.connect(audioCtx.destination);
      if (type === 'success') {
        osc.type = 'sine'; osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        osc.frequency.setValueAtTime(1100, audioCtx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
        osc.start(); osc.stop(audioCtx.currentTime + 0.3);
      } else {
        osc.type = 'square'; osc.frequency.setValueAtTime(200, audioCtx.currentTime);
        osc.frequency.setValueAtTime(150, audioCtx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
        osc.start(); osc.stop(audioCtx.currentTime + 0.4);
      }
    } catch (e) {}
  }, []);

  const [setupMode, setSetupMode] = useState(null);
  useEffect(() => {
    if (!fbUser) return;
    (async () => {
      const snap = await getDocs(collection(db, 'pos_users'));
      setSetupMode(!snap.docs.some(d => d.data().role === 'admin'));
    })();
  }, [fbUser, db]);

  const handleSetup = async (username, password, shopName) => {
    const tenantId = `tenant_${username.trim()}_${Date.now()}`;
    const exp = new Date(); exp.setDate(exp.getDate() + 7);
    await addDoc(collection(db, 'pos_users'), {
      username: username.trim(), password: simpleHash(password), role: 'admin', permissions: [],
      tenantId, createdAt: Date.now(), expiryDate: exp.toISOString()
    });
    await setDoc(doc(db, 'pos_settings', tenantId), { shopName: shopName.trim() || `${username.trim()}'s POS` });
    showToast(t('success') + ' (7-day trial)');
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

  // States for UI
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
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [openingBalance, setOpeningBalance] = useState('');
  const [closingBalance, setClosingBalance] = useState('');

  const hasPermission = useCallback((perm) => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin') return true;
    return currentUser.permissions?.includes(perm);
  }, [currentUser]);

  // Auth & Data listeners
  useEffect(() => { signInAnonymously(auth); return onAuthStateChanged(auth, u => { setFbUser(u); if (!u) setAuthLoading(false); }); }, [auth]);
  useEffect(() => {
    if (!fbUser) return;
    const u1 = onSnapshot(collection(db, 'pos_users'), s => { setAllUsers(s.docs.map(d => ({ id: d.id, ...d.data() }))); setAuthLoading(false); });
    const u2 = onSnapshot(collection(db, 'pos_records'), s => setAllRecords(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))));
    const u3 = onSnapshot(collection(db, 'pos_products'), s => setAllProducts(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const u4 = onSnapshot(collection(db, 'pos_settings'), s => setAllSettings(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => { u1(); u2(); u3(); u4(); };
  }, [fbUser, db]);

  // Scanner effect
  useEffect(() => {
    if (!showScanner) return;
    if (!window.Html5Qrcode) { showToast('Scanner library missing', 'err'); setShowScanner(false); return; }
    let html5QrCode;
    (async () => {
      try {
        if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
        html5QrCode = new window.Html5Qrcode("barcode-reader"); scannerRef.current = html5QrCode;
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            const prod = products.find(p => p.barcode === decodedText.trim() || p.id === decodedText.trim());
            if (prod) {
              const price = entryTab === 'Sale' ? (prod.price || 0) : (prod.costPrice || 0);
              setCart(prev => {
                const ex = prev.find(c => c.productId === prod.id && c.unitPrice === price);
                return ex ? prev.map(c => c.id === ex.id ? { ...c, quantity: c.quantity + 1 } : c) : [...prev, { id: Date.now(), productId: prod.id, name: prod.name, unitPrice: price, costPrice: prod.costPrice || 0, quantity: 1, itemDiscountAmt: 0 }];
              });
              playBeep('success'); showToast(`${prod.name} added`);
            } else { playBeep('error'); showToast('Not found', 'err'); }
            (async () => { if (isStopping.current) return; isStopping.current = true; if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } isStopping.current = false; setShowScanner(false); })();
          }, () => {});
      } catch { showToast('Camera error', 'err'); setShowScanner(false); }
    })();
    return () => { isStopping.current = true; if (scannerRef.current) scannerRef.current.stop().catch(() => {}); };
  }, [showScanner]);

  // Data processing
  const categories = useMemo(() => ['All', ...new Set(products.map(p => p.category).filter(Boolean))], [products]);
  const lowStock = useMemo(() => products.filter(p => (Number(p.stock) || 0) <= (Number(p.minStock) || 5)), [products]);
  const filteredProdsForDropdown = useMemo(() => products.filter(p => {
    const ms = (p.name || '').toLowerCase().includes(prodSearch.toLowerCase()) || (p.barcode || '').includes(prodSearch);
    return (selCategory === 'All' || p.category === selCategory) && ms;
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

  // Cart actions
  const addToCart = () => { /* ... (same as before) ... */ };
  const removeFromCart = id => setCart(prev => prev.filter(c => c.id !== id));
  const updateItemDiscount = (id, amt) => setCart(prev => prev.map(c => c.id === id ? { ...c, itemDiscountAmt: Number(amt) || 0 } : c));
  const clearCart = () => { setCart([]); setGlobalDiscountAmt(''); setPersonName(''); setPaymentType('Cash'); setSelProdId(''); setProdSearch(''); };
  const handleBarcodeSubmit = e => { /* ... */ };

  const getNextInvoiceNo = async () => { /* ... (same) ... */ };
  const submitSale = async () => { /* ... (same, uses receipt modal) ... */ };
  const submitPurchase = async () => { /* ... (same, no receipt modal) ... */ };
  const submitExpense = async () => { /* ... */ };
  const submitPayment = async () => { /* ... */ };
  const doDelete = async () => { /* ... */ };
  const sendTg = async text => { /* ... */ };
  const sendDailyReport = () => { /* ... */ };
  const sendInventoryReport = () => { /* ... */ };
  const getRecordsCSV = () => { /* ... */ };
  const getProductsCSV = () => { /* ... */ };
  const exportAllCSV = () => { downloadFile(`Records_${todayISO()}.csv`, getRecordsCSV()); downloadFile(`Products_${todayISO()}.csv`, getProductsCSV()); showToast('CSV exported'); };
  const backupToTelegram = async () => { /* ... */ };
  const handleImportAll = async e => { /* ... */ };
  const saveSettings = async () => { await setDoc(doc(db, 'pos_settings', currentTenant), { shopName, tgToken, tgChatId }, { merge: true }); showToast('Settings saved'); setShowSettings(false); };
  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) { showToast('Fill both fields', 'err'); return; }
    if (currentUser.password !== simpleHash(oldPassword)) { showToast('Wrong old password', 'err'); return; }
    await setDoc(doc(db, 'pos_users', currentUser.id), { password: simpleHash(newPassword) }, { merge: true });
    showToast('Password changed'); setOldPassword(''); setNewPassword('');
  };
  const saveBalance = async () => {
    await setDoc(doc(db, 'pos_settings', currentTenant), {
      openingBalance: parseFloat(openingBalance) || 0,
      closingBalance: parseFloat(closingBalance) || 0,
    }, { merge: true });
    showToast(t('balance_save') + ' ✓');
  };

  // History
  let histBal = 0;
  const histRecords = records.filter(r => (r.type === 'Sale' || r.type === 'Payment') && r.personName === historyModal.name)
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    .map(r => { histBal += r.type === 'Sale' ? (Number(r.amount) || 0) : -(Number(r.amount) || 0); return { ...r, runningBal: histBal }; }).reverse();

  // ═══ RENDER LOGIC ═══
  if (setupMode === null || authLoading || appLoading) return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center">
      <Cpu className="text-cyan-500 animate-pulse" size={64} />
    </div>
  );
  const isSecretSetup = window.location.pathname === '/mttadminacc';
  if (isSecretSetup && currentUser && currentUser.role === 'admin' && currentUser.username === 'Myat7291') {
    return <AdminDashboard allUsers={allUsers} db={db} showToast={showToast} onSetup={handleSetup} allSettings={allSettings} allRecords={allRecords} allProducts={allProducts} />;
  }
  if (setupMode && fbUser && !isSecretSetup) return <SetupScreen onSetup={handleSetup} t={t} />;
  if (!currentUser) return <AuthScreen allUsers={allUsers} onLogin={setCurrentUser} t={t} />;

  // ═══════════════════════ MAIN UI ═══════════════════════
  return (
    <>
      <style>{`@media (max-width: 768px){ html{ font-size: 14px; } }`}</style>
      <div className="min-h-[100dvh] w-full bg-[#080c14] pb-[110px] text-slate-100 font-sans overflow-x-hidden animate-fade-in">
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
            <AlertTriangle size={20} className="animate-pulse flex-shrink-0"/> {t('stock_low')}: {lowStock.slice(0,3).map(p=>`${p.name}(${p.stock})`).join(' · ')}{lowStock.length>3?` +${lowStock.length-3}`:''}
          </div>
        )}

        {/* Nav */}
        <nav className="sticky top-0 z-40 w-full bg-[#0d1120]/95 backdrop-blur border-b border-cyan-500/20 px-5 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Cpu size={32} className="text-cyan-400" />
            <div>
              <p className="text-xl font-black text-cyan-300">{shopName}</p>
              <p className="text-xs text-cyan-600">{t('version')} · {currentUser.username}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setLang(lang === 'mm' ? 'en' : 'mm')} className="p-2 text-slate-400 hover:text-white"><Globe size={22}/></button>
            {hasPermission('settings') && <button onClick={() => setShowSettings(true)} className="p-2 text-cyan-400"><SettingsIcon size={24}/></button>}
            <button onClick={() => setCurrentUser(null)} className="p-2 text-rose-400"><LogOut size={24}/></button>
          </div>
        </nav>

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#0d1120] w-full max-w-lg rounded-3xl p-6 border-2 border-cyan-500/25 max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-black text-white text-2xl"><SettingsIcon size={24} className="inline mr-2 text-cyan-400"/>{t('settings')}</h3>
                <button onClick={() => setShowSettings(false)}><X size={30}/></button>
              </div>
              <div className="space-y-5">
                <div><label className="text-sm font-bold text-slate-400">{t('shop_name')}</label><input value={shopName} onChange={e => setShopName(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/></div>
                <div className="border-t border-white/10 pt-4"><p className="text-sm font-bold text-slate-400 mb-2">Telegram Config</p><input value={tgToken} onChange={e => setTgToken(e.target.value)} placeholder="Bot Token" className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white mb-2"/><input value={tgChatId} onChange={e => setTgChatId(e.target.value)} placeholder="Chat ID" className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/></div>
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <button onClick={backupToTelegram} className="w-full py-3 bg-blue-600/20 border border-blue-500/30 rounded-xl text-blue-300 flex items-center justify-center gap-2"><Cloud size={18}/>{t('backup_telegram')}</button>
                  <button onClick={exportAllCSV} className="w-full py-3 bg-emerald-600/20 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center justify-center gap-2"><Download size={18}/>{t('export_csv')}</button>
                  <button onClick={() => fileRef.current?.click()} className="w-full py-3 bg-amber-600/20 border border-amber-500/30 rounded-xl text-amber-300 flex items-center justify-center gap-2"><Upload size={18}/>{t('import_csv')}</button>
                  <input type="file" accept=".csv" multiple ref={fileRef} onChange={handleImportAll} className="hidden"/>
                </div>
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <p className="text-sm font-bold text-slate-400">{t('change_password')}</p>
                  <input type="password" placeholder={t('old_password')} value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/>
                  <input type="password" placeholder={t('new_password')} value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/>
                  <button onClick={handleChangePassword} className="w-full py-3 bg-indigo-600/20 border border-indigo-500/30 rounded-xl text-indigo-300 flex items-center justify-center gap-2"><Lock size={18}/>{t('change_password')}</button>
                </div>
                <div className="border-t border-white/10 pt-4 space-y-3">
                  <p className="text-sm font-bold text-slate-400">{t('opening_balance')} / {t('closing_balance')}</p>
                  <div className="flex gap-4">
                    <div className="flex-1"><input type="number" placeholder={t('opening_balance')} value={openingBalance} onChange={e => setOpeningBalance(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/></div>
                    <div className="flex-1"><input type="number" placeholder={t('closing_balance')} value={closingBalance} onChange={e => setClosingBalance(e.target.value)} className="w-full bg-black/50 border border-cyan-500/20 rounded-xl px-4 py-3 text-white"/></div>
                  </div>
                  <button onClick={saveBalance} className="w-full py-3 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-300 flex items-center justify-center gap-2"><Save size={18}/>{t('balance_save')}</button>
                </div>
                <button onClick={saveSettings} className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-xl font-black">{t('save')}</button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 w-full max-w-lg sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-6xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
          {/* ═══ ENTRY TAB ═══ */}
          {view === 'Entry' && (
            <div className="space-y-8">
              <div className="bg-[#0d1120] p-2 rounded-2xl flex border border-cyan-500/15 overflow-x-auto">
                {hasPermission('create_sale') && <button onClick={()=>{setEntryTab('Sale');clearCart();}} className={`flex-1 py-5 text-lg font-black rounded-xl whitespace-nowrap ${entryTab==='Sale'?'bg-cyan-600 text-white shadow-[0_0_18px_rgba(6,182,212,0.3)]':'text-cyan-600 hover:text-cyan-400'}`}>{t('sale')}</button>}
                {hasPermission('create_purchase') && <button onClick={()=>{setEntryTab('Purchase');clearCart();}} className={`flex-1 py-5 text-lg font-black rounded-xl whitespace-nowrap ${entryTab==='Purchase'?'bg-blue-600 text-white shadow-[0_0_18px_rgba(59,130,246,0.3)]':'text-blue-600 hover:text-blue-400'}`}>{t('purchase')}</button>}
                {hasPermission('create_expense') && <button onClick={()=>{setEntryTab('Expense');clearCart();}} className={`flex-1 py-5 text-lg font-black rounded-xl whitespace-nowrap ${entryTab==='Expense'?'bg-amber-600 text-white shadow-[0_0_18px_rgba(217,119,6,0.3)]':'text-amber-600 hover:text-amber-400'}`}>{t('expense')}</button>}
              </div>

              <div className="bg-[#0d1120] p-6 sm:p-8 rounded-3xl border border-cyan-500/15 shadow-xl space-y-6">
                <div><label className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-2">{t('date')}</label><input type="date" value={entryDate} onChange={e=>setEntryDate(e.target.value)} className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-all" /></div>

                {entryTab==='Expense' ? (
                  <>
                    <div><label className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-2">{t('item')}</label><input value={expenseTitle} onChange={e=>setExpenseTitle(e.target.value)} placeholder="e.g., Electricity" className="w-full bg-black/50 border-2 border-amber-500/20 rounded-xl px-5 py-5 text-xl font-bold text-slate-200 outline-none placeholder-slate-600 focus:border-amber-400 transition-all" /></div>
                    <div><label className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-2">Amount (Ks)</label><input type="number" value={expenseAmt} onChange={e=>setExpenseAmt(e.target.value)} placeholder="0" className="w-full bg-black/50 border-2 border-amber-500/20 rounded-xl px-5 py-5 text-3xl font-black text-amber-400 outline-none placeholder-slate-600 focus:border-amber-400 transition-all" /></div>
                    <button onClick={submitExpense} className="w-full py-6 bg-gradient-to-r from-amber-600 to-orange-600 text-white font-black rounded-xl text-xl active:scale-95 transition-all shadow-xl shadow-amber-500/20">✓ {t('save')}</button>
                  </>
                ) : (
                  <>
                    <div><label className="text-sm font-black text-slate-500 uppercase tracking-widest block mb-2">{entryTab==='Sale'? t('customer') + ' (required for credit)' : t('supplier')}</label><input value={personName} onChange={e=>setPersonName(e.target.value)} placeholder={entryTab==='Sale'?'Walk-in Customer':'Supplier'} className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-slate-200 outline-none placeholder-slate-600 focus:border-cyan-400 transition-all" /></div>

                    {/* Add to Cart Section */}
                    <div className="bg-black/40 p-6 rounded-2xl border-2 border-cyan-500/10 space-y-5">
                      <p className="text-sm font-black text-slate-500 uppercase tracking-widest">Add Item</p>

                      <div className="flex items-stretch gap-3">
                        <div className="relative flex-1 min-w-0">
                          <ScanBarcode size={24} className="absolute left-5 top-5 text-blue-400 z-10" />
                          <input value={barcodeInput} onChange={e=>setBarcodeInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleBarcodeSubmit(e)} placeholder="Barcode" className="w-full h-full bg-blue-950/20 border-2 border-blue-500/30 rounded-xl pl-14 pr-5 py-5 text-xl font-bold text-blue-300 outline-none focus:border-blue-400 focus:bg-blue-950/40 transition-all placeholder-blue-700" />
                        </div>
                        <button onClick={()=>setShowScanner(true)} className="px-5 bg-blue-600/20 border-2 border-blue-500/40 rounded-xl text-blue-400 hover:bg-blue-600/30 active:scale-95 transition-all flex-shrink-0 flex items-center justify-center"><ScanBarcode size={28} /></button>
                      </div>

                      <div className="flex gap-3 overflow-x-auto pb-2">{categories.map(c=><button key={c} onClick={()=>setSelCategory(c)} className={`px-6 py-3.5 rounded-xl text-base font-black whitespace-nowrap transition-all ${selCategory===c?'bg-cyan-600 text-white':'bg-[#0d1120] text-slate-400 border-2 border-white/5 hover:border-cyan-500/30'}`}>{c}</button>)}</div>

                      <div className="relative" ref={searchRef}>
                        <div className="relative"><Search size={24} className="absolute left-5 top-5 text-cyan-500 z-10" /><input value={prodSearch} onChange={e=>{setProdSearch(e.target.value);setShowProdDropdown(true);setSelProdId('');}} onFocus={()=>setShowProdDropdown(true)} placeholder={t('search')} className="w-full bg-black border-2 border-cyan-500/20 rounded-xl pl-14 pr-14 py-5 text-xl font-bold text-slate-200 outline-none focus:border-cyan-400 placeholder-slate-600 transition-all" />{prodSearch && <button onClick={()=>{setProdSearch('');setSelProdId('');setUnitPrice('');}} className="absolute right-5 top-5 text-slate-500 hover:text-slate-300 p-1 z-10"><X size={24}/></button>}</div>
                        {showProdDropdown && (
                          <div className="absolute z-50 w-full bg-[#0d1120] border-2 border-cyan-500/40 rounded-xl mt-2 max-h-64 overflow-y-auto shadow-2xl">
                            {filteredProdsForDropdown.length===0?<p className="px-6 py-5 text-lg text-slate-500 text-center">{t('no_data')}</p>:filteredProdsForDropdown.slice(0,20).map(p=>(
                              <div key={p.id} onClick={()=>{setSelProdId(p.id);setProdSearch(p.name);setUnitPrice(String(entryTab==='Sale'?p.price||0:p.costPrice||0));setShowProdDropdown(false);}} className="px-6 py-5 border-b border-white/5 hover:bg-cyan-900/30 cursor-pointer transition-all flex justify-between items-center">
                                <div><p className="text-xl font-black text-slate-200">{p.name}</p><p className="text-base text-cyan-500 font-bold mt-1">{p.category||'General'} · {fmt(entryTab==='Sale'?p.price:p.costPrice)} Ks</p></div>
                                <span className={`text-sm font-black px-4 py-2 rounded-lg ${(p.stock||0) <= (p.minStock||5) ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>Stock: {p.stock||0}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-5">
                        <div><label className="text-xs font-black text-slate-600 uppercase block mb-2">{t('price')}</label><input type="number" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)} placeholder="0" className="w-full bg-black border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-all placeholder-slate-700" /></div>
                        <div><label className="text-xs font-black text-slate-600 uppercase block mb-2">{t('qty')}</label><input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="1" className="w-full bg-black border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-cyan-400 outline-none focus:border-cyan-400 transition-all placeholder-slate-700" /></div>
                      </div>
                      <button onClick={addToCart} className="w-full py-5 bg-cyan-600/20 border-2 border-cyan-500/40 text-cyan-400 rounded-xl font-black text-xl flex items-center justify-center gap-3 hover:bg-cyan-600/30 transition-all active:scale-95"><PlusCircle size={26}/> {t('add')}</button>
                    </div>

                    {cart.length>0 && (
                      <div className="space-y-5">
                        <div className="max-h-72 overflow-y-auto space-y-4 pr-2">
                          {cart.map(item=>(
                            <div key={item.id} className="bg-black/40 p-5 rounded-2xl border-2 border-cyan-500/10">
                              <div className="flex justify-between items-start">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xl font-black text-white truncate">{item.name}</p>
                                  <p className="text-base text-cyan-400 font-bold mt-1.5">{fmt(item.unitPrice)} × {item.quantity} = {fmt(item.unitPrice*item.quantity)} Ks</p>
                                  {item.costPrice>0 && entryTab==='Sale' && <p className="text-sm text-emerald-600 mt-1">Margin: +{fmt((item.unitPrice-item.costPrice)*item.quantity)} Ks</p>}
                                </div>
                                <button onClick={()=>removeFromCart(item.id)} className="text-slate-600 hover:text-rose-400 ml-4 p-3 flex-shrink-0"><X size={24}/></button>
                              </div>
                              {entryTab==='Sale' && (
                                <div className="flex items-center gap-4 mt-4 pt-4 border-t-2 border-white/5">
                                  <span className="text-sm font-black text-amber-500/80 uppercase flex items-center gap-2"><Tag size={18}/> {t('discount')} (Ks):</span>
                                  <input type="number" value={item.itemDiscountAmt||''} onChange={e=>updateItemDiscount(item.id,e.target.value)} placeholder="0" className="w-32 bg-black/50 border-2 border-amber-500/20 rounded-lg px-4 py-2.5 text-lg font-bold text-amber-400 outline-none focus:border-amber-400 transition-all" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>

                        {entryTab==='Sale' && (
                          <div className="flex gap-4 items-end">
                            <div className="flex-1"><label className="text-xs font-black text-slate-600 uppercase block mb-2">{t('global_disc')}</label><input type="number" value={globalDiscountAmt} onChange={e=>setGlobalDiscountAmt(e.target.value)} placeholder="0" className="w-full bg-black/50 border-2 border-amber-500/20 rounded-xl px-5 py-5 text-xl font-bold text-amber-400 outline-none focus:border-amber-400 transition-all placeholder-slate-700" /></div>
                            <div className="flex rounded-xl overflow-hidden border-2 border-white/5">
                              <button onClick={()=>setGlobalDiscountType('%')} className={`px-6 py-5 text-lg font-black transition-all ${globalDiscountType==='%'?'bg-amber-600 text-white':'bg-[#0d1120] text-slate-500'}`}>%</button>
                              <button onClick={()=>setGlobalDiscountType('flat')} className={`px-6 py-5 text-lg font-black transition-all ${globalDiscountType==='flat'?'bg-amber-600 text-white':'bg-[#0d1120] text-slate-500'}`}>Ks</button>
                            </div>
                          </div>
                        )}

                        <div className="bg-black/40 p-6 rounded-2xl space-y-3 border-2 border-cyan-500/10">
                          <div className="flex justify-between text-lg text-slate-500"><span>{t('subtotal')}</span><span className="font-bold">{fmt(cartTotals.sub)} Ks</span></div>
                          {cartTotals.itemDiscounts>0 && <div className="flex justify-between text-lg text-amber-500"><span>Item Discounts</span><span className="font-bold">−{fmt(cartTotals.itemDiscounts)} Ks</span></div>}
                          {cartTotals.globalDisc>0 && <div className="flex justify-between text-lg text-amber-400"><span>{t('global_disc')}</span><span className="font-bold">−{fmt(cartTotals.globalDisc)} Ks</span></div>}
                          <div className="flex justify-between text-3xl font-black text-cyan-300 pt-4 mt-3 border-t-2 border-white/10"><span>{t('total')}</span><span>{fmt(cartTotals.total)} Ks</span></div>
                        </div>

                        {entryTab==='Sale' && (
                          <div className="grid grid-cols-2 gap-5">
                            <button onClick={()=>setPaymentType('Cash')} className={`py-6 rounded-2xl text-lg font-black transition-all border-2 ${paymentType==='Cash'?'bg-cyan-500/20 text-cyan-300 border-cyan-500/40':'bg-black/40 text-slate-500 border-white/5 hover:border-cyan-500/20'}`}>💵 {t('cash')}</button>
                            <button onClick={()=>setPaymentType('Credit')} className={`py-6 rounded-2xl text-lg font-black transition-all border-2 ${paymentType==='Credit'?'bg-rose-500/20 text-rose-300 border-rose-500/40':'bg-black/40 text-slate-500 border-white/5 hover:border-rose-500/20'}`}>💳 {t('credit')}</button>
                          </div>
                        )}

                        <button onClick={entryTab==='Sale'?submitSale:submitPurchase} className={`w-full py-6 rounded-2xl font-black text-white text-2xl active:scale-95 transition-all shadow-2xl ${entryTab==='Sale'?'bg-gradient-to-r from-cyan-600 to-blue-600 shadow-cyan-500/20':'bg-gradient-to-r from-blue-700 to-indigo-700 shadow-blue-500/20'}`}>
                          ✓ {entryTab==='Sale'? t('submit_sale') : t('submit_purchase')}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ═══ DASHBOARD TAB ═══ */}
          {view === 'Dashboard' && (
            <div className="space-y-6">
              <div className="grid grid-cols-4 gap-2 bg-[#0d1120] p-2 rounded-2xl border-2 border-cyan-500/15">
                {[['Today','ဒီနေ့'],['Week','၇ရက်'],['Month','၁လ'],['AllTime','အားလုံး']].map(([k,l])=><button key={k} onClick={()=>setDashPeriod(k)} className={`py-5 text-base font-black rounded-xl transition-all ${dashPeriod===k?'bg-cyan-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]':'text-cyan-600 hover:text-cyan-400'}`}>{l}</button>)}
              </div>
              {dashPeriod==='Today' && (
                <div className="flex items-center gap-5 bg-[#0d1120] p-6 rounded-2xl border-2 border-cyan-500/15">
                  <input type="date" value={selDate} onChange={e=>setSelDate(e.target.value)} className="flex-1 bg-black border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-cyan-400 outline-none" />
                  <button onClick={sendDailyReport} className="bg-blue-600/20 border-2 border-blue-500/40 text-blue-400 p-5 rounded-xl hover:bg-blue-600/40 active:scale-95 transition-all"><Send size={26}/></button>
                </div>
              )}
              <div className={`p-10 rounded-3xl border-2 relative overflow-hidden ${stats.balance>=0?'border-cyan-500/30 bg-cyan-950/15':'border-rose-500/30 bg-rose-950/15'}`}>
                <p className="text-base font-black text-cyan-600 uppercase tracking-[0.3em] mb-3">{t('total')} Balance</p>
                <p className={`text-6xl font-black tracking-tighter ${stats.balance>=0?'text-cyan-400':'text-rose-400'}`}>{fmt(stats.balance)} <span className="text-xl font-normal opacity-40">Ks</span></p>
              </div>
              <div className={`p-8 rounded-2xl border-2 flex items-center justify-between ${stats.profit>=0?'border-emerald-500/20 bg-emerald-950/10':'border-rose-500/20 bg-rose-950/10'}`}>
                <div className="flex items-center gap-5">
                  <div className={`p-5 rounded-2xl ${stats.profit>=0?'bg-emerald-500/10 text-emerald-400':'bg-rose-500/10 text-rose-400'}`}><DollarSign size={34}/></div>
                  <div><p className="text-base font-black text-slate-400 uppercase tracking-widest">Net Profit</p><p className="text-sm text-slate-600">(Sales Profit − Discount − Expenses)</p></div>
                </div>
                <p className={`text-4xl font-black ${stats.profit>=0?'text-emerald-400':'text-rose-400'}`}>{stats.profit>=0?'+':''}{fmt(stats.profit)}</p>
              </div>
              <div className="grid grid-cols-2 gap-5">
                {[['Sales',stats.sales,'text-cyan-400'],['Purchases',stats.purchases,'text-blue-400'],['Debt',stats.debt,'text-rose-400'],['Discount',stats.disc,'text-amber-400'],['Expenses',stats.expenses,'text-orange-400']].map(([l,v,c])=><div key={l} className={`bg-[#0d1120] p-7 rounded-2xl border-2 border-white/5`}><p className="text-sm font-black text-slate-600 uppercase tracking-widest mb-3">{l}</p><p className={`text-3xl font-black ${c}`}>{fmt(v)}</p></div>)}
              </div>
            </div>
          )}

          {/* ═══ REPORTS TAB ═══ */}
          {view === 'Reports' && (
            <div className="space-y-6">
              <div className="bg-[#0d1120] p-8 rounded-3xl border-2 border-cyan-500/15 shadow-xl space-y-6">
                <h3 className="font-black text-white flex items-center gap-4 text-2xl"><PieChart size={30} className="text-cyan-500"/> Profit/Loss Report</h3>
                <div className="grid grid-cols-2 gap-5">
                  <div><label className="text-sm font-black text-slate-500 uppercase mb-2 block">Start Date</label><input type="date" value={repStart} onChange={e=>setRepStart(e.target.value)} className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-cyan-400 outline-none"/></div>
                  <div><label className="text-sm font-black text-slate-500 uppercase mb-2 block">End Date</label><input type="date" value={repEnd} onChange={e=>setRepEnd(e.target.value)} className="w-full bg-black/50 border-2 border-cyan-500/20 rounded-xl px-5 py-5 text-xl font-bold text-cyan-400 outline-none"/></div>
                </div>
                <div className="space-y-5 pt-4">
                  {[['Total Sales',reportStats.sales,'cyan'],['Total Purchases',reportStats.purchases,'blue'],['Total Expenses',reportStats.expenses,'amber']].map(([l,v,c])=><div key={l} className={`flex justify-between p-6 rounded-xl bg-${c}-950/20 border-2 border-${c}-500/10`}><span className="text-xl font-bold text-slate-300">{l}</span><span className="text-2xl font-black text-cyan-400">{fmt(v)} Ks</span></div>)}
                  <div className="flex justify-between p-8 rounded-xl bg-emerald-950/30 border-2 border-emerald-500/30"><span className="text-xl font-black text-emerald-200 uppercase tracking-widest">Net Profit</span><span className="text-4xl font-black text-emerald-400">{fmt(reportStats.profit - reportStats.expenses)} Ks</span></div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ LEDGER TAB ═══ */}
          {view === 'Ledger' && (
            <div className="space-y-5">
              <div className="flex gap-5">
                <div className="relative flex-1"><Search size={28} className="absolute left-5 top-5 text-slate-600"/><input value={ledSearch} onChange={e=>setLedSearch(e.target.value)} placeholder="Search..." className="w-full pl-14 pr-5 py-5 bg-[#0d1120] border-2 border-white/5 rounded-xl text-xl font-bold text-slate-200 outline-none focus:border-cyan-500/30 placeholder-slate-600 transition-all" /></div>
                <button onClick={()=>setLedFilter(ledFilter==='Debtors'?'All':'Debtors')} className={`px-6 rounded-xl border-2 transition-all ${ledFilter==='Debtors'?'bg-cyan-600/20 border-cyan-500 text-cyan-400':'bg-[#0d1120] border-white/5 text-slate-500'}`}><Filter size={30}/></button>
              </div>
              {ledFilter==='Debtors' ? (
                <div className="space-y-5">
                  <p className="text-base font-black text-slate-500 uppercase tracking-widest px-2">Debtors</p>
                  {debtors.length===0?<div className="text-center py-20 text-slate-500 font-bold text-xl">{t('no_data')}</div>:debtors.map(d=>(
                    <div key={d.n} className="bg-[#0d1120] p-7 rounded-2xl border-2 border-rose-500/10 flex items-center justify-between hover:border-rose-500/30 transition-all">
                      <div className="flex items-center gap-6">
                        <div className="bg-rose-500/10 p-5 rounded-xl text-rose-400"><User size={34}/></div>
                        <div>
                          <p className="font-black text-rose-100 text-2xl cursor-pointer hover:text-cyan-400" onClick={()=>setHistoryModal({show:true,name:d.n})}>{d.n}</p>
                          {hasPermission('accept_payment') && <button onClick={()=>setPayModal({show:true,name:d.n,debt:d.a,amt:'',date:todayISO()})} className="mt-4 text-base font-black text-blue-400 bg-blue-500/10 px-5 py-3 rounded-xl border-2 border-blue-500/15 flex items-center gap-3 active:scale-95"><CreditCard size={22}/> Receive Payment</button>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-4xl font-black text-rose-500">{fmt(d.a)}</p>
                        <p className="text-sm text-rose-700 font-black uppercase mt-2">Outstanding</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredRecs.length===0 && <div className="text-center py-20 text-slate-500 font-bold text-xl">{t('no_data')}</div>}
                  {filteredRecs.map(r=>(
                    <div key={r.id} className="bg-[#0d1120] p-6 rounded-2xl border-2 border-white/5 hover:border-cyan-500/10 transition-all group">
                      <div className="flex items-start gap-5">
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 ${r.type==='Sale'?'bg-cyan-500/10 text-cyan-400':r.type==='Purchase'?'bg-blue-500/10 text-blue-400':r.type==='Expense'?'bg-amber-500/10 text-amber-400':'bg-emerald-500/10 text-emerald-400'}`}>
                          {r.type==='Sale'?<ArrowUpRight size={30}/>:r.type==='Purchase'?<ArrowDownRight size={30}/>:r.type==='Expense'?<FileText size={30}/>:<Banknote size={30}/>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex gap-4 items-center flex-wrap">
                            <p className="font-black text-white text-2xl">{r.personName||'−'}</p>
                            {r.invoiceNo && <span className="text-sm font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1.5 rounded">{r.invoiceNo}</span>}
                          </div>
                          <p className="text-lg text-slate-500 font-bold mt-2.5 truncate">{r.item||'−'}</p>
                          <p className="text-sm text-slate-600 font-mono mt-2">{r.date||'−'}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`font-black text-3xl ${r.type==='Purchase'||r.type==='Expense'?'text-orange-400':'text-cyan-400'}`}>{r.type==='Purchase'||r.type==='Expense'?'−':'+'}{fmt(r.amount)}</p>
                          {(Number(r.remainingDebt)||0)>0 && <span className="text-base font-black text-rose-400 bg-rose-500/10 px-4 py-1.5 rounded-lg block mt-3">ကျန်: {fmt(r.remainingDebt)}</span>}
                          <div className="flex gap-4 justify-end mt-4">
                            {['Sale','Purchase','Payment'].includes(r.type) && <button onClick={()=>setReceiptModal({show:true,record:r})} className="p-3 text-slate-500 hover:text-cyan-400 transition-colors rounded-xl bg-black/40"><Receipt size={22}/></button>}
                            {hasPermission('delete_records') && <button onClick={()=>setConfirmDel(r)} className="p-3 text-slate-500 hover:text-rose-500 transition-colors rounded-xl bg-black/40"><Trash2 size={22}/></button>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ ADMIN TAB ═══ */}
          {view === 'Admin' && (
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2 bg-[#0d1120] p-2 rounded-2xl border-2 border-cyan-500/15">
                {hasPermission('manage_products') && <button onClick={()=>setAdminTab('Products')} className={`py-5 text-base font-black rounded-xl transition-all flex items-center justify-center gap-2 ${adminTab==='Products'?'bg-cyan-600 text-white':'text-slate-500 hover:text-slate-300'}`}>📦 Products</button>}
                {(hasPermission('manage_inventory')||hasPermission('view_inventory')) && <button onClick={()=>setAdminTab('Inventory')} className={`py-5 text-base font-black rounded-xl transition-all flex items-center justify-center gap-2 ${adminTab==='Inventory'?'bg-cyan-600 text-white':'text-slate-500 hover:text-slate-300'}`}>📊 Inventory</button>}
                {hasPermission('manage_users') && <button onClick={()=>setAdminTab('Users')} className={`py-5 text-base font-black rounded-xl transition-all flex items-center justify-center gap-2 ${adminTab==='Users'?'bg-cyan-600 text-white':'text-slate-500 hover:text-slate-300'}`}>👥 Users</button>}
              </div>
              {adminTab==='Products' && hasPermission('manage_products') && <ProductsTab products={products} db={db} currentTenant={currentTenant} showToast={showToast} />}
              {adminTab==='Inventory' && (hasPermission('manage_inventory')||hasPermission('view_inventory')) && <InventoryTab products={products} db={db} hasPermission={hasPermission} sendInventoryReport={sendInventoryReport} />}
              {adminTab==='Users' && hasPermission('manage_users') && <UsersTab posUsers={posUsers} db={db} currentTenant={currentTenant} showToast={showToast} currentUser={currentUser} />}
            </div>
          )}
        </main>

        {/* Bottom Nav */}
        <div className="fixed bottom-0 left-0 w-full bg-[#0d1120]/95 backdrop-blur border-t-2 border-cyan-500/10 z-40" style={{paddingBottom:'max(env(safe-area-inset-bottom),1rem)'}}>
          <div className="max-w-3xl mx-auto flex items-end justify-around px-5 pt-4 pb-5">
            {hasPermission('view_reports') && <button onClick={()=>setView('Dashboard')} className={`flex flex-col items-center gap-2 transition-all ${view==='Dashboard'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><LayoutDashboard size={30}/><span className="text-[11px] font-black uppercase tracking-widest">{t('dashboard')}</span></button>}
            {hasPermission('view_sales') && <button onClick={()=>setView('Ledger')} className={`flex flex-col items-center gap-2 transition-all ${view==='Ledger'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><Database size={30}/><span className="text-[11px] font-black uppercase tracking-widest">{t('ledger')}</span></button>}
            {(hasPermission('create_sale')||hasPermission('create_purchase')||hasPermission('create_expense')) && (
              <div className="relative -top-8"><button onClick={()=>setView('Entry')} className={`w-24 h-24 rounded-2xl flex items-center justify-center border-[7px] border-[#080c14] shadow-[0_0_30px_rgba(6,182,212,0.4)] active:scale-95 transition-all ${view==='Entry'?'bg-cyan-500 text-white':'bg-[#0d1120] border-cyan-500/20 text-cyan-500 hover:bg-cyan-950'}`}><ShoppingCart size={38}/></button></div>
            )}
            {hasPermission('view_reports') && <button onClick={()=>setView('Reports')} className={`flex flex-col items-center gap-2 transition-all ${view==='Reports'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><BarChart3 size={30}/><span className="text-[11px] font-black uppercase tracking-widest">{t('reports')}</span></button>}
            {(hasPermission('manage_products')||hasPermission('manage_inventory')||hasPermission('manage_users')) && <button onClick={()=>setView('Admin')} className={`flex flex-col items-center gap-2 transition-all ${view==='Admin'?'text-cyan-400 scale-110':'text-slate-600 hover:text-slate-400'}`}><ShieldAlert size={30}/><span className="text-[11px] font-black uppercase tracking-widest">{t('admin')}</span></button>}
          </div>
        </div>

        {/* Modals */}
        {confirmDel && <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"><div className="bg-[#0d1120] p-10 rounded-3xl border-2 border-rose-500/25 text-center max-w-md w-full shadow-2xl"><Trash2 size={56} className="mx-auto text-rose-500 mb-6"/><h3 className="text-3xl font-black text-white mb-4">{t('confirm_delete')}</h3><p className="text-lg text-slate-500 mb-10">{t('confirm_delete_msg')}</p><div className="flex gap-5"><button onClick={()=>setConfirmDel(null)} className="flex-1 py-5 bg-slate-800 rounded-xl font-black text-xl text-white">{t('cancel')}</button><button onClick={doDelete} className="flex-1 py-5 bg-rose-600 rounded-xl font-black text-xl text-white">{t('delete')}</button></div></div></div>}
        {payModal.show && <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"><div className="bg-[#0d1120] w-full max-w-md rounded-3xl p-8 border-2 border-cyan-500/20 shadow-2xl"><div className="flex justify-between items-center mb-6"><h3 className="font-black text-white text-2xl">Receive Payment</h3><button onClick={()=>setPayModal({show:false,name:'',debt:0,amt:'',date:todayISO()})} className="text-slate-400 hover:text-rose-400"><X size={30}/></button></div><div className="bg-rose-950/30 border-2 border-rose-500/15 p-6 rounded-xl text-center mb-6"><p className="text-lg text-rose-400 font-bold uppercase">{payModal.name}</p><p className="text-5xl font-black text-rose-300 mt-2">{fmt(payModal.debt)} <span className="text-xl font-normal opacity-40">Ks</span></p></div><input type="date" value={payModal.date} onChange={e=>setPayModal(p=>({...p,date:e.target.value}))} className="w-full bg-black/40 border-2 border-cyan-500/15 rounded-xl px-5 py-5 text-xl font-bold text-cyan-300 outline-none mb-5"/><input type="number" autoFocus value={payModal.amt} onChange={e=>setPayModal(p=>({...p,amt:e.target.value}))} placeholder="Amount" className="w-full bg-black/40 border-2 border-cyan-500/15 rounded-xl px-5 py-5 text-4xl font-black text-center text-cyan-300 outline-none mb-6 placeholder-slate-700"/><button onClick={submitPayment} className="w-full py-6 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-xl text-2xl active:scale-95">✓ Confirm</button></div></div>}
        {receiptModal.show && <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#080c14]/95"><div className="bg-white text-black w-full max-w-md p-8 shadow-2xl relative font-mono text-lg" style={{backgroundImage:'repeating-linear-gradient(transparent,transparent 28px,#f0f0f0 28px,#f0f0f0 29px)',backgroundSize:'100% 29px'}}><button onClick={()=>setReceiptModal({show:false,record:null})} className="absolute -top-14 right-0 text-white p-3"><X size={36}/></button><div className="text-center mb-5 border-b-2 border-dashed border-gray-400 pb-5"><h2 className="text-2xl font-black uppercase">{shopName}</h2><p className="text-base text-gray-500 mt-2">{receiptModal.record?.date}</p><p className="text-base text-gray-800 font-bold mt-2">{receiptModal.record?.invoiceNo||''}</p></div><div className="space-y-2 mb-5"><div className="flex justify-between"><span className="font-bold">Type:</span><span>{receiptModal.record?.type}</span></div><div className="flex justify-between"><span className="font-bold">Name:</span><span>{receiptModal.record?.personName}</span></div></div>{receiptModal.record?.itemsDetail?.length>0?<div className="border-t-2 border-b-2 border-dashed border-gray-300 py-4 mb-5 space-y-3">{receiptModal.record.itemsDetail.map((it,i)=><div key={i} className="flex justify-between items-start"><div><span>{it.name} <span className="text-gray-500">×{it.quantity}</span></span>{it.itemDiscountAmt>0&&<span className="block text-sm text-gray-500">(-{fmt(it.itemDiscountAmt)} Disc)</span>}</div><span>{fmt((it.unitPrice*it.quantity)-(it.itemDiscountAmt||0))}</span></div>)}</div>:<div className="mb-5 pb-4 border-b-2 border-dashed border-gray-300"><div className="flex justify-between"><span className="font-bold">Item:</span><span>{receiptModal.record?.item}</span></div></div>}{(receiptModal.record?.discount||0)>0&&<div className="flex justify-between mb-2 text-gray-600"><span>Global Disc:</span><span>-{fmt(receiptModal.record.discount)}</span></div>}<div className="flex justify-between font-black text-2xl mb-6 pt-3 border-t-2 border-gray-300"><span>TOTAL</span><span>{fmt(receiptModal.record?.amount)} Ks</span></div><div className="flex gap-4"><button onClick={()=>doPrint(receiptModal.record,shopName)} className="flex-1 py-4 bg-gray-900 text-white rounded-xl font-black text-lg">🖨 {t('print')}</button><button onClick={()=>setReceiptModal({show:false,record:null})} className="flex-1 py-4 bg-gray-200 text-gray-700 rounded-xl font-black text-lg">{t('close')}</button></div></div></div>}
        {historyModal.show && <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/85"><div className="bg-[#0d1120] w-full max-w-md rounded-3xl p-8 border-2 border-cyan-500/20 max-h-[85vh] flex flex-col"><div className="flex justify-between items-center mb-6"><h3 className="font-black text-white text-2xl flex items-center gap-3">📜 {historyModal.name}</h3><button onClick={()=>setHistoryModal({show:false,name:''})} className="text-slate-400 hover:text-rose-400"><X size={30}/></button></div><div className="overflow-y-auto space-y-4 flex-1 pr-2">{histRecords.map(r=><div key={r.id} className="bg-black/50 p-5 rounded-2xl border-2 border-cyan-500/10"><div className="flex justify-between items-start mb-3"><span className={`text-sm font-black px-3 py-1.5 rounded uppercase ${r.type==='Sale'?'bg-rose-500/20 text-rose-400':'bg-emerald-500/20 text-emerald-400'}`}>{r.type==='Sale'?'Credit':'Payment'}</span><span className="text-sm text-slate-500">{(r.date||'').split(',')[0]}</span></div><div className="flex justify-between items-end mb-3"><p className="text-base text-slate-400 font-bold truncate max-w-[180px]">{r.item}</p><p className={`text-2xl font-black ${r.type==='Sale'?'text-rose-400':'text-emerald-400'}`}>{fmt(r.amount)}</p></div><div className="border-t-2 border-white/5 pt-3 text-right"><p className="text-sm text-slate-500">Balance: <span className="font-black text-slate-300">{fmt(r.runningBal)} Ks</span></p></div></div>)}</div></div></div>}
        {showScanner && <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm"><div className="bg-[#0d1120] p-8 rounded-3xl border-2 border-cyan-500/20 w-full max-w-lg mx-4"><div className="flex justify-between items-center mb-6"><h3 className="font-black text-white text-2xl">Scan Barcode</h3><button onClick={()=>setShowScanner(false)} className="text-slate-400 hover:text-rose-400 p-2"><X size={32}/></button></div><div id="barcode-reader" className="w-full overflow-hidden rounded-xl" style={{minHeight:'260px'}}></div></div></div>}
      </div>
    </>
  );
}

// ═══════════════════════ OTHER COMPONENTS ═══════════════════════

// AdminDashboard Component (Master Admin only)
function AdminDashboard({ allUsers, db, showToast, onSetup, allSettings, allRecords, allProducts }) {
  const [showSetup, setShowSetup] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmAction, setConfirmAction] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ username: '', password: '' });
  const [customExpiry, setCustomExpiry] = useState('');

  const admins = allUsers.filter(u => u.role === 'admin');
  const activeAdmins = admins.filter(u => !u.expiryDate || new Date(u.expiryDate) >= new Date());
  const expiredAdmins = admins.filter(u => u.expiryDate && new Date(u.expiryDate) < new Date());
  let displayedAdmins = filter === 'active' ? activeAdmins : filter === 'expired' ? expiredAdmins : admins;
  if (searchQuery.trim()) {
    displayedAdmins = displayedAdmins.filter(u => u.username.toLowerCase().includes(searchQuery.trim().toLowerCase()));
  }

  const tenantInfoMap = useMemo(() => {
    const map = {};
    allUsers.forEach(u => {
      if (u.role !== 'admin') return;
      const tid = u.tenantId;
      if (!map[tid]) {
        const setting = allSettings.find(s => s.id === tid);
        map[tid] = {
          shopName: setting?.shopName || 'No Shop',
          recordCount: allRecords.filter(r => r.tenantId === tid).length,
          productCount: allProducts.filter(p => p.tenantId === tid).length,
        };
      }
    });
    return map;
  }, [allUsers, allSettings, allRecords, allProducts]);

  const handleSetExpiry = async (user, days) => {
    const expiry = new Date(); expiry.setDate(expiry.getDate() + days);
    await setDoc(doc(db, 'pos_users', user.id), { expiryDate: expiry.toISOString() }, { merge: true });
    showToast(`${user.username} +${days} days`);
    setEditUser(null); setCustomExpiry('');
  };
  const handleSetExpiryCustom = async (user) => {
    if (!customExpiry) return;
    await setDoc(doc(db, 'pos_users', user.id), { expiryDate: new Date(customExpiry).toISOString() }, { merge: true });
    showToast(`Expiry set to ${customExpiry}`);
    setEditUser(null); setCustomExpiry('');
  };
  const handleRevoke = async (user) => {
    await setDoc(doc(db, 'pos_users', user.id), { expiryDate: new Date().toISOString() }, { merge: true });
    showToast(`${user.username} revoked`);
    setConfirmAction(null);
  };
  const handleEditSave = async () => {
    if (!editingUser) return;
    const newUsername = editForm.username.trim();
    if (!newUsername) { showToast('Username required', 'err'); return; }
    if (admins.some(u => u.id !== editingUser.id && u.username === newUsername)) { showToast('Username exists', 'err'); return; }
    const updates = { username: newUsername };
    if (editForm.password.trim()) updates.password = simpleHash(editForm.password);
    await setDoc(doc(db, 'pos_users', editingUser.id), updates, { merge: true });
    showToast('User updated');
    setEditingUser(null); setEditForm({ username: '', password: '' });
  };
  const startEditProfile = (user) => { setEditingUser(user); setEditForm({ username: user.username, password: '' }); setEditUser(null); };

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100">
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="text-3xl font-black text-white">🛡️ Admin Dashboard</h1><p className="text-slate-500 mt-2">Master Control</p></div>
          <button onClick={() => setShowSetup(!showSetup)} className="px-6 py-3 bg-cyan-600 text-white rounded-xl font-black text-lg">{showSetup ? 'Close' : '+ New Admin'}</button>
        </div>
        {showSetup && <div className="bg-[#0d1120] p-6 rounded-2xl border-2 border-cyan-500/20 mb-8"><h2 className="text-xl font-black text-white mb-4">Create Admin</h2><SetupScreen onSetup={(...args) => { onSetup(...args); setShowSetup(false); }} /></div>}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-[#0d1120] p-5 rounded-2xl border-2 border-cyan-500/10 text-center"><p className="text-3xl font-black text-cyan-400">{admins.length}</p><p className="text-slate-500 text-sm mt-1">Total</p></div>
          <div className="bg-[#0d1120] p-5 rounded-2xl border-2 border-emerald-500/10 text-center"><p className="text-3xl font-black text-emerald-400">{activeAdmins.length}</p><p className="text-slate-500 text-sm mt-1">Active</p></div>
          <div className="bg-[#0d1120] p-5 rounded-2xl border-2 border-rose-500/10 text-center"><p className="text-3xl font-black text-rose-400">{expiredAdmins.length}</p><p className="text-slate-500 text-sm mt-1">Expired</p></div>
        </div>
        <div className="flex gap-4 mb-6 items-center">
          <div className="flex gap-3">
            {[['all','All'],['active','Active'],['expired','Expired']].map(([k,l])=>(<button key={k} onClick={()=>setFilter(k)} className={`px-5 py-2.5 rounded-xl font-black text-sm ${filter===k?'bg-cyan-600 text-white':'bg-[#0d1120] text-slate-500 border border-white/5'}`}>{l}</button>))}
          </div>
          <div className="relative flex-1 min-w-[200px]"><Search size={20} className="absolute left-4 top-3.5 text-slate-500"/><input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search admin..." className="w-full pl-10 pr-4 py-3 bg-[#0d1120] border-2 border-white/5 rounded-xl text-base font-bold text-slate-200 outline-none focus:border-cyan-500/40 placeholder-slate-600"/></div>
        </div>
        <div className="space-y-4">
          {displayedAdmins.map(u => {
            const expired = u.expiryDate && new Date(u.expiryDate) < new Date();
            const tenant = tenantInfoMap[u.tenantId] || { shopName: 'Unknown', recordCount: 0, productCount: 0 };
            const isMaster = u.username === 'Myat7291';
            return (
              <div key={u.id} className={`bg-[#0d1120] p-5 rounded-2xl border-2 ${expired?'border-rose-500/20 bg-rose-950/10':'border-cyan-500/10'}`}>
                <div className="flex justify-between items-start flex-wrap gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3"><p className="text-xl font-black text-white">{u.username}</p><span className={`text-xs font-black px-2 py-1 rounded ${expired?'bg-rose-500/20 text-rose-400':'bg-emerald-500/20 text-emerald-400'}`}>{expired?'Expired':'Active'}</span>{isMaster && <span className="text-xs font-black px-2 py-1 rounded bg-cyan-500/20 text-cyan-400">👑 Master</span>}</div>
                    <div className="flex gap-4 mt-2 text-sm text-slate-500"><span>Join: {new Date(u.createdAt||Date.now()).toLocaleDateString('en-GB')}</span>{u.expiryDate && <span className={expired?'text-rose-400 font-bold':'text-emerald-400'}>Expiry: {new Date(u.expiryDate).toLocaleDateString('en-GB')}</span>}</div>
                    <div className="mt-3 flex gap-4 text-sm text-slate-400 bg-black/30 p-3 rounded-xl"><span className="flex items-center gap-1.5"><MonitorPlay size={16}/> {tenant.shopName}</span><span className="flex items-center gap-1.5"><FileText size={16}/> Recs: {tenant.recordCount}</span><span className="flex items-center gap-1.5"><Package size={16}/> Prods: {tenant.productCount}</span></div>
                  </div>
                  <div className="flex gap-2 items-start flex-shrink-0">
                    {editUser === u.id ? (
                      <div className="flex gap-2 items-center flex-wrap">
                        {[7,30,90,365].map(d=>(<button key={d} onClick={()=>handleSetExpiry(u,d)} className="px-3 py-1.5 bg-cyan-600 text-white rounded-lg text-xs font-black">{d}d</button>))}
                        <div className="flex items-center gap-1"><input type="date" value={customExpiry} onChange={e=>setCustomExpiry(e.target.value)} className="w-28 px-2 py-1.5 bg-black border border-cyan-500/30 rounded text-xs text-cyan-300"/><button onClick={()=>handleSetExpiryCustom(u)} className="px-2 py-1.5 bg-cyan-700 text-white rounded text-xs">Set</button></div>
                        <button onClick={()=>{setEditUser(null);setCustomExpiry('');}} className="px-2 py-1.5 bg-slate-700 text-white rounded">✕</button>
                      </div>
                    ) : (
                      <div className="flex gap-2 flex-wrap">
                        {!isMaster && (<><button onClick={()=>setEditUser(u.id)} className="px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded-lg text-xs font-black border border-cyan-500/30">Extend</button><button onClick={()=>setConfirmAction({type:'revoke',user:u})} className="px-3 py-1.5 bg-rose-600/20 text-rose-400 rounded-lg text-xs font-black border border-rose-500/30">Revoke</button><button onClick={()=>startEditProfile(u)} className="px-3 py-1.5 bg-indigo-600/20 text-indigo-400 rounded-lg text-xs font-black border border-indigo-500/30"><Edit3 size={14} className="inline mr-1"/>Edit</button></>)}
                      </div>
                    )}
                  </div>
                </div>
                {editingUser?.id === u.id && (
                  <div className="mt-4 p-4 bg-black/40 rounded-xl border border-indigo-500/20 space-y-4">
                    <p className="text-sm font-black text-indigo-400 uppercase">Edit Account</p>
                    <div className="grid grid-cols-2 gap-4">
                      <input value={editForm.username} onChange={e=>setEditForm({...editForm, username:e.target.value})} placeholder="New Username" className="w-full px-4 py-2.5 bg-black border border-indigo-500/20 rounded-lg text-slate-200"/>
                      <input value={editForm.password} onChange={e=>setEditForm({...editForm, password:e.target.value})} placeholder="New Password" className="w-full px-4 py-2.5 bg-black border border-indigo-500/20 rounded-lg text-slate-200"/>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button onClick={()=>{setEditingUser(null);setEditForm({username:'',password:''});}} className="px-4 py-2 bg-slate-700 text-white rounded">Cancel</button>
                      <button onClick={handleEditSave} className="px-4 py-2 bg-indigo-600 text-white rounded flex items-center gap-1"><Save size={16}/> Save</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {confirmAction && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/80">
            <div className="bg-[#0d1120] p-8 rounded-3xl border-2 border-rose-500/30 text-center max-w-md w-full">
              <AlertTriangle size={48} className="mx-auto text-rose-400 mb-4"/>
              <h3 className="text-2xl font-black text-white mb-2">Revoke Access?</h3>
              <p className="text-base text-slate-400 mb-6"><span className="text-rose-300 font-bold">{confirmAction.user.username}</span> will be blocked.</p>
              <div className="flex gap-4">
                <button onClick={()=>setConfirmAction(null)} className="flex-1 py-3 bg-slate-800 rounded-xl font-black text-white">Cancel</button>
                <button onClick={()=>handleRevoke(confirmAction.user)} className="flex-1 py-3 bg-rose-600 rounded-xl font-black text-white">Revoke</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// SetupScreen Component
function SetupScreen({ onSetup, t }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shopName, setShopName] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const handleSubmit = e => { e.preventDefault(); if (!username.trim() || !password.trim()) { setErr('Fill all fields'); return; } onSetup(username, password, shopName); };
  return (
    <div className="bg-[#0d1120] p-8 rounded-3xl border-2 border-cyan-500/25 w-full max-w-md mx-auto">
      <div className="text-center mb-8"><Lock size={48} className="mx-auto text-cyan-400 mb-4"/><h2 className="text-2xl font-black text-white">Admin Setup</h2></div>
      {err && <p className="text-sm font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl mb-4 text-center">{err}</p>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input required value={shopName} onChange={e=>setShopName(e.target.value)} placeholder="Shop Name" className="w-full px-5 py-4 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200"/>
        <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder="Admin Username" className="w-full px-5 py-4 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200"/>
        <div className="relative"><input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Password" className="w-full px-5 py-4 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 pr-12"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-4 top-4 text-slate-500">{show?<EyeOff size={20}/>:<Eye size={20}/>}</button></div>
        <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-4 rounded-xl">Create Admin</button>
      </form>
    </div>
  );
}

// AuthScreen Component
function AuthScreen({ allUsers, onLogin, t }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  const handleLogin = e => {
    e.preventDefault();
    const user = allUsers.find(u => u.username === username.trim() && u.password === simpleHash(password));
    if (user) {
      if (user.expiryDate && new Date(user.expiryDate) < new Date()) {
        setErr(t ? 'Account expired. Contact admin.' : 'သက်တမ်းကုန်သွားပါပြီ။');
        return;
      }
      onLogin(user);
    } else setErr(t ? 'Invalid credentials' : 'Username သို့မဟုတ် Password မှားနေပါသည်');
  };
  return (
    <div className="min-h-screen bg-[#080c14] flex items-center justify-center p-4">
      <div className="bg-[#0d1120] p-10 sm:p-12 rounded-3xl border-2 border-cyan-500/25 shadow-[0_0_50px_rgba(6,182,212,0.2)] w-full max-w-lg">
        <div className="text-center mb-10"><MonitorPlay size={64} className="mx-auto text-cyan-500 mb-6"/><h2 className="text-4xl font-black text-white uppercase">{t ? t('app_name') : 'MTT POS'}</h2><p className="text-lg text-cyan-400 font-bold mt-3">{t ? t('version') : 'PRO VERSION 18'}</p></div>
        {err && <p className="text-lg font-bold text-rose-400 bg-rose-500/10 border-2 border-rose-500/20 p-5 rounded-xl mb-8 text-center">{err}</p>}
        <form onSubmit={handleLogin} className="space-y-6">
          <input required value={username} onChange={e=>setUsername(e.target.value)} placeholder={t ? t('username') : 'Username'} className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl"/>
          <div className="relative"><input required type={show?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder={t ? t('password') : 'Password'} className="w-full px-6 py-6 bg-black/50 border-2 border-cyan-500/20 rounded-xl text-slate-200 font-bold text-2xl pr-16"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-6 top-6 text-slate-500">{show?<EyeOff size={30}/>:<Eye size={30}/>}</button></div>
          <button type="submit" className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black py-6 rounded-xl text-2xl">{t ? t('login') : 'Login'}</button>
        </form>
      </div>
    </div>
  );
}

// ProductsTab Component
function ProductsTab({ products, db, currentTenant, showToast }) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', category: '', barcode: '', costPrice: '', price: '', minStock: '5', unit: 'ခု' });
  const [showProductScanner, setShowProductScanner] = useState(false);
  const scannerRef = useRef(null);
  const isStopping = useRef(false);

  const resetForm = () => setForm({ name: '', category: '', barcode: '', costPrice: '', price: '', minStock: '5', unit: 'ခု' });
  useEffect(() => {
    if (!showProductScanner) return;
    if (!window.Html5Qrcode) { showToast('Scanner library missing', 'err'); setShowProductScanner(false); return; }
    let html5QrCode;
    (async () => {
      try {
        if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; }
        html5QrCode = new window.Html5Qrcode("product-barcode-reader"); scannerRef.current = html5QrCode;
        await html5QrCode.start({ facingMode: "environment" }, { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => { setForm(prev => ({ ...prev, barcode: decodedText.trim() })); showToast('Barcode scanned'); (async () => { if (isStopping.current) return; isStopping.current = true; if (scannerRef.current) { await scannerRef.current.stop().catch(() => {}); scannerRef.current = null; } isStopping.current = false; setShowProductScanner(false); })(); },
          () => {}
        );
      } catch { showToast('Camera error', 'err'); setShowProductScanner(false); }
    })();
    return () => { isStopping.current = true; if (scannerRef.current) scannerRef.current.stop().catch(() => {}); };
  }, [showProductScanner]);

  const handleSave = async e => {
    e.preventDefault();
    if (!form.name || !form.price || !form.costPrice) { showToast('Fill required fields', 'err'); return; }
    const payload = { name: form.name, category: form.category || 'General', barcode: form.barcode, costPrice: +form.costPrice, price: +form.price, minStock: +form.minStock || 5, unit: form.unit || 'ခု' };
    try {
      if (editing) {
        await setDoc(doc(db, 'pos_products', editing.id), payload, { merge: true });
        showToast('Updated'); setEditing(null);
      } else {
        await addDoc(collection(db, 'pos_products'), { ...payload, tenantId: currentTenant, stock: 0, createdAt: Date.now() });
        showToast('Added'); setAdding(false);
      }
      resetForm();
    } catch { showToast('Error', 'err'); }
  };

  const startEdit = p => { setEditing(p); setForm({ name: p.name || '', category: p.category || '', barcode: p.barcode || '', costPrice: String(p.costPrice || ''), price: String(p.price || ''), minStock: String(p.minStock || '5'), unit: p.unit || 'ခု' }); setAdding(false); };
  const cancelEdit = () => { setEditing(null); resetForm(); };

  return (
    <div className="bg-[#0d1120] border-2 border-cyan-500/15 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center mb-8"><h3 className="font-black text-white flex items-center gap-4 text-2xl"><Package size={30}/> Products</h3><button onClick={()=>{setAdding(!adding);cancelEdit();}} className="bg-cyan-900/40 text-cyan-400 px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3"><Plus size={24}/> Add</button></div>
      {(adding||editing) && (
        <form onSubmit={handleSave} className="bg-black/40 p-8 rounded-2xl border-2 border-cyan-500/15 mb-8 space-y-6">
          <p className="text-base font-black text-cyan-400 uppercase">{editing?'Edit':'New'}</p>
          <input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Product Name" className="w-full px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl"/>
          <div className="grid grid-cols-2 gap-5">
            <input value={form.category} onChange={e=>setForm({...form,category:e.target.value})} placeholder="Category" className="px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl"/>
            <div className="flex gap-4"><input value={form.barcode} onChange={e=>setForm({...form,barcode:e.target.value})} placeholder="Barcode" className="flex-1 px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl"/><button type="button" onClick={()=>setShowProductScanner(true)} className="px-4 bg-blue-600/20 border-2 border-blue-500/40 rounded-xl text-blue-400"><ScanBarcode size={24}/></button></div>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <input required type="number" value={form.costPrice} onChange={e=>setForm({...form,costPrice:e.target.value})} placeholder="Cost Price" className="px-5 py-5 bg-black border-2 border-blue-500/15 rounded-xl text-xl text-blue-300"/>
            <input required type="number" value={form.price} onChange={e=>setForm({...form,price:e.target.value})} placeholder="Sell Price" className="px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl text-cyan-300"/>
          </div>
          <div className="grid grid-cols-2 gap-5">
            <input value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder="Unit" className="px-5 py-5 bg-black border-2 border-cyan-500/15 rounded-xl text-xl"/>
            <input type="number" value={form.minStock} onChange={e=>setForm({...form,minStock:e.target.value})} placeholder="Min Stock" className="px-5 py-5 bg-black border-2 border-amber-500/15 rounded-xl text-xl text-amber-300"/>
          </div>
          {form.price && form.costPrice && +form.price>0 && <p className="text-lg text-emerald-400 font-bold bg-emerald-950/30 border-2 border-emerald-500/15 px-6 py-5 rounded-xl">Margin: {fmt((+form.price-+form.costPrice))} Ks ({((+form.price-+form.costPrice)/+form.price*100).toFixed(1)}%)</p>}
          <div className="flex gap-5"><button type="submit" className="flex-1 py-6 bg-cyan-600 text-white rounded-xl font-black text-xl"><Save size={24}/> Save</button><button type="button" onClick={()=>{setAdding(false);cancelEdit();}} className="px-8 py-6 bg-slate-800 text-slate-400 rounded-xl font-black text-xl">Cancel</button></div>
        </form>
      )}
      <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-2">
        {products.length===0 && <p className="text-center text-slate-500 text-xl py-14">No products</p>}
        {products.map(p=>(
          <div key={p.id} className="bg-black/30 p-6 rounded-2xl border-2 border-cyan-500/8 hover:border-cyan-500/20 transition-all group">
            <div className="flex justify-between"><div><p className="font-black text-white text-2xl">{p.name}</p><span className="text-sm bg-slate-800 px-4 py-2 rounded-lg">{p.category||'General'}</span><div className="flex gap-5 mt-3"><span className="text-blue-400">Cost: {fmt(p.costPrice)}</span><span className="text-cyan-400">Sell: {fmt(p.price)}</span><span className="text-emerald-500">{(p.price-p.costPrice)/p.price*100|0}%</span></div>{p.barcode && <p className="text-sm font-mono text-slate-600 mt-3">BC: {p.barcode}</p>}</div><div className="flex gap-4"><button onClick={()=>startEdit(p)} className="p-4 bg-indigo-950/50 border-2 border-indigo-500/20 text-indigo-400 rounded-xl"><Edit3 size={24}/></button><button onClick={async ()=>{await deleteDoc(doc(db,'pos_products',p.id));}} className="p-4 bg-rose-950/50 border-2 border-rose-500/20 text-rose-400 rounded-xl"><Trash2 size={24}/></button></div></div>
          </div>
        ))}
      </div>
      {showProductScanner && <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80"><div className="bg-[#0d1120] p-8 rounded-3xl w-full max-w-lg"><div className="flex justify-between mb-6"><h3 className="font-black text-white text-2xl">Scan Barcode</h3><button onClick={()=>setShowProductScanner(false)} className="text-slate-400"><X size={32}/></button></div><div id="product-barcode-reader" style={{minHeight:260}}></div></div></div>}
    </div>
  );
}

// InventoryTab Component
function InventoryTab({ products, db, hasPermission, sendInventoryReport }) {
  const canManage = hasPermission('manage_inventory');
  return (
    <div className="bg-[#0d1120] border-2 border-blue-500/15 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center mb-8"><h3 className="font-black text-white flex items-center gap-4 text-2xl"><Boxes size={30}/> Inventory</h3><button onClick={sendInventoryReport} className="bg-blue-600/20 text-blue-400 border-2 border-blue-500/30 px-5 py-4 rounded-xl font-black flex items-center gap-3"><Send size={22}/> Send Report</button></div>
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        {products.length===0 && <p className="text-center text-slate-500 text-xl py-14">No products</p>}
        {products.map(p=>(
          <div key={p.id} className={`p-6 rounded-2xl border-2 flex justify-between items-center ${(Number(p.stock)||0)<=(Number(p.minStock)||5)?'bg-amber-950/20 border-amber-500/20':'bg-black/30 border-cyan-500/8'}`}>
            <div><p className="font-black text-white text-2xl">{p.name}</p><p className="text-lg text-slate-400 font-bold mt-2">{fmt(p.price)} Ks · Min: {p.minStock||5} {p.unit}</p></div>
            <div className="flex flex-col items-end gap-3"><span className="text-sm text-slate-500 font-black uppercase">Stock</span><input type="number" defaultValue={p.stock||0} readOnly={!canManage} onBlur={async e=>{if(!canManage)return;const v=Number(e.target.value);if(v!==(p.stock||0))await setDoc(doc(db,'pos_products',p.id),{stock:v},{merge:true});}} className={`w-32 text-center font-black text-2xl px-4 py-4 rounded-xl outline-none border-2 transition-all ${!canManage?'bg-black text-slate-500 border-white/5 cursor-not-allowed':(Number(p.stock)||0)<=(Number(p.minStock)||5)?'bg-amber-950/40 border-amber-500/40 text-amber-300':'bg-black/50 border-blue-500/30 text-blue-300'}`}/></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// UsersTab Component
function UsersTab({ posUsers, db, currentTenant, showToast, currentUser }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' });
  const [show, setShow] = useState(false);
  const [editingPerms, setEditingPerms] = useState(null);
  const [adminPassword, setAdminPassword] = useState('');

  const handleAdd = async e => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) return;
    if (!adminPassword.trim()) { showToast('Admin password required', 'err'); return; }
    if (currentUser.password !== simpleHash(adminPassword)) { showToast('Wrong admin password', 'err'); return; }
    if (posUsers.some(u => u.username === form.username.trim())) { showToast('Username exists', 'err'); return; }
    await addDoc(collection(db, 'pos_users'), {
      tenantId: currentTenant, username: form.username.trim(),
      password: simpleHash(form.password), role: form.role,
      permissions: form.role === 'staff' ? DEFAULT_STAFF_PERMS : [],
      createdAt: Date.now(),
    });
    setForm({ username: '', password: '', role: 'staff' }); setAdminPassword(''); setAdding(false);
    showToast('User created');
  };

  const togglePermission = async (user, permKey) => {
    const newPerms = user.permissions?.includes(permKey) ? user.permissions.filter(p => p !== permKey) : [...(user.permissions || []), permKey];
    await setDoc(doc(db, 'pos_users', user.id), { permissions: newPerms }, { merge: true });
  };

  return (
    <div className="bg-[#0d1120] border-2 border-indigo-500/15 rounded-3xl p-8 shadow-xl">
      <div className="flex justify-between items-center mb-8"><h3 className="font-black text-white flex items-center gap-4 text-2xl"><Users size={30}/> Staff</h3><button onClick={()=>setAdding(!adding)} className="bg-indigo-900/40 text-indigo-400 px-6 py-4 rounded-xl font-black text-lg flex items-center gap-3"><Plus size={24}/> Add</button></div>
      {adding && (
        <form onSubmit={handleAdd} className="bg-black/40 p-8 rounded-2xl border-2 border-indigo-500/15 mb-8 space-y-6">
          <input required value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="Username" className="w-full px-5 py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-xl"/>
          <div className="relative"><input required type={show?'text':'password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="Password" className="w-full px-5 py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-xl pr-16"/><button type="button" onClick={()=>setShow(!show)} className="absolute right-6 top-6 text-slate-500"><EyeOff size={26}/></button></div>
          <div className="relative"><input required type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="Your Admin Password" className="w-full px-5 py-5 bg-amber-950/20 border-2 border-amber-500/20 rounded-xl text-xl text-amber-300"/></div>
          <select value={form.role} onChange={e=>setForm({...form,role:e.target.value})} className="w-full px-5 py-5 bg-black border-2 border-indigo-500/15 rounded-xl text-xl"><option value="staff">Staff</option><option value="admin">Admin</option></select>
          <div className="flex gap-5"><button type="submit" className="flex-1 py-6 bg-indigo-600 text-white rounded-xl font-black text-xl">Create</button><button type="button" onClick={()=>setAdding(false)} className="px-8 py-6 bg-slate-800 text-slate-400 rounded-xl font-black text-xl">Cancel</button></div>
        </form>
      )}
      <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2">
        {posUsers.map(u=>(
          <div key={u.id} className="bg-black/30 p-6 rounded-2xl border-2 border-indigo-500/8">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-5"><div className="w-14 h-14 rounded-xl bg-indigo-950/60 flex items-center justify-center text-indigo-400 font-black text-2xl">{u.username?.[0]?.toUpperCase()||'?'}</div><div><p className="font-black text-white text-2xl">{u.username}</p><span className={`text-sm font-black px-4 py-1.5 rounded uppercase ${u.role==='admin'?'bg-indigo-500/20 text-indigo-400':'bg-cyan-500/20 text-cyan-400'}`}>{u.role}</span></div></div>
              <div className="flex items-center gap-4">
                <button onClick={()=>setEditingPerms(editingPerms===u.id?null:u.id)} className="text-base text-indigo-400 bg-indigo-500/10 px-5 py-3 rounded-xl border-2 border-indigo-500/20 flex items-center gap-3"><ShieldCheck size={22}/> {editingPerms===u.id?'Close':'Permissions'}</button>
                {u.username!==currentUser.username && <button onClick={async ()=>{if(u.role==='admin'&&posUsers.filter(x=>x.role==='admin').length<=1){showToast('Cannot delete last admin','err');return;}await deleteDoc(doc(db,'pos_users',u.id));}} className="text-rose-500 hover:text-rose-300 p-4"><Trash2 size={26}/></button>}
              </div>
            </div>
            {editingPerms===u.id && (
              <div className="mt-6 p-6 bg-black/60 rounded-2xl border-2 border-indigo-500/20 grid grid-cols-2 gap-5">
                {PERMISSION_OPTIONS.map(perm=>(<label key={perm.key} className={`flex items-center gap-4 text-lg font-bold ${u.role==='admin'?'text-slate-600':'text-slate-300'} cursor-pointer`}><input type="checkbox" checked={u.role==='admin'?true:u.permissions?.includes(perm.key)} onChange={()=>togglePermission(u,perm.key)} disabled={u.role==='admin'} className="accent-indigo-500 w-6 h-6 rounded"/><span>{perm.label}</span></label>))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════ APP WRAPPER ═══════════════════════
export default function App() {
  return (
    <LanguageContext.Provider value={{ lang: 'mm', setLang: () => {}, t: (k) => translations['mm'][k] || k }}>
      <AppWithLang />
    </LanguageContext.Provider>
  );
}
function AppWithLang() {
  const [lang, setLang] = useState('mm');
  const t = useCallback((key) => translations[lang]?.[key] || key, [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, t]);
  return (
    <LanguageContext.Provider value={value}>
      <MainApp />
    </LanguageContext.Provider>
  );
}
