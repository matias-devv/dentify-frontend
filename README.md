# 🦷 Dentify — Frontend

Dentify is a multi-tenant dental clinic management system. This repository contains the **frontend** (React + TypeScript + Vite), which consumes the [Dentify backend API](#) (Java Spring Boot).

> Status: **actively in development.** APIs, folder structure, and conventions may still change. This is a portfolio/learning project also being built collaboratively.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Backend in Parallel](#running-the-backend-in-parallel)
  - [Available Scripts](#available-scripts)
- [Authentication & Roles](#authentication--roles)
- [Payments (Mercado Pago)](#payments-mercado-pago)
- [Testing](#testing)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [Roadmap](#roadmap)
- [License](#license)

---

## Overview

Dentify helps dental clinics manage patients, appointments, medical histories, products/inventory, and payments from a single dashboard. The frontend is a single-page application built with **React 19** and **Vite**, using role-based access (dentist vs. secretary) and a centralized HTTP client that talks to the Dentify backend.

This repo is the client only. All business logic, database access, and most configuration/secrets live in the **backend** repository.

## Tech Stack

| Layer | Choice |
|---|---|
| UI library | React 19 |
| Language | TypeScript + JavaScript (mixed, migrating toward TS) |
| Build tool | Vite 7 |
| Routing | React Router DOM v7 |
| Styling | Tailwind CSS v4 |
| HTTP client | Axios (centralized instance with JWT refresh) |
| Charts | Recharts |
| UI primitives | Radix UI, Lucide icons |
| Animation | Framer Motion |
| Linting | ESLint 9 |

## Features

- Role-based dashboards for **dentists** and **secretaries**
- Patient management and medical history (create/edit, complementary exams)
- Appointment scheduling (turnos) and admission flow
- Product/inventory management
- Payments module with **Mercado Pago Checkout Pro** integration
- JWT-based authentication with automatic token refresh (single-flight, no duplicate refresh calls on concurrent 401s)

## Project Structure

```
dentify-frontend/
├─ src/
│  ├─ api/                    # HTTP layer
│  │  ├─ apiClient.js         # Central Axios instance (base URL, JWT refresh interceptor)
│  │  ├─ authError.js
│  │  ├─ authService.js
│  │  ├─ dashboardService.js
│  │  └─ login.js
│  │
│  ├─ pages/
│  │  ├─ agendas/             # Calendar / schedule views
│  │  ├─ auth/
│  │  │  ├─ invitation/       # Invite-based registration (dentist / secretary)
│  │  │  ├─ login/
│  │  │  ├─ AuthContext.jsx   # Auth state + role (DENTIST / SECRETARY)
│  │  │  ├─ useAuth.js
│  │  │  ├─ ProtectedRoute.jsx
│  │  │  ├─ RoleProtectedRoute.jsx
│  │  │  └─ Unauthorized.jsx
│  │  ├─ dashboard/
│  │  ├─ dentist/             # Dentist-specific layout
│  │  ├─ medicalHistory/      # Medical history CRUD + complementary exams
│  │  ├─ patients/
│  │  ├─ payments/            # Mercado Pago flow, income chart, summaries
│  │  ├─ products/
│  │  ├─ sidebar/
│  │  └─ turnos/               # Appointments (create, detail, admission)
│  │
│  ├─ App.jsx                  # Route wrappers (WithUserProfile, CrearTurnoRouteWrapper, etc.)
│  ├─ App.css
│  ├─ home.jsx
│  └─ main.jsx
│
├─ index.html
├─ vite.config.js
├─ tailwind.config.js
├─ postcss.config.js
├─ eslint.config.js
├─ package.json
└─ README.md
```

**Routing convention:** each protected feature is wrapped in a dedicated route wrapper component in `App.jsx` (e.g. `WithUserProfile`, `CrearTurnoRouteWrapper`), which injects shared context/props before rendering the page.

> **Housekeeping:** the top-level `js/` folder (`api/dashboardService.js`, `pages/login.js`) is unused legacy — safe to delete. `.agents` is also unused. `files-dentify-guide` is kept intentionally as an internal reference guide. Also double check `dist/` and `node_modules/` are covered by `.gitignore` and never committed.

## Getting Started

### Prerequisites

- **Node.js** 20+ and npm
- The **Dentify backend** running locally (see [below](#running-the-backend-in-parallel)) — this frontend does not work standalone, it needs a live API to talk to.

### Installation

```bash
git clone <this-repo-url>
cd dentify-frontend
npm install
```

### Environment Variables

`src/api/apiClient.js` already reads the backend URL from `import.meta.env.VITE_API_BASE_URL` (falling back to `http://localhost:8008` if unset) — it just needs a local `.env` file to exist, since `.env` is gitignored and not committed.

1. Create a `.env` file at the project root:

   ```env
   VITE_API_BASE_URL=http://localhost:8008/api
   ```

2. Restart `npm run dev` after creating/changing it — Vite only reads `.env` on startup.

3. `.env.example` (committed, no real values needed here since there's nothing sensitive) documents the expected variable name for anyone cloning the repo — see the one included.

> **Important:** all *sensitive* configuration (database credentials, JWT secret, Mercado Pago access token/public key, etc.) lives exclusively in the **backend** repository's `application.properties` / environment. This frontend never needs, stores, or ships secrets — it only needs to know the backend's URL, which can differ per developer (e.g. a different local port).

### Running the Backend in Parallel

This frontend needs the Dentify backend running to do anything useful. Recommended local setup:

1. Clone and run the backend separately (it has its own `Dockerfile`; if using `docker-compose`, bring up the API + database there).
2. Point this frontend at it via `VITE_API_BASE_URL` in your local `.env`.
3. Run the frontend natively with `npm run dev` — **don't Dockerize the frontend for local development**, Vite's hot-module-reload is faster and simpler outside a container. Docker for the frontend only makes sense for a production build (multi-stage: `npm run build` → serve the static output with nginx).

This keeps the two repos independently deployable and lets each contributor use their own backend instance/config without touching frontend code.

### Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start the Vite dev server with hot reload |
| `npm run build` | Type-check and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview the production build locally |

## Authentication & Roles

Authentication is JWT-based, managed through `AuthContext.jsx` and `useAuth.js`. Two roles are supported:

- **DENTIST**
- **SECRETARY**

Routes are guarded with `ProtectedRoute.jsx` (must be logged in) and `RoleProtectedRoute.jsx` (must have a specific role); unauthorized access falls back to `Unauthorized.jsx`. `apiClient.js` centralizes an Axios instance with an interceptor that refreshes the JWT on `401` responses using a single-flight pattern, so concurrent requests don't trigger multiple refresh calls.

## Payments (Mercado Pago)

The payments module (`src/pages/payments/`) integrates **Mercado Pago Checkout Pro** to let clinics charge patients for appointments. The frontend triggers payment creation against the backend endpoint that generates the personalized Checkout Pro link; payment confirmation is handled via a webhook on the backend side.

## Testing

No automated tests exist yet for the frontend. Planned:

- Component/unit tests (Vitest + React Testing Library, to match the Vite setup)
- Coverage for auth guards and the Axios refresh-token flow first, since they gate everything else

## Deployment

Not deployed yet — the project is still in active/experimental development with a second contributor onboarding. A live demo link will be added here once a first stable version is deployed (Vercel is a natural fit for a Vite + React static build).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup notes if you're joining this project.

## Roadmap
 
- [ ] Add automated tests (Vitest)
- [ ] Migrate remaining `.jsx` files to `.tsx`
- [ ] First deploy (Vercel) + live demo link
- [ ] Update backend Dockerfile and document a combined `docker-compose` for full-stack local dev

## License

TBD.
