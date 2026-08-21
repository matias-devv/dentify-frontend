# 🔨 Contributing to Dentify Frontend

Thanks for jumping in. A few things to get you productive quickly:

## Local Setup

1. `npm install`
2. Copy `.env.example` to `.env` and set `VITE_API_BASE_URL` to wherever **your** local backend is running.
3. Get the backend running separately (see its own README) — this frontend does nothing without it.
4. `npm run dev`

## Conventions

- **Routing:** new protected pages go through a route wrapper in `App.jsx` (see existing examples like `WithUserProfile`). Don't call the API directly from a page component — go through `src/api/*Service.js`.
- **HTTP calls:** always use the shared `apiClient.js` Axios instance, not a raw `axios.get(...)`. It already handles auth headers and JWT refresh on 401.
- **Roles:** if a page/action should be restricted to `DENTIST` or `SECRETARY`, wrap it with `RoleProtectedRoute`, don't hide it with conditional rendering alone.
- **File types:** new files should be `.tsx`/`.ts` where possible — the project is gradually migrating off `.jsx`/`.js`.

## Before Opening a PR

- Run `npm run lint` and fix anything it flags.
- Don't commit `.env`, `dist/`, or `node_modules/`.
- Keep commits scoped — one feature/fix per commit where reasonable.

## Questions

Ping the project owner directly — there's no formal issue tracker yet, this is still early-stage.
