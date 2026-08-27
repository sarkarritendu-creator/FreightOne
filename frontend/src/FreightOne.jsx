import React, { useState, useEffect, useCallback } from "react";
import {
  ComposedChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Bar, BarChart,
} from "recharts";
import {
  Lock, User, AlertTriangle, TrendingUp, MapPin, Anchor, Clock, DollarSign,
  Shield, LogOut, Package, Sliders, CheckCircle2, XCircle, Ship, Navigation,
  Newspaper, Sparkles, ArrowRight, LayoutDashboard, Compass, ChevronRight,
  Building2, MapPinned, Calendar, TrendingDown, Loader2, ArrowLeft,
} from "lucide-react";

/* ============================================================================
   CONFIG + DESIGN TOKENS
============================================================================ */
const API_BASE = "http://localhost:8000";

const FONT_IMPORT = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500;600&display=swap');
`;

const C = {
  navy: "#0F1C33", navyLight: "#16264A", panel: "#132340", panelBorder: "#25375C",
  steel: "#3E5C8A", blue: "#3D7BD9", teal: "#2BB6A3", amber: "#E0A02B", red: "#D9534F",
  ink: "#E7ECF6", mute: "#8CA0C4",
};

async function api(path, opts) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    let detail = "Request failed";
    try { detail = (await res.json()).detail || detail; } catch {}
    throw new Error(detail);
  }
  return res.json();
}

/* ============================================================================
   SHARED UI ATOMS
============================================================================ */
function Card({ children, className = "", style = {} }) {
  return (
    <div className={`rounded-xl border ${className}`} style={{ background: C.panel, borderColor: C.panelBorder, ...style }}>
      {children}
    </div>
  );
}

function Badge({ children, tone = "steel" }) {
  const map = {
    steel: { bg: "rgba(62,92,138,0.25)", fg: C.mute },
    teal: { bg: "rgba(43,182,163,0.18)", fg: C.teal },
    amber: { bg: "rgba(224,160,43,0.18)", fg: C.amber },
    red: { bg: "rgba(217,83,79,0.18)", fg: C.red },
    blue: { bg: "rgba(61,123,217,0.18)", fg: C.blue },
  };
  const s = map[tone];
  return <span className="px-2 py-0.5 rounded-full text-xs font-semibold tracking-wide" style={{ background: s.bg, color: s.fg }}>{children}</span>;
}

function Field({ label, icon: Icon, children }) {
  return (
    <div>
      <label className="text-xs font-medium flex items-center gap-1.5 mb-2" style={{ color: C.mute }}>
        {Icon && <Icon size={13} />} {label}
      </label>
      {children}
    </div>
  );
}

const inputStyle = { background: C.navyLight, border: `1px solid ${C.panelBorder}`, color: C.ink };

function LoadingSpinner({ label }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: C.mute }}>
      <Loader2 size={16} className="animate-spin" /> {label}
    </div>
  );
}

/* ============================================================================
   LOGIN — plain credentials form, no demo list, no autofill
============================================================================ */
function LoginScreen({ onLogin }) {
  const [managerId, setManagerId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const data = await api("/api/login", { method: "POST", body: JSON.stringify({ manager_id: managerId.trim(), password }) });
      onLogin(data.manager, data.plant);
    } catch (err) {
      setError(err.message || "Manager ID or password not recognized.");
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden"
      style={{ background: `radial-gradient(1200px 600px at 20% -10%, #1A2C52 0%, ${C.navy} 55%)` }}>
      <style>{FONT_IMPORT}</style>
      <svg className="absolute inset-0 w-full h-full opacity-10" preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((i) => (
          <path key={i} d={`M -50 ${120 + i * 140} C 300 ${80 + i * 140}, 700 ${180 + i * 140}, 1400 ${100 + i * 140}`} stroke={C.teal} strokeWidth="1" fill="none" />
        ))}
      </svg>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-11 h-11 rounded-lg flex items-center justify-center" style={{ background: C.blue }}>
            <Compass size={22} color="white" />
          </div>
          <div>
            <div className="font-semibold text-lg tracking-tight" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>FreightOne</div>
            <div className="text-xs uppercase tracking-widest" style={{ color: C.mute }}>Chartering & Route Intelligence</div>
          </div>
        </div>

        <Card className="p-7">
          <div className="mb-6">
            <h1 className="text-xl font-semibold" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Manager sign-in</h1>
            <p className="text-sm mt-1" style={{ color: C.mute }}>Enter the credentials issued to you separately by your administrator.</p>
          </div>

          <form onSubmit={submit} className="space-y-4">
            <Field label="Manager ID" icon={User}>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={inputStyle}>
                <User size={16} color={C.mute} />
                <input value={managerId} onChange={(e) => setManagerId(e.target.value)} placeholder="e.g. RS-001"
                  className="bg-transparent outline-none w-full text-sm font-mono" style={{ color: C.ink }} />
              </div>
            </Field>
            <Field label="Password" icon={Lock}>
              <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={inputStyle}>
                <Lock size={16} color={C.mute} />
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••"
                  className="bg-transparent outline-none w-full text-sm" style={{ color: C.ink }} />
              </div>
            </Field>
            {error && <div className="flex items-center gap-2 text-sm" style={{ color: C.red }}><XCircle size={15} /> {error}</div>}
            <button type="submit" disabled={loading} className="w-full rounded-lg py-2.5 font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
              style={{ background: C.blue, color: "white" }}>
              {loading ? <Loader2 size={15} className="animate-spin" /> : <>Sign in <ArrowRight size={15} /></>}
            </button>
          </form>
        </Card>
        <p className="text-center text-xs mt-5" style={{ color: C.mute }}>
          Access is provisioned per-manager. Contact your administrator if you don't have a Manager ID yet.
        </p>
      </div>
    </div>
  );
}

/* ============================================================================
   TOP BAR
============================================================================ */
function TopBar({ user, plant, page, setPage, onLogout, riskLevel }) {
  const tabs = [
    { id: "dashboard", label: "Command Center", icon: LayoutDashboard },
    { id: "optimize", label: "Charter Optimizer", icon: Sliders },
    { id: "tracker", label: "Consignments", icon: Ship },
  ];
  const riskColor = { green: C.teal, amber: C.amber, red: C.red }[riskLevel] || C.mute;
  return (
    <div className="sticky top-0 z-20 px-5 py-3 flex items-center justify-between flex-wrap gap-3" style={{ background: C.navy, borderBottom: `1px solid ${C.panelBorder}` }}>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: C.blue }}><Compass size={16} color="white" /></div>
          <span className="font-semibold text-sm" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>FreightOne</span>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {tabs.map((t) => {
            const Icon = t.icon; const active = page === t.id;
            return (
              <button key={t.id} onClick={() => setPage(t.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors"
                style={{ background: active ? C.panel : "transparent", color: active ? C.ink : C.mute }}>
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.04)" }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: riskColor }} />
          <span style={{ color: C.mute }}>Network risk:</span>
          <span style={{ color: riskColor }} className="font-medium capitalize">{riskLevel || "…"}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-medium" style={{ color: C.ink }}>{user.name}</div>
            <div className="text-xs font-mono" style={{ color: C.mute }}>{plant?.name}</div>
          </div>
          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold" style={{ background: C.steel, color: "white" }}>{user.initials}</div>
          <button onClick={onLogout} className="p-1.5 rounded-md hover:brightness-125" style={{ color: C.mute }} title="Log out"><LogOut size={15} /></button>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   DASHBOARD — 90-day forecast, risk/news feed, consignment milestones + reroute
============================================================================ */
function ForecastChart() {
  const [data, setData] = useState(null);
  useEffect(() => { api("/api/forecast?days=90").then((d) => setData([...d.history, ...d.forecast])).catch(() => setData([])); }, []);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <div className="text-sm font-medium flex items-center gap-2" style={{ color: C.ink }}><TrendingUp size={15} color={C.blue} /> Freight Index — 60d trailing / 90d predicted</div>
          <div className="text-xs mt-0.5" style={{ color: C.mute }}>Confidence band widens with time and during the monsoon window</div>
        </div>
        <div className="flex items-center gap-3 text-xs" style={{ color: C.mute }}>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block" style={{ background: C.blue }} /> Historical</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 inline-block border-t border-dashed" style={{ borderColor: C.amber }} /> Predicted</span>
          <span className="flex items-center gap-1"><span className="w-3 h-2 inline-block rounded-sm" style={{ background: "rgba(224,160,43,0.25)" }} /> Confidence band</span>
        </div>
      </div>
      {!data ? <LoadingSpinner label="Loading forecast…" /> : (
        <ResponsiveContainer width="100%" height={240}>
          <ComposedChart data={data} margin={{ left: -12, right: 8, top: 4 }}>
            <CartesianGrid stroke={C.panelBorder} strokeDasharray="3 4" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: C.mute, fontSize: 10 }} axisLine={{ stroke: C.panelBorder }} tickLine={false} />
            <YAxis domain={["auto", "auto"]} tick={{ fill: C.mute, fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
            <Tooltip contentStyle={{ background: C.navyLight, border: `1px solid ${C.panelBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.mute }} />
            <Area dataKey="upper" stroke="none" fill="rgba(224,160,43,0.18)" isAnimationActive={false} />
            <Area dataKey="lower" stroke="none" fill={C.navy} isAnimationActive={false} />
            <Line dataKey="index" stroke={C.blue} strokeWidth={2} dot={false} isAnimationActive={false} />
            <Line dataKey="predicted" stroke={C.amber} strokeWidth={2} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}

function AlertBanner({ risk }) {
  if (!risk) return null;
  if (risk.level === "green") {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-lg mb-5" style={{ background: "rgba(43,182,163,0.1)", border: `1px solid rgba(43,182,163,0.3)` }}>
        <CheckCircle2 size={16} color={C.teal} />
        <span className="text-sm" style={{ color: C.ink }}>All monitored lanes are operating normally. No action required.</span>
      </div>
    );
  }
  const isRed = risk.level === "red"; const color = isRed ? C.red : C.amber;
  return (
    <div className="flex items-start gap-3 px-4 py-3 rounded-lg mb-5" style={{ background: isRed ? "rgba(217,83,79,0.1)" : "rgba(224,160,43,0.1)", border: `1px solid ${color}55` }}>
      <AlertTriangle size={17} color={color} className="mt-0.5 shrink-0" />
      <div>
        <div className="text-sm font-medium" style={{ color }}>{isRed ? "High-priority disruption risk detected" : "Elevated risk — monitor before booking"}</div>
        <div className="text-xs mt-1" style={{ color: C.mute }}>{risk.items?.map((n) => n.text).join(" ")}</div>
      </div>
    </div>
  );
}

function ConsignmentCard({ c, onReroute, rerouting }) {
  const [suggestion, setSuggestion] = useState(null);
  const [showSuggestion, setShowSuggestion] = useState(false);

  async function handleReroute() {
    const result = await onReroute(c.id);
    setSuggestion(result);
    setShowSuggestion(true);
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm font-medium" style={{ color: C.ink }}>{c.id}</span>
          <Badge tone="steel">{c.plant_label}</Badge>
        </div>
        {c.status === "delayed" ? <Badge tone="red">Delayed {c.delay_days}d</Badge> : <Badge tone="teal">On schedule</Badge>}
      </div>
      <div className="text-xs mb-3" style={{ color: C.mute }}>{c.vessel} · {c.origin_label} → {c.port_label}</div>

      <div className="grid grid-cols-3 gap-2 text-xs mb-3">
        <div><div className="uppercase" style={{ color: C.mute }}>Port ETA</div><div className="font-mono mt-0.5" style={{ color: C.ink }}>{c.eta_port_date}</div></div>
        <div><div className="uppercase" style={{ color: C.mute }}>Earliest dispatch</div><div className="font-mono mt-0.5" style={{ color: C.ink }}>{c.earliest_dispatch_from_port}</div></div>
        <div><div className="uppercase" style={{ color: C.mute }}>Final arrival</div><div className="font-mono mt-0.5" style={{ color: C.ink }}>{c.expected_final_arrival}</div></div>
      </div>

      {c.status === "delayed" && (
        <div className="mb-3 flex items-start gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: "rgba(224,160,43,0.1)", color: C.mute }}>
          <AlertTriangle size={13} color={C.amber} className="mt-0.5 shrink-0" /> {c.delay_reason}
        </div>
      )}

      {c.status === "delayed" && !showSuggestion && (
        <button onClick={handleReroute} disabled={rerouting} className="w-full rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: C.amber, color: C.navy }}>
          <Navigation size={13} /> {rerouting ? "Checking diversion options…" : "Check reroute / diversion option"}
        </button>
      )}

      {showSuggestion && suggestion?.suggestion && (
        <Card className="p-3.5" style={{ background: C.navyLight }}>
          <div className="flex items-center gap-2 mb-2"><Navigation size={13} color={C.teal} /><span className="text-xs font-medium" style={{ color: C.ink }}>Cross-plant diversion available</span></div>
          <div className="text-xs mb-2.5" style={{ color: C.mute }}>{suggestion.suggestion.message}</div>
          <div className="flex items-center gap-2 text-xs px-2.5 py-2 rounded-md" style={{ background: "rgba(43,182,163,0.1)", color: C.teal }}>
            <CheckCircle2 size={13} /> Notification sent to {suggestion.suggestion.notification_sent_to}
          </div>
        </Card>
      )}
      {showSuggestion && !suggestion?.suggestion && (
        <div className="text-xs" style={{ color: C.mute }}>{suggestion?.message || "No suitable diversion found right now."}</div>
      )}
    </Card>
  );
}

function DashboardPage({ plant, plantCode }) {
  const [risk, setRisk] = useState(null);
  const [consignments, setConsignments] = useState(null);
  const [reroutingId, setReroutingId] = useState(null);

  useEffect(() => {
    api("/api/risk-score").then(setRisk).catch(() => {});
    api(`/api/consignments?plant_code=${plantCode}`).then((d) => setConsignments(d.consignments)).catch(() => setConsignments([]));
  }, [plantCode]);

  const handleReroute = useCallback(async (id) => {
    setReroutingId(id);
    try { return await api(`/api/reroute-suggestion`, { method: "POST", body: JSON.stringify({ consignment_id: id }) }); }
    finally { setReroutingId(null); }
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 py-6">
      <div className="mb-5">
        <h1 className="text-lg font-semibold" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Command Center</h1>
        <p className="text-sm" style={{ color: C.mute }}>Live overview for {plant?.name}, {plant?.state}</p>
      </div>
      <AlertBanner risk={risk} />
      <ForecastChart />

      <Card className="p-5 mt-5">
        <div className="flex items-center gap-2 mb-3"><Newspaper size={15} color={C.blue} /><span className="text-sm font-medium" style={{ color: C.ink }}>Signal Feed — News &amp; Fuel</span></div>
        {!risk ? <LoadingSpinner label="Loading signals…" /> : (
          <div className="space-y-2.5">
            {risk.items?.length ? risk.items.map((n, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <Badge tone={n.weight > 15 ? "red" : n.weight < -3 ? "teal" : "steel"}>{n.tag}</Badge>
                <span style={{ color: C.mute }}>{n.text}</span>
              </div>
            )) : <div className="text-sm" style={{ color: C.mute }}>No notable signals right now.</div>}
          </div>
        )}
      </Card>

      <div className="mt-5">
        <div className="text-xs uppercase tracking-wide mb-2.5" style={{ color: C.mute }}>Active consignments</div>
        {!consignments ? <LoadingSpinner label="Loading consignments…" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {consignments.map((c) => <ConsignmentCard key={c.id} c={c} onReroute={handleReroute} rerouting={reroutingId === c.id} />)}
            {consignments.length === 0 && <div className="text-sm" style={{ color: C.mute }}>No active consignments for this plant.</div>}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================================
   OPTIMIZE PAGE — cargo/origin/priority -> preferred port -> destination
   choice -> ranked options (auto vessel selection, port is a preference)
============================================================================ */
function OptionCard({ opt, onAnalyze }) {
  const tagTone = { "AI Recommended": "teal", "Your Preference": "blue", "Nearest to Plant": "amber" };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="font-medium text-sm" style={{ color: C.ink }}>
            {opt.port} — {opt.shipments_needed > 1 ? `${opt.shipments_needed}× ${opt.vessel}` : `1× ${opt.vessel}`}
          </div>
          <div className="flex gap-1.5 mt-1.5 flex-wrap">
            {(opt.tags || []).map((t) => <Badge key={t} tone={tagTone[t] || "steel"}>{t}</Badge>)}
            <Badge tone={opt.risk_level === "red" ? "red" : opt.risk_level === "amber" ? "amber" : "teal"}>Risk {opt.risk_score}/100</Badge>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div><div className="text-xs uppercase" style={{ color: C.mute }}>Landed cost</div><div className="font-mono font-semibold text-sm" style={{ color: C.ink }}>${opt.cost_per_mt}/MT</div></div>
        <div><div className="text-xs uppercase" style={{ color: C.mute }}>ETA</div><div className="font-mono font-semibold text-sm" style={{ color: C.ink }}>{opt.eta_days}d</div></div>
        <div><div className="text-xs uppercase" style={{ color: C.mute }}>Port turnaround</div><div className="font-mono font-semibold text-sm" style={{ color: C.ink }}>{opt.port_turnaround_days}d</div></div>
        <div><div className="text-xs uppercase" style={{ color: C.mute }}>Inland</div><div className="font-mono font-semibold text-sm" style={{ color: C.ink }}>{opt.distance_km} km</div></div>
      </div>
      <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg mb-3" style={{ background: C.navyLight, color: C.mute }}>
        <Sparkles size={13} color={C.amber} className="mt-0.5 shrink-0" /> {opt.reason}
      </div>
      <button onClick={() => onAnalyze(opt)} className="w-full rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-2 hover:opacity-90"
        style={{ background: C.blue, color: "white" }}>
        View detailed route analysis <ChevronRight size={13} />
      </button>
    </Card>
  );
}

function OptimizePage({ plantCode, onOpenAnalysis }) {
  const [ref, setRef] = useState(null);
  const [step, setStep] = useState(1);
  const [tonnage, setTonnage] = useState(150000);
  const [origin, setOrigin] = useState("australia");
  const [priority, setPriority] = useState(50);
  const [preferredPort, setPreferredPort] = useState("");
  const [destMode, setDestMode] = useState("plant");
  const [customLabel, setCustomLabel] = useState("");
  const [customKm, setCustomKm] = useState(100);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    api("/api/reference-data").then((d) => { setRef(d); setPreferredPort(Object.keys(d.ports)[0]); }).catch(() => {});
  }, []);

  async function generate() {
    setLoading(true); setError(""); setResult(null);
    try {
      const final_delivery = destMode === "plant"
        ? { mode: "plant" }
        : { mode: "custom", label: customLabel || "Custom location", distance_km: Number(customKm), rate_per_mt_km: 2.0 };
      const data = await api("/api/route-options", {
        method: "POST",
        body: JSON.stringify({ tonnage, origin, preferred_port: preferredPort, priority, plant_code: plantCode, final_delivery }),
      });
      setResult(data);
      setStep(4);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  if (!ref) return <div className="max-w-6xl mx-auto px-5 py-10"><LoadingSpinner label="Loading reference data…" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-5 py-6">
      <h1 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Charter Optimizer</h1>
      <p className="text-sm mb-5" style={{ color: C.mute }}>Vessel type is selected automatically by the model — you only choose cargo, origin, and a preferred port.</p>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-2 space-y-4">
          {/* STEP 1: cargo + origin + priority */}
          <Card className="p-5 space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.blue }}>1 · Cargo &amp; origin</div>
            <Field label="Tonnage (MT)" icon={Package}>
              <input type="number" value={tonnage} onChange={(e) => setTonnage(Number(e.target.value))}
                className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none" style={inputStyle} />
            </Field>
            <Field label="Origin" icon={MapPin}>
              <select value={origin} onChange={(e) => setOrigin(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
                {Object.entries(ref.origins).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium flex items-center gap-1.5" style={{ color: C.mute }}><Sliders size={13} /> Priority</label>
                <span className="text-xs font-mono" style={{ color: C.amber }}>{priority < 35 ? "Price priority" : priority > 65 ? "Deadline priority" : "Balanced"}</span>
              </div>
              <input type="range" min="0" max="100" value={priority} onChange={(e) => setPriority(Number(e.target.value))} className="w-full" style={{ accentColor: C.blue }} />
              <div className="flex justify-between text-xs mt-1" style={{ color: C.mute }}><span>Cheapest</span><span>Fastest</span></div>
            </div>
          </Card>

          {/* STEP 2: preferred port */}
          <Card className="p-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.blue }}>2 · Preferred port (your choice — not final)</div>
            <p className="text-xs" style={{ color: C.mute }}>We'll always show your preference alongside the nearest port and a full ranked comparison.</p>
            <select value={preferredPort} onChange={(e) => setPreferredPort(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle}>
              {Object.entries(ref.ports).map(([k, v]) => <option key={k} value={k}>{v.name} — {v.state} ({v.draft_m}m draft)</option>)}
            </select>
          </Card>

          {/* STEP 3: destination choice — USP */}
          <Card className="p-5 space-y-3">
            <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.blue }}>3 · Final delivery point</div>
            <p className="text-xs" style={{ color: C.mute }}>Do you want final delivery from the port to your registered plant, or a different location?</p>
            <div className="flex gap-2">
              <button onClick={() => setDestMode("plant")} className="flex-1 rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                style={{ background: destMode === "plant" ? C.blue : C.navyLight, color: destMode === "plant" ? "white" : C.mute }}>
                <Building2 size={13} /> My registered plant
              </button>
              <button onClick={() => setDestMode("custom")} className="flex-1 rounded-lg py-2 text-xs font-medium flex items-center justify-center gap-1.5"
                style={{ background: destMode === "custom" ? C.blue : C.navyLight, color: destMode === "custom" ? "white" : C.mute }}>
                <MapPinned size={13} /> Different location
              </button>
            </div>
            {destMode === "custom" && (
              <div className="space-y-3 pt-1">
                <Field label="Location name">
                  <input value={customLabel} onChange={(e) => setCustomLabel(e.target.value)} placeholder="e.g. Regional office, Kolkata"
                    className="w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
                </Field>
                <Field label="Approx. extra distance from port (km)">
                  <input type="number" value={customKm} onChange={(e) => setCustomKm(e.target.value)}
                    className="w-full rounded-lg px-3 py-2 text-sm font-mono outline-none" style={inputStyle} />
                </Field>
              </div>
            )}
          </Card>

          <button onClick={generate} disabled={loading} className="w-full rounded-lg py-2.5 text-sm font-medium flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ background: C.blue, color: "white" }}>
            {loading ? <Loader2 size={15} className="animate-spin" /> : <>Generate ranked route options <ArrowRight size={14} /></>}
          </button>
          {error && <div className="flex items-center gap-2 text-sm" style={{ color: C.red }}><XCircle size={15} /> {error}</div>}
        </div>

        {/* RESULTS */}
        <div className="lg:col-span-3 space-y-4">
          {!result && !loading && (
            <Card className="p-8 text-center text-sm" style={{ color: C.mute }}>Fill in the form and generate to see ranked port &amp; route options.</Card>
          )}
          {loading && <LoadingSpinner label="Evaluating all East Coast ports…" />}

          {result && (
            <>
              {result.preferred_infeasible && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg" style={{ background: "rgba(217,83,79,0.1)", border: `1px solid ${C.red}55` }}>
                  <XCircle size={16} color={C.red} className="mt-0.5 shrink-0" />
                  <div className="text-sm" style={{ color: C.ink }}>
                    <b>{result.preferred_infeasible.port}</b> can't be used for this cargo: {result.preferred_infeasible.reason}
                  </div>
                </div>
              )}
              {result.better_alternative && (
                <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg" style={{ background: "rgba(224,160,43,0.1)", border: `1px solid ${C.amber}55` }}>
                  <TrendingDown size={16} color={C.amber} className="mt-0.5 shrink-0" />
                  <div className="text-sm" style={{ color: C.ink }}>{result.better_alternative.message}</div>
                </div>
              )}
              <div className="text-xs uppercase tracking-wide mb-1" style={{ color: C.mute }}>Ranked results — top {result.options.length}</div>
              {result.options.map((o) => <OptionCard key={o.port_id} opt={o} onAnalyze={(opt) => onOpenAnalysis({ tonnage, origin, port: opt.port_id, portName: opt.port })} />)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   ROUTE ANALYSIS — order-timing curve for a chosen route
============================================================================ */
function AnalysisPage({ params, onBack }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null); setError("");
    api("/api/order-timing", { method: "POST", body: JSON.stringify({ tonnage: params.tonnage, origin: params.origin, port: params.port }) })
      .then(setData).catch((e) => setError(e.message));
  }, [params]);

  return (
    <div className="max-w-5xl mx-auto px-5 py-6">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm mb-4 hover:opacity-80" style={{ color: C.mute }}>
        <ArrowLeft size={14} /> Back to results
      </button>
      <h1 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Route Analysis — {params.portName}</h1>
      <p className="text-sm mb-5" style={{ color: C.mute }}>When should this order actually be placed? Cost, arrival date, and weather risk across the next 90 possible order dates.</p>

      {error && <div className="text-sm" style={{ color: C.red }}>{error}</div>}
      {!data && !error && <LoadingSpinner label="Computing order-timing curve…" />}

      {data && (
        <>
          <Card className="p-4 mb-5 flex items-center gap-3" style={{ background: "rgba(43,182,163,0.08)", borderColor: "rgba(43,182,163,0.3)" }}>
            <Calendar size={18} color={C.teal} />
            <div className="text-sm" style={{ color: C.ink }}>
              Recommended order day: <b>Day {data.recommended_order_day}</b> from today — projected
              <b> ${data.recommended.projected_cost_per_mt}/MT</b>, arriving around day {data.recommended.projected_arrival_day}.
            </div>
          </Card>

          <Card className="p-5 mb-5">
            <div className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: C.ink }}><DollarSign size={15} color={C.blue} /> Projected cost per MT by order date</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.points} margin={{ left: -12, right: 8, top: 4 }}>
                <CartesianGrid stroke={C.panelBorder} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="order_day" tick={{ fill: C.mute, fontSize: 10 }} axisLine={{ stroke: C.panelBorder }} tickLine={false} />
                <YAxis tick={{ fill: C.mute, fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: C.navyLight, border: `1px solid ${C.panelBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.mute }} />
                <Line dataKey="projected_cost_per_mt" stroke={C.blue} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-medium mb-3 flex items-center gap-2" style={{ color: C.ink }}><AlertTriangle size={15} color={C.amber} /> Weather risk by order date (monsoon window highlighted)</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.points} margin={{ left: -12, right: 8, top: 4 }}>
                <CartesianGrid stroke={C.panelBorder} strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="order_day" tick={{ fill: C.mute, fontSize: 10 }} axisLine={{ stroke: C.panelBorder }} tickLine={false} />
                <YAxis tick={{ fill: C.mute, fontSize: 10 }} axisLine={false} tickLine={false} width={34} />
                <Tooltip contentStyle={{ background: C.navyLight, border: `1px solid ${C.panelBorder}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: C.mute }} />
                <Bar dataKey="weather_risk" fill={C.amber} radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}

/* ============================================================================
   TRACKER PAGE (consignments, full list — reuses dashboard's card)
============================================================================ */
function TrackerPage({ plantCode }) {
  const [consignments, setConsignments] = useState(null);
  const [reroutingId, setReroutingId] = useState(null);

  useEffect(() => { api(`/api/consignments?plant_code=${plantCode}`).then((d) => setConsignments(d.consignments)).catch(() => setConsignments([])); }, [plantCode]);

  const handleReroute = useCallback(async (id) => {
    setReroutingId(id);
    try { return await api(`/api/reroute-suggestion`, { method: "POST", body: JSON.stringify({ consignment_id: id }) }); }
    finally { setReroutingId(null); }
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-5 py-6">
      <h1 className="text-lg font-semibold mb-1" style={{ color: C.ink, fontFamily: "'Space Grotesk', sans-serif" }}>Consignments</h1>
      <p className="text-sm mb-5" style={{ color: C.mute }}>Full milestone chain: sea leg → port arrival → earliest dispatch → final plant arrival.</p>
      {!consignments ? <LoadingSpinner label="Loading…" /> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {consignments.map((c) => <ConsignmentCard key={c.id} c={c} onReroute={handleReroute} rerouting={reroutingId === c.id} />)}
          {consignments.length === 0 && <div className="text-sm" style={{ color: C.mute }}>No active consignments for this plant.</div>}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   ROOT APP
============================================================================ */
export default function App() {
  const [user, setUser] = useState(null);
  const [plant, setPlant] = useState(null);
  const [page, setPage] = useState("dashboard");
  const [analysisParams, setAnalysisParams] = useState(null);
  const [riskLevel, setRiskLevel] = useState(null);

  useEffect(() => {
    if (user) api("/api/risk-score").then((r) => setRiskLevel(r.level)).catch(() => {});
  }, [user]);

  if (!user) return <LoginScreen onLogin={(m, p) => { setUser(m); setPlant(p); }} />;

  function openAnalysis(params) { setAnalysisParams(params); setPage("analysis"); }

  return (
    <div className="min-h-screen" style={{ background: C.navy, fontFamily: "'Inter', sans-serif" }}>
      <style>{FONT_IMPORT}</style>
      <TopBar user={user} plant={plant} page={page === "analysis" ? "optimize" : page} setPage={setPage} onLogout={() => setUser(null)} riskLevel={riskLevel} />
      {page === "dashboard" && <DashboardPage plant={plant} plantCode={user.plant} />}
      {page === "optimize" && <OptimizePage plantCode={user.plant} onOpenAnalysis={openAnalysis} />}
      {page === "tracker" && <TrackerPage plantCode={user.plant} />}
      {page === "analysis" && analysisParams && <AnalysisPage params={analysisParams} onBack={() => setPage("optimize")} />}
    </div>
  );
}
