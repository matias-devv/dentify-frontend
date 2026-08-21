import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

// ==================== HELPERS ====================
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);

const getCurrentMonthYear = () =>
  new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' })
    .format(new Date())
    .replace(/^\w/, (c) => c.toUpperCase());

const formatPaymentMethod = (method: string) => ({ CASH: 'Efectivo', MERCADO_PAGO: 'Mercado Pago' }[method] || method);

// Demo data for sandbox
const DEMO_KPIS = { today_income: 15200, monthly_income: 54000, total_outstanding_balance: 28500, outstanding_payments: 12 };
const DEMO_COLLECTION_RATE = { totalPaymentsMonth: 17, confirmedPayments: 9, pendingPayments: 8, ratePercentage: 52.9 };
const DEMO_METHODS = [{ payment_method: 'CASH', total_amount: 54000, percentage: 100 }];
const DEMO_DEBTORS = [{ patient_name: 'Pipi Cucu', treatments_with_debt: 2, total_debt: 46500, pending_payments_count: 8 }];
const DEMO_CHART_MONTHLY = Array.from({ length: 31 }, (_, i) => ({
  label: String(i + 1),
  amount: i % 7 === 6 || i % 7 === 0 ? 0 : Math.round(Math.random() * 12000 + 2000),
}));

// ==================== INCOME CHART ====================
function IncomeChart({ data, period }: { data: { label: string; amount: number }[]; period: string }) {
  const tickFormatter = period === 'year'
    ? (v: number) => `$${(v / 1000).toFixed(0)}k`
    : (v: number) => `$${(v / 1000).toFixed(0)}k`;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#1A6FD4" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#1A6FD4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#EAEAE6" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
        <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={44} />
        <RechartsTooltip
          formatter={(value: any) => [formatCurrency(value as number), 'Ingresos'] as [string, string]}
          contentStyle={{ borderRadius: 8, border: '1px solid #EAEAE6', boxShadow: '0 2px 12px rgba(10,22,40,0.08)', fontSize: 12 }}
          labelStyle={{ color: '#0A1628', fontWeight: 600 }}
        />
        <Area type="monotone" dataKey="amount" stroke="#1A6FD4" strokeWidth={2} fill="url(#incomeGrad)" dot={false} activeDot={{ r: 4, fill: '#1A6FD4', strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ==================== DONUT CHART (method breakdown) ====================
function MethodDonut({ methods }: { methods: { payment_method: string; total_amount: number; percentage: number }[] }) {
  if (!methods?.length) return <div className="text-on-surface-variant text-sm">Sin datos</div>;

  const total = methods.reduce((s, m) => s + (m.total_amount || 0), 0);
  let offset = 0;
  const segments = methods.map((m, i) => {
    const pct = total > 0 ? ((m.total_amount || 0) / total) * 100 : 0;
    const fill = m.payment_method === 'CASH' ? '#0A1628' : m.payment_method === 'MERCADO_PAGO' ? '#1A6FD4' : '#EAEAE6';
    const seg = { id: i, pct, dasharray: `${pct}, 100`, dashoffset: -offset, stroke: fill };
    offset += pct;
    return seg;
  });

  return (
    <div className="relative w-56 h-56 mb-8">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
        {segments.map((s) => (
          <path
            key={s.id}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={s.stroke}
            strokeDasharray={s.dasharray}
            strokeDashoffset={s.dashoffset}
            strokeWidth="4"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data-mono text-3xl font-bold text-primary">100%</span>
        <span className="text-sm text-outline font-body-sm">Total</span>
      </div>
    </div>
  );
}

// ==================== ESTADO DE PAGOS — redesigned section ====================
function PaymentStatusCard({
  collectionRate,
}: {
  collectionRate: { totalPaymentsMonth: number; confirmedPayments: number; pendingPayments: number; ratePercentage: number };
}) {
  const total = collectionRate.totalPaymentsMonth;
  const confirmed = collectionRate.confirmedPayments;
  const pending = collectionRate.pendingPayments;
  const rate = collectionRate.ratePercentage;

  const confirmedPct = total > 0 ? (confirmed / total) * 100 : 0;
  const pendingPct = total > 0 ? (pending / total) * 100 : 0;

  const donutData =
    total > 0
      ? [
          { name: 'Confirmados', value: confirmed, color: '#0A1628' },
          { name: 'Pendientes', value: pending, color: '#1A6FD4' },
        ]
      : [{ name: 'Sin datos', value: 1, color: '#E5E7EB' }];

  // Custom center label for recharts PieChart
  const CenterLabel = () => (
    <g>
      <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle" fill="#0A1628" style={{ fontSize: 20, fontWeight: 700, fontFamily: 'monospace' }}>
        {rate.toFixed(1)}%
      </text>
      <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" style={{ fontSize: 9, fontFamily: 'monospace' }}>
        cobrado
      </text>
      <text x="50%" y="66%" textAnchor="middle" dominantBaseline="middle" fill="#9CA3AF" style={{ fontSize: 9, fontFamily: 'monospace' }}>
        {total} pagos
      </text>
    </g>
  );

  return (
    <div className="lg:col-span-5 bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 flex flex-col">
      {/* Header */}
      <div className="border-b border-outline-variant/20 pb-4 mb-5">
        <p className="font-label-eyebrow text-[11px] text-outline uppercase tracking-widest mb-1">COBROS</p>
        <h2 className="font-headline-sm text-[20px] text-primary">Estado de pagos del mes</h2>
      </div>

      <div className="flex-1 flex flex-col items-center gap-5">
        {/* Donut chart */}
        <div className="w-52 h-52 shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={82}
                startAngle={90}
                endAngle={-270}
                dataKey="value"
                strokeWidth={0}
                paddingAngle={donutData.length > 1 && total > 0 ? 2 : 0}
              >
                {donutData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <CenterLabel />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Stat cards row */}
        <div className="w-full grid grid-cols-2 gap-3">
          {/* Confirmados */}
          <div className="rounded-xl p-4 border border-[#0A1628]/8" style={{ background: 'linear-gradient(135deg, #F2F4F8 0%, #EEF1F6 100%)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#0A1628] shrink-0" />
              <span className="text-[9px] font-data-mono text-on-surface-variant uppercase tracking-widest font-bold">Confirmados</span>
            </div>
            <p className="font-data-mono text-[30px] font-bold text-primary leading-none tabular-nums">{confirmed}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-outline font-data-mono">{confirmedPct.toFixed(1)}% del total</span>
            </div>
            {/* mini progress */}
            <div className="mt-3 h-1 bg-[#D1D5DC] rounded-full overflow-hidden">
              <div className="h-full bg-[#0A1628] rounded-full transition-all duration-700" style={{ width: `${confirmedPct}%` }} />
            </div>
          </div>

          {/* Pendientes */}
          <div className="rounded-xl p-4 border border-[#1A6FD4]/10" style={{ background: 'linear-gradient(135deg, #EEF4FC 0%, #E5EEFA 100%)' }}>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-[#1A6FD4] shrink-0" />
              <span className="text-[9px] font-data-mono text-[#1A6FD4] uppercase tracking-widest font-bold">Pendientes</span>
            </div>
            <p className="font-data-mono text-[30px] font-bold text-[#1A6FD4] leading-none tabular-nums">{pending}</p>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-[#1A6FD4]/60 font-data-mono">{pendingPct.toFixed(1)}% del total</span>
            </div>
            {/* mini progress */}
            <div className="mt-3 h-1 bg-[#BDD4EF] rounded-full overflow-hidden">
              <div className="h-full bg-[#1A6FD4] rounded-full transition-all duration-700" style={{ width: `${pendingPct}%` }} />
            </div>
          </div>
        </div>

        {/* Global progress bar */}
        <div className="w-full">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-data-mono text-outline uppercase tracking-wider">Progreso de cobro del mes</span>
            <span className="text-[10px] font-data-mono text-on-surface-variant font-bold">{confirmed}/{total}</span>
          </div>
          <div className="relative h-3 bg-[#EAEAE6] rounded-full overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-in-out"
              style={{ width: `${confirmedPct}%`, background: 'linear-gradient(90deg, #0A1628 0%, #1A6FD4 100%)' }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-outline font-data-mono">● Confirmados</span>
            <span className="text-[10px] text-[#1A6FD4] font-data-mono">● Pendientes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN COMPONENT ====================
export default function PaymentSummary() {
  const [kpis, setKpis] = useState(DEMO_KPIS);
  const [chartData, setChartData] = useState<{ label: string; amount: number }[]>(DEMO_CHART_MONTHLY);
  const [paymentMethods, setPaymentMethods] = useState(DEMO_METHODS);
  const [topDebtors, setTopDebtors] = useState(DEMO_DEBTORS);
  const [collectionRate, setCollectionRate] = useState(DEMO_COLLECTION_RATE);
  const [period, setPeriod] = useState('month');

  // Real API calls (fail silently in sandbox — demo data persists)
  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    Promise.all([
      fetch(`/api/payments/kpis`).then((r) => r.json()),
      fetch(`/api/payments/by-method?year=${year}&month=${month}`).then((r) => r.json()),
      fetch(`/api/payments/top-debtors`).then((r) => r.json()),
      fetch(`/api/payments/collection-rate?year=${year}&month=${month}`).then((r) => r.json()),
    ])
      .then(([kpisData, methodsData, debtorsData, rateData]) => {
        if (kpisData) setKpis(kpisData);
        if (Array.isArray(methodsData)) setPaymentMethods(methodsData);
        if (Array.isArray(debtorsData)) setTopDebtors(debtorsData.slice(0, 5));
        if (rateData) setCollectionRate(rateData);
      })
      .catch(() => {/* sandbox — demo data stays */});
  }, []);

  useEffect(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    let url = `/api/payments/monthly?year=${year}&month=${month}`;
    if (period === 'week') {
      const today = new Date();
      const start = new Date(today); start.setDate(today.getDate() - 6);
      url = `/api/payments/weekly?startDate=${start.toISOString().split('T')[0]}&endDate=${today.toISOString().split('T')[0]}`;
    } else if (period === 'year') {
      url = `/api/payments/yearly?year=${year}`;
    }
    fetch(url)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setChartData(data); })
      .catch(() => {});
  }, [period]);

  return (
    <div className="bg-[#F4F3F0] text-on-surface font-body-md min-h-screen flex">
      {/* SideNavBar */}
      <nav className="hidden md:flex flex-col w-[240px] h-screen py-8 fixed left-0 top-0 z-20 shadow-sm border-r border-outline-variant/20 navy-gradient">
        <div className="flex-1 flex flex-col gap-1 mt-4">
          {[
            { icon: 'dashboard', label: 'Inicio' },
            { icon: 'clinical_notes', label: 'Historia Clínica' },
            { icon: 'calendar_today', label: 'Turnos' },
            { icon: 'group', label: 'Pacientes' },
            { icon: 'event_note', label: 'Agendas' },
          ].map((item) => (
            <a key={item.label} className="flex items-center gap-3 px-4 py-3 text-on-primary-container hover:text-on-primary transition-colors hover:bg-on-primary-fixed-variant/5" href="#">
              <span className="material-symbols-outlined" data-icon={item.icon}>{item.icon}</span>
              <span className="font-data-mono text-data-mono">{item.label}</span>
            </a>
          ))}
          <div className="mt-2">
            <a className="flex items-center justify-between px-4 py-3 text-on-primary-container hover:text-on-primary transition-colors hover:bg-on-primary-fixed-variant/5 group" href="#">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined" data-icon="payments">payments</span>
                <span className="font-data-mono text-data-mono">Finanzas</span>
              </div>
              <span className="material-symbols-outlined text-[16px] rotate-180">expand_more</span>
            </a>
            <div className="flex flex-col ml-[42px] mt-1 space-y-1">
              <a className="flex items-center px-4 py-2 text-on-primary font-bold bg-on-primary-fixed-variant/10 border-l-2 border-secondary-container rounded-r-md" href="#">
                <span className="font-data-mono text-data-mono text-sm">Resumen</span>
              </a>
              <a className="flex items-center px-4 py-2 text-on-primary-container hover:text-on-primary transition-colors text-sm font-data-mono text-data-mono" href="#">Pagos</a>
              <a className="flex items-center px-4 py-2 text-on-primary-container hover:text-on-primary transition-colors text-sm font-data-mono text-data-mono" href="#">Tratamientos</a>
            </div>
          </div>
        </div>
        <div className="px-6 mt-4 mb-3">
          <div className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10">
            <p className="font-data-mono text-[11px] text-white/80 font-semibold leading-tight truncate">Clínica Salud Dental</p>
            <p className="font-data-mono text-[10px] text-white/40 mt-0.5 leading-tight">{getCurrentMonthYear()}</p>
          </div>
        </div>
        <div className="px-6">
          <button className="w-full bg-[#1A6FD4] text-on-primary py-3 rounded-lg font-data-mono text-data-mono hover:bg-secondary-container transition-colors shadow-sm">
            Nueva Consulta
          </button>
        </div>
        <div className="mt-8 flex flex-col gap-1 border-t border-outline-variant/10 pt-4">
          {[{ icon: 'settings', label: 'Ajustes' }, { icon: 'logout', label: 'Cerrar Sesión' }].map((item) => (
            <a key={item.label} className="flex items-center gap-3 px-4 py-3 text-on-primary-container hover:text-on-primary transition-colors hover:bg-on-primary-fixed-variant/5" href="#">
              <span className="material-symbols-outlined" data-icon={item.icon}>{item.icon}</span>
              <span className="font-data-mono text-data-mono">{item.label}</span>
            </a>
          ))}
        </div>
      </nav>

      <main className="flex-1 md:ml-[240px] px-8 py-8 pb-24 w-full">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div>
            <p className="font-label-eyebrow text-[12px] text-[#1A6FD4] uppercase mb-2 tracking-widest">MÓDULO FINANCIERO</p>
            <h1 className="font-headline-lg text-headline-lg text-primary mb-1" style={{ fontSize: '2rem' }}>Resumen</h1>
            <p className="font-body-md text-body-md text-on-surface-variant font-light">Panel de gestión financiera · {getCurrentMonthYear()}</p>
          </div>
        </div>

        {/* SECTION 1: KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-stack-lg">
          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 hover:border-[#1A6FD4]/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">Pagos confirmados hoy</p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">payments</span>
            </div>
            <h3 className="font-data-mono text-[32px] font-medium tracking-tight text-primary mb-1">{formatCurrency(kpis.today_income)}</h3>
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600">▲ 12%</span>
              <span className="text-xs text-outline font-body-sm">vs ayer</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 hover:border-[#1A6FD4]/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">{getCurrentMonthYear()}</p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">account_balance_wallet</span>
            </div>
            <h3 className="font-data-mono text-[32px] font-medium tracking-tight text-primary mb-1">{formatCurrency(kpis.monthly_income)}</h3>
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600">▲ 5.4%</span>
              <span className="text-xs text-outline font-body-sm">vs mes anterior</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 relative overflow-hidden hover:border-[#4A9EE8]/30 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#4A9EE8]" />
            <div className="flex justify-between items-start mb-2 pl-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">En tratamientos activos</p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">receipt_long</span>
            </div>
            <h3 className="font-data-mono text-[32px] font-medium tracking-tight text-[#4A9EE8] mb-1 pl-2">{formatCurrency(kpis.total_outstanding_balance)}</h3>
            <div className="mt-2 pl-2">
              <span className="text-xs text-outline font-body-sm">Saldo pendiente total</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 hover:border-[#1A6FD4]/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">Turnos cobrados este mes</p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">trending_up</span>
            </div>
            <h3 className="font-data-mono text-[32px] font-medium tracking-tight text-primary mb-1">{Math.round(collectionRate.ratePercentage)}%</h3>
            <div className="mt-2">
              <span className="text-xs text-outline font-body-sm">Tasa de cobro</span>
            </div>
          </div>
        </div>

        {/* Gradient Separator */}
        <div className="h-[2px] w-full mb-stack-lg rounded-full" style={{ background: 'linear-gradient(90deg, #1A6FD4 0%, #F4F3F0 100%)' }} />

        {/* SECTION 2: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-stack-lg">
          {/* Line Chart */}
          <div className="lg:col-span-7 bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10">
            <div className="flex justify-between items-start mb-6 border-b border-outline-variant/20 pb-4">
              <div>
                <p className="font-label-eyebrow text-[12px] text-outline uppercase mb-1">EVOLUCIÓN</p>
                <h2 className="font-headline-sm text-[20px] text-primary">Ingresos por período</h2>
              </div>
              <div className="flex bg-[#F4F3F0] rounded-lg p-1 border border-outline-variant/50 custom-shadow">
                {(['week', 'month', 'year'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-5 py-2 rounded-md font-data-mono text-data-mono text-sm transition-colors ${
                      period === p ? 'bg-[#1A6FD4] text-white custom-shadow' : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {p === 'week' ? 'Semana' : p === 'month' ? 'Mes' : 'Año'}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length > 0
              ? <IncomeChart data={chartData} period={period} />
              : <div className="h-80 flex items-center justify-center text-on-surface-variant">Sin datos disponibles</div>
            }
          </div>

          {/* Method Donut */}
          <div className="lg:col-span-5 bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 flex flex-col">
            <div className="border-b border-outline-variant/20 pb-4 mb-6">
              <p className="font-label-eyebrow text-[12px] text-outline uppercase mb-1">DISTRIBUCIÓN</p>
              <h2 className="font-headline-sm text-[20px] text-primary">Breakdown por método de pago</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              {paymentMethods.length > 0 ? (
                <>
                  <MethodDonut methods={paymentMethods} />
                  <div className="w-full space-y-3 mt-0">
                    {paymentMethods.map((method) => {
                      const fill = method.payment_method === 'CASH' ? '#0A1628' : method.payment_method === 'MERCADO_PAGO' ? '#1A6FD4' : '#EAEAE6';
                      return (
                        <div key={method.payment_method} className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fill }} />
                            <span className="font-data-mono text-data-mono text-base">{formatPaymentMethod(method.payment_method)}</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-data-mono text-data-mono text-base font-medium">{formatCurrency(method.total_amount)}</span>
                            <span className="text-sm text-outline w-8 text-right">{method.percentage}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="text-on-surface-variant">Sin datos disponibles</div>
              )}
            </div>
          </div>
        </div>

        {/* SECTION 3: Table + Status */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-[32px]">
          {/* Debtors table */}
          <div className="lg:col-span-7 bg-white rounded-xl custom-shadow border border-outline-variant/10 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-outline-variant/20">
              <p className="font-label-eyebrow text-[12px] text-outline uppercase mb-1">SEGUIMIENTO</p>
              <h2 className="font-headline-sm text-[20px] text-primary">Pacientes con saldo pendiente</h2>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F8F6]">
                    {['Paciente', 'Tratamientos', 'Deuda Acumulada', 'Pagos Pend.'].map((h, i) => (
                      <th
                        key={h}
                        className={`font-label-eyebrow text-[12px] text-on-surface-variant uppercase p-5 border-b border-outline-variant/20 ${i === 2 ? 'text-right' : i === 3 ? 'text-center' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-base">
                  {topDebtors.length > 0 ? topDebtors.map((d, idx) => (
                    <tr key={idx} className="border-b border-outline-variant/10 hover:bg-[#F8F8F6] transition-colors">
                      <td className="p-5 font-medium text-primary">{d.patient_name}</td>
                      <td className="p-5 text-on-surface-variant">{d.treatments_with_debt} trat.</td>
                      <td className="p-5 text-right font-data-mono text-data-mono text-[#4A9EE8] font-bold">{formatCurrency(d.total_debt)}</td>
                      <td className="p-5 text-center">{d.pending_payments_count}</td>
                    </tr>
                  )) : (
                    <tr><td colSpan={4} className="p-5 text-center text-on-surface-variant">Sin deudores registrados</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-5 border-t border-outline-variant/20 bg-surface-bright text-center">
              <a className="font-data-mono text-data-mono text-sm text-[#1A6FD4] hover:text-secondary-container transition-colors inline-flex items-center gap-1 font-medium" href="#">
                Ver todos <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            </div>
          </div>

          {/* ← REDESIGNED: Estado de pagos del mes */}
          <PaymentStatusCard collectionRate={collectionRate} />
        </div>
      </main>

      <style>{`
        .navy-gradient { background: linear-gradient(180deg, #101c2e 0%, #001b3e 100%); }
        .custom-shadow { box-shadow: 0 2px 20px rgba(10,22,40,0.08); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e4e2e3; border-radius: 3px; }
      `}</style>
    </div>
  );
}
