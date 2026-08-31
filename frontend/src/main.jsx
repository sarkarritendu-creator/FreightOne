import React, { useEffect, useMemo, useState } from 'react';
import ISTClock from './ISTClock'; 
import { createRoot } from 'react-dom/client';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, ArrowRight, BarChart3, Bell, Boxes, BrainCircuit,
  CheckCircle2, ChevronRight, Clock3, CloudRain, FileText, Factory,
  LogOut, MapPin, Navigation, Package, RefreshCw, Route, Ship,
  SlidersHorizontal, Sparkles, TrendingUp, UserRound
} from 'lucide-react';
import './styles.css';

const API = 'http://localhost:8000';

async function api(path, opts = {}, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${API}${path}`, {
      method: opts.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
      body: opts.body,
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Backend request timed out.');
    if (err instanceof TypeError) throw new Error('Cannot reach FreightOne backend.');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const money = n => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const fmt = n => Number(n || 0).toLocaleString('en-IN');

const titleMap = {
  dashboard: 'Command Center',
  procurement: 'Procurement Planner',
  freight: 'Freight Intelligence',
  optimizer: 'Port Optimizer',
  tracker: 'Consignment Tracker',
  simulation: 'What-if Simulation',
  alerts: 'Alert Center',
  inventory: 'Stock & Inventory',
  report: 'Executive Report',
};

/* -------------------------------------------------------------------------- */
/* Prototype fallback data.                                                   */
/* The UI will use the live backend whenever an endpoint exists; otherwise    */
/* these deterministic records keep every screen populated and demonstrable.  */
/* -------------------------------------------------------------------------- */

const DEMO_REFS = {
  materials: {
    coking_coal: {
      name: 'Coking Coal',
      daily_consumption: 9200,
      safety_days: 6,
    },
    iron_ore: {
      name: 'Iron Ore',
      daily_consumption: 10800,
      safety_days: 7,
    },
    limestone: {
      name: 'Limestone',
      daily_consumption: 4200,
      safety_days: 8,
    },
  },
  origins: {
    australia: { label: 'Australia', typical_transit_days: 17 },
    indonesia: { label: 'Indonesia', typical_transit_days: 14 },
    south_africa: { label: 'South Africa', typical_transit_days: 21 },
  },
  ports: {
    paradip: { name: 'Paradip', state: 'Odisha' },
    haldia: { name: 'Haldia', state: 'West Bengal' },
    vizag: { name: 'Visakhapatnam', state: 'Andhra Pradesh' },
  },
  plants: {
    RSP: {
      name: 'Rourkela Steel Plant',
      nearest_port: 'paradip',
      state: 'Odisha',
    }
  },
};

const DEMO_CONSIGNMENTS = [
  {
    id: 'SC-2198',
    plant: 'RSP',
    plant_label: 'Rourkela Steel Plant',
    material_label: 'Coking Coal',
    origin_label: 'Australia',
    port_label: 'Paradip',
    vessel: 'Capesize',
    ship_size: 'Capesize',
    status: 'Delayed',
    delay_days: 6,
    delay_reason: 'Port congestion at Paradip and berth rollover',
    risk_percentage: 78,
    progress: 62,
    position: 'Bay of Bengal · 165 km east of Paradip',
    eta_port_date: '02 Sep 2026',
    earliest_dispatch_from_port: '04 Sep 2026',
    expected_final_arrival: '06 Sep 2026',
    tonnage: 80000,
  },
  {
    id: 'SC-2214',
    plant: 'RSP',
    plant_label: 'Rourkela Steel Plant',
    material_label: 'Iron Ore',
    origin_label: 'Australia',
    port_label: 'Visakhapatnam',
    vessel: 'Panamax',
    ship_size: 'Panamax',
    status: 'On schedule',
    delay_days: 0,
    delay_reason: '',
    risk_percentage: 18,
    progress: 74,
    position: 'Approaching Visakhapatnam anchorage',
    eta_port_date: '31 Aug 2026',
    earliest_dispatch_from_port: '02 Sep 2026',
    expected_final_arrival: '04 Sep 2026',
    tonnage: 60000,
  },
  {
    id: 'SC-2206',
    plant: 'RSP',
    plant_label: 'Rourkela Steel Plant',
    material_label: 'Coking Coal',
    origin_label: 'Indonesia',
    port_label: 'Paradip',
    vessel: 'Panamax',
    ship_size: 'Panamax',
    status: 'Future',
    delay_days: 0,
    delay_reason: '',
    risk_percentage: 12,
    progress: 12,
    position: 'Loading at Balikpapan',
    eta_port_date: '12 Sep 2026',
    earliest_dispatch_from_port: '14 Sep 2026',
    expected_final_arrival: '17 Sep 2026',
    tonnage: 50000,
  },
  {
    id: 'SC-2187',
    plant: 'RSP',
    plant_label: 'Rourkela Steel Plant',
    material_label: 'Limestone',
    origin_label: 'South Africa',
    port_label: 'Haldia',
    vessel: 'Supramax',
    ship_size: 'Supramax',
    status: 'Delivered',
    delay_days: 0,
    delay_reason: '',
    risk_percentage: 0,
    progress: 100,
    position: 'Delivered to plant',
    eta_port_date: '14 Jul 2026',
    earliest_dispatch_from_port: '16 Jul 2026',
    expected_final_arrival: '19 Jul 2026',
    tonnage: 30000,
    delivered_date: '19 Jul 2026',
  },
  {
    id: 'SC-2173',
    plant: 'RSP',
    plant_label: 'Rourkela Steel Plant',
    material_label: 'Coking Coal',
    origin_label: 'Australia',
    port_label: 'Paradip',
    vessel: 'Capesize',
    ship_size: 'Capesize',
    status: 'Delivered',
    delay_days: 2,
    delay_reason: 'Berth congestion',
    risk_percentage: 0,
    progress: 100,
    position: 'Delivered to plant',
    eta_port_date: '28 Jul 2026',
    earliest_dispatch_from_port: '30 Jul 2026',
    expected_final_arrival: '02 Aug 2026',
    tonnage: 75000,
    delivered_date: '02 Aug 2026',
  },
];

const DEMO_BDI_HISTORY = Array.from({ length: 30 }, (_, i) => ({
  day: i + 1,
  index: 1320 + Math.round(32 * Math.sin(i / 4.3) + i * 2.4),
}));

const DEMO_BDI_FORECAST = Array.from({ length: 60 }, (_, i) => ({
  day: 31 + i,
  predicted: 1390 + Math.round(i * 1.7 + 20 * Math.sin(i / 7)),
  lower: 1368 + Math.round(i * 1.6),
  upper: 1415 + Math.round(i * 1.9),
}));

const DEMO_INVENTORY = [
  { id: 'coal-rsp', material: 'Coking Coal', stock_mt: 118000, daily_consumption: 9200, incoming_mt: 50000, days_cover: 12.8, urgency_index: 7, rating: 'WATCH' },
  { id: 'ore-rsp', material: 'Iron Ore', stock_mt: 164000, daily_consumption: 10800, incoming_mt: 60000, days_cover: 15.2, urgency_index: 5, rating: 'STABLE' },
  { id: 'lime-rsp', material: 'Limestone', stock_mt: 52000, daily_consumption: 4200, incoming_mt: 30000, days_cover: 12.4, urgency_index: 7, rating: 'WATCH' },
];

const DEMO_NEWS = [
  { title: 'Paradip berth congestion remains elevated', tags: ['PORT', 'RISK'], severity: 'amber' },
  { title: 'Bay of Bengal weather window under review', tags: ['WEATHER', 'ROUTE'], severity: 'amber' },
  { title: 'BDI softens versus last booking window', tags: ['MARKET'], severity: 'green' },
];

const DEMO_ALERTS = [
  {
    severity: 'high',
    type: 'CONSIGNMENT',
    title: 'SC-2198 is 6 days behind schedule',
    impact: 'Coking coal replenishment window at Rourkela is compressed.',
    action: 'Review alternate-port recovery before safety stock falls below threshold.',
  },
  {
    severity: 'medium',
    type: 'WEATHER',
    title: 'Bay of Bengal weather risk elevated',
    impact: 'Potential increase in sailing and anchorage uncertainty.',
    action: 'Keep alternate booking window available.',
  },
  {
    severity: 'low',
    type: 'MARKET',
    title: 'Freight market is moderately softer',
    impact: 'Near-term charter economics are currently less pressured.',
    action: 'Prefer disciplined booking rather than emergency procurement.',
  },
];

const DEMO_MATERIAL_PRICES = {
  coking_coal: [
    { country: 'Russia', price: 74 },
    { country: 'Indonesia', price: 78 },
    { country: 'Mozambique', price: 81 },
    { country: 'Australia', price: 92 },
    { country: 'USA', price: 88 },
  ],
  iron_ore: [
    { country: 'Australia', price: 106 },
    { country: 'Brazil', price: 101 },
    { country: 'South Africa', price: 103 },
  ],
  limestone: [
    { country: 'India', price: 31 },
    { country: 'Oman', price: 35 },
    { country: 'UAE', price: 38 },
  ],
};

function normalizeAuth(saved) {
  if (!saved || typeof saved !== 'object') return null;
  const manager = saved.manager || saved.user || null;
  if (!manager) return null;

  const plantCode =
    manager.plant ||
    manager.plant_code ||
    saved.plant?.code ||
    'RSP';

  const plant = saved.plant || DEMO_REFS.plants[plantCode] || DEMO_REFS.plants.RSP;

  return {
    manager: {
      ...manager,
      id: manager.id || manager.manager_id || manager.user_id || manager.employee_id || 'r.sharma',
      manager_id: manager.manager_id || manager.id || 'r.sharma',
      name: manager.name || manager.employee_name || 'R. Sharma',
      employee_id: manager.employee_id || 'SAIL-0421',
      rank: manager.rank || manager.rank_post || 'Deputy General Manager',
      plant: plantCode,
    },
    plant: {
      ...plant,
      code: plant.code || plantCode,
      name: plant.name || 'Rourkela Steel Plant',
    },
  };
}

function Login({ onLogin }) {
  const [id, setId] = useState('r.sharma');
  const [pw, setPw] = useState('sail123');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setErr('');
    try {
      const data = await api('/api/login', {
        method: 'POST',
        body: JSON.stringify({ manager_id: id.trim(), password: pw }),
      });
      onLogin(data.manager, data.plant);
    } catch (error) {
      setErr(error.message || 'Unable to sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login-left">
        <div className="brand">FREIGHT<span>ONE</span></div>
        <div className="eyebrow">INTELLIGENT PROCUREMENT & FREIGHT CONTROL</div>
        <h1>Make the decision before the market makes it for you.</h1>
        <p>Material-aware procurement, freight intelligence, port choice and contingency recovery in one decision workflow.</p>
        <div className="login-features">
          <span><BrainCircuit /> Decision intelligence</span>
          <span><Route /> Route optimization</span>
          <span><Bell /> Risk monitoring</span>
        </div>
      </div>

      <form className="login-card" onSubmit={submit}>
        <div className="eyebrow">MANAGER ACCESS</div>
        <h2>Sign in to FreightOne</h2>
        <p>Your access scope and plant context load automatically.</p>
        <label>Manager ID<input value={id} onChange={e => setId(e.target.value)} /></label>
        <label>Password<input type="password" value={pw} onChange={e => setPw(e.target.value)} /></label>
        {err && <div className="error">{err}</div>}
        <button className="primary full" disabled={loading}>
          {loading ? 'Authenticating…' : 'Sign in'} <ArrowRight size={16} />
        </button>
      </form>
    </div>
  );
}

function Shell({ auth, page, setPage, onLogout, children }) {
  const tabs = [
    ['dashboard', 'Command Center', BarChart3],
    ['procurement', 'Procurement Planner', Boxes],
    ['freight', 'Freight Intelligence', TrendingUp],
    ['optimizer', 'Port Optimizer', Route],
    ['tracker', 'Consignment Tracker', Ship],
    ['simulation', 'What-if Simulation', SlidersHorizontal],
    ['alerts', 'Alert Center', Bell],
    ['inventory', 'Stock & Inventory', Package],
    ['report', 'Executive Report', FileText],
  ];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="side-brand">
          <div className="brand-mark"><Navigation size={20} /></div>
          <div><b>FreightOne</b><small>AI LOGISTICS INTELLIGENCE</small></div>
        </div>

        <div className="posting">
          <span>ACTIVE POSTING</span>
          <b>{auth?.plant?.name || 'Rourkela Steel Plant'}</b>
          <small>{auth?.manager?.rank || 'Manager'}</small>
        </div>

        <nav>
          {tabs.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}>
              <Icon size={16} />
              <span>{label}</span>
              <ChevronRight size={14} />
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <div className="profile-mini">
            <div className="avatar"><UserRound size={17} /></div>
            <div>
              <b>{auth?.manager?.name || 'R. Sharma'}</b>
              <small>{auth?.manager?.employee_id || 'SAIL-0421'}</small>
            </div>
          </div>
          <div className="risk-mini"><span /> Network risk <b>68</b></div>
          <button className="signout" onClick={onLogout}><LogOut size={14} /> Sign out</button>
        </div>
      </aside>

      <section className="shell-main">
        <header className="topbar">
          <div>
            <span className="eyebrow">FREIGHTONE / {titleMap[page].toUpperCase()}</span>
            <h2>{titleMap[page]}</h2>
          </div>
          <div className="top-status"><span className="status-dot" /> <ISTClock /></div>
        </header>
        <main>{children}</main>
      </section>
    </div>
  );
}

function PageHead({ eyebrow, title, desc, action }) {
  return (
    <div className="page-head">
      <div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{desc}</p></div>
      {action}
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, tone = 'blue' }) {
  return (
    <div className="kpi">
      <div className={`kpi-icon ${tone}`}><Icon size={18} /></div>
      <div><small>{label}</small><b>{value}</b><span>{sub}</span></div>
    </div>
  );
}

function Chart({ data = [], height = 280 }) {
  const rows = Array.isArray(data) ? data : [];
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={rows}>
        <CartesianGrid stroke="#2d3e5b" strokeDasharray="4 4" vertical={false} />
        <XAxis dataKey="day" tick={{ fill: '#90a3bd', fontSize: 10 }} />
        <YAxis tick={{ fill: '#90a3bd', fontSize: 10 }} />
        <Tooltip contentStyle={{ background: '#142541', border: '1px solid #31496e' }} />
        <Line dataKey="index" stroke="#4d95ef" strokeWidth={2} dot={false} />
        <Line dataKey="predicted" stroke="#edb353" strokeWidth={2} strokeDasharray="6 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function CommandCenter({ auth, setPage }) {
  const [forecast, setForecast] = useState({ history: DEMO_BDI_HISTORY, forecast: DEMO_BDI_FORECAST });
  const [risk, setRisk] = useState({ risk_score: 68, risk_level: 'amber', items: DEMO_NEWS });
  const [cons, setCons] = useState(DEMO_CONSIGNMENTS);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      api('/api/forecast'),
      api('/api/risk-score'),
      api('/api/consignments?plant_code=' + encodeURIComponent(auth.manager.plant)),
    ]).then(results => {
      if (!alive) return;
      if (results[0].status === 'fulfilled' && results[0].value) setForecast(results[0].value);
      if (results[1].status === 'fulfilled' && results[1].value) setRisk(results[1].value);
      if (results[2].status === 'fulfilled' && Array.isArray(results[2].value?.consignments)) {
        setCons(results[2].value.consignments);
      }
    });
    return () => { alive = false; };
  }, [auth.manager.plant]);

  const chart = [
    ...(Array.isArray(forecast?.history) ? forecast.history.slice(-30) : DEMO_BDI_HISTORY),
    ...(Array.isArray(forecast?.forecast) ? forecast.forecast.slice(0, 45) : DEMO_BDI_FORECAST.slice(0, 45)),
  ];
  const delayed = cons.filter(c => String(c.status || '').toLowerCase() === 'delayed').length;

  return (
    <div className="page">
      <PageHead
        eyebrow="COMMAND CENTER"
        title={`Good morning, ${auth.plant.name}`}
        desc="One view across procurement, freight, route risk and live shipments."
        action={<button className="secondary" onClick={() => window.location.reload()}><RefreshCw size={14} /> Refresh intelligence</button>}
      />

      <section className="kpis">
        <KPI label="ACTIVE CONSIGNMENTS" value={cons.filter(c => String(c.status).toLowerCase() !== 'future' && String(c.status).toLowerCase() !== 'delivered').length} sub={`${delayed} delayed`} icon={Ship} />
        <KPI label="NETWORK RISK" value={risk ? `${risk.risk_score}/100` : '—'} sub={risk?.risk_level || 'Loading'} icon={Bell} tone="orange" />
        <KPI label="LIVE MATERIAL" value="Coking Coal" sub="Selected lane" icon={Package} tone="orange" />
        <KPI label="AI PROCUREMENT SIGNAL" value="MONITOR" sub="Freight risk elevated" icon={BrainCircuit} tone="green" />
      </section>

      <div className="grid two">
        <section className="panel">
          <div className="panel-head">
            <div><h3>Freight market intelligence</h3><p>Historical rate trajectory with the current model horizon.</p></div>
            <span className="live-tag"><i />LIVE</span>
          </div>
          <Chart data={chart} />
        </section>

        <section className="panel">
          <div className="panel-head"><div><h3>Live intelligence</h3><p>News → risk → procurement action.</p></div></div>
          <div className="decision hold">
            <div className="decision-icon"><BrainCircuit size={20} /></div>
            <div>
              <span className="eyebrow">AI PROCUREMENT SIGNAL</span>
              <h2>Monitor — no immediate buy</h2>
              <p>Current stock cover is adequate, but freight and weather exposure should be reviewed before the next booking.</p>
            </div>
          </div>
          <div className="news-list">
            {(risk?.items?.length ? risk.items : DEMO_NEWS).map((n, i) => (
              <div className="news-item" key={i}>
                <span>LIVE</span>
                <b>{n.title || n.text}</b>
                <small>{Array.isArray(n.tags) ? n.tags.join(' · ') : 'MARKET · RISK'}</small>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="panel">
        <div className="panel-head">
          <div><h3>Current consignments</h3><p>Vessel → port → plant. Delayed shipments open the recovery path.</p></div>
          <button className="secondary small" onClick={() => setPage('tracker')}>Open tracker <ChevronRight size={14} /></button>
        </div>
        <div className="cons-grid">
          {cons.filter(c => String(c.status).toLowerCase() !== 'future').slice(0, 4).map(c => (
            <div className="cons-card" key={c.id}>
              <div className="cons-top">
                <div><b>{c.id}</b><span>{c.material_label || c.material || 'Material'} · {c.origin_label || c.origin} → {c.port_label || c.port}</span></div>
                <em className={`status ${String(c.status).toLowerCase() === 'delayed' ? 'delayed' : 'on_schedule'}`}>
                  {String(c.status).toLowerCase() === 'delayed' ? `Delayed ${c.delay_days || 0}d` : (c.status || 'On schedule')}
                </em>
              </div>
              <div className="route-line"><Ship size={13} /><i />Port<i />Plant</div>
              <div className="cons-metrics">
                <div><small>Port ETA</small><b>{c.eta_port_date || c.port_eta || '—'}</b></div>
                <div><small>Dispatch</small><b>{c.earliest_dispatch_from_port || c.earliest_dispatch || '—'}</b></div>
                <div><small>Final arrival</small><b>{c.expected_final_arrival || c.final_arrival || '—'}</b></div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, help, children }) {
  return <label className="field"><b>{label}</b>{children}<small>{help}</small></label>;
}

function Procurement({ auth }) {
  const [refs, setRefs] = useState(DEMO_REFS);
  const [material, setMaterial] = useState('coking_coal');
  const [qty, setQty] = useState(80000);
  const [deadline, setDeadline] = useState(21);
  const [port, setPort] = useState('paradip');
  const [priority, setPriority] = useState(55);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/api/reference-data').then(data => {
      if (data?.materials || data?.ports) setRefs({
        ...DEMO_REFS,
        ...data,
      });
    }).catch(() => {});
  }, []);

  async function run() {
    setMessage('');
    try {
      const live = await api('/api/procurement-plan', {
        method: 'POST',
        body: JSON.stringify({
          material,
          quantity: Number(qty),
          deadline_days: Number(deadline),
          preferred_port: port,
          priority,
          plant_code: auth.manager.plant,
        }),
      });
      setResult(live);
    } catch {
      const mat = refs.materials?.[material] || DEMO_REFS.materials[material];
      const stock = DEMO_INVENTORY.find(x => x.material.toLowerCase().replace(' ', '_') === material) || DEMO_INVENTORY[0];
      const cover = Number(stock.days_cover || (stock.stock_mt / stock.daily_consumption));
      const urgency = cover < 8 ? 9 : cover < 14 ? 7 : 4;
      const modelQty = urgency >= 8 ? Math.round(qty * 1.15 / 5000) * 5000 : Math.round(qty / 5000) * 5000;
      const bestPort = urgency >= 8 ? 'Paradip' : 'Visakhapatnam';
      setResult({
        material: mat.name,
        manager_preference: {
          quantity_mt: Number(qty),
          deadline_days: Number(deadline),
          preferred_port: refs.ports?.[port]?.name || port,
        },
        model_output: {
          recommended_port: bestPort,
          recommended_quantity_mt: modelQty,
          urgency_index: urgency,
          days_of_cover: cover.toFixed(1),
          reason: `Model balances projected consumption, safety stock, freight pressure and the selected deadline. Preferred port remains ${refs.ports?.[port]?.name || port}.`,
        },
      });
      setMessage('Prototype model view — backend procurement-plan endpoint is not available in the current API, so this screen is using deterministic prototype calculations.');
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="PROCUREMENT INTELLIGENCE" title="Tell the system what material you need." desc="Your preference is preserved separately from the model recommendation." action={<button className="primary" onClick={run}>Run procurement plan <Sparkles size={15} /></button>} />
      {message && <div className="prototype-note">{message}</div>}
      <section className="panel">
        <div className="form-grid">
          <Field label="Material" help="Changes inventory, consumption and supplier assumptions.">
            <select value={material} onChange={e => setMaterial(e.target.value)}>
              {Object.entries(refs.materials || DEMO_REFS.materials).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </Field>
          <Field label="Quantity" help="Manager-requested purchase volume.">
            <div className="unit-input"><input type="number" value={qty} onChange={e => setQty(e.target.value)} /><span>MT</span></div>
          </Field>
          <Field label="Delivery deadline" help="Required final-arrival window.">
            <input type="number" value={deadline} onChange={e => setDeadline(e.target.value)} />
          </Field>
          <Field label="Preferred port" help="The model evaluates your preference instead of blindly following it.">
            <select value={port} onChange={e => setPort(e.target.value)}>
              {Object.entries(refs.ports || DEMO_REFS.ports).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="priority-box">
          <div><b>Cost ↔ deadline preference</b><small>Move toward cost to favor lower landed cost, or deadline to favor faster delivery.</small></div>
          <div className="priority-control"><span>Cost</span><input type="range" min="0" max="100" value={priority} onChange={e => setPriority(+e.target.value)} /><span>Deadline</span></div>
        </div>
      </section>

      {result && (
        <div className="grid two">
          <section className="panel preference">
            <div className="panel-label">MANAGER PREFERENCE</div>
            <div className="scenario">
              <b>{result.material}</b>
              <div><span>Quantity</span><strong>{fmt(result.manager_preference.quantity_mt)} MT</strong></div>
              <div><span>Deadline</span><strong>{result.manager_preference.deadline_days} days</strong></div>
              <div><span>Port</span><strong>{result.manager_preference.preferred_port}</strong></div>
            </div>
          </section>
          <section className="panel model">
            <div className="panel-label">AI / MODEL OUTPUT</div>
            <div className="scenario">
              <b>{result.model_output.recommended_port}</b>
              <div><span>Recommended quantity</span><strong>{fmt(result.model_output.recommended_quantity_mt)} MT</strong></div>
              <div><span>Urgency index</span><strong>{result.model_output.urgency_index}/10</strong></div>
              <div><span>Days of cover</span><strong>{result.model_output.days_of_cover}</strong></div>
            </div>
            <p className="reason">{result.model_output.reason}</p>
          </section>
        </div>
      )}
    </div>
  );
}

function FreightPage() {
  const [data, setData] = useState(null);
  const [weather, setWeather] = useState(null);

  useEffect(() => {
    Promise.allSettled([api('/api/freight-intelligence'), api('/api/weather')]).then(([f, w]) => {
      setData(f.status === 'fulfilled' ? f.value : null);
      setWeather(w.status === 'fulfilled' ? w.value : null);
    });
  }, []);

  const forecast = data?.forecast || { history: DEMO_BDI_HISTORY, forecast: DEMO_BDI_FORECAST };
  const chart = [
    ...(Array.isArray(forecast.history) ? forecast.history.slice(-30) : DEMO_BDI_HISTORY),
    ...(Array.isArray(forecast.forecast) ? forecast.forecast.slice(0, 60) : DEMO_BDI_FORECAST),
  ];
  const weatherSeries = weather?.series || Array.from({ length: 14 }, (_, i) => ({ day: i + 1, risk: Math.round(38 + 18 * Math.sin(i / 2.2)) }));
  const weatherRisk = weather?.risk || { no_delay: 42, slight: 28, moderate: 20, high: 10 };

  return (
    <div className="page">
      <PageHead eyebrow="FREIGHT MARKET INTELLIGENCE" title="Market signals before the booking window closes." desc="BDI trend, forecast horizon, weather exposure and booking timing in one view." />
      <div className="grid two">
        <section className="panel">
          <div className="panel-head"><div><h3>BDI history + 90-day model horizon</h3><p>Historical freight movement and the current forecast.</p></div></div>
          <Chart data={chart} />
        </section>
        <section className="panel">
          <h3>Recommended booking window</h3>
          <div className="decision buy">
            <div className="decision-icon"><Clock3 size={20} /></div>
            <div>
              <span className="eyebrow">MODEL TIMING OUTPUT</span>
              <h2>Book around day {data?.booking_window?.best_day || 18}</h2>
              <p>{data?.booking_window?.reason || 'The current prototype balances projected freight rate, weather risk and procurement lead time.'} Estimated saving opportunity: {data?.booking_window?.expected_savings_percent || 4.2}%.</p>
            </div>
          </div>
          <div className="index-grid">
            {Object.entries(data?.indices || { BDI: 1398, Capesize: 21400, Panamax: 14200, Fuel: 684, Congestion: 61 }).map(([k, v]) => <div key={k}><small>{k}</small><b>{v}</b></div>)}
          </div>
        </section>
      </div>
      <section className="panel weather-panel">
        <div className="panel-head"><div><h3>How is the weather today at Bay of Bengal?</h3><p>{weather?.status || 'Prototype weather risk derived from regional disruption scenarios.'}</p></div><CloudRain size={22} /></div>
        <div className="weather-grid">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={weatherSeries}>
              <CartesianGrid stroke="#2d3e5b" strokeDasharray="4 4" />
              <XAxis dataKey="day" tick={{ fill: '#90a3bd', fontSize: 10 }} />
              <YAxis tick={{ fill: '#90a3bd', fontSize: 10 }} />
              <Line dataKey="risk" stroke="#edb353" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
          <div className="risk-bars">
            {Object.entries(weatherRisk).map(([k, v]) => <div key={k}><span className={`risk-color ${k}`} /><b>{k.replace('_', ' ')}</b><em>{v}%</em></div>)}
          </div>
        </div>
      </section>
    </div>
  );
}

function Optimizer({ auth }) {
  const [refs, setRefs] = useState(DEMO_REFS);
  const [material, setMaterial] = useState('coking_coal');
  const [origin, setOrigin] = useState('australia');
  const [port, setPort] = useState('paradip');
  const [tonnage, setTonnage] = useState(80000);
  const [priority, setPriority] = useState(55);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api('/api/reference-data').then(data => {
      if (data) setRefs({ ...DEMO_REFS, ...data });
    }).catch(() => {});
  }, []);

  async function run() {
    setMessage('');
    const payload = {
      tonnage: Number(tonnage),
      origin,
      preferred_port: port,
      priority,
      plant_code: auth.manager.plant,
      final_delivery: { mode: 'plant' },
    };
    try {
      const live = await api('/api/route-options', { method: 'POST', body: JSON.stringify(payload) });
      const options = Array.isArray(live.options) ? live.options : [];
      const preferred = live.preferred || options.find(o => o.port_id === port) || options[0];
      const best = options[0] || preferred;
      setResult({
        selected_port: preferred || { port: refs.ports?.[port]?.name || port, vessel: '—', congestion: '—', eta_days: '—', total_cost: 0, risk_score: 0 },
        options: options.map((o, i) => ({
          ...o,
          optimization_rank: i + 1,
          tags: o.tags?.length ? o.tags : (i === 0 ? ['AI Recommended'] : []),
        })),
        better_alternative: live.better_alternative || null,
        best_overall: best,
      });
    } catch {
      const names = { paradip: 'Paradip', haldia: 'Haldia', vizag: 'Visakhapatnam' };
      const base = names[port] || port;
      const generated = [
        { port_id: 'paradip', port: 'Paradip', optimization_rank: 1, cost_per_mt: 64.2, eta_days: 24, risk_score: 28, vessel: 'Capesize', congestion: 'Low', tags: ['AI Recommended'] },
        { port_id: 'haldia', port: 'Haldia', optimization_rank: 2, cost_per_mt: 67.8, eta_days: 27, risk_score: 36, vessel: 'Panamax', congestion: 'Medium', tags: [] },
        { port_id: 'vizag', port: 'Visakhapatnam', optimization_rank: 3, cost_per_mt: 71.4, eta_days: 29, risk_score: 44, vessel: 'Panamax', congestion: 'High', tags: [] },
      ];
      const pref = generated.find(x => x.port_id === port) || generated[0];
      setResult({
        selected_port: { ...pref, port: base, total_cost: pref.cost_per_mt * Number(tonnage), },
        options: generated.map(x => ({ ...x, tags: x.port_id === port ? ['Your Preference'] : x.tags })),
        better_alternative: pref.port_id !== 'paradip'
          ? { port: 'Paradip', message: 'Paradip offers the better prototype landed-cost and congestion balance.', cost_saving_pct: 5.6, time_saved_days: 3 }
          : null,
        best_overall: generated[0],
      });
      setMessage('Prototype route ranking — live /api/route-options was unavailable, so this view is using deterministic sample scenarios.');
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="PORT PREFERENCE OPTIMIZER" title="Evaluate the preference. Then show the better option." desc="The manager chooses the preferred port; FreightOne ranks all feasible alternatives." action={<button className="primary" onClick={run}>Evaluate route <Route size={15} /></button>} />
      {message && <div className="prototype-note">{message}</div>}
      <section className="panel">
        <div className="form-grid">
          <Field label="Material" help="Changes cargo economics."><select value={material} onChange={e => setMaterial(e.target.value)}>{Object.entries(refs.materials || DEMO_REFS.materials).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
          <Field label="Origin" help="Changes sailing time and sea-cost multiplier."><select value={origin} onChange={e => setOrigin(e.target.value)}>{Object.entries(refs.origins || DEMO_REFS.origins).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Manager preferred port" help="Shown separately from the system ranking."><select value={port} onChange={e => setPort(e.target.value)}>{Object.entries(refs.ports || DEMO_REFS.ports).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
          <Field label="Cargo size" help="Used for vessel feasibility."><div className="unit-input"><input type="number" value={tonnage} onChange={e => setTonnage(e.target.value)} /><span>MT</span></div></Field>
        </div>
        <div className="priority-box">
          <div><b>Cost ↔ deadline preference</b><small>Controls the trade-off used in route ranking.</small></div>
          <div className="priority-control"><span>Cost</span><input type="range" min="0" max="100" value={priority} onChange={e => setPriority(+e.target.value)} /><span>Deadline</span></div>
        </div>
      </section>

      {result && <>
        <section className="featured-route">
          <div><div className="panel-label">MANAGER PREFERENCE</div><h2>{result.selected_port.port}</h2><p>{result.selected_port.vessel} · {result.selected_port.congestion || '—'} congestion · ETA {result.selected_port.eta_days} days</p></div>
          <div className="route-stats"><div><small>Landed cost</small><b>{money(result.selected_port.total_cost)}</b></div><div><small>Risk</small><b>{result.selected_port.risk_score}/100</b></div></div>
        </section>
        <section className="panel">
          <div className="panel-head"><div><h3>True optimization ranking</h3><p>All feasible ports ranked by landed cost, ETA, congestion and risk.</p></div></div>
          <div className="rank-list">
            {result.options.map(o => <div className={`rank-item ${o.optimization_rank === 1 ? 'selected' : ''}`} key={o.port_id}><div className="rank-num">#{o.optimization_rank}</div><div className="rank-main"><h3>{o.port}</h3><span>{(o.tags || []).join(' · ')}</span></div><div><small>Cost / MT</small><b>{money(o.cost_per_mt)}</b></div><div><small>ETA</small><b>{o.eta_days}d</b></div><div><small>Risk</small><b>{o.risk_score}</b></div></div>)}
          </div>
        </section>
        {result.better_alternative && <div className="alternate-alert"><AlertTriangle size={16} /><div><b>Better system alternative: {result.better_alternative.port}</b><p>{result.better_alternative.message}</p></div></div>}
      </>}
    </div>
  );
}

function Tracker({ auth }) {
  const [cons, setCons] = useState(DEMO_CONSIGNMENTS);
  const [view, setView] = useState('active');
  const [selected, setSelected] = useState(null);
  const [reroute, setReroute] = useState(null);

  useEffect(() => {
    let alive = true;
    api('/api/consignments?plant_code=' + encodeURIComponent(auth.manager.plant))
      .then(data => {
        if (!alive) return;
        if (Array.isArray(data?.consignments)) setCons(data.consignments);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [auth.manager.plant]);

  const visible = useMemo(() => {
    const status = view === 'past'
      ? ['delivered', 'past', 'completed']
      : view === 'future'
      ? ['future', 'planned', 'booked']
      : ['active', 'on schedule', 'delayed'];
    const filtered = cons.filter(c => {
      const s = String(c.status || '').toLowerCase();
      return status.includes(s);
    });
    if (view === 'past') return filtered.filter(c => !c.delivered_date || String(c.delivered_date).slice(0, 7) >= '2026-07');
    return filtered;
  }, [cons, view]);

  async function rerouteFn() {
    if (!selected) return;
    try {
      setReroute(await api('/api/reroute-suggestion', { method: 'POST', body: JSON.stringify({ consignment_id: selected.id }) }));
    } catch {
      setReroute({
        suggestion: {
          recommended_port: 'Haldia',
          estimated_recovery_days: 3,
          risk_reduction: 27,
          additional_cost: 1450000,
          message: 'Divert a portion through Haldia and secure an earlier inland rail slot.',
        },
      });
    }
  }

  return (
    <div className="page">
      <PageHead
        eyebrow="CONSIGNMENT CONTROL"
        title="Track. Detect. Recover."
        desc="Role-scoped shipment visibility with delay analysis and contingency recovery."
        action={<div className="select-inline"><span>Consignments</span><select value={view} onChange={e => setView(e.target.value)}><option value="active">Active</option><option value="past">Past</option><option value="future">Future</option></select></div>}
      />
      <div className="tracker-grid">
        <section className="panel">
          <div className="panel-head"><h3>Shipments</h3><span className="muted">{visible.length} shown</span></div>
          {visible.map(c => (
            <button className={`tracker-card ${selected?.id === c.id ? 'selected' : ''}`} key={c.id} onClick={() => { setSelected(c); setReroute(null); }}>
              <div className="tracker-top"><div><b>{c.id}</b><span>{c.material_label || c.material} · {c.origin_label || c.origin} → {c.port_label || c.port}</span></div><em className={`status ${String(c.status).toLowerCase() === 'delayed' ? 'delayed' : 'on_schedule'}`}>{String(c.status).toLowerCase() === 'delayed' ? `Delayed ${c.delay_days || 0}d` : c.status}</em></div>
              <div className="progress"><span style={{ width: `${c.progress || 0}%` }} /></div>
              <div className="cons-metrics"><div><small>Port ETA</small><b>{c.eta_port_date || '—'}</b></div><div><small>Dispatch</small><b>{c.earliest_dispatch_from_port || '—'}</b></div><div><small>Final arrival</small><b>{c.expected_final_arrival || '—'}</b></div></div>
            </button>
          ))}
        </section>
        <aside className="panel side-panel">
          {selected ? <>
            <div className="panel-label">SHIPMENT DETAILS TRACKING</div>
            <h2>{selected.id}</h2>
            <div className="map-box"><MapPin size={26} /><b>{selected.position || 'Bay of Bengal / transit leg'}</b><small>Prototype position marker · live AIS-ready architecture</small></div>
            <div className="timeline"><div><span>VESSEL</span><b>{selected.vessel}</b><small>{selected.origin_label}</small></div><i /><div className={String(selected.status).toLowerCase() === 'delayed' ? 'warn' : ''}><span>PORT</span><b>{selected.port_label}</b><small>{selected.eta_port_date}</small></div><i /><div><span>FINAL DELIVERY</span><b>{selected.plant_label}</b><small>{selected.expected_final_arrival}</small></div></div>
            {String(selected.status).toLowerCase() === 'delayed' && <>
              <div className="issue big"><AlertTriangle size={15} /><div><b>{selected.delay_reason || 'Operational delay detected'}</b><span>Risk index: {selected.risk_percentage || 0}%</span></div></div>
              <button className="primary full" onClick={rerouteFn}><Navigation size={15} /> Find reroute options</button>
              {reroute?.suggestion && <div className="recovery"><b>Recommended: {reroute.suggestion.recommended_port}</b><p>{reroute.suggestion.message}</p><div className="recovery-grid"><div><small>Recovery</small><b>{reroute.suggestion.estimated_recovery_days} days</b></div><div><small>Risk reduction</small><b>{reroute.suggestion.risk_reduction}%</b></div><div><small>Additional cost</small><b>{money(reroute.suggestion.additional_cost)}</b></div></div></div>}
            </>}
          </> : <div className="empty-side"><Ship size={25} /><b>Select a consignment</b><span>Tracking, delay analysis and recovery options appear here.</span></div>}
        </aside>
      </div>
    </div>
  );
}

function Simulation({ auth }) {
  const [refs, setRefs] = useState(DEMO_REFS);
  const [material, setMaterial] = useState('coking_coal');
  const [origin, setOrigin] = useState('australia');
  const [port, setPort] = useState('vizag');
  const [tonnage, setTonnage] = useState(150000);
  const [priority, setPriority] = useState(45);
  const [result, setResult] = useState(null);

  useEffect(() => { api('/api/reference-data').then(data => data && setRefs({ ...DEMO_REFS, ...data })).catch(() => {}); }, []);

  async function run() {
    const payload = { tonnage: Number(tonnage), origin, preferred_port: port, priority, plant_code: auth.manager.plant, final_delivery: { mode: 'plant' } };
    try {
      const live = await api('/api/route-options', { method: 'POST', body: JSON.stringify(payload) });
      const options = live.options || [];
      const base = live.preferred || options.find(x => x.port_id === port) || options[0];
      const best = options[0] || base;
      setResult({ base, what_if: best });
    } catch {
      setResult({
        base: { port: refs.ports?.[port]?.name || 'Visakhapatnam', total_cost: 10860000, eta_days: 29 },
        what_if: { port: 'Paradip', total_cost: 10120000, eta_days: 25 },
      });
    }
  }

  return (
    <div className="page">
      <PageHead eyebrow="WHAT-IF LAB" title="Change the assumptions. Watch the decision move." desc="No booking is submitted; this page compares the manager scenario with the best available alternative." action={<button className="primary" onClick={run}>Run simulation <SlidersHorizontal size={15} /></button>} />
      <section className="panel">
        <div className="form-grid">
          <Field label="Material" help="Scenario cargo."><select value={material} onChange={e => setMaterial(e.target.value)}>{Object.entries(refs.materials || DEMO_REFS.materials).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
          <Field label="Origin" help="Changes sea cost and transit."><select value={origin} onChange={e => setOrigin(e.target.value)}>{Object.entries(refs.origins || DEMO_REFS.origins).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field>
          <Field label="Port preference" help="Base scenario."><select value={port} onChange={e => setPort(e.target.value)}>{Object.entries(refs.ports || DEMO_REFS.ports).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</select></Field>
          <Field label="Tonnage" help="Scenario volume."><div className="unit-input"><input type="number" value={tonnage} onChange={e => setTonnage(e.target.value)} /><span>MT</span></div></Field>
        </div>
        <div className="priority-box"><div><b>Cost ↔ deadline</b><small>Compare cost, time and risk sensitivity.</small></div><div className="priority-control"><span>Cost</span><input type="range" min="0" max="100" value={priority} onChange={e => setPriority(+e.target.value)} /><span>Deadline</span></div></div>
      </section>
      {result && <div className="grid two"><section className="panel preference"><div className="panel-label">BASE</div><div className="scenario"><b>{result.base?.port}</b><div><span>Landed cost</span><strong>{money(result.base?.total_cost)}</strong></div><div><span>ETA</span><strong>{result.base?.eta_days} days</strong></div></div></section><section className="panel model"><div className="panel-label">WHAT-IF BEST ALTERNATIVE</div><div className="scenario"><b>{result.what_if?.port}</b><div><span>Landed cost</span><strong>{money(result.what_if?.total_cost)}</strong></div><div><span>ETA</span><strong>{result.what_if?.eta_days} days</strong></div></div></section></div>}
    </div>
  );
}

function Alerts() {
  const [data, setData] = useState(DEMO_ALERTS);
  useEffect(() => { api('/api/alerts').then(d => Array.isArray(d?.alerts) && setData(d.alerts)).catch(() => {}); }, []);
  return <div className="page"><PageHead eyebrow="ALERT CENTER" title="Turn signals into actions." desc="Each alert states the impact, affected area and recommended management action." /><section className="alert-list">{data.map((a, i) => <div className={`alert-card ${a.severity}`} key={i}><div className="alert-icon"><AlertTriangle size={18} /></div><div><span className="panel-label">{a.type} · {String(a.severity).toUpperCase()}</span><h3>{a.title}</h3><p><b>Impact:</b> {a.impact}</p><p><b>Recommended action:</b> {a.action}</p></div></div>)}</section></div>;
}

function Inventory({ auth }) {
  const [data, setData] = useState(DEMO_INVENTORY);
  useEffect(() => {
    api('/api/inventory?plant_code=' + encodeURIComponent(auth.manager.plant)).then(d => {
      if (Array.isArray(d?.items)) setData(d.items);
    }).catch(() => {});
  }, [auth.manager.plant]);

  return <div className="page"><PageHead eyebrow="STOCK & INVENTORY" title="Inventory continuity before shortage becomes a crisis." desc="Stock, consumption, incoming consignments and urgency are evaluated together." /><section className="inventory-grid">{data.map(i => <div className="inventory-card" key={i.id || i.material}><div className="panel-head"><div><span className="panel-label">{i.rating || 'WATCH'}</span><h3>{i.material}</h3></div><b className="urgency">{i.urgency_index || 5}/10</b></div><div className="stock-number">{fmt(i.stock_mt)} <span>MT</span></div><div className="inventory-metrics"><div><small>Daily consumption</small><b>{fmt(i.daily_consumption)} MT</b></div><div><small>Days cover</small><b>{i.days_cover}</b></div><div><small>Incoming</small><b>{fmt(i.incoming_mt)} MT</b></div></div><div className="stock-bar"><span style={{ width: `${Math.min(100, Number(i.days_cover || 0) * 2)}%` }} /></div></div>)}</section></div>;
}

function Report() {
  const [data, setData] = useState({
    summary: { network_risk: 68, active_consignments: 2, delayed_consignments: 1, inventory_watch: 2 },
    decisions: [
      'Review recovery for SC-2198 before coal cover drops below safety threshold.',
      'Use the next booking window to protect September coking-coal replenishment.',
      'Keep Paradip as preferred entry point while monitoring weather and berth congestion.',
    ],
    generated_on: new Date().toLocaleDateString('en-IN'),
  });

  useEffect(() => {
    api('/api/executive-report').then(d => d && setData(d)).catch(() => {});
  }, []);

  return <div className="page"><PageHead eyebrow="EXECUTIVE REPORT" title="Decision summary for management." desc="A concise operational picture of cost, risk, shipment continuity and required actions." /><section className="report-hero"><div><span className="panel-label">NETWORK RISK</span><b>{data?.summary?.network_risk ?? '—'}/100</b></div><div><span className="panel-label">ACTIVE CONSIGNMENTS</span><b>{data?.summary?.active_consignments ?? '—'}</b></div><div><span className="panel-label">DELAYED</span><b>{data?.summary?.delayed_consignments ?? '—'}</b></div><div><span className="panel-label">INVENTORY WATCH</span><b>{data?.summary?.inventory_watch ?? '—'}</b></div></section><section className="panel"><div className="panel-label">PRIORITY DECISIONS</div><div className="decision-list">{(data?.decisions || []).map((d, i) => <div key={i}><span>0{i + 1}</span><b>{d}</b></div>)}</div><small className="muted">Generated for prototype management review · {data?.generated_on}</small></section></div>;
}

function FreightOneErrorBoundary({ children }) {
  class Boundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null }; }
    static getDerivedStateFromError(error) { return { error }; }
    componentDidCatch(error, info) { console.error('FreightOne UI error', error, info); }
    render() {
      if (!this.state.error) return this.props.children;
      return (
        <div className="page">
          <section className="panel error-panel">
            <div className="eyebrow">RECOVERABLE UI ERROR</div>
            <h1>This view hit an unexpected state.</h1>
            <p className="muted">{this.state.error?.message || 'Unexpected UI error.'}</p>
            <button className="primary" onClick={() => this.setState({ error: null })}>Retry view <RefreshCw size={14} /></button>
          </section>
        </div>
      );
    }
  }
  return <Boundary>{children}</Boundary>;
}

function App() {
  const [auth, setAuth] = useState(() => normalizeAuth(JSON.parse(localStorage.getItem('freightone_auth') || 'null')));
  const [page, setPage] = useState('dashboard');

  function login(manager, plant) {
    const normalized = normalizeAuth({ manager, plant });
    localStorage.setItem('freightone_auth', JSON.stringify(normalized));
    setAuth(normalized);
  }

  function logout() {
    localStorage.removeItem('freightone_auth');
    setAuth(null);
    setPage('dashboard');
  }

  if (!auth) return <Login onLogin={login} />;

  const pages = {
    dashboard: <CommandCenter auth={auth} setPage={setPage} />,
    procurement: <Procurement auth={auth} />,
    freight: <FreightPage />,
    optimizer: <Optimizer auth={auth} />,
    tracker: <Tracker auth={auth} />,
    simulation: <Simulation auth={auth} />,
    alerts: <Alerts />,
    inventory: <Inventory auth={auth} />,
    report: <Report />,
  };

  return <Shell auth={auth} page={page} setPage={setPage} onLogout={logout}>
    <FreightOneErrorBoundary>{pages[page] || pages.dashboard}</FreightOneErrorBoundary>
  </Shell>;
}

createRoot(document.getElementById('root')).render(<App />);
