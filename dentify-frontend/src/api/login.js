/**
 * Dentify — Login Page
 * Handles: SVG line animation, password toggle, form validation
 * Module: ES module (type="module")
 */

/* ══════════════════════════════════════════════════════════════════════════
   Utilities
══════════════════════════════════════════════════════════════════════════ */

const prefersReducedMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const getElement = (id) => document.getElementById(id);

/* ══════════════════════════════════════════════════════════════════════════
   1. SVG Line Draw Animation
   Technique: stroke-dasharray / stroke-dashoffset, driven by rAF
══════════════════════════════════════════════════════════════════════════ */
function initToothAnimation() {
  const path = document.getElementById("divider-tooth-path");
  if (!path) return;

  const length = path.getTotalLength();

  path.style.strokeDasharray = `${length}`;
  path.style.strokeDashoffset = `${length}`;

  if (prefersReducedMotion()) {
    path.style.strokeDashoffset = "0";
    return;
  }

  const DELAY_MS = 400;
  const DURATION = 1600;
  const EASING = cubicBezier(0.4, 0, 0.2, 1);

  let start = null;

  function tick(timestamp) {
    if (!start) start = timestamp;
    const elapsed = timestamp - start;
    const progress = Math.min(elapsed / DURATION, 1);
    path.style.strokeDashoffset = `${length * (1 - EASING(progress))}`;
    if (progress < 1) requestAnimationFrame(tick);
  }

  setTimeout(() => requestAnimationFrame(tick), DELAY_MS);
}
/**
 * Pure cubic-bezier easing factory (CSS-compatible 4-param form)
 * Returns a function: t (0–1) → value (0–1)
 */
function cubicBezier(p1x, p1y, p2x, p2y) {
  const NEWTON_ITERATIONS = 8;
  const NEWTON_MIN_SLOPE = 0.001;
  const SUBDIVISION_MAX_ITER = 10;
  const SUBDIVISION_PRECISION = 1e-7;

  function A(a1, a2) {
    return 1 - 3 * a2 + 3 * a1;
  }
  function B(a1, a2) {
    return 3 * a2 - 6 * a1;
  }
  function C(a1) {
    return 3 * a1;
  }

  function calcBezier(t, a1, a2) {
    return ((A(a1, a2) * t + B(a1, a2)) * t + C(a1)) * t;
  }

  function getSlope(t, a1, a2) {
    return 3 * A(a1, a2) * t * t + 2 * B(a1, a2) * t + C(a1);
  }

  function binarySubdivide(x, a, b) {
    let currentX,
      currentT,
      i = 0;
    do {
      currentT = a + (b - a) / 2;
      currentX = calcBezier(currentT, p1x, p2x) - x;
      if (currentX > 0) b = currentT;
      else a = currentT;
    } while (
      Math.abs(currentX) > SUBDIVISION_PRECISION &&
      ++i < SUBDIVISION_MAX_ITER
    );
    return currentT;
  }

  function getTForX(x) {
    let t = x;
    for (let i = 0; i < NEWTON_ITERATIONS; i++) {
      const slope = getSlope(t, p1x, p2x);
      if (slope === 0) break;
      const cx = calcBezier(t, p1x, p2x) - x;
      t -= cx / slope;
      if (Math.abs(cx / slope) < NEWTON_MIN_SLOPE) break;
    }
    if (calcBezier(t, p1x, p2x) !== x) {
      t = binarySubdivide(x, 0, 1);
    }
    return t;
  }

  return function ease(x) {
    if (x === 0 || x === 1) return x;
    return calcBezier(getTForX(x), p1y, p2y);
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   2. Password Visibility Toggle
══════════════════════════════════════════════════════════════════════════ */

function initPasswordToggle() {
  const toggleBtn = getElement("toggle-password");
  const passwordEl = getElement("password");
  const iconEye = getElement("icon-eye");
  const iconEyeOff = getElement("icon-eye-off");

  if (!toggleBtn || !passwordEl) return;

  toggleBtn.addEventListener("click", () => {
    const isPassword = passwordEl.type === "password";
    passwordEl.type = isPassword ? "text" : "password";

    toggleBtn.setAttribute("aria-pressed", String(isPassword));
    toggleBtn.setAttribute(
      "aria-label",
      isPassword ? "Hide password" : "Show password",
    );

    iconEye.hidden = isPassword;
    iconEyeOff.hidden = !isPassword;
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   3. Form Validation
══════════════════════════════════════════════════════════════════════════ */

const VALIDATORS = {
  email: [
    {
      test: (v) => v.trim().length > 0,
      msg: "Se requiere dirección de correo electrónico.",
    },
    {
      test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
      msg: "Por favor, introduce una dirección de correo electrónico válida.",
    },
  ],
  password: [
    {
      test: (v) => v.length > 0,
      msg: "Se requiere contraseña.",
    },
    {
      test: (v) => v.length >= 8,
      msg: "La contraseña debe tener al menos 8 caracteres.",
    },
  ],
};

function validateField(input) {
  const name = input.name;
  const rules = VALIDATORS[name];
  const errorEl = document.getElementById(`${name}-error`);

  if (!rules || !errorEl) return true;

  for (const rule of rules) {
    if (!rule.test(input.value)) {
      input.setAttribute("aria-invalid", "true");
      errorEl.textContent = rule.msg;
      return false;
    }
  }

  input.setAttribute("aria-invalid", "false");
  errorEl.textContent = "";
  return true;
}

function clearFieldError(input) {
  const errorEl = document.getElementById(`${input.name}-error`);
  if (!errorEl) return;
  if (input.getAttribute("aria-invalid") === "true") {
    // Re-validate on typing to give live feedback
    validateField(input);
  }
}

function initFormValidation() {
  const form = getElement("login-form");
  if (!form) return;

  // Live validation on blur
  form.querySelectorAll('input[aria-required="true"]').forEach((input) => {
    input.addEventListener("blur", () => validateField(input));
    input.addEventListener("input", () => clearFieldError(input));
  });

  // Submit handler
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const inputs = [...form.querySelectorAll('input[aria-required="true"]')];
    const allValid = inputs.map((i) => validateField(i)).every(Boolean);

    if (!allValid) {
      // Focus first invalid field
      const firstInvalid = inputs.find(
        (i) => i.getAttribute("aria-invalid") === "true",
      );
      firstInvalid?.focus();
      return;
    }

    const btn = getElement("submit-btn");
    btn.setAttribute("aria-busy", "true");
    btn.disabled = true;

    // Placeholder for actual API call — replace with real auth logic
    setTimeout(() => {
      btn.removeAttribute("aria-busy");
      btn.disabled = false;
    }, 2000);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Init — DOMContentLoaded
══════════════════════════════════════════════════════════════════════════ */

document.addEventListener("DOMContentLoaded", () => {
  initLineAnimation();
  initPasswordToggle();
  initFormValidation();
});
