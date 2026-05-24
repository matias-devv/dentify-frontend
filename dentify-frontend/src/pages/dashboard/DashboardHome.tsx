// src/pages/dashboard/DashboardHome.tsx
//
// Contenido de la vista "Inicio" del dentista.
// Ya no contiene sidebar, topbar ni layout propio.
// Recibe userProfile desde el outlet context a través de App.jsx.
//

import { useState, useEffect, useCallback } from "react";
import React from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../../api/apiClient";

// Sub-views (internal navigation within dashboard home still uses section state
// for modals/sub-panels like CrearTurno and TurnoDetail)
import { OtorgarTurnoView, type SelectedSlotContext } from "../turnos/TurnosViews";
import { CrearTurnoView }    from "../turnos/CrearTurnoView";
import { TurnoDetailView }   from "../turnos/TurnoDetailView";
import { AdmisionView }      from "../turnos/AdmisionView";
import { PacientesListView } from "../patients/PatientViews";
import { CreatePatientView } from "../patients/CreatePatientView";
import { ProductsView }      from "../products/ProductView";
import { AgendaListView, AgendaCreateView } from "../agendas/AgendaViews";

// ── Design tokens (keep in sync with DentistLayout) ──────────────────────────
const FONT_SANS  = "'DM Sans', sans-serif";
const FONT_SERIF = "'Playfair Display', Georgia, serif";

const C = {
  navy:          "#0F2244",
  navyMid:       "#1A2B4A",
  electric:      "#2563EB",
  bg:            "#F4F5F7",
  cardBg:        "#FFFFFF",
  border:        "#E4E6EC",
  textPrimary:   "#111827",
  textSecondary: "#6B7280",
  textMuted:     "#9CA3AF",
};

const POLL_INTERVAL_MS = 45_000;

// ── Types ─────────────────────────────────────────────────────────────────────
interface PaymentTodayResponse {
  id: number;
  patient_name: string;
  patient_surname: string;
  patient_id: number;
  time: string;
  amount: number;
  payment_method: "CASH" | "MERCADO_PAGO";
  payment_status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
  service_name: string;
  appointment_id: number;
  has_receipt: boolean;
}

interface CancelledAppointment {
  id_appointment: number;
  time: string;
  patient_name: string;
  patient_surname: string;
  cancelled_by: string;
  reason_for_cancellation: string | null;
  service_name: string;
  appointmentStart: string;
}

interface ConfirmCashPanelProps {
  payment: PaymentTodayResponse;
  onConfirm: (id: number, montoRecibido: number) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error?: string | null;
}

interface ConfirmCashRequest {
  id_payment: number;
  amount_received: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const CANCELLED_BY_LABEL: Record<string, string> = {
  CANCELLED_BY_PATIENT:   "Cancelado por paciente",
  CANCELLED_BY_DENTIST:   "Cancelado por odontólogo",
  CANCELLED_BY_SECRETARY: "Cancelado por secretario",
  CANCELLED_BY_SYSTEM:    "Cancelado por sistema",
  CANCELLED:              "Cancelado",
};

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);

const getSaludo = (h: number) => h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";

const extractTime = (isoString: string) => {
  if (!isoString) return "—";
  if (/^\d{2}:\d{2}(:\d{2})?$/.test(isoString)) return isoString.slice(0, 5);
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
};

const sortPaymentsByTime = (payments: PaymentTodayResponse[]) =>
  [...payments].sort((a, b) => a.time.localeCompare(b.time));

// ── Badge maps ────────────────────────────────────────────────────────────────
const APPOINTMENT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  SCHEDULED:       { label: "Programado",  bg: "#F0F1F5", color: "#5A6070" },
  CONFIRMED:       { label: "Confirmado",  bg: "#F0F4FF", color: "#3B4FBA" },
  ADMITTED:        { label: "Admitido",    bg: "#1A2B4A", color: "#FFFFFF" },
  IN_ATTENTION:    { label: "En atención", bg: "#2563EB", color: "#FFFFFF" },
  COMPLETED:       { label: "Completado",  bg: "#ECFDF5", color: "#065F46" },
  NO_SHOW:         { label: "Ausente",     bg: "#FEF2F2", color: "#991B1B" },
  WALK_IN_PENDING: { label: "Sin turno",   bg: "#FEF9C3", color: "#854D0E" },
  CANCELLED:       { label: "Cancelado",   bg: "#F9FAFB", color: "#9CA3AF" },
};

const PAYMENT_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  PENDING:   { label: "Pendiente", bg: "#FEF3C7", color: "#B45309" },
  PARTIAL:   { label: "Parcial",   bg: "#DBEAFE", color: "#1E40AF" },
  PAID:      { label: "Pagado",    bg: "#ECFDF5", color: "#065F46" },
  CANCELLED: { label: "Cancelado", bg: "#F3F4F6", color: "#6B7280" },
};

const NON_ADMITTABLE = new Set([
  "ADMITTED", "IN_ATTENTION", "COMPLETED", "NO_SHOW",
  "CANCELLED", "CANCELLED_BY_SYSTEM", "CANCELLED_BY_PATIENT",
  "CANCELLED_BY_DENTIST", "CANCELLED_BY_SECRETARY",
]);

// ── SVG Icons ──────────────────────────────────────────────────────────────────
const Icon = {
  cash: (<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="16" height="10" rx="1.5"/><circle cx="10" cy="10" r="2.5"/><path d="M5 10h.5M14.5 10h.5"/></svg>),
  link: (<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 11a4 4 0 005.6.4l2-2a4 4 0 00-5.6-5.6l-1.1 1.1"/><path d="M12 9a4 4 0 00-5.6-.4l-2 2a4 4 0 005.6 5.6l1.1-1.1"/></svg>),
  alertTriangle: (<svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 3L2 17h16L10 3z"/><path d="M10 9v4M10 15v.5"/></svg>),
  close: (<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg>),
  arrowRight: (<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7M6.5 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>),
  checkSmall: (<svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>),
};

// ── Shared sub-components ─────────────────────────────────────────────────────
function Badge({ status, map }: { status: string; map: Record<string, { label: string; bg: string; color: string }> }) {
  const cfg = map[status] || { label: status, bg: "#F3F4F6", color: "#374151" };
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 100, fontSize: 11, fontWeight: 600, letterSpacing: "0.03em", background: cfg.bg, color: cfg.color, whiteSpace: "nowrap" }}>
      {cfg.label}
    </span>
  );
}

function MetricCard({ label, value, sub, accent = false }: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div style={{ background: accent ? C.navy : C.cardBg, border: `1px solid ${accent ? "transparent" : C.border}`, borderRadius: 10, padding: "22px 24px", display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 0 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: accent ? "rgba(255,255,255,0.55)" : C.textMuted, fontFamily: FONT_SANS }}>{label}</span>
      <span style={{ fontSize: 26, fontWeight: 700, color: accent ? "#FFFFFF" : C.textPrimary, fontFamily: FONT_SANS, lineHeight: 1.1, letterSpacing: "-0.02em" }}>{value}</span>
      {sub && <span style={{ fontSize: 11, color: accent ? "rgba(255,255,255,0.4)" : C.textMuted, fontFamily: FONT_SANS }}>{sub}</span>}
    </div>
  );
}

function EmptyState({ text, positive = false }: { text: string; positive?: boolean }) {
  return (
    <div style={{ padding: "32px 0", textAlign: "center", color: positive ? "#065F46" : C.textMuted, fontSize: 13, fontFamily: FONT_SANS, letterSpacing: "0.01em" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: positive ? "#ECFDF5" : "#F4F5F7", margin: "0 auto 12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">{positive ? <path d="M3 8l3.5 3.5L13 4" stroke="#065F46" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/> : <path d="M8 5v4M8 11v.5" stroke={C.textMuted} strokeWidth="1.6" strokeLinecap="round"/>}</svg>
      </div>
      {text}
    </div>
  );
}

function Divider() { return <div style={{ height: 1, background: C.border }} />; }

function ColumnCard({ flex, children }: { flex: string; children: React.ReactNode }) {
  return (
    <div style={{ flex, background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 10, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      {children}
    </div>
  );
}

// ── ConfirmCashPanel ──────────────────────────────────────────────────────────
function ConfirmCashPanel({ payment, onConfirm, onCancel, isLoading, error }: ConfirmCashPanelProps) {
  const [montoRecibido, setMontoRecibido] = useState<string>("");

  const montoNumerico  = parseFloat(montoRecibido.replace(/\./g, "").replace(",", ".")) || 0;
  const vuelto         = montoNumerico - payment.amount;
  const puedeConfirmar = montoNumerico >= payment.amount;

  const shortcuts = [payment.amount, ...[500, 1000, 2000, 5000, 10000].filter((b) => b > payment.amount)].slice(0, 5);

  const handleShortcut = (val: number) => setMontoRecibido(val.toLocaleString("es-AR"));

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, "");
    if (raw === "") { setMontoRecibido(""); return; }
    setMontoRecibido(parseInt(raw, 10).toLocaleString("es-AR"));
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: C.electric, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", display: "flex" }}>{Icon.cash}</span>
          </div>
          <div>
            <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>Confirmar pago en efectivo</p>
            <p style={{ fontFamily: FONT_SANS, fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>{payment.patient_surname}, {payment.patient_name} · {payment.service_name}</p>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted }}>Monto a cobrar</p>
          <p style={{ fontFamily: FONT_SANS, fontSize: 22, fontWeight: 700, color: C.navy, letterSpacing: "-0.02em", marginTop: 2 }}>{formatCurrency(payment.amount)}</p>
        </div>
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: 18 }} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, marginBottom: 7 }}>Monto recibido</label>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontFamily: FONT_SANS, fontSize: 15, fontWeight: 600, color: C.textSecondary, pointerEvents: "none" }}>$</span>
          <input type="text" inputMode="numeric" value={montoRecibido} onChange={handleInput} placeholder="0" autoFocus aria-label="Monto recibido del paciente"
            style={{ width: "100%", padding: "11px 14px 11px 30px", border: `1.5px solid ${puedeConfirmar && montoRecibido ? "#86EFAC" : C.border}`, borderRadius: 8, fontFamily: FONT_SANS, fontSize: 16, fontWeight: 600, color: C.textPrimary, background: "#FFFFFF", outline: "none", transition: "border-color 0.15s" }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.electric)}
            onBlur={(e)  => { e.currentTarget.style.borderColor = puedeConfirmar && montoRecibido ? "#86EFAC" : C.border; }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 7, marginBottom: 16, flexWrap: "wrap" }}>
        {shortcuts.map((val) => (
          <button key={val} onClick={() => handleShortcut(val)} aria-label={`Usar ${formatCurrency(val)}`}
            style={{ padding: "6px 13px", border: `1.5px solid ${montoNumerico === val ? C.electric : C.border}`, borderRadius: 7, background: montoNumerico === val ? "#EFF6FF" : "#FFFFFF", color: montoNumerico === val ? C.electric : C.textSecondary, fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", whiteSpace: "nowrap" }}
          >
            {val === payment.amount ? `Exacto ${formatCurrency(val)}` : `+${formatCurrency(val)}`}
          </button>
        ))}
      </div>

      {montoRecibido !== "" && (
        <div aria-live="polite"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: puedeConfirmar ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${puedeConfirmar ? "#86EFAC" : "#FECACA"}`, borderRadius: 8, padding: "10px 16px", marginBottom: 16 }}
        >
          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600, color: puedeConfirmar ? "#065F46" : "#991B1B" }}>
            {puedeConfirmar ? "✓  Vuelto a entregar" : "Monto insuficiente"}
          </span>
          <span style={{ fontFamily: FONT_SANS, fontSize: 18, fontWeight: 700, color: puedeConfirmar ? "#065F46" : "#991B1B", letterSpacing: "-0.02em" }}>
            {puedeConfirmar ? formatCurrency(vuelto) : `Faltan ${formatCurrency(payment.amount - montoNumerico)}`}
          </span>
        </div>
      )}

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 7, padding: "8px 12px", marginBottom: 14, color: "#991B1B", fontFamily: FONT_SANS, fontSize: 12 }}>
          {Icon.alertTriangle}{error}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
        <button onClick={onCancel} disabled={isLoading} style={{ padding: "9px 20px", borderRadius: 7, border: `1px solid ${C.border}`, background: "#FFFFFF", color: C.textSecondary, fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, cursor: isLoading ? "default" : "pointer" }}>
          Cancelar
        </button>
        <button onClick={() => { if (puedeConfirmar) onConfirm(payment.id, montoNumerico); }} disabled={!puedeConfirmar || isLoading}
          style={{ padding: "9px 22px", borderRadius: 7, border: "none", background: puedeConfirmar && !isLoading ? C.electric : "#93C5FD", color: "#FFFFFF", fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, cursor: puedeConfirmar && !isLoading ? "pointer" : "default", display: "flex", alignItems: "center", gap: 7, opacity: !puedeConfirmar || isLoading ? 0.6 : 1, transition: "opacity 0.15s" }}
        >
          {isLoading ? <><span className="dh-spinner" />Confirmando...</> : <>{Icon.checkSmall} Confirmar</>}
        </button>
      </div>
    </div>
  );
}

// ── ConfirmCashModal ──────────────────────────────────────────────────────────
function ConfirmCashModal(props: ConfirmCashPanelProps) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape" && !props.isLoading) props.onCancel(); };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, [props.isLoading, props.onCancel]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(10,20,40,0.45)", display: "flex", alignItems: "center", justifyContent: "center", animation: "dh-fadeIn 0.18s ease" }}
      onClick={(e) => { if (e.target === e.currentTarget && !props.isLoading) props.onCancel(); }}
      role="dialog" aria-modal="true" aria-label="Confirmar pago en efectivo"
    >
      <div style={{ background: "#FFFFFF", borderRadius: 14, boxShadow: "0 20px 60px rgba(10,20,40,0.18), 0 4px 16px rgba(10,20,40,0.08)", width: "100%", maxWidth: 480, margin: "0 24px", padding: "28px 28px 24px", position: "relative", animation: "dh-scaleIn 0.2s cubic-bezier(0.34,1.2,0.64,1)" }}>
        {!props.isLoading && (
          <button onClick={props.onCancel} aria-label="Cerrar"
            style={{ position: "absolute", top: 16, right: 16, width: 28, height: 28, borderRadius: "50%", background: "#F3F4F6", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#E5E7EB")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#F3F4F6")}
          >
            {Icon.close}
          </button>
        )}
        <ConfirmCashPanel {...props} />
      </div>
    </div>
  );
}

// ── PaymentsTodayTable ────────────────────────────────────────────────────────
function PaymentsTodayTable({ payments, onPaymentConfirmed }: { payments: PaymentTodayResponse[]; onPaymentConfirmed: (u: PaymentTodayResponse) => void }) {
  const [modalPayment, setModalPayment] = useState<PaymentTodayResponse | null>(null);
  const [loadingId,    setLoadingId]    = useState<number | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const handleConfirm = async (id: number, montoRecibido: number) => {
    setLoadingId(id); setConfirmError(null);
    try {
      const payload: ConfirmCashRequest = { id_payment: id, amount_received: montoRecibido };
      const res = await apiClient.patch("/api/payments/confirm-cash", payload);
      onPaymentConfirmed(res.data as PaymentTodayResponse);
      setModalPayment(null);
    } catch (err: any) {
      setConfirmError(err?.response?.data?.message ?? err?.response?.data?.error ?? "Error al confirmar el pago. Intentá nuevamente.");
    } finally { setLoadingId(null); }
  };

  const needsAction   = (p: PaymentTodayResponse) => p.payment_method === "CASH" && (p.payment_status === "PENDING" || p.payment_status === "PARTIAL");
  const sortedPayments = sortPaymentsByTime(payments);

  if (sortedPayments.length === 0) return <EmptyState text="Sin pagos registrados para hoy" positive />;

  return (
    <>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ background: "#FAFBFC" }}>
            {[{ label: "Hora", w: "72px" }, { label: "Paciente", w: "auto" }, { label: "Monto", w: "110px" }, { label: "Estado", w: "96px" }, { label: "Medio", w: "110px" }, { label: "", w: "120px" }].map(({ label, w }, i) => (
              <th key={i} style={{ padding: i === 0 ? "8px 8px 8px 20px" : "8px 12px", textAlign: i === 2 ? "right" : "left", fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS, whiteSpace: "nowrap", width: w }}>
                {label}
              </th>
            ))}
          </tr>
          <tr><td colSpan={6} style={{ padding: 0, height: 1, background: C.border }} /></tr>
        </thead>
        <tbody>
          {sortedPayments.map((p, idx) => {
            const showAction = needsAction(p);
            return (
              <React.Fragment key={p.id}>
                <tr onMouseEnter={(e) => (e.currentTarget.style.background = "#FAFBFC")} onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")} style={{ background: "transparent", transition: "background 0.12s" }}>
                  <td style={{ padding: "11px 8px 11px 20px", whiteSpace: "nowrap" }}><span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.electric }}>{p.time}</span></td>
                  <td style={{ padding: "11px 12px", minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: FONT_SANS, fontSize: 13, color: C.textPrimary, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.patient_surname}, {p.patient_name}</span>
                    <span style={{ display: "block", fontFamily: FONT_SANS, fontSize: 11, color: C.textMuted, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.service_name}</span>
                  </td>
                  <td style={{ padding: "11px 12px", whiteSpace: "nowrap", textAlign: "right" }}><span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>{formatCurrency(p.amount)}</span></td>
                  <td style={{ padding: "11px 12px" }}><Badge status={p.payment_status} map={PAYMENT_BADGE} /></td>
                  <td style={{ padding: "11px 12px", whiteSpace: "nowrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: FONT_SANS, fontSize: 12, fontWeight: 500, color: p.payment_method === "CASH" ? "#166534" : "#1E40AF" }}>
                      {p.payment_method === "CASH" ? <><span style={{ display: "flex" }}>{Icon.cash}</span>Efectivo</> : <><span style={{ display: "flex" }}>{Icon.link}</span>Mercado Pago</>}
                    </span>
                  </td>
                  <td style={{ padding: "11px 20px 11px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                    {showAction ? (
                      <button className="dh-ver-btn" onClick={() => { setModalPayment(p); setConfirmError(null); }} disabled={loadingId === p.id} style={{ color: C.electric }}>
                        Confirmar pago
                      </button>
                    ) : p.has_receipt ? (
                      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#065F46", fontFamily: FONT_SANS, display: "inline-flex", alignItems: "center", gap: 4 }}>
                        {Icon.checkSmall} Comprobante
                      </span>
                    ) : null}
                  </td>
                </tr>
                {idx < sortedPayments.length - 1 && <tr><td colSpan={6} style={{ padding: 0, height: 1, background: "#F3F4F6" }} /></tr>}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      {modalPayment && (
        <ConfirmCashModal payment={modalPayment} onConfirm={handleConfirm} onCancel={() => { if (loadingId !== null) return; setModalPayment(null); setConfirmError(null); }} isLoading={loadingId === modalPayment.id} error={confirmError} />
      )}
    </>
  );
}

// ── CancelledAppointmentsToday ────────────────────────────────────────────────
function CancelledAppointmentsToday({ preloadedCancelled }: { preloadedCancelled: CancelledAppointment[] }) {
  const [expanded, setExpanded] = useState(true);
  const [items,    setItems]    = useState<CancelledAppointment[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [fetched,  setFetched]  = useState(false);

  const handleToggle = async () => {
    const willExpand = !expanded;
    setExpanded(willExpand);
    if (willExpand && !fetched) {
      setLoading(true);
      try {
        const res = await apiClient.get("/api/dashboard/cancelled/today");
        const raw = res.data;
        setItems(Array.isArray(raw) ? raw : (raw.details ?? []));
      } catch { setItems(preloadedCancelled); }
      finally { setLoading(false); setFetched(true); }
    }
  };

  const displayItems = fetched ? items : preloadedCancelled;
  const count        = preloadedCancelled.length;

  return (
    <>
      <div style={{ padding: "18px 20px 14px" }}>
        <div onClick={handleToggle} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Turnos cancelados hoy</span>
            <span style={{ background: count > 0 ? "#FEE2E2" : "#F3F4F6", color: count > 0 ? "#B91C1C" : C.textMuted, fontSize: 10.5, fontWeight: 700, borderRadius: 100, padding: "1px 8px" }}>{count}</span>
          </div>
          <span style={{ color: C.textMuted, display: "flex", transition: "transform 0.2s", transform: expanded ? "rotate(0deg)" : "rotate(-90deg)" }}>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4.5l3 3 3-3"/></svg>
          </span>
        </div>
      </div>
      <Divider />
      {expanded && (
        <div style={{ padding: "4px 12px 8px" }}>
          {loading ? (
            <div style={{ padding: "24px 0", textAlign: "center", fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Cargando...</div>
          ) : displayItems.length === 0 ? (
            <EmptyState text="No hubo cancelaciones hoy" positive />
          ) : (
            displayItems.map((a, idx) => {
              const motivo = a.reason_for_cancellation?.trim() || CANCELLED_BY_LABEL[a.cancelled_by] || "Cancelado";
              return (
                <div key={a.id_appointment}>
                  <div className="dh-alerta-row">
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#9CA3AF", flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: FONT_SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.patient_surname}, {a.patient_name}</p>
                      <p style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_SANS, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.time} · {motivo}</p>
                    </div>
                  </div>
                  {idx < displayItems.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                </div>
              );
            })
          )}
        </div>
      )}
    </>
  );
}

// ── useDashboardData hook ─────────────────────────────────────────────────────
function useDashboardData(intervalMs = POLL_INTERVAL_MS) {
  const [summary,   setSummary]   = useState<any>(null);
  const [proximos,  setProximos]  = useState<any[]>([]);
  const [payments,  setPayments]  = useState<PaymentTodayResponse[]>([]);
  const [cancelled, setCancelled] = useState<CancelledAppointment[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [summaryError,   setSummaryError]   = useState(false);
  const [appoError,      setAppoError]      = useState(false);

  const fetchAll = useCallback(async () => {
    const [sumRes, appoRes, payRes, canRes] = await Promise.allSettled([
      apiClient.get("/api/dashboard/summary"),
      apiClient.get("/api/appointments/day"),
      apiClient.get("/api/payments/today"),
      apiClient.get("/api/dashboard/cancelled/today"),
    ]);
    if (sumRes.status  === "fulfilled")  { setSummary(sumRes.value.data);   setSummaryError(false); } else { setSummaryError(true); }
    if (appoRes.status === "fulfilled")  { setProximos(appoRes.value.data); setAppoError(false); }   else { setAppoError(true); }
    if (payRes.status  === "fulfilled")  { setPayments(payRes.value.data as PaymentTodayResponse[]); }
    if (canRes.status  === "fulfilled")  { const raw = canRes.value.data; setCancelled(Array.isArray(raw) ? raw : (raw.details ?? [])); }
    setInitialLoading(false);
  }, []);

  useEffect(() => { fetchAll(); const t = setInterval(fetchAll, intervalMs); return () => clearInterval(t); }, [fetchAll, intervalMs]);

  const updatePayment = useCallback((updated: PaymentTodayResponse) => {
    setPayments((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  return { summary, proximos, setProximos, payments, cancelled, initialLoading, summaryError, appoError, refetch: fetchAll, updatePayment };
}

// ── DashboardHome ─────────────────────────────────────────────────────────────
const TURN_GRID  = "52px 1fr 106px 170px";
type ActionState = "loading" | "done" | "error";

export default function DashboardHome({ userProfile }: { userProfile: any }) {
  const navigate                        = useNavigate();
  const [now,          setNow]          = useState(new Date());
  const [actionStates, setActionStates] = useState<Record<number, ActionState>>({});
  // Internal sub-section state (for components that haven't been migrated to routes yet)
  const [activeSection,       setActiveSection]       = useState("home");
  const [slotContext,         setSlotContext]         = useState<SelectedSlotContext | null>(null);
  const [activeAppointmentId, setActiveAppointmentId] = useState<number | null>(null);

  const { summary, proximos, setProximos, payments, cancelled, initialLoading, summaryError, appoError, refetch, updatePayment } = useDashboardData();

  useEffect(() => { const t = setInterval(() => setNow(new Date()), 30_000); return () => clearInterval(t); }, []);

  const handleAction = useCallback(async (appointmentId: number, endpoint: string, nextStatus: string) => {
    setActionStates((prev) => ({ ...prev, [appointmentId]: "loading" }));
    try {
      await apiClient.patch(`/api/appointments/${endpoint}/${appointmentId}`);
      setProximos((prev) => prev.map((t) => t.id === appointmentId ? { ...t, status: nextStatus } : t));
      setActionStates((prev) => ({ ...prev, [appointmentId]: "done" }));
    } catch (err: any) {
      if (err?.response?.status === 409) {
        await refetch();
        setActionStates((prev) => { const n = { ...prev }; delete n[appointmentId]; return n; });
      } else {
        setActionStates((prev) => ({ ...prev, [appointmentId]: "error" }));
        setTimeout(() => setActionStates((prev) => { const n = { ...prev }; delete n[appointmentId]; return n; }), 3_000);
      }
    }
  }, [refetch, setProximos]);

  const handleAdmit          = useCallback((id: number) => handleAction(id, "admit",           "ADMITTED"),    [handleAction]);
  const handleStartAttention = useCallback((id: number) => handleAction(id, "start-attention", "IN_ATTENTION"), [handleAction]);
  const handleComplete       = useCallback((id: number) => handleAction(id, "complete",         "COMPLETED"),   [handleAction]);

  // Internal sub-section rendering (Turno-detail, Crear-turno, etc.)
  if (activeSection !== "home") {
    return (
      <>
        <DashboardStyles />
        {activeSection === "turnos-otorgar" && <OtorgarTurnoView onNavigate={setActiveSection} userProfile={userProfile} onSlotSelected={(ctx) => { setSlotContext(ctx); setActiveSection("crear-turno"); }} onAppointmentSelected={(id) => { setActiveAppointmentId(id); setActiveSection("turno-detail"); }} />}
        {activeSection === "crear-turno" && <CrearTurnoView onNavigate={setActiveSection} userProfile={userProfile} slotContext={slotContext} onAppointmentCreated={(r) => setActiveAppointmentId(r.id_appointment)} />}
        {activeSection === "turno-detail" && activeAppointmentId !== null && <TurnoDetailView onNavigate={setActiveSection} userProfile={userProfile} appointmentId={activeAppointmentId} />}
        {activeSection === "turnos-admision" && <AdmisionView onNavigate={setActiveSection} userProfile={userProfile} onAppointmentSelected={(id) => { setActiveAppointmentId(id); setActiveSection("turno-detail"); }} />}
        {activeSection === "pacientes-create" && <CreatePatientView onNavigate={setActiveSection} />}
      </>
    );
  }

  if (initialLoading) {
    return (
      <div style={{ minHeight: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textMuted }}>Cargando...</span>
      </div>
    );
  }

  const isApptStillAhead = (dateStr: string) => {
    if (!dateStr) return false;
    const timePart = dateStr.includes("T") ? dateStr.split("T")[1] : dateStr;
    const [h, m]   = timePart.split(":").map(Number);
    return h > now.getHours() || (h === now.getHours() && m > now.getMinutes());
  };

  const hayTurnosHoy      = proximos.length > 0;
  const hayProximoVigente = !!summary?.nextAppointment && isApptStillAhead(summary.nextAppointment.date);
  const horaProximo       = hayProximoVigente ? extractTime(summary.nextAppointment.date) : hayTurnosHoy ? "—" : null;
  const subProximo        = hayProximoVigente ? `${summary.nextAppointment.patient_name} ${summary.nextAppointment.patient_surname}` : hayTurnosHoy ? "Todos los turnos finalizaron" : "Sin turnos para hoy";

  const nombreDoctor    = userProfile ? `Dr. ${userProfile.name} ${userProfile.surname}` : "—";
  const clinicaLabel    = userProfile ? userProfile.clinicName.toUpperCase() : "";
  const saludo          = getSaludo(now.getHours());
  const fechaFormateada = now.toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long" }).replace(/^\w/, (c) => c.toUpperCase());
  const horaFormateada  = now.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
  const totalPendientes = payments.filter((p) => p.payment_status === "PENDING" || p.payment_status === "PARTIAL").length;

  return (
    <>
      <DashboardStyles />
      <div style={{ minHeight: "100%", background: C.bg, padding: "32px 36px" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32 }}>
          <div>
            <h1 style={{ fontFamily: FONT_SERIF, fontSize: 28, fontWeight: 400, color: C.textPrimary, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
              {saludo}, <span style={{ fontWeight: 500 }}>{nombreDoctor}</span>
            </h1>
            <p style={{ marginTop: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS }}>{clinicaLabel}</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ fontSize: 22, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS, letterSpacing: "-0.02em", lineHeight: 1 }}>{horaFormateada}</p>
            <p style={{ marginTop: 5, fontSize: 11.5, color: C.textSecondary, fontFamily: FONT_SANS, textTransform: "capitalize" }}>{fechaFormateada}</p>
          </div>
        </div>

        {/* Metrics */}
        <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
          <MetricCard label="Ingresos del día"  value={summaryError ? "—" : formatCurrency(summary?.dailyIncome ?? 0)}   sub="Pagos confirmados hoy" />
          <MetricCard label="Ingresos del mes"  value={summaryError ? "—" : formatCurrency(summary?.monthlyIncome ?? 0)} sub={`${now.toLocaleDateString("es-AR", { month: "long" }).replace(/^\w/, (c) => c.toUpperCase())} ${now.getFullYear()}`} />
          <MetricCard label="Turnos hoy"        value={summaryError ? "—" : summary?.appointmentsToday ?? 0}             sub="Agendados para hoy" />
          <MetricCard label="Próximo turno"     value={horaProximo ?? "—"}                                               sub={subProximo} accent />
        </div>

        {/* Three columns */}
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Col 1: Turnos del día */}
          <ColumnCard flex="0 0 35%">
            <div style={{ padding: "18px 20px 14px" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Turnos del día</span>
                <span style={{ fontSize: 11, color: C.textMuted, fontFamily: FONT_SANS }}>Siguientes atenciones</span>
              </div>
            </div>
            <Divider />
            <div style={{ display: "grid", gridTemplateColumns: TURN_GRID, alignItems: "center", padding: "8px 20px", background: "#FAFBFC", gap: 0 }}>
              {[{ label: "Hora", j: "flex-start" }, { label: "Paciente", j: "flex-start" }, { label: "Estado", j: "flex-start" }, { label: "", j: "flex-end" }].map(({ label, j }, i) => (
                <span key={i} style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: C.textMuted, fontFamily: FONT_SANS, display: "flex", justifyContent: j, paddingRight: i === 2 ? 8 : 0 }}>{label}</span>
              ))}
            </div>
            <Divider />
            <div style={{ padding: "4px 16px 0" }}>
              {appoError ? (
                <EmptyState text="Error al cargar los turnos" />
              ) : proximos.length === 0 ? (
                <EmptyState text="Sin turnos pendientes para hoy" />
              ) : (
                proximos.map((t: any, idx: number) => {
                  const estado   = t.status as string;
                  const canAdmit = !NON_ADMITTABLE.has(estado);
                  const id       = t.id as number;
                  const aState   = actionStates[id];
                  const isActing = aState === "loading";
                  const hasError = aState === "error";
                  const isDone   = aState === "done";
                  return (
                    <React.Fragment key={id}>
                      <div className="dh-turn-row" style={{ display: "grid", gridTemplateColumns: TURN_GRID, alignItems: "center", gap: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: C.electric, fontFamily: FONT_SANS, whiteSpace: "nowrap" }}>{extractTime(t.time)}</span>
                        <span style={{ fontSize: 13, fontWeight: 500, color: C.textPrimary, fontFamily: FONT_SANS, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingRight: 8 }}>{t.patient_surname}, {t.patient_name}</span>
                        <span style={{ paddingRight: 8 }}><Badge status={estado} map={APPOINTMENT_BADGE} /></span>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 25 }}>
                          {canAdmit && (
                            <button className="dh-btn-admitir" disabled={isActing} onClick={() => handleAdmit(id)}
                              style={{ opacity: isActing ? 0.65 : 1, ...(hasError ? { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FECACA" } : isDone ? { background: "#ECFDF5", color: "#065F46", borderColor: "#86EFAC" } : { background: C.electric, color: "#FFFFFF", borderColor: C.electric }) }}
                            >
                              {isActing ? <><span className="dh-btn-spinner" />Admitiendo</> : hasError ? <>⚠ Reintentar</> : isDone ? <>{Icon.checkSmall} Admitido</> : <>Admitir</>}
                            </button>
                          )}
                          {estado === "ADMITTED" && (
                            <button className="dh-btn-admitir" disabled={isActing} onClick={() => handleStartAttention(id)}
                              style={{ opacity: isActing ? 0.65 : 1, ...(hasError ? { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FECACA" } : { background: C.electric, color: "#FFFFFF", borderColor: C.electric }) }}
                            >
                              {isActing ? <><span className="dh-btn-spinner" />Iniciando</> : hasError ? <>⚠ Reintentar</> : <>En atención</>}
                            </button>
                          )}
                          {estado === "IN_ATTENTION" && (
                            <button className="dh-btn-admitir" disabled={isActing} onClick={() => handleComplete(id)}
                              style={{ opacity: isActing ? 0.65 : 1, ...(hasError ? { background: "#FEF2F2", color: "#B91C1C", borderColor: "#FECACA" } : { background: "#059669", color: "#FFFFFF", borderColor: "#059669" }) }}
                            >
                              {isActing ? <><span className="dh-btn-spinner" />Completando</> : hasError ? <>⚠ Reintentar</> : <>Completado</>}
                            </button>
                          )}
                          <button className="dh-btn-ver">Ver {Icon.arrowRight}</button>
                        </div>
                      </div>
                      {idx < proximos.length - 1 && <div style={{ height: 1, background: "#F3F4F6" }} />}
                    </React.Fragment>
                  );
                })
              )}
            </div>
            {!appoError && proximos.length > 0 && (<><div style={{ height: 8 }} /><Divider /><div style={{ padding: "12px 20px" }}><button className="dh-btn-ver" style={{ color: C.textSecondary }}>Ver agenda completa →</button></div></>)}
          </ColumnCard>

          {/* Col 2: Pagos del día */}
          <ColumnCard flex="1">
            <div style={{ padding: "18px 24px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, fontFamily: FONT_SANS }}>Pagos del día</span>
                  <span style={{ background: payments.length > 0 ? "#EFF6FF" : "#F3F4F6", color: payments.length > 0 ? C.electric : C.textMuted, fontSize: 10.5, fontWeight: 700, borderRadius: 100, padding: "1px 8px" }}>{payments.length}</span>
                  {totalPendientes > 0 && <span style={{ background: "#FEF3C7", color: "#92400E", fontSize: 10.5, fontWeight: 700, borderRadius: 100, padding: "1px 7px" }}>{totalPendientes} pendiente{totalPendientes > 1 ? "s" : ""}</span>}
                </div>
                <p style={{ fontSize: 10.5, color: C.textMuted, fontFamily: FONT_SANS, marginTop: 3 }}>Todos los pagos asociados a turnos de hoy</p>
              </div>
            </div>
            <Divider />
            <PaymentsTodayTable payments={payments} onPaymentConfirmed={updatePayment} />
            {payments.length > 0 && (<><Divider /><div style={{ padding: "10px 24px" }}><button className="dh-btn-ver" style={{ color: C.textSecondary }} onClick={() => navigate("/dentist/payments/pagos")}>Ver en Finanzas → Pagos →</button></div></>)}
          </ColumnCard>

          {/* Col 3: Cancelados hoy */}
          <ColumnCard flex="0 0 20%">
            <CancelledAppointmentsToday preloadedCancelled={cancelled} />
          </ColumnCard>
        </div>
      </div>
    </>
  );
}

// ── Scoped CSS (namespaced with "dh-" prefix to avoid collisions) ─────────────
function DashboardStyles() {
  return (
    <style>{`
      .dh-turn-row { padding: 10px 4px; cursor: default; transition: background 0.15s; border-radius: 6px; }
      .dh-turn-row:hover { background: #F8F9FB; }
      .dh-alerta-row { display: flex; align-items: center; gap: 12px; padding: 12px 4px; cursor: default; border-radius: 6px; transition: background 0.15s; }
      .dh-alerta-row:hover { background: #F8F9FB; }
      .dh-btn-admitir { display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; border-radius: 6px; border: 1.5px solid ${C.electric}; background: ${C.electric}; color: #FFFFFF; font-family: ${FONT_SANS}; font-size: 11.5px; font-weight: 600; letter-spacing: 0.02em; cursor: pointer; white-space: nowrap; transition: opacity 0.15s, background 0.15s, border-color 0.15s; line-height: 1; }
      .dh-btn-admitir:hover:not(:disabled) { opacity: 0.88; }
      .dh-btn-admitir:disabled { cursor: default; }
      .dh-btn-ver { display: inline-flex; align-items: center; gap: 4px; color: ${C.textMuted}; font-size: 11.5px; font-weight: 500; font-family: ${FONT_SANS}; letter-spacing: 0.01em; background: none; border: none; cursor: pointer; padding: 5px 6px; border-radius: 4px; transition: background 0.15s, color 0.15s; white-space: nowrap; line-height: 1; }
      .dh-btn-ver:hover { background: #F3F4F6; color: ${C.textSecondary}; }
      .dh-ver-btn { margin-left: auto; display: flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; font-family: ${FONT_SANS}; letter-spacing: 0.02em; background: none; border: none; cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: background 0.15s; white-space: nowrap; }
      .dh-ver-btn:hover:not(:disabled) { background: #EFF6FF; }
      .dh-ver-btn:disabled { cursor: default; }
      .dh-spinner, .dh-btn-spinner { width: 11px; height: 11px; border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff; border-radius: 50%; animation: dh-spin 0.65s linear infinite; flex-shrink: 0; }
      @keyframes dh-spin { to { transform: rotate(360deg); } }
      @keyframes dh-fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes dh-scaleIn { from { opacity: 0; transform: scale(0.94) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
    `}</style>
  );
}