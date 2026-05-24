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
  amount: string; // BigDecimal serializado como string
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
    base_price: string; // BigDecimal serializado como string
    outstanding_balance: string; // BigDecimal serializado como string
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
    transaction_amount: string; // BigDecimal serializado como string
    payer_email: string;
    date_approved: string | null;
  } | null;
}

// ── Mappers ───────────────────────────────────────────────────────────────────

function formatDateFromISO(isoDate: string): string {
  // "2026-04-28" → "28/04/2026"
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

function formatTimeFromISO(isoDateTime: string): string {
  // "2026-04-28T14:00:00" → "14:00"
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
    isOldDebt: false, // resolved in detail
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

// ── Design tokens ─────────────────────────────────────────────────────────────

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
  // Backend values
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
        fontFamily: "'DM Sans', Arial, sans-serif",
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
      <span
        style={{
          fontFamily: "'DM Sans', Arial, sans-serif",
          fontSize: 13,
          fontWeight: 300,
          color: '#5A6A7A',
        }}
      >
        {method === 'CASH' ? 'Efectivo' : 'Mercado Pago'}
      </span>
    </div>
  );
}

function formatARS(n: number) {
  return `$ ${n.toLocaleString('es-AR')}`;
}

// ── Detail Drawer ─────────────────────────────────────────────────────────────

function PaymentDetailDrawer({
  paymentId,
  onClose,
  onConfirmSuccess,
}: {
  paymentId: string;
  onClose: () => void;
  onConfirmSuccess: () => void;
}) {
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

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

  async function handleConfirmCash() {
    if (!payment) return;
    try {
      await api.patch('/api/payments/confirm-cash', {
        id_payment: Number(payment.id),
        amount_received: payment.amount,
      });
      onConfirmSuccess();
      onClose();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        'Error al confirmar el pago. Intentá nuevamente.';
      alert(msg);
    }
  }

  const infoLabel: React.CSSProperties = {
    fontFamily: "'DM Sans', Arial, sans-serif",
    fontSize: 10,
    fontWeight: 500,
    color: '#6A7A8A',
    letterSpacing: '2px',
    textTransform: 'uppercase',
    margin: '0 0 4px',
  };

  const infoValue: React.CSSProperties = {
    fontFamily: "'DM Sans', Arial, sans-serif",
    fontSize: 13,
    fontWeight: 400,
    color: '#0A1628',
    margin: 0,
  };

  const eyebrow: React.CSSProperties = {
    fontFamily: "'DM Sans', Arial, sans-serif",
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
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(10,22,40,0.30)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
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
        {/* Header */}
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
              fontFamily: "'DM Sans', Arial, sans-serif",
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

        {/* Scrollable content */}
        <div style={{ padding: 24, flex: 1 }}>
          {loadingDetail || !payment ? (
            <div style={{ textAlign: 'center', paddingTop: 48 }}>
              <p
                style={{
                  fontFamily: "'DM Sans', Arial, sans-serif",
                  fontSize: 14,
                  fontWeight: 300,
                  color: '#6A7A8A',
                  margin: 0,
                }}
              >
                Cargando…
              </p>
            </div>
          ) : (
            <>
              {/* Block 1 – Patient */}
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

              {/* Block 2 – Payment summary grid */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 24,
                }}
              >
                <div>
                  <p style={infoLabel}>Monto</p>
                  <p
                    style={{
                      ...infoValue,
                      fontSize: 15,
                      fontWeight: 500,
                    }}
                  >
                    {formatARS(payment.amount)}
                  </p>
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

              {/* Separator */}
              <hr style={{ border: 'none', borderTop: '1px solid #EAEAE6', margin: '0 0 20px' }} />

              {/* Block 3 – Appointment */}
              <div style={internalCard}>
                <p style={eyebrow}>TURNO ASOCIADO</p>
                {payment.appointmentDate ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span
                      style={{
                        fontFamily: "'DM Sans', Arial, sans-serif",
                        fontSize: 13,
                        fontWeight: 400,
                        color: '#0A1628',
                      }}
                    >
                      {payment.appointmentDate}
                    </span>
                    {payment.appointmentStatus && appointmentStatusConfig[payment.appointmentStatus] && (
                      <span
                        style={{
                          fontFamily: "'DM Sans', Arial, sans-serif",
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
                  <span
                    style={{
                      fontFamily: "'DM Sans', Arial, sans-serif",
                      fontSize: 13,
                      fontWeight: 300,
                      color: '#6A7A8A',
                    }}
                  >
                    Turno no disponible
                  </span>
                )}
              </div>

              {/* Block 4 – Treatment */}
              <div style={internalCard}>
                <p style={eyebrow}>TRATAMIENTO</p>
                <p
                  style={{
                    fontFamily: "'DM Sans', Arial, sans-serif",
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#0A1628',
                    margin: '0 0 14px',
                  }}
                >
                  {payment.treatment}
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 10,
                    marginBottom: 14,
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: "'DM Sans', Arial, sans-serif",
                        fontSize: 10,
                        fontWeight: 400,
                        color: '#6A7A8A',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        margin: '0 0 3px',
                      }}
                    >
                      Precio base
                    </p>
                    <p
                      style={{
                        fontFamily: "'DM Sans', Arial, sans-serif",
                        fontSize: 13,
                        fontWeight: 500,
                        color: '#0A1628',
                        margin: 0,
                      }}
                    >
                      {formatARS(payment.basePrice)}
                    </p>
                  </div>
                  <div>
                    <p
                      style={{
                        fontFamily: "'DM Sans', Arial, sans-serif",
                        fontSize: 10,
                        fontWeight: 400,
                        color: '#6A7A8A',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        margin: '0 0 3px',
                      }}
                    >
                      Saldo pendiente
                    </p>
                    <p
                      style={{
                        fontFamily: "'DM Sans', Arial, sans-serif",
                        fontSize: 13,
                        fontWeight: 500,
                        color: payment.pendingBalance > 0 ? '#C2410C' : '#065F46',
                        margin: 0,
                      }}
                    >
                      {formatARS(payment.pendingBalance)}
                    </p>
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: "'DM Sans', Arial, sans-serif",
                        fontSize: 10,
                        fontWeight: 400,
                        color: '#6A7A8A',
                      }}
                    >
                      Pagado
                    </span>
                    <span
                      style={{
                        fontFamily: "'DM Sans', Arial, sans-serif",
                        fontSize: 10,
                        fontWeight: 500,
                        color: '#1A6FD4',
                      }}
                    >
                      {payment.paidPercentage}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 4,
                      backgroundColor: '#E8EFF6',
                      borderRadius: 2,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${payment.paidPercentage}%`,
                        backgroundColor: '#1A6FD4',
                        borderRadius: 2,
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Block 5 – Mercado Pago details (conditional) */}
              {payment.method === 'MERCADO_PAGO' && payment.mpData && (
                <div style={internalCard}>
                  <p style={eyebrow}>DETALLE MERCADO PAGO</p>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {[
                      { label: 'Payment ID', value: payment.mpData.paymentId },
                      { label: 'Estado MP', value: payment.mpData.mpStatus },
                      { label: 'Email pagador', value: payment.mpData.payerEmail },
                      { label: 'Fecha aprobación', value: payment.mpData.approvalDate },
                    ].map((row) => (
                      <div
                        key={row.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: "'DM Sans', Arial, sans-serif",
                            fontSize: 12,
                            fontWeight: 400,
                            color: '#6A7A8A',
                            flexShrink: 0,
                          }}
                        >
                          {row.label}
                        </span>
                        <span
                          style={{
                            fontFamily: "'DM Sans', Arial, sans-serif",
                            fontSize: 13,
                            fontWeight: 400,
                            color: '#0A1628',
                            textAlign: 'right',
                          }}
                        >
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
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
                onClick={handleConfirmCash}
                style={{
                  width: '100%',
                  backgroundColor: '#1A6FD4',
                  color: '#FFFFFF',
                  border: 'none',
                  borderRadius: 6,
                  padding: '13px 24px',
                  fontFamily: "'DM Sans', Arial, sans-serif",
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Confirmar pago
              </button>
            )}
            {payment && payment.hasReceipt && (
              <button
                // TODO: implementar descarga de comprobante cuando el endpoint esté disponible
                style={{
                  width: '100%',
                  backgroundColor: 'transparent',
                  color: '#1A6FD4',
                  border: '1px solid #1A6FD4',
                  borderRadius: 6,
                  padding: '12px 24px',
                  fontFamily: "'DM Sans', Arial, sans-serif",
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
    </>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

const selectStyle: React.CSSProperties = {
  height: 36,
  border: '1px solid #E8EFF6',
  borderRadius: 6,
  fontFamily: "'DM Sans', Arial, sans-serif",
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
  fontFamily: "'DM Sans', Arial, sans-serif",
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMethod, setFilterMethod] = useState('');
  const [filterFrom, setFilterFrom] = useState<string>(() => {
  const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [filterTo, setFilterTo] = useState<string>(() => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  });
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [awaitingDates, setAwaitingDates] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [totalElements, setTotalElements] = useState(0);

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
        if (filterStatus) params.status = filterStatus;
        if (filterMethod) params.method = filterMethod;
        if (filterFrom) params.startDate = filterFrom;
        if (filterTo) params.endDate = filterTo;

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

  // Fetch on mount and when filters change (reset to page 0)
  useEffect(() => {
    setPage(0);
    fetchPayments(0);
  }, [filterStatus, filterMethod, filterFrom, filterTo]);

  // Fetch when page changes (but not when filters change, as that resets page)
  useEffect(() => {
    fetchPayments(page);
  }, [page]);

  async function handleConfirmCash(payment: Payment, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await api.patch('/api/payments/confirm-cash', {
        id_payment: Number(payment.id),
        amount_received: payment.amount,
      });
      fetchPayments(page);
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        'Error al confirmar el pago. Intentá nuevamente.';
      alert(msg);
    }
  }

  const hasFilters = filterStatus || filterMethod || filterFrom || filterTo;

  const datesInvalid = !!(filterFrom && filterTo && filterFrom > filterTo);

  const currentMonth = new Date().toLocaleString('es-AR', { month: 'long', year: 'numeric' });
  const subtitleText = `Registro de transacciones · ${currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1)}`;

  // Pagination display
  const pageStart = totalElements === 0 ? 0 : page * 20 + 1;
  const pageEnd = page * 20 + payments.length;

  return (
    <div style={{ padding: '32px 36px 56px' }}>

      {/* ── Section header ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <div>
          <p
            style={{
              fontFamily: "'DM Sans', Arial, sans-serif",
              fontSize: 10,
              fontWeight: 500,
              color: '#1A6FD4',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              margin: '0 0 7px',
            }}
          >
            MÓDULO FINANCIERO
          </p>
          <h1
            style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 24,
              fontWeight: 600,
              color: '#0A1628',
              margin: '0 0 5px',
              lineHeight: 1.2,
            }}
          >
            Pagos
          </h1>
          <p
            style={{
              fontFamily: "'DM Sans', Arial, sans-serif",
              fontSize: 13,
              fontWeight: 300,
              color: '#5A6A7A',
              margin: 0,
            }}
          >
            {subtitleText}
          </p>
        </div>

        <button
          style={{
            border: '1px solid #E8EFF6',
            borderRadius: 6,
            backgroundColor: '#FFFFFF',
            color: '#5A6A7A',
            fontFamily: "'DM Sans', Arial, sans-serif",
            fontSize: 13,
            fontWeight: 400,
            padding: '8px 16px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            boxShadow: '0 1px 4px rgba(10,22,40,0.05)',
          }}
        >
          <Download size={14} strokeWidth={1.5} />
          Exportar
        </button>
      </div>

      {/* ── Filter bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          style={{ ...selectStyle, minWidth: 130 }}
        >
          <option value="">Estado</option>
          <option value="PENDING">Pendiente</option>
          <option value="PAID">Pagado</option>
          <option value="PARTIAL">Parcial</option>
          <option value="FAILED">Fallido</option>
          <option value="CANCELLED">Cancelado</option>
        </select>

        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          style={{ ...selectStyle, minWidth: 154 }}
        >
          <option value="">Método de pago</option>
          <option value="CASH">Efectivo</option>
          <option value="MERCADO_PAGO">Mercado Pago</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              fontFamily: "'DM Sans', Arial, sans-serif",
              fontSize: 12,
              fontWeight: 300,
              color: '#6A7A8A',
            }}
          >
            Desde
          </span>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            style={dateInputStyle}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span
            style={{
              fontFamily: "'DM Sans', Arial, sans-serif",
              fontSize: 12,
              fontWeight: 300,
              color: '#6A7A8A',
            }}
          >
            Hasta
          </span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            style={dateInputStyle}
          />
        </div>

        {hasFilters && (
          <button
            onClick={() => {
              setFilterStatus('');
              setFilterMethod('');
              setFilterFrom('');
              setFilterTo('');
            }}
            style={{
              marginLeft: 'auto',
              backgroundColor: 'transparent',
              border: 'none',
              color: '#5A6A7A',
              fontFamily: "'DM Sans', Arial, sans-serif",
              fontSize: 12,
              fontWeight: 400,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '6px 0',
            }}
          >
            <X size={12} strokeWidth={1.5} />
            Limpiar filtros
          </button>
        )}
      </div>

      {/* ── Table card ── */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 2px 20px rgba(10,22,40,0.08)',
          overflow: 'hidden',
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
            <thead>
              <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #EAEAE6' }}>
                {TABLE_COLUMNS.map((col) => (
                  <th
                    key={col}
                    style={{
                      fontFamily: "'DM Sans', Arial, sans-serif",
                      fontSize: 10,
                      fontWeight: 400,
                      color: '#6A7A8A',
                      letterSpacing: '2px',
                      textTransform: 'uppercase',
                      textAlign: 'left',
                      padding: '13px 16px',
                      whiteSpace: 'nowrap',
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
    <td
      colSpan={8}
      style={{ textAlign: 'center', padding: '56px 24px' }}
    >
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          maxWidth: 360,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            backgroundColor: '#EBF3FB',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Calendar icon inline SVG */}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A6FD4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
        </div>
        <p
          style={{
            fontFamily: "'DM Sans', Arial, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: '#0A1628',
            margin: 0,
          }}
        >
          Seleccioná un rango de fechas
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', Arial, sans-serif",
            fontSize: 12,
            fontWeight: 300,
            color: '#6A7A8A',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          Para visualizar los pagos es necesario indicar una fecha de inicio y una fecha de fin en los filtros superiores.
        </p>
      </div>
    </td>
  </tr>
) : loading ? (
  <tr>
    <td colSpan={8} style={{ textAlign: 'center', padding: '64px 24px' }}>
      <p style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: 14, fontWeight: 300, color: '#6A7A8A', margin: 0 }}>
        Cargando…
      </p>
    </td>
  </tr>
) : datesInvalid ? (
  <tr>
    <td colSpan={8} style={{ textAlign: 'center', padding: '56px 24px' }}>
      <div
        style={{
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          maxWidth: 380,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            backgroundColor: '#FFF7ED',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2410C" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
        </div>
        <p
          style={{
            fontFamily: "'DM Sans', Arial, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            color: '#0A1628',
            margin: 0,
          }}
        >
          Rango de fechas inválido
        </p>
        <p
          style={{
            fontFamily: "'DM Sans', Arial, sans-serif",
            fontSize: 12,
            fontWeight: 300,
            color: '#6A7A8A',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          La fecha de inicio debe ser anterior a la fecha de fin. Revisá el rango seleccionado para continuar.
        </p>
      </div>
    </td>
  </tr>
) : loadError ? (
  <tr>
    <td colSpan={8} style={{ textAlign: 'center', padding: '64px 24px' }}>
      <p style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: 14, fontWeight: 300, color: '#6A7A8A', margin: 0 }}>
        Error al cargar los pagos.
      </p>
    </td>
  </tr>
) : payments.length === 0 ? (
  <tr>
    <td colSpan={8} style={{ textAlign: 'center', padding: '64px 24px' }}>
      <div style={{ marginBottom: 12 }}>
        <Search size={24} color="#CBD5E1" strokeWidth={1.5} />
      </div>
      <p style={{ fontFamily: "'DM Sans', Arial, sans-serif", fontSize: 14, fontWeight: 300, color: '#6A7A8A', margin: 0 }}>
        No se encontraron pagos con los filtros seleccionados.
      </p>
    </td>
  </tr>
) : (
                payments.map((payment, index) => {
                  const isHovered = hoveredRow === payment.id;
                  const rowBg = isHovered
                    ? '#F0F4FF'
                    : index % 2 === 0
                    ? '#FFFFFF'
                    : '#F8F8F6';

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
                        <div
                          style={{
                            fontFamily: "'DM Sans', Arial, sans-serif",
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#0A1628',
                          }}
                        >
                          {payment.date}
                        </div>
                        <div
                          style={{
                            fontFamily: "'DM Sans', Arial, sans-serif",
                            fontSize: 11,
                            fontWeight: 300,
                            color: '#6A7A8A',
                            marginTop: 2,
                          }}
                        >
                          {payment.time}
                        </div>
                      </td>

                      {/* Paciente */}
                      <td style={{ padding: '0 16px' }}>
                        <span
                          style={{
                            fontFamily: "'DM Sans', Arial, sans-serif",
                            fontSize: 13,
                            fontWeight: 500,
                            color: '#0A1628',
                          }}
                        >
                          {payment.patient}
                        </span>
                      </td>

                      {/* Tratamiento */}
                      <td style={{ padding: '0 16px' }}>
                        <span
                          style={{
                            fontFamily: "'DM Sans', Arial, sans-serif",
                            fontSize: 13,
                            fontWeight: 300,
                            color: '#5A6A7A',
                          }}
                        >
                          {payment.treatment}
                        </span>
                      </td>

                      {/* Monto */}
                      <td style={{ padding: '0 16px', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            fontFamily: "'DM Sans', Arial, sans-serif",
                            fontSize: 14,
                            fontWeight: 500,
                            color: '#0A1628',
                          }}
                        >
                          {formatARS(payment.amount)}
                        </span>
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
                          <button
                            onClick={(e) => e.stopPropagation()}
                            // TODO: implementar descarga de comprobante cuando el endpoint esté disponible
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 4,
                              display: 'inline-flex',
                            }}
                          >
                            <Download size={15} color="#1A6FD4" strokeWidth={1.5} />
                          </button>
                        ) : (
                          <span
                            style={{
                              fontFamily: "'DM Sans', Arial, sans-serif",
                              fontSize: 14,
                              color: '#9CA3AF',
                            }}
                          >
                            —
                          </span>
                        )}
                      </td>

                      {/* Acción */}
                      <td style={{ padding: '0 16px' }}>
                        {showConfirm ? (
                          <button
                            onClick={(e) => handleConfirmCash(payment, e)}
                            style={{
                              backgroundColor: 'transparent',
                              border: '1px solid #1A6FD4',
                              borderRadius: 6,
                              color: '#1A6FD4',
                              fontFamily: "'DM Sans', Arial, sans-serif",
                              fontSize: 12,
                              fontWeight: 500,
                              padding: '5px 12px',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              transition: 'background-color 0.12s',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#EFF6FF';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent';
                            }}
                          >
                            Confirmar pago
                          </button>
                        ) : (
                          <span
                            style={{
                              fontFamily: "'DM Sans', Arial, sans-serif",
                              fontSize: 14,
                              color: '#9CA3AF',
                            }}
                          >
                            —
                          </span>
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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            borderTop: '1px solid #EAEAE6',
          }}
        >
          <span
            style={{
              fontFamily: "'DM Sans', Arial, sans-serif",
              fontSize: 12,
              fontWeight: 300,
              color: '#6A7A8A',
            }}
          >
            {totalElements === 0
              ? 'Sin registros'
              : `Mostrando ${pageStart}–${pageEnd} de ${totalElements} registros`}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                border: '1px solid #E8EFF6',
                borderRadius: 6,
                backgroundColor: '#FFFFFF',
                color: page === 0 ? '#CBD5E1' : '#5A6A7A',
                fontFamily: "'DM Sans', Arial, sans-serif",
                fontSize: 12,
                fontWeight: 300,
                padding: '6px 12px',
                cursor: page === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ChevronLeft size={13} strokeWidth={1.5} />
              Anterior
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                border: '1px solid #E8EFF6',
                borderRadius: 6,
                backgroundColor: '#FFFFFF',
                color: page >= totalPages - 1 ? '#CBD5E1' : '#5A6A7A',
                fontFamily: "'DM Sans', Arial, sans-serif",
                fontSize: 12,
                fontWeight: 300,
                padding: '6px 12px',
                cursor: page >= totalPages - 1 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
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
        <PaymentDetailDrawer
          paymentId={selectedId}
          onClose={() => setSelectedId(null)}
          onConfirmSuccess={() => fetchPayments(page)}
        />
      )}
    </div>
  );
}