// src/App.jsx
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation, useParams, useOutletContext } from "react-router-dom";

import Login                  from "./pages/auth/login/Login";
import DentistRegistration    from "./pages/auth/invitation/DentistRegistration";
import SecretaryRegistration  from "./pages/auth/invitation/SecretaryRegistration";
import Unauthorized           from "./pages/auth/Unauthorized";

import DentistLayout          from "./pages/dentist/DentistLayout";
import DashboardHome          from "./pages/dashboard/DashboardHome";
import PaymentSummary         from "./pages/payments/PaymentSummary";
import { PaymentsView }       from "./pages/payments/PaymentsViews";

import { AgendaListView, AgendaCreateView }          from "./pages/agendas/AgendaViews";
import { OtorgarTurnoView }                          from "./pages/turnos/TurnosViews";
import { AdmisionView }                              from "./pages/turnos/AdmisionView";
import { CrearTurnoView }                            from "./pages/turnos/CrearTurnoView";
import { TurnoDetailView }                           from "./pages/turnos/TurnoDetailView";
import { PacientesListView }                         from "./pages/patients/PatientViews";
import { HistorialClinicoView } from "./pages/medicalHistory/MedicalHistoryViews";
import { ProductsView }                              from "./pages/products/ProductView";
import {
  getSelectedSlotContext,
  clearSelectedSlotContext,
} from "./pages/turnos/TurnosViews";

import { AuthProvider }       from "./pages/auth/AuthContext";
import RoleProtectedRoute     from "./pages/auth/RoleProtectedRoute";

// ─── Mapa de rutas para onNavigate dentro de DentistLayout ──────────────────
const SECTION_ROUTES = {
  "crear-turno":  "/dentist/dashboard/turnos/crear",
  "turno-detail": "/dentist/dashboard/turnos/detalle",
  "otorgar-turno":"/dentist/dashboard/turnos/otorgar",
  admision:       "/dentist/dashboard/turnos/admision",
  home:           "/dentist/dashboard",
};

// ─── Wrapper genérico: inyecta userProfile desde el outlet context ───────────
function WithUserProfile({ Component }) {
  const ctx = useOutletContext() ?? {};
  return <Component userProfile={ctx.userProfile ?? null} />;
}

// ─── Wrapper para CrearTurnoView ─────────────────────────────────────────────
// Lee slotContext desde localStorage (guardado por TurnosViews antes de navegar).
// Si no existe, redirige de vuelta al calendario.
function CrearTurnoRouteWrapper() {
  const ctx         = useOutletContext() ?? {};
  const userProfile = ctx.userProfile ?? null;
  const navigate    = useNavigate();

  // Leer el contexto guardado por TurnosViews.handleSlotClick
  const [slotContext] = useState(() => getSelectedSlotContext());

  // Si llegamos aquí sin contexto (ej: el usuario pegó la URL directamente)
  // redirigimos al calendario para que elija un slot
  if (!slotContext) {
    return <Navigate to="/dentist/dashboard/turnos/otorgar" replace />;
  }

  const handleNavigate = (section) => {
    const route = SECTION_ROUTES[section];
    if (route) navigate(route);
    else navigate("/dentist/dashboard");
  };

  const handleAppointmentCreated = (resp) => {
    // Guardar el ID del turno creado para que TurnoDetailView lo encuentre
    if (resp?.id_appointment) {
      localStorage.setItem("selectedAppointmentId", String(resp.id_appointment));
    }
    // Limpiar el slot context ya que fue consumido
    clearSelectedSlotContext();
  };

  return (
    <CrearTurnoView
      onNavigate={handleNavigate}
      userProfile={userProfile}
      slotContext={slotContext}
      onAppointmentCreated={handleAppointmentCreated}
    />
  );
}

// ─── Wrapper para TurnoDetailView ────────────────────────────────────────────
// Lee el appointmentId desde localStorage (guardado por TurnosViews antes de
// navegar al detalle de un turno ocupado).
function TurnoDetailRouteWrapper() {
  const ctx         = useOutletContext() ?? {};
  const userProfile = ctx.userProfile ?? null;
  const navigate    = useNavigate();

  const [appointmentId] = useState(() => {
    const raw = localStorage.getItem("selectedAppointmentId");
    return raw ? parseInt(raw, 10) : null;
  });

  if (!appointmentId) {
    return <Navigate to="/dentist/dashboard/turnos/otorgar" replace />;
  }

  const handleNavigate = (section) => {
    const route = SECTION_ROUTES[section];
    if (route) navigate(route);
    else navigate("/dentist/dashboard");
  };

  return (
    <TurnoDetailView
      onNavigate={handleNavigate}
      userProfile={userProfile}
      appointmentId={appointmentId}
    />
  );
}

// ─── Wrapper para HistorialClinicoView ───────────────────────────────────────
// Lee patientId desde la URL (useParams — ver Requirements.md §5.1: se adopta
// useParams porque el historial clínico es un recurso direccionable, a
// diferencia del contexto efímero de Turnos que vive en localStorage).
//
// El header del paciente (nombre/fecha de nac.) llega, cuando está disponible,
// vía location.state — pasado por PacientesListView.handlePatientClick. Si el
// usuario llega por deep-link sin ese state, patientHeader es null y la vista
// cae a un fallback visual ("Paciente #{id}"). Ver Requirements.md §9, AJUSTAR
// (b): reemplazar esto por un endpoint liviano de detalle de paciente si se
// decide esa opción más adelante.
function HistorialClinicoRouteWrapper() {
  const ctx          = useOutletContext() ?? {};
  const userProfile  = ctx.userProfile ?? null;
  const { patientId } = useParams();
  const navigate      = useNavigate();
  const location       = useLocation();

  const parsedId = patientId ? parseInt(patientId, 10) : null;
  if (!parsedId || Number.isNaN(parsedId)) {
    return <Navigate to="/dentist/dashboard/pacientes" replace />;
  }

  const handleNavigate = (section) => {
    if (section === "historia-clinica-general") {
      navigate(`/dentist/dashboard/pacientes/${parsedId}/historia-clinica/nueva`);
      return;
    }
    if (section === "pacientes-list") {
      navigate("/dentist/dashboard/pacientes");
      return;
    }
    // "historia-clinica-previa" / "registro-imagenes" / "reporte-alergias"
    // nunca disparan onNavigate: son opciones deshabilitadas (RN-2), el menú
    // no llama a onSelect para ellas.
  };

  return (
    <HistorialClinicoView
      onNavigate={handleNavigate}
      userProfile={userProfile}
      patientId={parsedId}
      patientHeader={location.state?.patient ?? null}
    />
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public ── */}
          <Route path="/login"               element={<Login />} />
          <Route path="/registro/dentista"   element={<DentistRegistration />} />
          <Route path="/registro/secretario" element={<SecretaryRegistration />} />
          <Route path="/no-autorizado"       element={<Unauthorized />} />

          {/* ── Dentist layout — todas protegidas ── */}
          <Route
            path="/dentist"
            element={
              <RoleProtectedRoute allowedRoles={["ROLE_DENTIST"]}>
                <DentistLayout />
              </RoleProtectedRoute>
            }
          >
            {/* /dentist → /dentist/dashboard */}
            <Route index element={<Navigate to="dashboard" replace />} />

            {/* Dashboard home */}
            <Route path="dashboard" element={<WithUserProfile Component={DashboardHome} />} />

            {/* Productos, Pacientes, Agendas */}
            <Route path="dashboard/productos"     element={<WithUserProfile Component={ProductsView} />} />
            <Route path="dashboard/pacientes"     element={<WithUserProfile Component={PacientesListView} />} />

            {/* Historial clínico — listado/timeline, punto de entrada al módulo
                de Medical History (Requirements.md §5.3 / §5.4) */}
            <Route
              path="dashboard/pacientes/:patientId/historial"
              element={<HistorialClinicoRouteWrapper />}
            />
            <Route
              path="dashboard/pacientes/:patientId/historia-clinica/nueva"
              element={<PlaceholderView label="Historia Clínica General" />}
            />

            <Route path="dashboard/agendas"       element={<WithUserProfile Component={AgendaListView} />} />
            <Route path="dashboard/agendas/nueva" element={<WithUserProfile Component={AgendaCreateView} />} />

            {/* Turnos — flujo completo ── */}
            {/*
              Nota de arquitectura:
              - /otorgar  → OtorgarTurnoView   guarda slotContext / appointmentId en localStorage antes de navegar
              - /crear    → CrearTurnoRouteWrapper   lee slotContext de localStorage
              - /detalle  → TurnoDetailRouteWrapper  lee appointmentId de localStorage
              - /admision → AdmisionView (sin contexto necesario)
            */}
            <Route path="dashboard/turnos/otorgar"  element={<WithUserProfile Component={OtorgarTurnoView} />} />
            <Route path="dashboard/turnos/crear"    element={<CrearTurnoRouteWrapper />} />
            <Route path="dashboard/turnos/detalle"  element={<TurnoDetailRouteWrapper />} />
            <Route path="dashboard/turnos/admision" element={<WithUserProfile Component={AdmisionView} />} />

            {/* Finanzas */}
            <Route path="payments/resumen"      element={<PaymentSummary />} />
            <Route path="payments/pagos"        element={<WithUserProfile Component={PaymentsView} />} />
            <Route path="payments/tratamientos" element={<PlaceholderView label="Tratamientos" />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

// ── Placeholder para vistas no implementadas ──────────────────────────────────
function PlaceholderView({ label }) {
  return (
    <div style={{
      padding: "48px 36px",
      fontFamily: "'DM Sans', sans-serif",
      color: "#9CA3AF",
      fontSize: 13,
    }}>
      Vista <strong style={{ color: "#111827" }}>{label}</strong> — pendiente de implementación.
    </div>
  );
}