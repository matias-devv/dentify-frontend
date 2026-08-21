import { useState, useEffect, useCallback } from 'react';
import { AxiosResponse } from 'axios';
import {
  Download,
  Wallet,
  Banknote,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import api from '../../api/apiClient';

// ── Types ────────────────────────────────────────────────────────────────────

export type PaymentStatus = 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED' | 'CANCELLED' | 'EXPIRED';
export type PaymentMethod = 'CASH' | 'MERCADO_PAGO';

export interface MercadoPagoData {
  paymentId: string;
  mpStatus: string;
  payerEmail: string;
  approvalDate: string;
}

export interface Payment {
  id: string;
  date: string;
  time: string;
  patient: string;
  treatment: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  hasReceipt: boolean;
  isOldDebt?: boolean;
  mpData?: MercadoPagoData;
  appointmentDate?: string;
  appointmentStatus?: string;
  basePrice: number;
  pendingBalance: number;
  paidPercentage: number;
}

// ── Shared type for ConfirmCashModal ──────────────────────────────────────────

interface PaymentTodayResponse {
  id: number;
  patient_name: string;
  patient_surname: string;
  patient_id: number;
  time: string;
  amount: number;
  payment_method: 'CASH' | 'MERCADO_PAGO';
  payment_status: 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED';
  service_name: string;
  appointment_id: number;
  has_receipt: boolean;
}

interface ConfirmCashPanelProps {
  payment: PaymentTodayResponse;
  onConfirm: (id: number, montoRecibido: number) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error?: string | null;
  onOverchargeRequest?: (montoIngresado: number) => void;
}

// ── API response types ────────────────────────────────────────────────────────

interface PaymentSummaryDTO {
  payment_id: number;
  date: string;
  time: string;
  patient_name: string;
  patient_id: number;
  product_name: string;
  treatment_id: number;
  amount: number;
  payment_method: string;
  payment_status: string;
  comprobant_url: string | null;
  appointment_id: number | null;
}

interface PageResponse {
  content: PaymentSummaryDTO[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
}

interface PaymentDetailResponse {
  payment_id: number;
  amount: string;
  payment_method: string;
  payment_status: string;
  date_generation: string;
  total_fees: number | null;
  paid_fees: number | null;
  comprobant_url: string | null;
  appointment: {
    appointment_id: number;
    date: string;
    start_time: string;
    appointment_status: string;
  } | null;
  treatment: {
    treatment_id: number;
    product_name: string;
    base_price: string;
    outstanding_balance: string;
    treatment_status: string;
  };
  patient: {
    patient_id: number;
    name: string;
    surname: string;
  };
  mercadopago_detail: {
    payment_id: string;
    preference_id: string;
    status: string;
    status_detail: string;
    installments: number | null;
    payment_type_id: string;
    transaction_amount: string;
    payer_email: string;
    date_approved: string | null;
  } | null;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function formatDateFromISO(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatTimeFromISO(isoDateTime: string): string {
  const timePart = isoDateTime.includes('T') ? isoDateTime.split('T')[1] : isoDateTime;
  return timePart.substring(0, 5);
}

function mapSummaryToPayment(dto: PaymentSummaryDTO): Payment {
  return {
    id: String(dto.payment_id),
    date: formatDateFromISO(dto.date),
    time: dto.time.substring(0, 5),
    patient: dto.patient_name,
    treatment: dto.product_name,
    amount: Number(dto.amount),
    method: dto.payment_method as PaymentMethod,
    status: dto.payment_status as PaymentStatus,
    hasReceipt: dto.comprobant_url != null,
    isOldDebt: false,
    mpData: undefined,
    appointmentDate: undefined,
    appointmentStatus: undefined,
    basePrice: 0,
    pendingBalance: 0,
    paidPercentage: 0,
  };
}

function mapDetailToPayment(dto: PaymentDetailResponse): Payment {
  const basePrice = Number(dto.treatment.base_price);
  const pendingBalance = Number(dto.treatment.outstanding_balance);
  const paidPercentage =
    basePrice > 0 ? Math.round(((basePrice - pendingBalance) / basePrice) * 100) : 0;

  const dateStr = formatDateFromISO(dto.date_generation.split('T')[0]);
  const timeStr = dto.appointment
    ? dto.appointment.start_time.substring(0, 5)
    : formatTimeFromISO(dto.date_generation);

  const appointmentDate = dto.appointment
    ? `${formatDateFromISO(dto.appointment.date)} · ${dto.appointment.start_time.substring(0, 5)}`
    : undefined;

  const appointmentStatus = dto.appointment?.appointment_status ?? undefined;

  const isOldDebt =
    appointmentStatus === 'COMPLETED' && dto.payment_status !== 'PAID';

  let mpData: MercadoPagoData | undefined;
  if (dto.mercadopago_detail) {
    const mp = dto.mercadopago_detail;
    mpData = {
      paymentId: mp.payment_id,
      mpStatus: mp.status,
      payerEmail: mp.payer_email,
      approvalDate: mp.date_approved
        ? new Date(mp.date_approved).toLocaleDateString('es-AR')
        : '—',
    };
  }

  return {
    id: String(dto.payment_id),
    date: dateStr,
    time: timeStr,
    patient: `${dto.patient.surname}, ${dto.patient.name}`,
    treatment: dto.treatment.product_name,
    amount: Number(dto.amount),
    method: dto.payment_method as PaymentMethod,
    status: dto.payment_status as PaymentStatus,
    hasReceipt: dto.comprobant_url != null,
    isOldDebt,
    mpData,
    appointmentDate,
    appointmentStatus,
    basePrice,
    pendingBalance,
    paidPercentage,
  };
}

// ── Design tokens (shared with modal components) ──────────────────────────────

const C = {
  navy:          '#0F2244',
  electric:      '#2563EB',
  border:        '#E4E6EC',
  textPrimary:   '#111827',
  textSecondary: '#6B7280',
  textMuted:     '#9CA3AF',
};

const FONT_SANS = "'DM Sans', Arial, sans-serif";

const formatCurrency = (n: number) =>
  new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(n);

const ModalIcon = {
  cash: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="16" height="10" rx="1.5"/>
      <circle cx="10" cy="10" r="2.5"/>
      <path d="M5 10h.5M14.5 10h.5"/>
    </svg>
  ),
  alertTriangle: (
    <svg width="13" height="13" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 3L2 17h16L10 3z"/>
      <path d="M10 9v4M10 15v.5"/>
    </svg>
  ),
  close: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3 3l10 10M13 3L3 13"/>
    </svg>
  ),
  checkSmall: (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

// ── Design tokens (PaymentsView) ──────────────────────────────────────────────

const statusConfig: Record<PaymentStatus, { bg: string; text: string; border: string; label: string }> = {
  PENDING:   { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', label: 'PENDIENTE' },
  PAID:      { bg: '#ECFDF5', text: '#065F46', border: '#A7F3D0', label: 'PAGADO' },
  PARTIAL:   { bg: '#EFF6FF', text: '#1A6FD4', border: '#BFDBFE', label: 'PARCIAL' },
  FAILED:    { bg: '#FEF2F2', text: '#991B1B', border: '#FECACA', label: 'FALLIDO' },
  CANCELLED: { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB', label: 'CANCELADO' },
  EXPIRED:   { bg: '#F9FAFB', text: '#6B7280', border: '#E5E7EB', label: 'EXPIRADO' },
};

const appointmentStatusConfig: Record<string, { text: string; bg: string; border: string }> = {
  PROGRAMADO: { text: '#1A6FD4', bg: '#EFF6FF', border: '#BFDBFE' },
  COMPLETADO: { text: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
  CANCELADO:  { text: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
  COMPLETED:  { text: '#065F46', bg: '#ECFDF5', border: '#A7F3D0' },
  SCHEDULED:  { text: '#1A6FD4', bg: '#EFF6FF', border: '#BFDBFE' },
  CANCELLED:  { text: '#6B7280', bg: '#F9FAFB', border: '#E5E7EB' },
};

// ── Shared sub-components ─────────────────────────────────────────────────────

function StatusBadge({ status }: { status: PaymentStatus }) {
  const cfg = statusConfig[status];
  return (
    <span
      style={{
        display: 'inline-block',
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        borderRadius: 4,
        padding: '3px 8px',
        fontFamily: FONT_SANS,
        fontSize: 10,
        fontWeight: 500,
        letterSpacing: '1.5px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {cfg.label}
    </span>
  );
}

function MethodCell({ method }: { method: PaymentMethod }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {method === 'CASH' ? (
        <Banknote size={15} color="#5A6A7A" strokeWidth={1.5} />
      ) : (
        <Wallet size={15} color="#5A6A7A" strokeWidth={1.5} />
      )}
      <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 300, color: '#5A6A7A' }}>
        {method === 'CASH' ? 'Efectivo' : 'Mercado Pago'}
      </span>
    </div>
  );
}

function formatARS(n: number) {
  return `$ ${n.toLocaleString('es-AR')}`;
}

// ── OverchargeConfirmationModal ───────────────────────────────────────────────

interface OverchargeConfirmationModalProps {
  montoAPagar: number;
  montoIngresado: number;
  onConfirm: () => void;
  onEdit: () => void;
}

function OverchargeConfirmationModal({ montoAPagar, montoIngresado, onConfirm, onEdit }: OverchargeConfirmationModalProps) {
  const sobresaldo = montoIngresado - montoAPagar;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        background: 'rgba(10, 20, 40, 0.50)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: '#FFFFFF', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(10,20,40,0.20)',
          width: '100%', maxWidth: 420, margin: '0 24px', padding: '28px',
          textAlign: 'center',
        }}
      >
        {/* Icono warning */}
        <div
          style={{
            width: 48, height: 48, borderRadius: '50%',
            background: '#FEF3C7', border: '2px solid #FCD34D',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <AlertTriangle size={24} color="#D97706" />
        </div>

        <h3 style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 700, color: C.textPrimary, margin: '0 0 4px' }}>
          Monto excede el precio
        </h3>
        <p style={{ fontFamily: FONT_SANS, fontSize: 13, color: C.textSecondary, margin: '0 0 20px', lineHeight: 1.5 }}>
          El monto ingresado es mayor al precio del pago.<br />
          ¿Estás seguro de que querés confirmar con este monto?
        </p>

        {/* Bloque de montos */}
        <div
          style={{
            background: '#F9FAFB', borderRadius: 10, padding: '16px 20px',
            marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Monto a cobrar</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 600, color: '#065F46' }}>
              {formatCurrency(montoAPagar)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Monto ingresado</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 600, color: '#1A6FD4' }}>
              {formatCurrency(montoIngresado)}
            </span>
          </div>
          <div style={{ height: 1, background: '#E4E6EC' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontFamily: FONT_SANS, fontSize: 12, color: C.textMuted }}>Sobresaldo</span>
            <span style={{ fontFamily: FONT_SANS, fontSize: 16, fontWeight: 700, color: '#DC2626' }}>
              {formatCurrency(sobresaldo)}
            </span>
          </div>
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button
            onClick={onEdit}
            style={{
              padding: '10px 24px', borderRadius: 8, border: '1px solid #2563EB',
              background: '#FFFFFF', color: '#2563EB', fontFamily: FONT_SANS,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Editar monto
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#2563EB', color: '#FFFFFF', fontFamily: FONT_SANS,
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Confirmar igual
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ConfirmCashPanel ──────────────────────────────────────────────────────────

function ConfirmCashPanel({ payment, onConfirm, onCancel, isLoading, error, onOverchargeRequest }: ConfirmCashPanelProps) {
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [showOverchargeWarning, setShowOverchargeWarning] = useState(false);

  const montoNumerico  = parseFloat(montoRecibido.replace(/\./g, '').replace(',', '.')) || 0;
  const vuelto         = montoNumerico - payment.amount;
  const puedeConfirmar = montoNumerico >= payment.amount;

  const shortcuts = [
    payment.amount,
    ...[500, 1000, 2000, 5000, 10000].filter((b) => b > payment.amount),
  ].slice(0, 5);

  const handleShortcut = (val: number) => setMontoRecibido(val.toLocaleString('es-AR'));

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    if (raw === '') { setMontoRecibido(''); return; }
    setMontoRecibido(parseInt(raw, 10).toLocaleString('es-AR'));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: C.electric, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#fff', display: 'flex' }}>{ModalIcon.cash}</span>
          </div>
          <div>
            <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, color: C.textPrimary }}>
              Confirmar pago en efectivo
            </p>
            <p style={{ fontFamily: FONT_SANS, fontSize: 11.5, color: C.textSecondary, marginTop: 2 }}>
              {payment.patient_surname}, {payment.patient_name} · {payment.service_name}
            </p>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted }}>
            Monto a cobrar
          </p>
          <p style={{ fontFamily: FONT_SANS, fontSize: 22, fontWeight: 700, color: C.navy, letterSpacing: '-0.02em', marginTop: 2 }}>
            {formatCurrency(payment.amount)}
          </p>
        </div>
      </div>

      <div style={{ height: 1, background: C.border, marginBottom: 18 }} />

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontFamily: FONT_SANS, fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: C.textMuted, marginBottom: 7 }}>
          Monto recibido
        </label>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: FONT_SANS, fontSize: 15, fontWeight: 600, color: C.textSecondary, pointerEvents: 'none' }}>
            $
          </span>
          <input
            type="text"
            inputMode="numeric"
            value={montoRecibido}
            onChange={handleInput}
            placeholder="0"
            autoFocus
            aria-label="Monto recibido del paciente"
            style={{
              width: '100%', padding: '11px 14px 11px 30px',
              border: `1.5px solid ${puedeConfirmar && montoRecibido ? '#86EFAC' : C.border}`,
              borderRadius: 8, fontFamily: FONT_SANS, fontSize: 16, fontWeight: 600,
              color: C.textPrimary, background: '#FFFFFF', outline: 'none',
              transition: 'border-color 0.15s',
              boxSizing: 'border-box',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.electric)}
            onBlur={(e) => { e.currentTarget.style.borderColor = puedeConfirmar && montoRecibido ? '#86EFAC' : C.border; }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 7, marginBottom: 16, flexWrap: 'wrap' }}>
        {shortcuts.map((val) => (
          <button
            key={val}
            onClick={() => handleShortcut(val)}
            aria-label={`Usar ${formatCurrency(val)}`}
            style={{
              padding: '6px 13px',
              border: `1.5px solid ${montoNumerico === val ? C.electric : C.border}`,
              borderRadius: 7,
              background: montoNumerico === val ? '#EFF6FF' : '#FFFFFF',
              color: montoNumerico === val ? C.electric : C.textSecondary,
              fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600,
              cursor: 'pointer', transition: 'all 0.12s', whiteSpace: 'nowrap',
            }}
          >
            {val === payment.amount ? `Exacto ${formatCurrency(val)}` : `+${formatCurrency(val)}`}
          </button>
        ))}
      </div>

      {montoRecibido !== '' && (
        <div
          aria-live="polite"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: puedeConfirmar ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${puedeConfirmar ? '#86EFAC' : '#FECACA'}`,
            borderRadius: 8, padding: '10px 16px', marginBottom: 16,
          }}
        >
          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 600, color: puedeConfirmar ? '#065F46' : '#991B1B' }}>
            {puedeConfirmar ? '✓  Vuelto a entregar' : 'Monto insuficiente'}
          </span>
          <span style={{ fontFamily: FONT_SANS, fontSize: 18, fontWeight: 700, color: puedeConfirmar ? '#065F46' : '#991B1B', letterSpacing: '-0.02em' }}>
            {puedeConfirmar ? formatCurrency(vuelto) : `Faltan ${formatCurrency(payment.amount - montoNumerico)}`}
          </span>
        </div>
      )}

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, padding: '8px 12px', marginBottom: 14, color: '#991B1B', fontFamily: FONT_SANS, fontSize: 12 }}>
          {ModalIcon.alertTriangle}
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          onClick={onCancel}
          disabled={isLoading}
          style={{ padding: '9px 20px', borderRadius: 7, border: `1px solid ${C.border}`, background: '#FFFFFF', color: C.textSecondary, fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600, cursor: isLoading ? 'default' : 'pointer' }}
        >
          Cancelar
        </button>
        <button
          onClick={() => {
            if (!puedeConfirmar) return;
            const umbralTolerable = Math.min(payment.amount * 0.1, 500);
            if (montoNumerico > payment.amount + umbralTolerable) {
              setShowOverchargeWarning(true);
              if (onOverchargeRequest) onOverchargeRequest(montoNumerico);
            } else {
              onConfirm(payment.id, montoNumerico);
            }
          }}
          disabled={!puedeConfirmar || isLoading}
          style={{
            padding: '9px 22px', borderRadius: 7, border: 'none',
            background: puedeConfirmar && !isLoading ? C.electric : '#93C5FD',
            color: '#FFFFFF', fontFamily: FONT_SANS, fontSize: 13, fontWeight: 600,
            cursor: puedeConfirmar && !isLoading ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', gap: 7,
            opacity: !puedeConfirmar || isLoading ? 0.6 : 1,
            transition: 'opacity 0.15s',
          }}
        >
          {isLoading ? (
            <><span className="payments-modal-spinner" />Confirmando...</>
          ) : (
            <>{ModalIcon.checkSmall} Confirmar</>
          )}
        </button>
      </div>

      {showOverchargeWarning && (
        <OverchargeConfirmationModal
          montoAPagar={payment.amount}
          montoIngresado={montoNumerico}
          onConfirm={() => {
            setShowOverchargeWarning(false);
            onConfirm(payment.id, montoNumerico);
          }}
          onEdit={() => {
            setShowOverchargeWarning(false);
          }}
        />
      )}
    </div>
  );
}

// ── ConfirmCashModal ──────────────────────────────────────────────────────────

function ConfirmCashModal({ payment, onConfirm, onCancel, isLoading, error }: ConfirmCashPanelProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !isLoading) onCancel(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isLoading, onCancel]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <>
      <style>{`
        @keyframes paymentsBackdropFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes paymentsModalScaleIn {
          from { opacity: 0; transform: scale(0.94) translateY(8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);   }
        }
        .payments-modal-spinner {
          width: 11px; height: 11px;
          border: 2px solid rgba(255,255,255,0.35); border-top-color: #fff;
          border-radius: 50%; animation: paymentsModalSpin 0.65s linear infinite; flex-shrink: 0;
        }
        @keyframes paymentsModalSpin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(10, 20, 40, 0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: 'paymentsBackdropFadeIn 0.18s ease',
        }}
        onClick={(e) => { if (e.target === e.currentTarget && !isLoading) onCancel(); }}
        role="dialog"
        aria-modal="true"
        aria-label="Confirmar pago en efectivo"
      >
        <div style={{
          background: '#FFFFFF', borderRadius: 14,
          boxShadow: '0 20px 60px rgba(10,20,40,0.18), 0 4px 16px rgba(10,20,40,0.08)',
          width: '100%', maxWidth: 480, margin: '0 24px', padding: '28px 28px 24px',
          position: 'relative',
          animation: 'paymentsModalScaleIn 0.2s cubic-bezier(0.34, 1.2, 0.64, 1)',
        }}>
          {!isLoading && (
            <button
              onClick={onCancel}
              aria-label="Cerrar modal"
              style={{
                position: 'absolute', top: 16, right: 16,
                width: 28, height: 28, borderRadius: '50%',
                background: '#F3F4F6', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: C.textSecondary, transition: 'background 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#E5E7EB')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#F3F4F6')}
            >
              {ModalIcon.close}
            </button>
          )}
          <ConfirmCashPanel
            payment={payment}
            onConfirm={onConfirm}
            onCancel={onCancel}
            isLoading={isLoading}
            error={error}
            onOverchargeRequest={() => {}}
          />
        </div>
      </div>
    </>
  );
}

// ── Adapter: Payment → PaymentTodayResponse ───────────────────────────────────

function adaptPaymentToModal(payment: Payment): PaymentTodayResponse {
  return {
    id: Number(payment.id),
    patient_name: payment.patient.split(', ')[1] || payment.patient,
    patient_surname: payment.patient.split(', ')[0] || payment.patient,
    patient_id: 0,
    time: payment.time,
    amount: payment.amount,
    payment_method: payment.method,
    payment_status: payment.status as 'PENDING' | 'PARTIAL' | 'PAID' | 'CANCELLED',
    service_name: payment.treatment,
    appointment_id: 0,
    has_receipt: payment.hasReceipt,
  };
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

// CHANGE 1: Added onDownloadReceipt prop to the drawer interface
function PaymentDetailDrawer({
  paymentId,
  onClose,
  onConfirmSuccess,
  onDownloadReceipt,
}: {
  paymentId: string;
  onClose: () => void;
  onConfirmSuccess: () => void;
  onDownloadReceipt: (id: string) => void;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);
  const [drawerModalPayment,   setDrawerModalPayment]   = useState<Payment | null>(null);
  const [drawerConfirmLoading, setDrawerConfirmLoading] = useState(false);
  const [drawerConfirmError,   setDrawerConfirmError]   = useState<string | null>(null);

  useEffect(() => {
    setLoadingDetail(true);
    api
      .get<PaymentDetailResponse>(`/api/payments/${paymentId}`)
      .then((response: AxiosResponse<PaymentDetailResponse>) => {
        setPayment(mapDetailToPayment(response.data));
      })
      .catch(() => {
        onClose();
      })
      .finally(() => {
        setLoadingDetail(false);
      });
  }, [paymentId]);

  function handleOpenDrawerConfirmModal() {
    if (!payment) return;
    setDrawerModalPayment(payment);
    setDrawerConfirmError(null);
  }

  async function handleConfirmFromDrawerModal(id: number, montoRecibido: number) {
    setDrawerConfirmLoading(true);
    setDrawerConfirmError(null);
    try {
      await api.patch('/api/payments/confirm-cash', {
        id_payment: id,
        amount_received: montoRecibido,
      });
      setDrawerModalPayment(null);
      onConfirmSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al confirmar el pago. Intentá nuevamente.';
      setDrawerConfirmError(msg);
    } finally {
      setDrawerConfirmLoading(false);
    }
  }

  function handleCloseDrawerModal() {
    if (drawerConfirmLoading) return;
    setDrawerModalPayment(null);
    setDrawerConfirmError(null);
  }

  const infoLabel: React.CSSProperties = {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: 500,
    color: '#6A7A8A',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    margin: '0 0 4px',
  };

  const infoValue: React.CSSProperties = {
    fontFamily: FONT_SANS,
    fontSize: 13,
    fontWeight: 400,
    color: '#0A1628',
    margin: 0,
  };

  const eyebrow: React.CSSProperties = {
    fontFamily: FONT_SANS,
    fontSize: 10,
    fontWeight: 500,
    color: '#1A6FD4',
    letterSpacing: '3px',
    textTransform: 'uppercase',
    margin: '0 0 12px',
  };

  const internalCard: React.CSSProperties = {
    backgroundColor: '#F8F8F6',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10,22,40,0.30)',
          zIndex: 40,
        }}
      />
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          width: 400,
          height: '100vh',
          backgroundColor: '#FFFFFF',
          borderLeft: '1px solid #E8EFF6',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid #EAEAE6',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: FONT_SANS,
              fontSize: 11,
              fontWeight: 500,
              color: '#6A7A8A',
              letterSpacing: '2.5px',
              textTransform: 'uppercase',
            }}
          >
            DETALLE DE PAGO
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
            }}
          >
            <X size={18} color="#5A6A7A" strokeWidth={1.5} />
          </button>
        </div>

        <div style={{ padding: 24, flex: 1 }}>
          {loadingDetail || !payment ? (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <p style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 300, color: '#6A7A8A', margin: 0 }}>
                Cargando…
              </p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 24 }}>
                <p style={eyebrow}>PACIENTE</p>
                <h2
                  style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#0A1628',
                    margin: 0,
                    lineHeight: 1.2,
                  }}
                >
                  {payment.patient}
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <p style={infoLabel}>Monto</p>
                  <p style={{ ...infoValue, fontSize: 15, fontWeight: 500 }}>{formatARS(payment.amount)}</p>
                </div>
                <div>
                  <p style={infoLabel}>Estado</p>
                  <StatusBadge status={payment.status} />
                </div>
                <div>
                  <p style={infoLabel}>Método</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {payment.method === 'CASH' ? (
                      <Banknote size={14} color="#5A6A7A" strokeWidth={1.5} />
                    ) : (
                      <Wallet size={14} color="#5A6A7A" strokeWidth={1.5} />
                    )}
                    <span style={{ ...infoValue, fontSize: 13, fontWeight: 300, color: '#5A6A7A' }}>
                      {payment.method === 'CASH' ? 'Efectivo' : 'Mercado Pago'}
                    </span>
                  </div>
                </div>
                <div>
                  <p style={infoLabel}>Fecha</p>
                  <p style={{ ...infoValue, fontWeight: 300, color: '#5A6A7A' }}>{payment.date}</p>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid #EAEAE6', margin: '0 0 20px' }} />

              <div style={internalCard}>
                <p style={eyebrow}>TURNO ASOCIADO</p>
                {payment.appointmentDate ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 400, color: '#0A1628' }}>
                      {payment.appointmentDate}
                    </span>
                    {payment.appointmentStatus && appointmentStatusConfig[payment.appointmentStatus] && (
                      <span
                        style={{
                          fontFamily: FONT_SANS,
                          fontSize: 10,
                          fontWeight: 500,
                          letterSpacing: '1.5px',
                          textTransform: 'uppercase',
                          borderRadius: 4,
                          padding: '2px 8px',
                          ...appointmentStatusConfig[payment.appointmentStatus],
                          border: `1px solid ${appointmentStatusConfig[payment.appointmentStatus].border}`,
                        }}
                      >
                        {payment.appointmentStatus}
                      </span>
                    )}
                  </div>
                ) : (
                  <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 300, color: '#6A7A8A' }}>
                    Turno no disponible
                  </span>
                )}
              </div>

              <div style={internalCard}>
                <p style={eyebrow}>TRATAMIENTO</p>
                <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500, color: '#0A1628', margin: '0 0 14px' }}>
                  {payment.treatment}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 400, color: '#6A7A8A', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 3px' }}>
                      Precio base
                    </p>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500, color: '#0A1628', margin: 0 }}>
                      {formatARS(payment.basePrice)}
                    </p>
                  </div>
                  <div>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 400, color: '#6A7A8A', textTransform: 'uppercase', letterSpacing: '1.5px', margin: '0 0 3px' }}>
                      Saldo pendiente
                    </p>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500, color: payment.pendingBalance > 0 ? '#C2410C' : '#065F46', margin: 0 }}>
                      {formatARS(payment.pendingBalance)}
                    </p>
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 400, color: '#6A7A8A' }}>Pagado</span>
                    <span style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 500, color: '#1A6FD4' }}>{payment.paidPercentage}%</span>
                  </div>
                  <div style={{ height: 4, backgroundColor: '#E8EFF6', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${payment.paidPercentage}%`, backgroundColor: '#1A6FD4', borderRadius: 2 }} />
                  </div>
                </div>
              </div>

              {payment.method === 'MERCADO_PAGO' && payment.mpData && (
                <div style={internalCard}>
                  <p style={eyebrow}>DETALLE MERCADO PAGO</p>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {[
                      { label: 'Payment ID',      value: payment.mpData.paymentId },
                      { label: 'Estado MP',        value: payment.mpData.mpStatus },
                      { label: 'Email pagador',    value: payment.mpData.payerEmail },
                      { label: 'Fecha aprobación', value: payment.mpData.approvalDate },
                    ].map((row) => (
                      <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 400, color: '#6A7A8A', flexShrink: 0 }}>{row.label}</span>
                        <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 400, color: '#0A1628', textAlign: 'right' }}>{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {payment && (
          (payment.method === 'CASH' && payment.status === 'PENDING') || payment.hasReceipt
        ) ? (
          <div
            style={{
              padding: '16px 24px 24px',
              borderTop: '1px solid #EAEAE6',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              flexShrink: 0,
            }}
          >
            {payment && payment.method === 'CASH' && payment.status === 'PENDING' && (
              <button
                onClick={handleOpenDrawerConfirmModal}
                style={{
                  width: '100%',
                  backgroundColor: '#1A6FD4',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '13px 24px',
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Confirmar pago
              </button>
            )}
            {payment && payment.hasReceipt && (
              // CHANGE 2: Added onClick to the drawer download button
              <button
                onClick={() => payment && onDownloadReceipt(payment.id)}
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#1A6FD4',
                  border: '1px solid #1A6FD4',
                  borderRadius: 6,
                  padding: '12px 24px',
                  fontFamily: FONT_SANS,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                <Download size={15} strokeWidth={1.5} />
                Descargar comprobante
              </button>
            )}
          </div>
        ) : null}
      </div>

      {drawerModalPayment && (
        <ConfirmCashModal
          payment={adaptPaymentToModal(drawerModalPayment)}
          onConfirm={handleConfirmFromDrawerModal}
          onCancel={handleCloseDrawerModal}
          isLoading={drawerConfirmLoading}
          error={drawerConfirmError}
        />
      )}
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  height: 36,
  border: '1px solid #E8EFF6',
  borderRadius: 6,
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 300,
  color: '#0A1628',
  backgroundColor: '#FFFFFF',
  padding: '0 10px',
  outline: 'none',
  cursor: 'pointer',
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235A6A7A' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 28,
};

const dateInputStyle: React.CSSProperties = {
  height: 36,
  border: '1px solid #E8EFF6',
  borderRadius: 6,
  fontFamily: FONT_SANS,
  fontSize: 13,
  fontWeight: 300,
  color: '#0A1628',
  backgroundColor: '#FFFFFF',
  padding: '0 10px',
  outline: 'none',
};

const TABLE_COLUMNS = [
  'Fecha & Hora',
  'Paciente',
  'Tratamiento',
  'Monto',
  'Método',
  'Estado',
  'Comprobante',
  'Acción',
];

export function PaymentsView() {
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterMethod,  setFilterMethod]  = useState('');
  const [filterFrom,    setFilterFrom]    = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [filterTo,      setFilterTo]      = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [hoveredRow,    setHoveredRow]    = useState<string | null>(null);

  const [payments,      setPayments]      = useState<Payment[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [loadError,     setLoadError]     = useState(false);
  const [awaitingDates, setAwaitingDates] = useState(true);
  const [page,          setPage]          = useState(0);
  const [totalPages,    setTotalPages]    = useState(1);
  const [totalElements, setTotalElements] = useState(0);

  // ── Modal state ──
  const [modalPayment,  setModalPayment]  = useState<Payment | null>(null);
  const [confirmLoading,setConfirmLoading]= useState(false);
  const [confirmError,  setConfirmError]  = useState<string | null>(null);

  const fetchPayments = useCallback(
    async (currentPage: number) => {
      if (!filterFrom || !filterTo) {
        setAwaitingDates(true);
        setPayments([]);
        setTotalElements(0);
        setTotalPages(1);
        return;
      }
      setAwaitingDates(false);
      setLoading(true);
      setLoadError(false);
      try {
        const params: Record<string, string | number> = {
          page: currentPage,
          size: 20,
        };
        if (filterStatus) params.status  = filterStatus;
        if (filterMethod) params.method  = filterMethod;
        if (filterFrom)   params.startDate = filterFrom;
        if (filterTo)     params.endDate   = filterTo;

        const response = await api.get<PageResponse>('/api/payments', { params });
        setPayments(response.data.content.map(mapSummaryToPayment));
        setTotalPages(response.data.totalPages);
        setTotalElements(response.data.totalElements);
      } catch {
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    },
    [filterStatus, filterMethod, filterFrom, filterTo]
  );

  useEffect(() => {
    setPage(0);
    fetchPayments(0);
  }, [filterStatus, filterMethod, filterFrom, filterTo]);

  useEffect(() => {
    fetchPayments(page);
  }, [page]);

  // ── Modal handlers ──

  function handleOpenConfirmModal(payment: Payment, e: React.MouseEvent) {
    e.stopPropagation();
    setModalPayment(payment);
    setConfirmError(null);
  }

  async function handleConfirmFromModal(id: number, montoRecibido: number) {
    setConfirmLoading(true);
    setConfirmError(null);
    try {
      await api.patch('/api/payments/confirm-cash', {
        id_payment: id,
        amount_received: montoRecibido,
      });
      setModalPayment(null);
      fetchPayments(page);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Error al confirmar el pago. Intentá nuevamente.';
      setConfirmError(msg);
    } finally {
      setConfirmLoading(false);
    }
  }

  function handleCloseModal() {
    if (confirmLoading) return;
    setModalPayment(null);
    setConfirmError(null);
  }

  // CHANGE 3: handleDownloadReceipt function
  async function handleDownloadReceipt(paymentId: string): Promise<void> {
    try {
      const response = await api.get<{
        receiptId: number;
        filename: string;
        downloadUrl: string;
      }>(`/api/payments/receipt/download/${Number(paymentId)}`);

      const { downloadUrl } = response.data;
      window.open(downloadUrl, '_blank');

    } catch (error: any) {
      if (error.response?.status === 404) {
        alert('El comprobante no está disponible para este pago.');
      } else if (error.response?.status === 403) {
        alert('No tienes permisos para descargar este comprobante.');
      } else if (error.response?.status !== 401) {
        alert('Error al descargar el comprobante. Intentá nuevamente.');
      }
      console.error('Error downloading receipt:', error);
    }
  }

  const hasFilters    = filterStatus || filterMethod || filterFrom || filterTo;
  const datesInvalid  = !!(filterFrom && filterTo && filterFrom > filterTo);
  const currentMonth  = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  const subtitleText  = `Registro de transacciones · ${currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}`;
  const pageStart     = totalElements === 0 ? 0 : page * 20 + 1;
  const pageEnd       = page * 20 + payments.length;

  return (
    <div style={{ padding: '32px 36px 56px' }}>

      {/* ── Section header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <p style={{ fontFamily: FONT_SANS, fontSize: 10, fontWeight: 500, color: '#1A6FD4', letterSpacing: '3px', textTransform: 'uppercase', margin: '0 0 7px' }}>
            MÓDULO FINANCIERO
          </p>
          <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 24, fontWeight: 600, color: '#0A1628', margin: '0 0 5px', lineHeight: 1.2 }}>
            Pagos
          </h1>
          <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 300, color: '#5A6A7A', margin: 0 }}>
            {subtitleText}
          </p>
        </div>
        <button
          style={{
            border: '1px solid #E8EFF6', borderRadius: 6, backgroundColor: '#FFFFFF',
            color: '#5A6A7A', fontFamily: FONT_SANS, fontSize: 13, fontWeight: 400,
            padding: '8px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            boxShadow: '0 1px 4px rgba(10,22,40,0.05)',
          }}
        >
          <Download size={14} strokeWidth={1.5} />
          Exportar
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...selectStyle, minWidth: 130 }}>
          <option value="">Estado</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagado</option>
          <option value="PARTIAL">Parcial</option>
          <option value="FAILED">Fallido</option>
          <option value="CANCELLED">Cancelado</option>
        </select>

        <select value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)} style={{ ...selectStyle, minWidth: 154 }}>
          <option value="">Método de pago</option>
          <option value="CASH">Efectivo</option>
          <option value="MERCADO_PAGO">Mercado Pago</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 300, color: '#6A7A8A' }}>Desde</span>
          <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} style={dateInputStyle} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 300, color: '#6A7A8A' }}>Hasta</span>
          <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} style={dateInputStyle} />
        </div>

        {hasFilters && (
          <button
            onClick={() => { setFilterStatus(''); setFilterMethod(''); setFilterFrom(''); setFilterTo(''); }}
            style={{
              marginLeft: 'auto', backgroundColor: 'transparent', border: 'none',
              color: '#5A6A7A', fontFamily: FONT_SANS, fontSize: 12, fontWeight: 400,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, padding: '6px 0',
            }}
          >
            <X size={12} strokeWidth={1.5} />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Table card ── */}
      <div style={{ backgroundColor: '#FFFFFF', borderRadius: 12, boxShadow: '0 2px 20px rgba(10,22,40,0.08)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #EAEAE6' }}>
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col}
                    style={{
                      fontFamily: FONT_SANS, fontSize: 10, fontWeight: 400, color: '#6A7A8A',
                      letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'left',
                      padding: '13px 16px', whiteSpace: 'nowrap',
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {awaitingDates ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '56px 24px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: 360 }}>
                      <div style={{ width: 40, height: 40, backgroundColor: '#EBF3FB', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A6FD4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                          <line x1="16" y1="2" x2="16" y2="6"/>
                          <line x1="8" y1="2" x2="8" y2="6"/>
                          <line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </div>
                      <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500, color: '#0A1628', margin: 0 }}>
                        Seleccioná un rango de fechas
                      </p>
                      <p style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 300, color: '#6A7A8A', margin: 0, lineHeight: 1.6 }}>
                        Para visualizar los pagos es necesario indicar una fecha de inicio y una fecha de fin en los filtros superiores.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '64px 24px' }}>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 300, color: '#6A7A8A', margin: 0 }}>Cargando…</p>
                  </td>
                </tr>
              ) : datesInvalid ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '56px 24px' }}>
                    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 10, maxWidth: 380 }}>
                      <div style={{ width: 40, height: 40, backgroundColor: '#FFF7ED', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                      </div>
                      <p style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500, color: '#0A1628', margin: 0 }}>
                        Rango de fechas inválido
                      </p>
                      <p style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 300, color: '#6A7A8A', margin: 0, lineHeight: 1.6 }}>
                        La fecha de inicio debe ser anterior a la fecha de fin. Revisá el rango seleccionado para continuar.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '64px 24px' }}>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 300, color: '#6A7A8A', margin: 0 }}>Error al cargar los pagos.</p>
                  </td>
                </tr>
              ) : payments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '64px 24px' }}>
                    <div style={{ marginBottom: 12 }}>
                      <Search size={24} color="#CBD5E1" strokeWidth={1.5} />
                    </div>
                    <p style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 300, color: '#6A7A8A', margin: 0 }}>
                      No se encontraron pagos con los filtros seleccionados.
                    </p>
                  </td>
                </tr>
              ) : (
                payments.map((payment, index) => {
                  const isHovered = hoveredRow === payment.id;
                  const rowBg = isHovered ? '#F0F4FF' : index % 2 === 0 ? '#FFFFFF' : '#F8F8F6';
                  const showConfirm =
                    (payment.method === 'CASH' && payment.status === 'PENDING') ||
                    (payment.isOldDebt && payment.method === 'CASH');

                  return (
                    <tr
                      key={payment.id}
                      onClick={() => setSelectedId(payment.id)}
                      onMouseEnter={() => setHoveredRow(payment.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        backgroundColor: rowBg,
                        borderBottom: '1px solid #EAEAE6',
                        borderLeft: payment.isOldDebt ? '3px solid #C2410C' : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'background-color 0.12s',
                        height: 56,
                      }}
                    >
                      {/* Fecha & Hora */}
                      <td style={{ padding: '0 16px' }}>
                        <div style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500, color: '#0A1628' }}>{payment.date}</div>
                        <div style={{ fontFamily: FONT_SANS, fontSize: 11, fontWeight: 300, color: '#6A7A8A', marginTop: 2 }}>{payment.time}</div>
                      </td>

                      {/* Paciente */}
                      <td style={{ padding: '0 16px' }}>
                        <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 500, color: '#0A1628' }}>{payment.patient}</span>
                      </td>

                      {/* Tratamiento */}
                      <td style={{ padding: '0 16px' }}>
                        <span style={{ fontFamily: FONT_SANS, fontSize: 13, fontWeight: 300, color: '#5A6A7A' }}>{payment.treatment}</span>
                      </td>

                      {/* Monto */}
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontFamily: FONT_SANS, fontSize: 14, fontWeight: 500, color: '#0A1628' }}>{formatARS(payment.amount)}</span>
                      </td>

                      {/* Método */}
                      <td style={{ padding: '0 16px' }}>
                        <MethodCell method={payment.method} />
                      </td>

                      {/* Estado */}
                      <td style={{ padding: '0 16px' }}>
                        <StatusBadge status={payment.status} />
                      </td>

                      {/* Comprobante */}
                      <td style={{ padding: '0 16px', textAlign: 'center' }}>
                        {payment.hasReceipt ? (
                          // CHANGE 4: Added handleDownloadReceipt call to the table download button
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadReceipt(payment.id);
                            }}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'inline-flex' }}
                          >
                            <Download size={15} color="#1A6FD4" strokeWidth={1.5} />
                          </button>
                        ) : (
                          <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: '#9CA3AF' }}>—</span>
                        )}
                      </td>

                      {/* Acción */}
                      <td style={{ padding: '0 16px' }}>
                        {showConfirm ? (
                          <button
                            onClick={(e) => handleOpenConfirmModal(payment, e)}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #1A6FD4',
                              borderRadius: 6,
                              color: '#1A6FD4',
                              fontFamily: FONT_SANS,
                              fontSize: 12,
                              fontWeight: 500,
                              padding: '5px 12px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'background-color 0.12s',
                            }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#EFF6FF'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                          >
                            Confirmar pago
                          </button>
                        ) : (
                          <span style={{ fontFamily: FONT_SANS, fontSize: 14, color: '#9CA3AF' }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderTop: '1px solid #EAEAE6' }}>
          <span style={{ fontFamily: FONT_SANS, fontSize: 12, fontWeight: 300, color: '#6A7A8A' }}>
            {totalElements === 0 ? 'Sin registros' : `Mostrando ${pageStart}–${pageEnd} de ${totalElements} registros`}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                border: '1px solid #E8EFF6', borderRadius: 6, backgroundColor: '#FFFFFF',
                color: page === 0 ? '#CBD5E1' : '#5A6A7A', fontFamily: FONT_SANS, fontSize: 12, fontWeight: 300,
                padding: '6px 12px', cursor: page === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              <ChevronLeft size={13} strokeWidth={1.5} />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                border: '1px solid #E8EFF6', borderRadius: 6, backgroundColor: '#FFFFFF',
                color: page >= totalPages - 1 ? '#CBD5E1' : '#5A6A7A', fontFamily: FONT_SANS, fontSize: 12, fontWeight: 300,
                padding: '6px 12px', cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 4,
              }}
            >
              Siguiente
              <ChevronRight size={13} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Drawer */}
      {selectedId && (
        // CHANGE 5: Pass handleDownloadReceipt to the drawer
        <PaymentDetailDrawer
          paymentId={selectedId}
          onClose={() => setSelectedId(null)}
          onConfirmSuccess={() => fetchPayments(page)}
          onDownloadReceipt={handleDownloadReceipt}
        />
      )}

      {/* Confirm Cash Modal */}
      {modalPayment && (
        <ConfirmCashModal
          payment={adaptPaymentToModal(modalPayment)}
          onConfirm={handleConfirmFromModal}
          onCancel={handleCloseModal}
          isLoading={confirmLoading}
          error={confirmError}
        />
      )}
    </div>
  );
}