/* global React, ReactDOM */
const { useState, useEffect, useMemo, useRef } = React;

const APP_VERSION = '2.0.1';
const STORAGE_KEY = 'bin_ghaith_v3';
const SETTINGS_KEY = 'bin_ghaith_settings_v3';
const LOGS_KEY = 'bin_ghaith_logs_v3';

const CURRENCIES = ['AED', 'SAR', 'USD', 'EUR', 'KWD', 'QAR', 'OMR', 'BHD', 'GBP'];
const OUD_GRADES = ['AAA+', 'AAA', 'AA', 'A', 'B', 'C'];
const COUNTRIES = ['الهند', 'كمبوديا', 'لاوس', 'فيتنام', 'إندونيسيا', 'ماليزيا', 'بورما', 'تايلاند', 'الفلبين', 'بنغلاديش', 'أخرى'];
const EXPENSE_CATS = {
  shipping: 'شحن', packaging: 'تغليف', delivery: 'توصيل',
  stickers: 'ملصقات', logos: 'شعارات', marketing: 'تسويق',
  customs: 'جمارك', travel: 'سفر', other: 'أخرى'
};

const PATCH_HISTORY = [
  { version: '2.0.1', date: '2025-05-19', description: 'إضافة نظام Patch Management و Logs & Monitoring' },
  { version: '2.0.0', date: '2025-05-18', description: 'الإصدار الأول - نظام إدارة المخزون والمبيعات الكامل' },
];

const defaultData = {
  products: [], suppliers: [], orders: [], purchases: [], expenses: [],
  customCategories: []
};

const defaultSettings = {
  fxRates: { AED: 1, SAR: 0.98, USD: 3.673, EUR: 4.05, KWD: 12.0, QAR: 1.01, OMR: 9.55, BHD: 9.74, GBP: 4.65 },
  lowStockThreshold: 10
};

const loadData = () => {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? { ...defaultData, ...JSON.parse(s) } : defaultData;
  } catch { return defaultData; }
};
const loadSettings = () => {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (!s) return defaultSettings;
    const p = JSON.parse(s);
    return { ...defaultSettings, ...p, fxRates: { ...defaultSettings.fxRates, ...(p.fxRates || {}) } };
  } catch { return defaultSettings; }
};
const loadLogs = () => {
  try { return JSON.parse(localStorage.getItem(LOGS_KEY) || '[]'); }
  catch { return []; }
};
const saveData = (d) => localStorage.setItem(STORAGE_KEY, JSON.stringify(d));
const saveSettings = (s) => localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
const saveLogs = (l) => localStorage.setItem(LOGS_KEY, JSON.stringify(l));

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function addLog(type, message, details = {}) {
  const logs = loadLogs();
  logs.unshift({
    id: uid(), type, message, details,
    timestamp: new Date().toISOString()
  });
  if (logs.length > 500) logs.length = 500;
  saveLogs(logs);
}

window.addEventListener('error', (e) => {
  addLog('error', e.message || 'Unknown error', { stack: e.error?.stack });
});

const fmt = (n, d = 2) => (Number(n) || 0).toLocaleString('ar-AE', { minimumFractionDigits: 0, maximumFractionDigits: d });
const toBase = (a, c, r) => (Number(a) || 0) * (r[c] || 1);
const todayISO = () => new Date().toISOString().slice(0, 10);
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const t = new Date();
  const y = new Date(); y.setDate(t.getDate() - 1);
  if (d.toDateString() === t.toDateString()) return 'اليوم';
  if (d.toDateString() === y.toDateString()) return 'أمس';
  return d.toLocaleDateString('ar-AE', { day: 'numeric', month: 'short', year: 'numeric' });
};
const fmtDateTime = (iso) => new Date(iso).toLocaleString('ar-AE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtWeight = (g) => {
  const n = Number(g) || 0;
  return n >= 1000 ? `${fmt(n / 1000, 2)} كجم` : `${fmt(n, 1)} جم`;
};

const getStock = (data, pid) => {
  const bought = data.purchases.filter(p => p.productId === pid).reduce((s, p) => s + (Number(p.quantity) || 0), 0);
  const sold = data.orders.reduce((s, o) => s + (o.items || []).filter(i => i.productId === pid).reduce((ss, i) => ss + (Number(i.quantity) || 0), 0), 0);
  return bought - sold;
};

const getAvgCost = (data, settings, pid) => {
  const rates = settings.fxRates;
  let qty = 0, cost = 0;
  data.purchases.forEach(p => {
    if (p.productId !== pid) return;
    const q = Number(p.quantity) || 0;
    qty += q;
    cost += toBase(p.totalCost ?? (Number(p.unitCost || 0) * q), p.currency || 'AED', rates);
  });
  return qty > 0 ? cost / qty : 0;
};

const I = {
  home: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7h-6v7H4a1 1 0 0 1-1-1z" strokeLinejoin="round"/></svg>,
  box: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 7l9-4 9 4-9 4-9-4z" strokeLinejoin="round"/><path d="M3 7v10l9 4 9-4V7" strokeLinejoin="round"/></svg>,
  truck: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M1 4h14v12H1zM15 8h4l3 4v4h-7" strokeLinejoin="round"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>,
  bag: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M6 7h12l-1 13H7L6 7z" strokeLinejoin="round"/><path d="M9 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round"/></svg>,
  chart: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 21h18M5 17V9m4 8V5m4 12v-8m4 8V11" strokeLinecap="round"/></svg>,
  settings: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" strokeLinejoin="round"/></svg>,
  plus: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>,
  close: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" strokeLinecap="round"/></svg>,
  edit: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M16 3l5 5-12 12H4v-5L16 3z" strokeLinejoin="round"/></svg>,
  trash: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" strokeLinejoin="round"/></svg>,
  alert: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" strokeLinejoin="round"/></svg>,
  info: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01" strokeLinecap="round"/></svg>,
  download: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v13m-5-5l5 5 5-5M4 21h16" strokeLinejoin="round"/></svg>,
  sparkle: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" strokeLinecap="round"/></svg>,
  whatsapp: <svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.5 14.4l-2.6-1.3c-.4-.2-.8-.1-1 .2l-.5.6c-.2.3-.5.3-.8.2-1-.4-2.6-1.8-3.1-2.8-.2-.3-.1-.5.1-.7l.6-.6c.2-.2.3-.5.1-.8l-1.2-2.5c-.2-.4-.6-.5-1-.4-.8.2-2.1.9-2.1 2.6 0 4 3.5 7.5 7.5 7.5 1.7 0 2.4-1.3 2.6-2.1.1-.4-.1-.8-.5-.9zM12 2C6.5 2 2 6.5 2 12c0 1.9.5 3.6 1.4 5.1L2 22l5-1.4c1.5.8 3.2 1.4 5 1.4 5.5 0 10-4.5 10-10S17.5 2 12 2z"/></svg>,
  code: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M16 18l6-6-6-6M8 6l-6 6 6 6" strokeLinejoin="round"/></svg>,
};

function useStats(data, settings) {
  return useMemo(() => {
    const rates = settings.fxRates;
    const totalPurchases = data.purchases.reduce((s, p) => s + toBase(p.totalCost ?? (Number(p.unitCost || 0) * Number(p.quantity || 0)), p.currency || 'AED', rates), 0);
    const totalSales = data.orders.reduce((s, o) => s + toBase(o.total || 0, o.currency || 'AED', rates), 0);
    const totalExpenses = data.expenses.reduce((s, e) => s + toBase(e.amount || 0, e.currency || 'AED', rates), 0);

    let totalCOGS = 0;
    data.orders.forEach(o => (o.items || []).forEach(i => totalCOGS += (Number(i.unitCost || 0) * Number(i.quantity || 0))));

    const productStats = {};
    data.products.forEach(p => {
      productStats[p.id] = { product: p, purchasedQty: 0, purchasedCost: 0, soldQty: 0, soldRevenue: 0 };
    });
    data.purchases.forEach(p => {
      if (!productStats[p.productId]) return;
      const q = Number(p.quantity) || 0;
      productStats[p.productId].purchasedQty += q;
      productStats[p.productId].purchasedCost += toBase(p.totalCost ?? (Number(p.unitCost || 0) * q), p.currency || 'AED', rates);
    });
    data.orders.forEach(o => (o.items || []).forEach(i => {
      if (!productStats[i.productId]) return;
      productStats[i.productId].soldQty += Number(i.quantity) || 0;
      productStats[i.productId].soldRevenue += toBase(Number(i.unitPrice || 0) * Number(i.quantity || 0), o.currency || 'AED', rates);
    }));

    let stockValue = 0;
    Object.values(productStats).forEach(ps => {
      ps.remaining = ps.purchasedQty - ps.soldQty;
      ps.avgCost = ps.purchasedQty > 0 ? ps.purchasedCost / ps.purchasedQty : 0;
      ps.stockValue = Math.max(0, ps.remaining) * ps.avgCost;
      stockValue += ps.stockValue;
    });

    const grossProfit = totalSales - totalCOGS;
    const netProfit = grossProfit - totalExpenses;
    const margin = totalSales > 0 ? (netProfit / totalSales) * 100 : 0;
    const capital = totalSales - totalPurchases - totalExpenses;

    return { totalPurchases, totalSales, totalExpenses, grossProfit, netProfit, margin, capital, ordersCount: data.orders.length, stockValue, productStats };
  }, [data, settings]);
}

function Sheet({ title, onClose, children, footer }) {
  return (
    <>
      <div className="sheet-overlay" onClick={onClose} />
      <div className="sheet">
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div className="sheet-title">{title}</div>
          <button className="sheet-close" onClick={onClose}>{I.close}</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-footer">{footer}</div>}
      </div>
    </>
  );
}

function ConfirmDialog({ title, text, onCancel, onConfirm }) {
  return (
    <div className="dialog-overlay" onClick={onCancel}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-icon">{I.alert}</div>
        <div className="dialog-title">{title}</div>
        <div className="dialog-text">{text}</div>
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={onCancel}>إلغاء</button>
          <button className="btn btn-danger" onClick={onConfirm}>حذف</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ data, settings, stats, setTab }) {
  const insights = useMemo(() => {
    const out = [];
    const bestSellers = Object.values(stats.productStats).filter(ps => ps.soldQty > 0).sort((a, b) => b.soldRevenue - a.soldRevenue);
    const lowStock = Object.values(stats.productStats).filter(ps => ps.remaining > 0 && ps.remaining < settings.lowStockThreshold);
    if (bestSellers.length > 0) out.push({ icon: I.sparkle, title: 'الأكثر مبيعاً', text: `${bestSellers[0].product.name} يقود مبيعاتك` });
    if (lowStock.length > 0) out.push({ icon: I.alert, title: 'تنبيه مخزون', text: `${lowStock.length} منتج بحاجة إعادة طلب` });
    if (data.orders.length === 0 && data.products.length > 0) out.push({ icon: I.info, title: 'ابدأ البيع', text: 'سجّل أول طلب لرؤية التحليلات' });
    return out.slice(0, 2);
  }, [stats, settings, data]);

  return (
    <div className="page">
      <div className="hero">
        <div className="hero-label">رأس المال الحالي</div>
        <div className="hero-value">{fmt(stats.capital)}<span className="hero-currency">د.إ</span></div>
        <div className="hero-meta">
          <div className="hero-meta-item">
            <span className="hero-meta-label">صافي الربح</span>
            <span className={`hero-meta-value ${stats.netProfit >= 0 ? 'pos' : 'neg'}`}>{fmt(stats.netProfit)}</span>
          </div>
          <div className="hero-meta-item">
            <span className="hero-meta-label">الطلبات</span>
            <span className="hero-meta-value">{stats.ordersCount}</span>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-label">المبيعات</div><div className="stat-value gold">{fmt(stats.totalSales, 0)}</div></div>
        <div className="stat-card"><div className="stat-label">قيمة المخزون</div><div className="stat-value gold">{fmt(stats.stockValue, 0)}</div></div>
        <div className="stat-card"><div className="stat-label">المصروفات</div><div className="stat-value">{fmt(stats.totalExpenses, 0)}</div></div>
        <div className="stat-card"><div className="stat-label">هامش الربح</div><div className="stat-value">{stats.margin.toFixed(1)}<span className="stat-unit">٪</span></div></div>
      </div>

      {insights.length > 0 && (
        <>
          <div className="section-head"><h3 className="section-title">تنبيهات ذكية</h3></div>
          {insights.map((ins, i) => (
            <div key={i} className="insight">
              <div className="insight-icon">{ins.icon}</div>
              <div className="insight-body">
                <div className="insight-title">{ins.title}</div>
                <div className="insight-text">{ins.text}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {data.products.length === 0 && (
        <div className="empty">
          <div className="empty-icon">{I.box}</div>
          <div className="empty-title">ابدأ رحلتك مع بن غيث</div>
          <div className="empty-text">أضف منتجك الأول من تبويب المخزون</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setTab('inventory')}>إضافة منتج</button>
        </div>
      )}
    </div>
  );
}

function InventoryPage({ data, settings, stats, openSheet, askDelete }) {
  const [search, setSearch] = useState('');
  const filtered = data.products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="search-bar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث في المنتجات..." />
      </div>
      <div className="section-head"><h3 className="section-title">المنتجات ({filtered.length})</h3></div>
      {filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">{I.box}</div><div className="empty-title">لا توجد منتجات</div><div className="empty-text">اضغط + لإضافة منتج جديد</div></div>
      ) : filtered.map(p => {
        const ps = stats.productStats[p.id] || { remaining: 0, avgCost: 0, stockValue: 0 };
        const low = ps.remaining > 0 && ps.remaining < settings.lowStockThreshold;
        const out = ps.remaining <= 0;
        return (
          <div key={p.id} className="list-card">
            <div className="list-card-head">
              <h4 className="list-card-title">{p.name}</h4>
              <span className={`list-card-badge ${out || low ? 'warn' : 'success'}`}>{out ? 'نفذ' : low ? 'منخفض' : 'متوفر'}</span>
            </div>
            <div className="tag-row">
              {p.grade && <span className="tag gold">{p.grade}</span>}
              {p.origin && <span className="tag">{p.origin}</span>}
            </div>
            <div className="list-card-meta">
              <div className="list-card-meta-item"><span className="label">المتبقي:</span><span className="value">{fmtWeight(Math.max(0, ps.remaining))}</span></div>
              <div className="list-card-meta-item"><span className="label">سعر البيع:</span><span className="value">{fmt(p.salePrice || 0, 0)} د.إ</span></div>
            </div>
            <div className="list-card-foot">
              <div>
                <div className="list-card-price">{fmt(ps.stockValue, 0)}<span className="list-card-price-currency">د.إ</span></div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>قيمة المخزون</div>
              </div>
              <div className="list-card-actions">
                <button className="txn-action" onClick={() => openSheet({ type: 'product', id: p.id })}>{I.edit}</button>
                <button className="txn-action danger" onClick={() => askDelete('product', p.id, p.name)}>{I.trash}</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function OrdersPage({ data, settings, openSheet, askDelete }) {
  const sorted = [...data.orders].sort((a, b) => new Date(b.date) - new Date(a.date));
  return (
    <div className="page">
      <div className="section-head"><h3 className="section-title">الطلبات ({data.orders.length})</h3></div>
      {sorted.length === 0 ? (
        <div className="empty"><div className="empty-icon">{I.bag}</div><div className="empty-title">لا توجد طلبات</div><div className="empty-text">اضغط + لتسجيل طلب جديد</div></div>
      ) : sorted.map(o => {
        const baseTotal = toBase(o.total || 0, o.currency || 'AED', settings.fxRates);
        const firstItem = (o.items || [])[0];
        const productName = firstItem ? data.products.find(p => p.id === firstItem.productId)?.name : '';
        return (
          <div key={o.id} className="list-card">
            <div className="list-card-head">
              <h4 className="list-card-title">{o.customerName || 'عميل'}</h4>
              <span className={`list-card-badge ${o.paymentStatus === 'paid' ? 'success' : 'warn'}`}>
                {o.paymentStatus === 'paid' ? 'مدفوع' : o.paymentStatus === 'partial' ? 'جزئي' : 'آجل'}
              </span>
            </div>
            <div className="list-card-meta">
              <div className="list-card-meta-item"><span className="value">{productName || 'طلب'} {(o.items || []).length > 1 ? `+${o.items.length - 1}` : ''}</span></div>
              <div className="list-card-meta-item"><span className="label">التاريخ:</span><span className="value">{fmtDate(o.date)}</span></div>
            </div>
            <div className="list-card-foot">
              <div className="list-card-price">{fmt(baseTotal, 0)}<span className="list-card-price-currency">د.إ</span></div>
              <div className="list-card-actions">
                {o.customerPhone && <a className="txn-action" style={{ color: '#25D366' }} href={`https://wa.me/${o.customerPhone.replace(/\D/g, '')}`} target="_blank">{I.whatsapp}</a>}
                <button className="txn-action" onClick={() => openSheet({ type: 'order', id: o.id })}>{I.edit}</button>
                <button className="txn-action danger" onClick={() => askDelete('order', o.id, o.customerName || 'الطلب')}>{I.trash}</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SuppliersPage({ data, settings, openSheet, askDelete }) {
  return (
    <div className="page">
      <div className="section-head"><h3 className="section-title">الموردين ({data.suppliers.length})</h3></div>
      {data.suppliers.length === 0 ? (
        <div className="empty"><div className="empty-icon">{I.truck}</div><div className="empty-title">لا يوجد موردين</div><div className="empty-text">اضغط + لإضافة مورد</div></div>
      ) : data.suppliers.map(s => {
        const purchases = data.purchases.filter(p => p.supplierId === s.id);
        const totalSpent = purchases.reduce((acc, p) => acc + toBase(p.totalCost ?? 0, p.currency || 'AED', settings.fxRates), 0);
        return (
          <div key={s.id} className="list-card">
            <div className="list-card-head"><h4 className="list-card-title">{s.name}</h4></div>
            <div className="list-card-meta">
              {s.contactPerson && <div className="list-card-meta-item"><span className="value">{s.contactPerson}</span></div>}
              {s.country && <div className="list-card-meta-item"><span className="label">الدولة:</span><span className="value">{s.country}</span></div>}
              <div className="list-card-meta-item"><span className="label">المشتريات:</span><span className="value">{purchases.length}</span></div>
            </div>
            <div className="list-card-foot">
              <div className="list-card-price">{fmt(totalSpent, 0)}<span className="list-card-price-currency">د.إ</span></div>
              <div className="list-card-actions">
                {s.phone && <a className="txn-action" style={{ color: '#25D366' }} href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank">{I.whatsapp}</a>}
                <button className="txn-action" onClick={() => openSheet({ type: 'supplier', id: s.id })}>{I.edit}</button>
                <button className="txn-action danger" onClick={() => askDelete('supplier', s.id, s.name)}>{I.trash}</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReportsPage({ data, settings, stats, openSheet, askDelete }) {
  return (
    <div className="page">
      <div className="detail-section">
        <div className="detail-section-title">ملخص مالي</div>
        <div className="detail-row"><span className="detail-row-label">إجمالي المبيعات</span><span className="detail-row-value gold">{fmt(stats.totalSales)} د.إ</span></div>
        <div className="detail-row"><span className="detail-row-label">إجمالي المشتريات</span><span className="detail-row-value">{fmt(stats.totalPurchases)} د.إ</span></div>
        <div className="detail-row"><span className="detail-row-label">إجمالي المصروفات</span><span className="detail-row-value">{fmt(stats.totalExpenses)} د.إ</span></div>
        <div className="detail-row"><span className="detail-row-label">إجمالي الربح</span><span className="detail-row-value gold">{fmt(stats.grossProfit)} د.إ</span></div>
        <div className="detail-row"><span className="detail-row-label">صافي الربح</span><span className="detail-row-value gold" style={{ color: stats.netProfit >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(stats.netProfit)} د.إ</span></div>
        <div className="detail-row"><span className="detail-row-label">هامش الربح</span><span className="detail-row-value">{stats.margin.toFixed(2)}٪</span></div>
        <div className="detail-row"><span className="detail-row-label">رأس المال</span><span className="detail-row-value gold">{fmt(stats.capital)} د.إ</span></div>
      </div>

      <div className="section-head">
        <h3 className="section-title">المصروفات ({data.expenses.length})</h3>
        <button className="section-action" onClick={() => openSheet({ type: 'expense' })}>+ إضافة</button>
      </div>

      {data.expenses.length === 0 ? (
        <div className="empty"><div className="empty-icon">{I.chart}</div><div className="empty-title">لا توجد مصروفات</div></div>
      ) : [...data.expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => {
        const baseAmt = toBase(e.amount || 0, e.currency || 'AED', settings.fxRates);
        return (
          <div key={e.id} className="txn expense">
            <div className="txn-body">
              <div className="txn-title">{e.note || EXPENSE_CATS[e.category]}</div>
              <div className="txn-sub">{EXPENSE_CATS[e.category]} · {fmtDate(e.date)}</div>
            </div>
            <div className="txn-side" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <div className="txn-amount neg">-{fmt(baseAmt, 0)}<span className="txn-currency">د.إ</span></div>
              <button className="txn-action danger" onClick={() => askDelete('expense', e.id, e.note || EXPENSE_CATS[e.category])}>{I.trash}</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ProductForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: '', grade: '', origin: '', salePrice: '', notes: '' });
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Sheet title={initial ? 'تعديل المنتج' : 'إضافة منتج'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>إلغاء</button><button className="btn btn-primary" onClick={() => { if (f.name.trim()) { onSave({ ...f, id: f.id || uid(), salePrice: Number(f.salePrice) || 0 }); onClose(); } }}>حفظ</button></>}>
      <div className="form-grid">
        <div className="field"><label className="field-label">اسم المنتج *</label><input className="input" value={f.name} onChange={(e) => u('name', e.target.value)} placeholder="عود كمبودي مميز" /></div>
        <div className="form-row">
          <div className="field"><label className="field-label">الدرجة</label><select className="select" value={f.grade} onChange={(e) => u('grade', e.target.value)}><option value="">-- اختر --</option>{OUD_GRADES.map(g => <option key={g} value={g}>{g}</option>)}</select></div>
          <div className="field"><label className="field-label">المنشأ</label><select className="select" value={f.origin} onChange={(e) => u('origin', e.target.value)}><option value="">-- اختر --</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="field"><label className="field-label">سعر البيع (د.إ)</label><input type="number" className="input" value={f.salePrice} onChange={(e) => u('salePrice', e.target.value)} placeholder="0" /></div>
        <div className="field"><label className="field-label">ملاحظات</label><textarea className="textarea" value={f.notes} onChange={(e) => u('notes', e.target.value)} /></div>
      </div>
    </Sheet>
  );
}

function SupplierForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { name: '', contactPerson: '', phone: '', country: '', notes: '' });
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Sheet title={initial ? 'تعديل المورد' : 'إضافة مورد'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>إلغاء</button><button className="btn btn-primary" onClick={() => { if (f.name.trim()) { onSave({ ...f, id: f.id || uid() }); onClose(); } }}>حفظ</button></>}>
      <div className="form-grid">
        <div className="field"><label className="field-label">اسم المورد *</label><input className="input" value={f.name} onChange={(e) => u('name', e.target.value)} /></div>
        <div className="field"><label className="field-label">الشخص المسؤول</label><input className="input" value={f.contactPerson} onChange={(e) => u('contactPerson', e.target.value)} /></div>
        <div className="field"><label className="field-label">الهاتف / واتساب</label><input type="tel" className="input" value={f.phone} onChange={(e) => u('phone', e.target.value)} placeholder="+971..." /></div>
        <div className="field"><label className="field-label">الدولة</label><select className="select" value={f.country} onChange={(e) => u('country', e.target.value)}><option value="">-- اختر --</option>{COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        <div className="field"><label className="field-label">ملاحظات</label><textarea className="textarea" value={f.notes} onChange={(e) => u('notes', e.target.value)} /></div>
      </div>
    </Sheet>
  );
}

function PurchaseForm({ data, settings, onSave, onClose }) {
  const [f, setF] = useState({ productId: data.products[0]?.id || '', supplierId: '', quantity: '', totalCost: '', currency: 'AED', date: todayISO(), notes: '' });
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Sheet title="إضافة عملية شراء" onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>إلغاء</button><button className="btn btn-primary" onClick={() => { if (!f.productId || !f.quantity) return; onSave({ ...f, id: uid(), quantity: Number(f.quantity), totalCost: Number(f.totalCost) }); onClose(); }}>حفظ</button></>}>
      <div className="form-grid">
        {data.products.length === 0 ? (
          <div className="insight"><div className="insight-icon">{I.alert}</div><div className="insight-body"><div className="insight-title">أضف منتج أولاً</div></div></div>
        ) : (
          <>
            <div className="field"><label className="field-label">المنتج *</label><select className="select" value={f.productId} onChange={(e) => u('productId', e.target.value)}>{data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div className="field"><label className="field-label">المورد</label><select className="select" value={f.supplierId} onChange={(e) => u('supplierId', e.target.value)}><option value="">-- بدون --</option>{data.suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="form-row">
              <div className="field"><label className="field-label">الكمية (جم) *</label><input type="number" className="input" value={f.quantity} onChange={(e) => u('quantity', e.target.value)} /></div>
              <div className="field"><label className="field-label">العملة</label><select className="select" value={f.currency} onChange={(e) => u('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
            </div>
            <div className="field"><label className="field-label">التكلفة الإجمالية</label><input type="number" className="input" value={f.totalCost} onChange={(e) => u('totalCost', e.target.value)} placeholder={`المبلغ بـ${f.currency}`} /></div>
            <div className="field"><label className="field-label">التاريخ</label><input type="date" className="input" value={f.date} onChange={(e) => u('date', e.target.value)} /></div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function OrderForm({ initial, data, settings, onSave, onClose }) {
  const fp = data.products[0];
  const [f, setF] = useState(initial || {
    customerName: '', customerPhone: '',
    items: fp ? [{ productId: fp.id, quantity: '', unitPrice: fp.salePrice || '', unitCost: 0 }] : [],
    currency: 'AED', paymentStatus: 'paid', date: todayISO(), notes: ''
  });
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  const updateItem = (i, k, v) => {
    setF(p => {
      const items = [...p.items];
      items[i] = { ...items[i], [k]: v };
      if (k === 'productId') {
        const cost = getAvgCost(data, settings, v) / (settings.fxRates[p.currency] || 1);
        items[i].unitCost = cost;
        const prod = data.products.find(x => x.id === v);
        if (prod) items[i].unitPrice = prod.salePrice || '';
      }
      return { ...p, items };
    });
  };
  const total = f.items.reduce((s, i) => s + (Number(i.unitPrice) || 0) * (Number(i.quantity) || 0), 0);
  const baseTotal = toBase(total, f.currency, settings.fxRates);

  return (
    <Sheet title={initial ? 'تعديل الطلب' : 'إضافة طلب / بيع'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>إلغاء</button><button className="btn btn-primary" onClick={() => { if (!f.items.length || f.items.some(i => !i.productId || !i.quantity)) return; onSave({ ...f, id: f.id || uid(), total, items: f.items.map(i => ({ ...i, quantity: Number(i.quantity), unitPrice: Number(i.unitPrice), unitCost: Number(i.unitCost) || 0 })) }); onClose(); }}>حفظ</button></>}>
      <div className="form-grid">
        {data.products.length === 0 ? (
          <div className="insight"><div className="insight-icon">{I.alert}</div><div className="insight-body"><div className="insight-title">أضف منتج أولاً</div></div></div>
        ) : (
          <>
            <div className="form-row">
              <div className="field"><label className="field-label">اسم العميل</label><input className="input" value={f.customerName} onChange={(e) => u('customerName', e.target.value)} /></div>
              <div className="field"><label className="field-label">رقم العميل</label><input type="tel" className="input" value={f.customerPhone} onChange={(e) => u('customerPhone', e.target.value)} placeholder="+971..." /></div>
            </div>
            <div className="field"><label className="field-label">العملة</label><select className="select" value={f.currency} onChange={(e) => u('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>

            {f.items.map((item, idx) => (
              <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 12, padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, color: 'var(--gold)' }}>منتج #{idx + 1}</span>
                  {f.items.length > 1 && <button className="txn-action danger" onClick={() => setF(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }))}>{I.close}</button>}
                </div>
                <div className="form-grid">
                  <div className="field"><label className="field-label">المنتج</label><select className="select" value={item.productId} onChange={(e) => updateItem(idx, 'productId', e.target.value)}>{data.products.map(p => <option key={p.id} value={p.id}>{p.name} ({fmtWeight(getStock(data, p.id))})</option>)}</select></div>
                  <div className="form-row">
                    <div className="field"><label className="field-label">الكمية</label><input type="number" className="input" value={item.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} /></div>
                    <div className="field"><label className="field-label">السعر</label><input type="number" className="input" value={item.unitPrice} onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)} /></div>
                  </div>
                </div>
              </div>
            ))}

            <button className="btn btn-secondary btn-sm" onClick={() => {
              const p = data.products[0];
              if (p) setF(prev => ({ ...prev, items: [...prev.items, { productId: p.id, quantity: '', unitPrice: p.salePrice || '', unitCost: 0 }] }));
            }}>+ إضافة منتج آخر</button>

            <div className="detail-section">
              <div className="detail-row"><span className="detail-row-label">الإجمالي</span><span className="detail-row-value gold">{fmt(total)} {f.currency}</span></div>
              {f.currency !== 'AED' && <div className="detail-row"><span className="detail-row-label">≈ بالدرهم</span><span className="detail-row-value">{fmt(baseTotal)} د.إ</span></div>}
            </div>

            <div className="field">
              <label className="field-label">حالة الدفع</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {['paid', 'partial', 'unpaid'].map(s => (
                  <button key={s} className={`chip ${f.paymentStatus === s ? 'active' : ''}`} style={{ justifyContent: 'center', display: 'flex' }} onClick={() => u('paymentStatus', s)}>
                    {s === 'paid' ? 'مدفوع' : s === 'partial' ? 'جزئي' : 'آجل'}
                  </button>
                ))}
              </div>
            </div>
            <div className="field"><label className="field-label">التاريخ</label><input type="date" className="input" value={f.date} onChange={(e) => u('date', e.target.value)} /></div>
          </>
        )}
      </div>
    </Sheet>
  );
}

function ExpenseForm({ initial, onSave, onClose }) {
  const [f, setF] = useState(initial || { category: 'shipping', amount: '', currency: 'AED', date: todayISO(), note: '' });
  const u = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Sheet title={initial ? 'تعديل المصروف' : 'إضافة مصروف'} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={onClose}>إلغاء</button><button className="btn btn-primary" onClick={() => { if (f.amount) { onSave({ ...f, id: f.id || uid(), amount: Number(f.amount) }); onClose(); } }}>حفظ</button></>}>
      <div className="form-grid">
        <div className="field">
          <label className="field-label">الفئة</label>
          <div className="chips" style={{ flexWrap: 'wrap' }}>
            {Object.entries(EXPENSE_CATS).map(([k, v]) => (
              <button key={k} className={`chip ${f.category === k ? 'active' : ''}`} onClick={() => u('category', k)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="field"><label className="field-label">المبلغ *</label><input type="number" className="input" value={f.amount} onChange={(e) => u('amount', e.target.value)} /></div>
          <div className="field"><label className="field-label">العملة</label><select className="select" value={f.currency} onChange={(e) => u('currency', e.target.value)}>{CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
        </div>
        <div className="field"><label className="field-label">التاريخ</label><input type="date" className="input" value={f.date} onChange={(e) => u('date', e.target.value)} /></div>
        <div className="field"><label className="field-label">الوصف</label><input className="input" value={f.note} onChange={(e) => u('note', e.target.value)} placeholder="مثلاً: شحن جدة" /></div>
      </div>
    </Sheet>
  );
}

function SettingsSheet({ settings, setSettings, onClose, onShowAbout, onShowLogs }) {
  return (
    <Sheet title="الإعدادات" onClose={onClose} footer={<button className="btn btn-secondary btn-block" onClick={onClose}>إغلاق</button>}>
      <div className="detail-section-title">أسعار الصرف (1 = ؟ د.إ)</div>
      <div className="form-grid" style={{ marginBottom: 16 }}>
        {CURRENCIES.filter(c => c !== 'AED').map(c => (
          <div key={c} className="form-row" style={{ gridTemplateColumns: '80px 1fr' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13, color: 'var(--gold)' }}>{c}</div>
            <input type="number" className="input" step="0.0001" value={settings.fxRates[c] || 0} onChange={(e) => setSettings(s => ({ ...s, fxRates: { ...s.fxRates, [c]: Number(e.target.value) || 0 } }))} />
          </div>
        ))}
      </div>

      <div className="detail-section-title">حد التنبيه للمخزون (جم)</div>
      <input type="number" className="input" value={settings.lowStockThreshold} onChange={(e) => setSettings(s => ({ ...s, lowStockThreshold: Number(e.target.value) || 10 }))} />

      <div className="detail-section-title" style={{ marginTop: 24 }}>النظام</div>
      <button className="btn btn-secondary btn-block" onClick={onShowAbout} style={{ marginBottom: 8 }}>{I.info}<span>معلومات التطبيق والإصدارات</span></button>
      <button className="btn btn-secondary btn-block" onClick={onShowLogs}>{I.code}<span>سجل الأحداث ({loadLogs().length})</span></button>

      <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', padding: '24px 0 8px' }}>بن غيث للعود · إصدار {APP_VERSION}</div>
    </Sheet>
  );
}

function AboutSheet({ onClose }) {
  return (
    <Sheet title="معلومات التطبيق" onClose={onClose} footer={<button className="btn btn-secondary btn-block" onClick={onClose}>إغلاق</button>}>
      <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-soft)', marginBottom: 16, textAlign: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>الإصدار الحالي</div>
        <div style={{ fontSize: 32, fontWeight: 700, color: 'var(--gold)', fontFamily: 'var(--font-display)' }}>v{APP_VERSION}</div>
      </div>
      <div className="detail-section-title">سجل التحديثات (Patches)</div>
      {PATCH_HISTORY.map((p, i) => (
        <div key={i} style={{ padding: 14, background: 'var(--bg-card)', border: '1px solid var(--border-soft)', borderRadius: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gold)' }}>v{p.version}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{p.date}</span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0, lineHeight: 1.5 }}>{p.description}</p>
        </div>
      ))}
    </Sheet>
  );
}

function LogsSheet({ onClose }) {
  const [logs, setLogs] = useState(loadLogs());
  const [filter, setFilter] = useState('all');
  const filtered = filter === 'all' ? logs : logs.filter(l => l.type === filter);

  const exportLogs = () => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `bin-ghaith-logs-${todayISO()}.json`; a.click();
    URL.revokeObjectURL(url);
  };
  const clearAll = () => { if (confirm('حذف جميع السجلات؟')) { saveLogs([]); setLogs([]); } };
  const color = (t) => t === 'error' ? 'var(--red)' : t === 'warning' ? '#e8b44c' : t === 'transaction' ? 'var(--green)' : 'var(--text-muted)';
  const label = (t) => ({ all: 'الكل', error: 'أخطاء', warning: 'تحذيرات', info: 'معلومات', transaction: 'عمليات' })[t];

  return (
    <Sheet title={`سجل الأحداث (${filtered.length})`} onClose={onClose}
      footer={<><button className="btn btn-secondary" onClick={exportLogs}>{I.download}<span>تصدير</span></button><button className="btn btn-danger" onClick={clearAll}>{I.trash}<span>مسح</span></button></>}>
      <div className="chips" style={{ marginBottom: 12, flexWrap: 'wrap' }}>
        {['all', 'error', 'warning', 'info', 'transaction'].map(t => (
          <button key={t} className={`chip ${filter === t ? 'active' : ''}`} onClick={() => setFilter(t)}>{label(t)}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="empty"><div className="empty-icon">{I.code}</div><div className="empty-title">لا توجد سجلات</div></div>
      ) : filtered.map(log => (
        <div key={log.id} style={{ padding: 12, background: 'var(--bg-card)', border: `1px solid ${color(log.type)}40`, borderRadius: 10, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontSize: 10, padding: '2px 8px', background: `${color(log.type)}20`, color: color(log.type), borderRadius: 4, textTransform: 'uppercase' }}>{log.type}</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmtDateTime(log.timestamp)}</span>
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{log.message}</div>
          {Object.keys(log.details || {}).length > 0 && (
            <pre style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 6, fontSize: 10, color: 'var(--text-muted)', overflow: 'auto', maxHeight: 100 }}>{JSON.stringify(log.details, null, 2)}</pre>
          )}
        </div>
      ))}
    </Sheet>
  );
}

function App() {
  const [data, setData] = useState(loadData);
  const [settings, setSettings] = useState(loadSettings);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => { saveData(data); }, [data]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => {
    document.documentElement.lang = 'ar';
    document.documentElement.dir = 'rtl';
    addLog('info', `تشغيل التطبيق v${APP_VERSION}`);
  }, []);

  const stats = useStats(data, settings);

  const openSheet = (s) => setSheet(s);
  const closeSheet = () => setSheet(null);
  const askDelete = (type, id, label) => setConfirm({ type, id, label });

  const handleDelete = () => {
    if (!confirm) return;
    const { type, id, label } = confirm;
    setData(d => {
      const map = { product: 'products', supplier: 'suppliers', order: 'orders', purchase: 'purchases', expense: 'expenses' };
      const key = map[type];
      return { ...d, [key]: d[key].filter(x => x.id !== id) };
    });
    addLog('transaction', `حذف ${type}: ${label}`);
    setConfirm(null);
  };

  const save = (key, item) => {
    setData(d => {
      const exists = d[key].find(x => x.id === item.id);
      return { ...d, [key]: exists ? d[key].map(x => x.id === item.id ? item : x) : [...d[key], item] };
    });
    addLog('transaction', `حفظ ${key}: ${item.name || item.customerName || item.note || 'عنصر'}`);
  };

  const fabAction = () => {
    const map = { home: 'order', inventory: 'product', orders: 'order', suppliers: 'supplier', reports: 'expense' };
    openSheet({ type: map[tab] });
  };

  const renderSheet = () => {
    if (!sheet) return null;
    const { type, id } = sheet;
    if (type === 'product') {
      const initial = id ? data.products.find(p => p.id === id) : null;
      return <ProductForm initial={initial} onSave={(p) => save('products', p)} onClose={closeSheet} />;
    }
    if (type === 'supplier') {
      const initial = id ? data.suppliers.find(s => s.id === id) : null;
      return <SupplierForm initial={initial} onSave={(s) => save('suppliers', s)} onClose={closeSheet} />;
    }
    if (type === 'purchase') return <PurchaseForm data={data} settings={settings} onSave={(p) => save('purchases', p)} onClose={closeSheet} />;
    if (type === 'order') {
      const initial = id ? data.orders.find(o => o.id === id) : null;
      return <OrderForm initial={initial} data={data} settings={settings} onSave={(o) => save('orders', o)} onClose={closeSheet} />;
    }
    if (type === 'expense') {
      const initial = id ? data.expenses.find(e => e.id === id) : null;
      return <ExpenseForm initial={initial} onSave={(e) => save('expenses', e)} onClose={closeSheet} />;
    }
    return null;
  };

  return (
    <div className="app">
      <div className="topbar">
        <div className="brand">
          <div className="brand-mark">ب</div>
          <div className="brand-text">
            <div className="brand-name">بن غيث للعود</div>
            <div className="brand-tag">BIN GHAITH</div>
          </div>
        </div>
        <button className="icon-btn" onClick={() => setShowSettings(true)}>{I.settings}</button>
      </div>

      {tab === 'home' && <Dashboard data={data} settings={settings} stats={stats} setTab={setTab} />}
      {tab === 'inventory' && (
        <>
          <div style={{ padding: '0 16px' }}>
            <button className="btn btn-secondary btn-sm btn-block" onClick={() => openSheet({ type: 'purchase' })} style={{ marginBottom: 8 }}>+ تسجيل عملية شراء</button>
          </div>
          <InventoryPage data={data} settings={settings} stats={stats} openSheet={openSheet} askDelete={askDelete} />
        </>
      )}
      {tab === 'orders' && <OrdersPage data={data} settings={settings} openSheet={openSheet} askDelete={askDelete} />}
      {tab === 'suppliers' && <SuppliersPage data={data} settings={settings} openSheet={openSheet} askDelete={askDelete} />}
      {tab === 'reports' && <ReportsPage data={data} settings={settings} stats={stats} openSheet={openSheet} askDelete={askDelete} />}

      <button className="fab" onClick={fabAction}>{I.plus}</button>

      <div className="tabbar">
        <div className="tabbar-inner">
          {[
            { key: 'home', label: 'الرئيسية', icon: I.home },
            { key: 'inventory', label: 'المخزون', icon: I.box },
            { key: 'orders', label: 'الطلبات', icon: I.bag },
            { key: 'suppliers', label: 'الموردين', icon: I.truck },
            { key: 'reports', label: 'التقارير', icon: I.chart },
          ].map(t => (
            <button key={t.key} className={`tab ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
              <span className="tab-icon">{t.icon}</span>
              <span className="tab-label">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {renderSheet()}
      {showSettings && <SettingsSheet settings={settings} setSettings={setSettings} onClose={() => setShowSettings(false)} onShowAbout={() => { setShowSettings(false); setShowAbout(true); }} onShowLogs={() => { setShowSettings(false); setShowLogs(true); }} />}
      {showAbout && <AboutSheet onClose={() => setShowAbout(false)} />}
      {showLogs && <LogsSheet onClose={() => setShowLogs(false)} />}
      {confirm && <ConfirmDialog title="تأكيد الحذف" text={`حذف "${confirm.label}"؟ لا يمكن التراجع.`} onCancel={() => setConfirm(null)} onConfirm={handleDelete} />}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
