// PaymentSummary.jsx
//
// PERFORMANCE FIX:
// - DonutChart wrapped with React.memo (evita re-render cuando colapsa sidebar)
// - useCallback en handlers de estado para referencias estables
// - useMemo en derivados (confirmedPct, pendingPct) para evitar recálculos
// - Los demás useState / useEffect no cambian

'use client';

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import apiClient from '../../api/apiClient';
import IncomeChart from './ui/IncomeChart';

// ==================== HELPERS ====================
const formatCurrency = (value) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value || 0);
};

const getDateRange = (type) => {
  const today = new Date();
  let startDate, endDate;
  endDate = today;
  if (type === 'week') {
    startDate = new Date(today);
    startDate.setDate(today.getDate() - 6);
  } else if (type === 'month') {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  } else {
    startDate = new Date(today.getFullYear(), 0, 1);
  }
  const formatDate = (d) => d.toISOString().split('T')[0];
  return { startDate: formatDate(startDate), endDate: formatDate(endDate) };
};

const formatPaymentMethod = (method) => {
  const map = { CASH: 'Efectivo', MERCADO_PAGO: 'Mercado Pago' };
  return map[method] || method;
};

// ==================== DONUT SVG ARTESANAL ====================================
// FIX: React.memo impide que este componente pesado (paths SVG, cálculos de
// porcentajes) se vuelva a renderizar cuando el padre cambia por colapso del
// sidebar u otros estados no relacionados.
const DonutChart = memo(function DonutChart({ methods }) {
  if (!methods || methods.length === 0) {
    return <div className="text-on-surface-variant">Sin datos</div>;
  }

  const total = methods.reduce((sum, m) => sum + (m.total_amount || 0), 0);
  let currentOffset = 0;
  const segments = [];

  methods.forEach((method, idx) => {
    const percentage = total > 0 ? ((method.total_amount || 0) / total) * 100 : 0;
    const fill =
      method.payment_method === 'CASH'
        ? '#0A1628'
        : method.payment_method === 'MERCADO_PAGO'
        ? '#1A6FD4'
        : '#EAEAE6';
    segments.push({
      id: idx,
      percentage,
      dasharray: `${percentage}, 100`,
      dashoffset: -currentOffset,
      stroke: fill,
    });
    currentOffset += percentage;
  });

  return (
    <div className="relative w-56 h-56 mb-8">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
        {segments.map((seg) => (
          <path
            key={seg.id}
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke={seg.stroke}
            strokeDasharray={seg.dasharray}
            strokeDashoffset={seg.dashoffset}
            strokeWidth="4"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-data-mono text-data-mono text-3xl font-bold text-primary">100%</span>
        <span className="text-sm text-outline font-body-sm">Total</span>
      </div>
    </div>
  );
});

// ==================== COMPONENT ====================
export default function PaymentSummary() {
  const [kpis, setKpis] = useState({
    today_income: 0,
    monthly_income: 0,
    total_outstanding_balance: 0,
    outstanding_payments: 0,
  });
  const [chartData, setChartData] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [topDebtors, setTopDebtors] = useState([]);
  const [collectionRate, setCollectionRate] = useState({
    totalPaymentsMonth: 0,
    confirmedPayments: 0,
    pendingPayments: 0,
    ratePercentage: 0,
  });
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      try {
        const [kpisRes, methodsRes, debtorsRes, rateRes] = await Promise.all([
          apiClient.get('/api/payments/kpis'),
          apiClient.get('/api/payments/by-method', { params: { year, month } }),
          apiClient.get('/api/payments/top-debtors'),
          apiClient.get('/api/payments/collection-rate', { params: { year, month } }),
        ]);
        setKpis(kpisRes.data || {});
        setPaymentMethods(Array.isArray(methodsRes.data) ? methodsRes.data : []);
        setTopDebtors(Array.isArray(debtorsRes.data) ? debtorsRes.data.slice(0, 5) : []);
        setCollectionRate(rateRes.data || {});
      } catch (error) {
        console.error('Error fetching initial data:', error.response?.status, error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const now = new Date();
        let response;
        if (period === 'week') {
          const { startDate, endDate } = getDateRange('week');
          response = await apiClient.get('/api/payments/weekly', { params: { startDate, endDate } });
        } else if (period === 'month') {
          response = await apiClient.get('/api/payments/monthly', {
            params: { year: now.getFullYear(), month: now.getMonth() + 1 },
          });
        } else {
          response = await apiClient.get('/api/payments/yearly', { params: { year: now.getFullYear() } });
        }
        setChartData(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error('Error fetching chart data:', error.response?.status, error.message);
      }
    };
    fetchChartData();
  }, [period]);

  // FIX: useCallback para los handlers del período — referencia estable entre
  // re-renders, evita que los botones tengan nuevas props en cada ciclo.
  const handleWeek  = useCallback(() => setPeriod('week'),  []);
  const handleMonth = useCallback(() => setPeriod('month'), []);
  const handleYear  = useCallback(() => setPeriod('year'),  []);

  // FIX: useMemo para derivados — no recalcular en cada render.
  const { total, confirmed, pending, confirmedPct, pendingPct } = useMemo(() => {
    const total     = collectionRate.totalPaymentsMonth;
    const confirmed = collectionRate.confirmedPayments;
    const pending   = collectionRate.pendingPayments;
    return {
      total,
      confirmed,
      pending,
      confirmedPct: total > 0 ? (confirmed / total) * 100 : 0,
      pendingPct:   total > 0 ? (pending   / total) * 100 : 0,
    };
  }, [collectionRate]);

  // FIX: useMemo para la data del donut de estado de pagos — evita recrear
  // el array en cada render.
  const collectionDonutData = useMemo(() => [
    { name: 'Confirmados', value: confirmed },
    { name: 'Pendientes',  value: pending  },
  ], [confirmed, pending]);

  return (
    <div className="bg-[#F4F3F0] text-on-surface font-body-md min-h-screen">
      <main className="px-8 py-8 pb-24 w-full">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-6">
          <div>
            <p className="font-label-eyebrow text-[12px] text-[#1A6FD4] uppercase mb-2 tracking-widest">
              MÓDULO FINANCIERO
            </p>
            <h1 className="font-headline-lg text-headline-lg text-primary mb-1" style={{ fontSize: '2rem' }}>
              Resumen
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant font-light">
              Panel de gestión financiera · Mayo 2026
            </p>
          </div>
        </div>

        {/* SECTION 1: KPI Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-stack-lg">
          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 relative overflow-hidden group hover:border-[#1A6FD4]/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">Pagos confirmados hoy</p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">payments</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="font-data-mono text-data-mono text-[32px] font-medium tracking-tight text-primary">
                {formatCurrency(kpis.today_income)}
              </h3>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600">▲ 12%</span>
              <span className="text-xs text-outline font-body-sm">vs ayer</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 relative overflow-hidden group hover:border-[#1A6FD4]/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">Mayo 2026</p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">account_balance_wallet</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="font-data-mono text-data-mono text-[32px] font-medium tracking-tight text-primary">
                {formatCurrency(kpis.monthly_income)}
              </h3>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="inline-flex items-center text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-emerald-50 text-emerald-600">▲ 5.4%</span>
              <span className="text-xs text-outline font-body-sm">vs mes anterior</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 relative overflow-hidden group hover:border-[#4A9EE8]/30 transition-colors">
            <div className="absolute top-0 left-0 w-1 h-full bg-[#4A9EE8]"></div>
            <div className="flex justify-between items-start mb-2 pl-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">En tratamientos activos</p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">receipt_long</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1 pl-2">
              <h3 className="font-data-mono text-data-mono text-[32px] font-medium tracking-tight text-[#4A9EE8]">
                {formatCurrency(kpis.total_outstanding_balance)}
              </h3>
            </div>
            <div className="mt-2 pl-2">
              <span className="text-xs text-outline font-body-sm">Saldo pendiente total</span>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 relative overflow-hidden group hover:border-[#1A6FD4]/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <p className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase">
                Turnos cobrados este mes
              </p>
              <span className="material-symbols-outlined text-outline/50 text-[18px]">trending_up</span>
            </div>
            <div className="flex items-baseline gap-2 mb-1">
              <h3 className="font-data-mono text-data-mono text-[32px] font-medium tracking-tight text-primary">
                {Math.round(collectionRate.ratePercentage)}%
              </h3>
            </div>
            <div className="mt-2">
              <span className="text-xs text-outline font-body-sm">Tasa de cobro</span>
            </div>
          </div>
        </div>

        {/* Gradient Separator */}
        <div
          className="h-[2px] w-full mb-stack-lg rounded-full"
          style={{ background: 'linear-gradient(90deg, #1A6FD4 0%, #F4F3F0 100%)' }}
        />

        {/* SECTION 2: Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-stack-lg">
          {/* Area Chart */}
          <div className="lg:col-span-7 bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10">
            <div className="flex justify-between items-start mb-6 border-b border-outline-variant/20 pb-4">
              <div>
                <p className="font-label-eyebrow text-[12px] text-outline uppercase mb-1">EVOLUCIÓN</p>
                <h2 className="font-headline-sm text-[20px] text-primary">Ingresos por período</h2>
              </div>
              {/* FIX: onClick con referencias estables (useCallback) */}
              <div className="flex bg-[#F4F3F0] rounded-lg p-1 border border-outline-variant/50 custom-shadow">
                <button
                  onClick={handleWeek}
                  className={`px-5 py-2 rounded-md font-data-mono text-data-mono text-sm transition-colors ${
                    period === 'week' ? 'bg-[#1A6FD4] text-white custom-shadow' : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  Semana
                </button>
                <button
                  onClick={handleMonth}
                  className={`px-5 py-2 rounded-md font-data-mono text-data-mono text-sm transition-colors ${
                    period === 'month' ? 'bg-[#1A6FD4] text-white custom-shadow' : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  Mes
                </button>
                <button
                  onClick={handleYear}
                  className={`px-5 py-2 rounded-md font-data-mono text-data-mono text-sm transition-colors ${
                    period === 'year' ? 'bg-[#1A6FD4] text-white custom-shadow' : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                >
                  Año
                </button>
              </div>
            </div>

            {chartData.length > 0 ? (
              // IncomeChart ya tiene React.memo — no re-renderiza por colapso del sidebar
              <IncomeChart data={chartData} period={period} />
            ) : (
              <div className="h-80 flex items-center justify-center text-on-surface-variant">
                Sin datos disponibles
              </div>
            )}
          </div>

          {/* Donut Chart — método de pago */}
          <div className="lg:col-span-5 bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 flex flex-col">
            <div className="border-b border-outline-variant/20 pb-4 mb-6">
              <p className="font-label-eyebrow text-[12px] text-outline uppercase mb-1">DISTRIBUCIÓN</p>
              <h2 className="font-headline-sm text-[20px] text-primary">Breakdown por método de pago</h2>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              {paymentMethods.length > 0 ? (
                <>
                  {/* DonutChart ya tiene React.memo */}
                  <DonutChart methods={paymentMethods} />
                  <div className="w-full space-y-3 mt-0">
                    {paymentMethods.map((method) => {
                      const fill =
                        method.payment_method === 'CASH'
                          ? '#0A1628'
                          : method.payment_method === 'MERCADO_PAGO'
                          ? '#1A6FD4'
                          : '#EAEAE6';
                      return (
                        <div
                          key={method.payment_method}
                          className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-container-low transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: fill }} />
                            <span className="font-data-mono text-data-mono text-base">
                              {formatPaymentMethod(method.payment_method)}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="font-data-mono text-data-mono text-base font-medium">
                              {formatCurrency(method.total_amount)}
                            </span>
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

        {/* SECTION 3: Tables & Status */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-[32px]">
          {/* Tabla deudores */}
          <div className="lg:col-span-7 bg-white rounded-xl custom-shadow border border-outline-variant/10 overflow-hidden flex flex-col">
            <div className="p-6 border-b border-outline-variant/20">
              <p className="font-label-eyebrow text-[12px] text-outline uppercase mb-1">SEGUIMIENTO</p>
              <h2 className="font-headline-sm text-[20px] text-primary">Pacientes con saldo pendiente</h2>
            </div>
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F8F6]">
                    <th className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase p-5 border-b border-outline-variant/20">Paciente</th>
                    <th className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase p-5 border-b border-outline-variant/20">Tratamientos</th>
                    <th className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase p-5 border-b border-outline-variant/20 text-right">Deuda Acumulada</th>
                    <th className="font-label-eyebrow text-[12px] text-on-surface-variant uppercase p-5 border-b border-outline-variant/20 text-center">Pagos Pend.</th>
                  </tr>
                </thead>
                <tbody className="text-base">
                  {topDebtors.length > 0 ? (
                    topDebtors.map((debtor, idx) => (
                      <tr key={idx} className="border-b border-outline-variant/10 hover:bg-[#F8F8F6] transition-colors">
                        <td className="p-5 font-medium text-primary">{debtor.patient_name}</td>
                        <td className="p-5 text-on-surface-variant">{debtor.treatments_with_debt} trat.</td>
                        <td className="p-5 text-right font-data-mono text-data-mono text-[#4A9EE8] font-bold">
                          {formatCurrency(debtor.total_debt)}
                        </td>
                        <td className="p-5 text-center">{debtor.pending_payments_count}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-5 text-center text-on-surface-variant">
                        Sin deudores registrados
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-5 border-t border-outline-variant/20 bg-surface-bright text-center">
              <a
                className="font-data-mono text-data-mono text-sm text-[#1A6FD4] hover:text-secondary-container transition-colors inline-flex items-center gap-1 font-medium"
                href="#"
              >
                Ver todos <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </a>
            </div>
          </div>

          {/* Estado de pagos del mes */}
          <div className="lg:col-span-5 bg-white rounded-xl p-6 custom-shadow border border-outline-variant/10 flex flex-col">
            <div className="border-b border-outline-variant/20 pb-4 mb-6">
              <p className="font-label-eyebrow text-[12px] text-outline uppercase tracking-widest mb-1">COBROS</p>
              <h2 className="font-headline-sm text-[20px] text-primary">Estado de pagos del mes</h2>
            </div>

            <div className="flex-1 flex flex-col items-center gap-6">
              {/* Donut Recharts — data memoizada */}
              <div className="w-52 h-52 shrink-0">
                {total > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={collectionDonutData}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={80}
                        startAngle={90}
                        endAngle={-270}
                        dataKey="value"
                        strokeWidth={0}
                        paddingAngle={2}
                      >
                        <Cell fill="#0A1628" />
                        <Cell fill="#1A6FD4" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[{ name: 'Sin datos', value: 1 }]}
                        cx="50%"
                        cy="50%"
                        innerRadius={58}
                        outerRadius={80}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        <Cell fill="#E5E7EB" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Stat cards */}
              <div className="w-full grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-4 border border-[#0A1628]/8"
                  style={{ background: 'linear-gradient(135deg, #F2F4F8 0%, #EEF1F6 100%)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#0A1628] shrink-0" />
                    <span className="font-label-eyebrow text-[9px] text-on-surface-variant uppercase tracking-widest font-bold">
                      Confirmados
                    </span>
                  </div>
                  <p className="font-data-mono text-[32px] font-bold text-primary leading-none tabular-nums">
                    {confirmed}
                  </p>
                  <p className="text-[10px] text-outline font-data-mono mt-2">
                    {confirmedPct.toFixed(1)}% del total
                  </p>
                  <div className="mt-3 h-1 bg-[#D1D5DC] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#0A1628] rounded-full transition-all duration-700"
                      style={{ width: `${confirmedPct}%` }}
                    />
                  </div>
                </div>

                <div
                  className="rounded-xl p-4 border border-[#1A6FD4]/10"
                  style={{ background: 'linear-gradient(135deg, #EEF4FC 0%, #E5EEFA 100%)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-[#1A6FD4] shrink-0" />
                    <span className="font-label-eyebrow text-[9px] text-[#1A6FD4] uppercase tracking-widest font-bold">
                      Pendientes
                    </span>
                  </div>
                  <p className="font-data-mono text-[32px] font-bold text-[#1A6FD4] leading-none tabular-nums">
                    {pending}
                  </p>
                  <p className="text-[10px] text-[#1A6FD4]/60 font-data-mono mt-2">
                    {pendingPct.toFixed(1)}% del total
                  </p>
                  <div className="mt-3 h-1 bg-[#BDD4EF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1A6FD4] rounded-full transition-all duration-700"
                      style={{ width: `${pendingPct}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Barra global */}
              <div className="w-full">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-data-mono text-outline uppercase tracking-wider">
                    Progreso de cobro
                  </span>
                  <span className="text-[10px] font-data-mono text-on-surface-variant font-bold">
                    {confirmed}/{total}
                  </span>
                </div>
                <div className="relative h-2 bg-[#EAEAE6] rounded-full overflow-hidden">
                  <div
                    className="absolute left-0 top-0 h-full rounded-full transition-all duration-700 ease-in-out"
                    style={{
                      width: `${confirmedPct}%`,
                      background: 'linear-gradient(90deg, #0A1628 0%, #1A6FD4 100%)',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .custom-shadow { box-shadow: 0 2px 20px rgba(10, 22, 40, 0.08); }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #e4e2e3; border-radius: 3px; }
      `}</style>
    </div>
  );
}