/**
 * Login.jsx
 * React implementation of login.html.
 * HTML structure and CSS classes are IDENTICAL to login.html.
 * Only the form submission, validation, and error display are added as React logic.
 *
 * Design: ENTERPRISE MEDICAL SAAS — Dentify Platform
 * Visual redesign only. All logic, hooks, refs, handlers are UNCHANGED.
 */

import { useEffect, useRef, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../useAuth";
import { AuthError } from "../../../api/authService";
import { resolveHomeRoute } from "../AuthContext";


/* ── Field-level error state shape ─────────────────────────────────── */
const EMPTY_ERRORS = { email: "", password: "", general: "" };

/* ═══════════════════════════════════════════════════════════════════
   ENTERPRISE LOGIN DESIGN SYSTEM — DENTIFY PLATFORM
   Full CSS override block. Injected at component root.
   Fonts: Libre Baskerville (serif editorial) + DM Sans (UI geometric)
   Palette: Institutional Navy · Clinical Blue · Warm White · Soft Gray
   ═══════════════════════════════════════════════════════════════════ */
const ENTERPRISE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=DM+Sans:wght@300;400;500;600&display=swap');

  /* ── Reset & Tokens ─────────────────────────────────────────────── */
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :root {
    --c-bg:             #F4F5F7;
    --c-surface:        #FFFFFF;
    --c-navy:           #0B1829;
    --c-navy-mid:       #122035;
    --c-navy-light:     #1C3050;
    --c-accent:         #2A6DF4;
    --c-accent-dim:     rgba(42, 109, 244, 0.12);
    --c-text-primary:   #0E1219;
    --c-text-secondary: #64748B;
    --c-text-muted:     #94A3B8;
    --c-border:         #E2E6EC;
    --c-error:          #C0392B;
    --c-error-bg:       rgba(192, 57, 43, 0.06);
    --c-white:          #FFFFFF;
    --c-white-10:       rgba(255,255,255,0.10);
    --c-white-15:       rgba(255,255,255,0.15);
    --c-white-20:       rgba(255,255,255,0.20);
    --c-white-40:       rgba(255,255,255,0.40);
    --c-white-60:       rgba(255,255,255,0.60);
    --c-white-80:       rgba(255,255,255,0.80);

    --r-input:  10px;
    --r-btn:    10px;
    --r-badge:  8px;

    --f-serif: 'Libre Baskerville', Georgia, serif;
    --f-sans:  'DM Sans', system-ui, sans-serif;

    --shadow-input-focus: 0 0 0 3px rgba(42, 109, 244, 0.18);
  }

  /* ── Skip link ──────────────────────────────────────────────────── */
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0,0,0,0);
    white-space: nowrap;
  }

  /* ── Page shell ─────────────────────────────────────────────────── */
  html, body, #root {
    height: 100%;
    background: var(--c-bg);
  }

  .login-page {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 100vh;
    font-family: var(--f-sans);
    background: var(--c-bg);
  }

  /* ═══════════════════════════════════════════════════════════════════
     LEFT COLUMN — Form panel
     ═══════════════════════════════════════════════════════════════════ */
  .login-page__form-col {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 48px 64px;
    background: var(--c-surface);
    position: relative;
    z-index: 1;
  }

  /* Subtle right-edge separator */
  .login-page__form-col::after {
    content: '';
    position: absolute;
    top: 0;
    right: 0;
    width: 1px;
    height: 100%;
    background: linear-gradient(
      to bottom,
      transparent,
      var(--c-border) 20%,
      var(--c-border) 80%,
      transparent
    );
  }

  /* ── Logo area ──────────────────────────────────────────────────── */
  .login-page__logo-area {
    display: flex;
    flex-direction: column;
    gap: 2px;
    user-select: none;
  }

  .logo__wordmark {
    font-family: var(--f-serif);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.5px;
    color: var(--c-navy);
    line-height: 1;
  }

  .logo__platform {
    font-family: var(--f-sans);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 3.5px;
    color: var(--c-text-muted);
    text-transform: uppercase;
  }

  /* ── Form body ──────────────────────────────────────────────────── */
  .login-page__form-body {
    display: flex;
    flex-direction: column;
    gap: 36px;
    width: 100%;
    max-width: 380px;
    margin: 0 auto;
  }

  /* ── Form header ────────────────────────────────────────────────── */
  .login-form__header {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .login-form__greeting {
    font-family: var(--f-sans);
    font-size: 11px;
    font-weight: 500;
    letter-spacing: 2.8px;
    text-transform: uppercase;
    color: var(--c-accent);
  }

  .login-form__title {
    font-family: var(--f-serif);
    font-size: 38px;
    font-weight: 700;
    color: var(--c-text-primary);
    line-height: 1.08;
    letter-spacing: -0.5px;
  }

  /* ── General error ──────────────────────────────────────────────── */
  .field__error--general {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--c-error-bg);
    border: 1px solid rgba(192, 57, 43, 0.20);
    border-radius: var(--r-input);
    padding: 12px 16px;
    font-family: var(--f-sans);
    font-size: 13px;
    font-weight: 400;
    color: var(--c-error);
    line-height: 1.4;
  }

  /* ── Login form ─────────────────────────────────────────────────── */
  .login-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .login-form__fields {
    display: flex;
    flex-direction: column;
    gap: 18px;
    border: none;
    padding: 0;
  }

  /* ── Field ──────────────────────────────────────────────────────── */
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field__label {
    font-family: var(--f-sans);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.3px;
    color: var(--c-text-secondary);
  }

  .field__input-wrapper {
    position: relative;
  }

  .field__input {
    width: 100%;
    height: 48px;
    padding: 0 16px;
    font-family: var(--f-sans);
    font-size: 14px;
    font-weight: 400;
    color: var(--c-text-primary);
    background: var(--c-bg);
    border: 1.5px solid var(--c-border);
    border-radius: var(--r-input);
    outline: none;
    transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
    -webkit-appearance: none;
  }

  .field__input::placeholder {
    color: var(--c-text-muted);
    font-weight: 300;
  }

  .field__input:hover:not(:disabled) {
    border-color: #C4CAD4;
    background: var(--c-surface);
  }

  .field__input:focus {
    border-color: var(--c-accent);
    background: var(--c-surface);
    box-shadow: var(--shadow-input-focus);
  }

  .field__input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .field__input--password {
    padding-right: 48px;
  }

  .field__input--error {
    border-color: var(--c-error) !important;
    box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.10) !important;
  }

  /* Field error text */
  .field__error {
    font-family: var(--f-sans);
    font-size: 12px;
    font-weight: 400;
    color: var(--c-error);
    min-height: 16px;
    line-height: 1.4;
  }

  /* ── Password toggle button ─────────────────────────────────────── */
  .field__toggle-btn {
    position: absolute;
    top: 50%;
    right: 14px;
    transform: translateY(-50%);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--c-text-muted);
    padding: 0;
    border-radius: 4px;
    transition: color 0.15s ease;
  }

  .field__toggle-btn:hover {
    color: var(--c-text-secondary);
  }

  .field__toggle-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .field__toggle-btn svg {
    width: 16px;
    height: 16px;
  }

  /* ── Actions row (forgot credentials) ──────────────────────────── */
  .login-form__actions {
    display: flex;
    justify-content: flex-end;
    margin-top: -4px;
  }

  .link--subtle {
    font-family: var(--f-sans);
    font-size: 12.5px;
    font-weight: 400;
    color: var(--c-text-secondary);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: color 0.15s ease, border-color 0.15s ease;
  }

  .link--subtle:hover {
    color: var(--c-accent);
    border-bottom-color: var(--c-accent-dim);
  }

  /* ── CTA button ─────────────────────────────────────────────────── */
  .btn-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    width: 100%;
    height: 50px;
    padding: 0 24px;
    font-family: var(--f-sans);
    font-size: 14px;
    font-weight: 500;
    letter-spacing: 0.2px;
    color: var(--c-white);
    background: var(--c-navy);
    border: none;
    border-radius: var(--r-btn);
    cursor: pointer;
    outline: none;
    position: relative;
    overflow: hidden;
    transition: background 0.18s ease, transform 0.12s ease;
    margin-top: 4px;
  }

  .btn-cta::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 60%);
    pointer-events: none;
  }

  .btn-cta:hover:not(:disabled) {
    background: #0A1422;
    transform: translateY(-1px);
  }

  .btn-cta:active:not(:disabled) {
    transform: translateY(0px);
  }

  .btn-cta:focus-visible {
    box-shadow: 0 0 0 3px rgba(42, 109, 244, 0.30);
  }

  .btn-cta:disabled {
    opacity: 0.65;
    cursor: not-allowed;
    transform: none;
  }

  .btn-cta--loading {
    background: #162840;
  }

  .btn-cta__text {
    position: relative;
    z-index: 1;
  }

  .btn-cta__icon {
    display: flex;
    align-items: center;
    position: relative;
    z-index: 1;
  }

  .btn-cta__icon svg {
    width: 15px;
    height: 15px;
    stroke: rgba(255,255,255,0.70);
  }

  /* ── Form footer ────────────────────────────────────────────────── */
  .login-page__form-footer,
  .form-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .form-footer__copy {
    font-family: var(--f-sans);
    font-size: 11px;
    font-weight: 400;
    color: var(--c-text-muted);
    letter-spacing: 0.2px;
  }

  .form-footer__link {
    font-family: var(--f-sans);
    font-size: 11px;
    font-weight: 400;
    color: var(--c-text-muted);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    transition: color 0.15s, border-color 0.15s;
  }

  .form-footer__link:hover {
    color: var(--c-text-secondary);
    border-bottom-color: var(--c-border);
  }

  /* ═══════════════════════════════════════════════════════════════════
     RIGHT COLUMN — Brand panel
     ═══════════════════════════════════════════════════════════════════ */
  .login-page__brand-col {
    position: relative;
    background: var(--c-navy);
    background-image: linear-gradient(160deg, #0F2040 0%, #0B1829 55%, #061120 100%);
    overflow: hidden;
    display: flex;
    align-items: stretch;
  }

  /* Radial glow overlays */
  .login-page__brand-col::before {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      radial-gradient(ellipse 60% 50% at 70% 20%, rgba(42, 109, 244, 0.09) 0%, transparent 70%),
      radial-gradient(ellipse 40% 60% at 20% 80%, rgba(42, 109, 244, 0.05) 0%, transparent 60%);
    pointer-events: none;
    z-index: 0;
  }

  /* Fine institutional grid */
  .login-page__brand-col::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(255,255,255,0.018) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255,255,255,0.018) 1px, transparent 1px);
    background-size: 44px 44px;
    pointer-events: none;
    z-index: 0;
  }

  .brand-panel {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 52px 60px;
  }

  /* ── Brand top ──────────────────────────────────────────────────── */
  .brand-panel__top {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .brand-panel__label {
    display: inline-block;
    font-family: var(--f-sans);
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 3px;
    text-transform: uppercase;
    color: var(--c-accent);
    padding: 6px 12px;
    border: 1px solid rgba(42, 109, 244, 0.30);
    border-radius: 4px;
    width: fit-content;
    background: rgba(42, 109, 244, 0.06);
  }

  .brand-panel__headline {
    font-family: var(--f-serif);
    font-size: 58px;
    font-weight: 700;
    color: var(--c-white);
    line-height: 1.04;
    letter-spacing: -1.5px;
  }

  /* "control." rendered as outlined text — editorial accent */
  .brand-panel__headline em {
    font-style: italic;
    color: transparent;
    -webkit-text-stroke: 1.5px rgba(255,255,255,0.70);
  }

  .brand-panel__subline {
    font-family: var(--f-sans);
    font-size: 14px;
    font-weight: 300;
    color: var(--c-white-60);
    line-height: 1.7;
    letter-spacing: 0.1px;
    max-width: 300px;
  }

  /* ── SVG accent line ────────────────────────────────────────────── */
  .brand-panel__line-container {
    padding: 32px 0 24px;
  }

  .brand-panel__line-svg {
    width: 100%;
    height: 44px;
    overflow: visible;
  }

  .brand-panel__line-path {
    stroke: rgba(42, 109, 244, 0.50);
    stroke-width: 1.5px;
    fill: none;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* ── Brand bottom ───────────────────────────────────────────────── */
  .brand-panel__bottom {
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  /* ── Stats grid ─────────────────────────────────────────────────── */
  .brand-panel__stats {
    display: flex;
    gap: 0;
    list-style: none;
    border: 1px solid var(--c-white-10);
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255,255,255,0.03);
  }

  .stat {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 22px 20px;
    position: relative;
  }

  .stat + .stat::before {
    content: '';
    position: absolute;
    left: 0;
    top: 16px;
    bottom: 16px;
    width: 1px;
    background: var(--c-white-10);
  }

  .stat--primary {
    background: rgba(42, 109, 244, 0.08);
  }

  .stat__number {
    font-family: var(--f-serif);
    font-size: 30px;
    font-weight: 700;
    color: var(--c-white);
    line-height: 1;
    letter-spacing: -0.5px;
  }

  .stat--primary .stat__number {
    color: #6EA8FF;
  }

  .stat__label {
    font-family: var(--f-sans);
    font-size: 10.5px;
    font-weight: 400;
    color: var(--c-white-40);
    line-height: 1.35;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  /* ── Security badge ─────────────────────────────────────────────── */
  .brand-panel__badge {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    border: 1px solid var(--c-white-10);
    border-radius: var(--r-badge);
    width: fit-content;
    background: rgba(255,255,255,0.04);
  }

  .brand-panel__badge-icon {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    color: var(--c-white-60);
  }

  .brand-panel__badge-text {
    font-family: var(--f-sans);
    font-size: 11.5px;
    font-weight: 400;
    letter-spacing: 0.3px;
    color: var(--c-white-60);
  }

  /* ═══════════════════════════════════════════════════════════════════
     RESPONSIVE
     ═══════════════════════════════════════════════════════════════════ */

  @media (max-width: 1100px) {
    .login-page__form-col {
      padding: 40px 48px;
    }
    .brand-panel {
      padding: 48px 44px;
    }
    .brand-panel__headline {
      font-size: 48px;
    }
    .stat__number {
      font-size: 26px;
    }
  }

  /* Tablet portrait — hide brand panel */
  @media (max-width: 900px) {
    .login-page {
      grid-template-columns: 1fr;
    }
    .login-page__brand-col {
      display: none;
    }
    .login-page__form-col {
      padding: 40px 32px;
      min-height: 100vh;
    }
    .login-page__form-col::after {
      display: none;
    }
    .login-page__form-body {
      max-width: 420px;
    }
  }

  /* Mobile */
  @media (max-width: 480px) {
    .login-page__form-col {
      padding: 32px 24px;
    }
    .login-form__title {
      font-size: 32px;
    }
    .login-page__form-body {
      gap: 28px;
    }
  }
`;

/* ─────────────────────────────────────────────────────────────────────
   StyleInjector — mounts CSS override block into <head> once on mount.
   Cleans up on unmount to avoid leaking styles between routes.
   ───────────────────────────────────────────────────────────────────── */
function EnterpriseStyles() {
  useEffect(() => {
    const id = "dentify-enterprise-login-styles";
    if (!document.getElementById(id)) {
      const el = document.createElement("style");
      el.id = id;
      el.textContent = ENTERPRISE_CSS;
      document.head.appendChild(el);
    }
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, []);
  return null;
}

/* ─────────────────────────────────────────────────────────────────────
   Login — public shell component
   Logic: UNCHANGED from original.
   ───────────────────────────────────────────────────────────────────── */
export default function Login() {
  const { loginUser, isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (!isLoading && isAuthenticated) {
    // Si llegó redirigido desde una ruta protegida → volvé ahí
    // Si entró directamente a /login ya autenticado → resolvé por rol
    const destination =
      location.state?.from?.pathname ?? resolveHomeRoute(user.roles);
    return <Navigate to={destination} replace />;
  }

  return <LoginForm loginUser={loginUser} />;
}

/* ─────────────────────────────────────────────────────────────────────
   LoginForm — inner form component
   Logic: 100% IDENTICAL to original. Zero changes.
   ───────────────────────────────────────────────────────────────────── */
function LoginForm({ loginUser }) {
  const [errors, setErrors] = useState(EMPTY_ERRORS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const submitRef = useRef(null);

  /* Auto-focus email on mount */
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  /* ── Client-side validation ─────────────────────────────────────── */
  function validate(email, password) {
    const next = { ...EMPTY_ERRORS };
    let valid = true;

    if (!email.trim()) {
      next.email = "Ingresá tu correo electrónico.";
      valid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      next.email = "El formato del correo no es válido.";
      valid = false;
    }

    if (!password) {
      next.password = "Ingresá tu contraseña.";
      valid = false;
    } else if (password.length < 6) {
      next.password = "La contraseña debe tener al menos 6 caracteres.";
      valid = false;
    }

    return { valid, next };
  }

  /* ── Form submit handler ────────────────────────────────────────── */
  async function handleSubmit(e) {
    e.preventDefault();

    const email = emailRef.current.value.trim();
    const password = passwordRef.current.value;

    // Clear previous errors
    setErrors(EMPTY_ERRORS);

    // Client-side validation
    const { valid, next } = validate(email, password);
    if (!valid) {
      setErrors(next);
      // Focus first failing field
      if (next.email) emailRef.current?.focus();
      else if (next.password) passwordRef.current?.focus();
      return;
    }

    setIsSubmitting(true);

    try {
      // loginUser calls authService.login → persists session → navigates to /dashboard
      await loginUser({ email, password });
    } catch (err) {
      setIsSubmitting(false);

      if (err instanceof AuthError) {
        switch (err.field) {
          case "email":
            setErrors((prev) => ({ ...prev, email: err.message }));
            emailRef.current?.focus();
            break;
          case "credentials":
            // Ambiguous by design — don't reveal which field is wrong
            setErrors((prev) => ({
              ...prev,
              password: err.message,
            }));
            passwordRef.current?.focus();
            break;
          case "account":
          case "rate_limit":
          case "network":
          case "server":
          default:
            setErrors((prev) => ({ ...prev, general: err.message }));
            break;
        }
      } else {
        setErrors((prev) => ({
          ...prev,
          general: "Ocurrió un error inesperado. Intentá nuevamente.",
        }));
      }
    }
  }

  /* ── Password visibility toggle ─────────────────────────────────── */
  function togglePassword() {
    setPasswordVisible((v) => !v);
  }

  /* ── Render ──────────────────────────────────────────────────────── */
  return (
    <>
      {/* Enterprise CSS injector — visual only, zero logic */}
      <EnterpriseStyles />

      {/* Skip navigation link (accessibility) */}
      <a className="visually-hidden" href="#login-form">
        Skip to login form
      </a>

      <main className="login-page" aria-label="Acceso a Dentify">

        {/* ══ LEFT COLUMN — Form panel ══════════════════════════════════ */}
        <section
          className="login-page__form-col"
          aria-label="Formulario de acceso"
        >
          {/* Logo */}
          <header className="login-page__logo-area">
            <span className="logo__wordmark">Dentify</span>
            <span className="logo__platform">PLATFORM</span>
          </header>

          {/* Form body */}
          <div className="login-page__form-body">
            <div className="login-form__header">
              <p className="login-form__greeting">Acceso institucional</p>
              <h1 className="login-form__title">Bienvenido.</h1>
            </div>

            {/* General error (network / server / account) */}
            {errors.general && (
              <p
                className="field__error field__error--general"
                role="alert"
                aria-live="assertive"
              >
                {errors.general}
              </p>
            )}

            <form
              className="login-form"
              id="login-form"
              onSubmit={handleSubmit}
              noValidate
              aria-label="Credenciales de acceso"
            >
              <fieldset className="login-form__fields" aria-label="Credenciales">
                <legend className="visually-hidden">
                  Ingresá tus credenciales
                </legend>

                {/* ── Email field ─────────────────────────────────── */}
                <div className="field">
                  <label className="field__label" htmlFor="email">
                    Correo electrónico
                  </label>
                  <div className="field__input-wrapper">
                    <input
                      className={`field__input${errors.email ? " field__input--error" : ""}`}
                      type="email"
                      id="email"
                      name="email"
                      autoComplete="username"
                      placeholder="dr.nombre@clinica.com"
                      aria-required="true"
                      aria-describedby="email-error"
                      aria-invalid={!!errors.email}
                      spellCheck="false"
                      inputMode="email"
                      ref={emailRef}
                      disabled={isSubmitting}
                    />
                  </div>
                  <p
                    className="field__error"
                    id="email-error"
                    aria-live="polite"
                    role="alert"
                  >
                    {errors.email}
                  </p>
                </div>

                {/* ── Password field ───────────────────────────────── */}
                <div className="field">
                  <label className="field__label" htmlFor="password">
                    Contraseña
                  </label>
                  <div className="field__input-wrapper">
                    <input
                      className={`field__input field__input--password${errors.password ? " field__input--error" : ""}`}
                      type={passwordVisible ? "text" : "password"}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      placeholder="••••••••••••"
                      aria-required="true"
                      aria-describedby="password-error"
                      aria-invalid={!!errors.password}
                      ref={passwordRef}
                      disabled={isSubmitting}
                    />
                    <button
                      type="button"
                      className="field__toggle-btn"
                      id="toggle-password"
                      aria-label={
                        passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      aria-controls="password"
                      aria-pressed={passwordVisible}
                      onClick={togglePassword}
                      disabled={isSubmitting}
                    >
                      {/* Eye icon (show) */}
                      {!passwordVisible && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                      )}
                      {/* Eye-off icon (hide) */}
                      {passwordVisible && (
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          focusable="false"
                        >
                          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                          <line x1="1" y1="1" x2="23" y2="23" />
                        </svg>
                      )}
                    </button>
                  </div>
                  <p
                    className="field__error"
                    id="password-error"
                    aria-live="polite"
                    role="alert"
                  >
                    {errors.password}
                  </p>
                </div>
              </fieldset>

              {/* Forgot credentials */}
              <div className="login-form__actions">
                <a href="/recuperar" className="link--subtle">
                  ¿Olvidaste tus credenciales de acceso?
                </a>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                className={`btn-cta${isSubmitting ? " btn-cta--loading" : ""}`}
                id="submit-btn"
                aria-label="Ingresar al sistema — acceso institucional"
                disabled={isSubmitting}
                ref={submitRef}
              >
                <span className="btn-cta__text">
                  {isSubmitting ? "Verificando..." : "Ingresar al Sistema"}
                </span>
                {!isSubmitting && (
                  <span className="btn-cta__icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                )}
              </button>
            </form>
          </div>

          {/* Form footer */}
          <footer className="form-footer login-page__form-footer">
            <small className="form-footer__copy">
              &copy; 2026 Dentify. Todos los derechos reservados.
            </small>
            <a href="/privacidad" className="form-footer__link">
              Política de privacidad
            </a>
          </footer>
        </section>

        {/* ══ RIGHT COLUMN — Brand panel ════════════════════════════════ */}
        <aside
          className="login-page__brand-col"
          aria-label="Declaración de marca Dentify"
        >
          <article className="brand-panel">
            <div className="brand-panel__top">
              <span className="brand-panel__label">
                Plataforma de Inteligencia Clínica
              </span>
              <h2 className="brand-panel__headline">
                La clínica
                <br />
                bajo
                <br />
                <em>control.</em>
              </h2>
              <p className="brand-panel__subline">
                <span style={{ whiteSpace: "nowrap" }}>
                  Cada historia clínica. Cada decisión de atención.
                </span>
                <br />
                En un solo lugar.
              </p>
            </div>

            <div className="brand-panel__line-container" aria-hidden="true">
              <svg
                className="brand-panel__line-svg"
                id="accent-line"
                viewBox="0 0 400 44"
                preserveAspectRatio="none"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  className="brand-panel__line-path"
                  id="accent-line-path"
                  d="M0,22 L110,22 L130,22 L148,6 L166,38 L184,6 L202,22 L220,22 L400,22"
                />
              </svg>
            </div>

            <div className="brand-panel__bottom">
              <ul className="brand-panel__stats" aria-label="Platform metrics">
                <li className="stat stat--primary">
                  <span className="stat__number">-47%</span>
                  <span className="stat__label">Reducción de inasistencias</span>
                </li>
                <li className="stat">
                  <span className="stat__number">8h</span>
                  <span className="stat__label">Recuperadas por semana</span>
                </li>
                <li className="stat">
                  <span className="stat__number">38</span>
                  <span className="stat__label">Clínicas en operación</span>
                </li>
              </ul>

              <div
                className="brand-panel__badge"
                role="status"
                aria-label="Cumple con normativas HIPAA e ISO 27001"
              >
                <svg
                  className="brand-panel__badge-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  focusable="false"
                >
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <polyline points="9 12 11 14 15 10" />
                </svg>
                <span className="brand-panel__badge-text">
                  Normativa HIPAA &middot; ISO 27001
                </span>
              </div>
            </div>
          </article>
        </aside>

      </main>
    </>
  );
}