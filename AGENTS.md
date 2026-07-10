# WebBot — repo rules

This is Next.js 16 (App Router) + Prisma + a browser extension. Before writing
Next-specific code, skim the relevant guide in `node_modules/next/dist/docs/` —
APIs differ from older versions.

## Frontend architecture (App Router)

Keep a strict split between **logic** and **presentation**. A route is assembled
from four layers:

- **`page.tsx`** — routing + guards only. No state, no fetching, no markup
  beyond composing a guard and a screen, e.g.
  `<RequireAuth><WorkflowsScreen /></RequireAuth>`.
- **`<Route>Screen.tsx`** — layout only. Calls hooks, wires their results into
  presentational components. No API calls, no business logic, no helpers.
- **`components/`** — dumb, presentational, reusable. Props in, JSX out. No data
  fetching. Prefer composition over conditional mega-blocks.
- **`hooks/` + `lib/`** — all behaviour lives here.
  - `hooks/` — stateful/effectful logic (fetching, mutations, derived state).
    Return a plain object (`{ data, loading, actions… }`). Keep each hook focused.
  - `lib/` — **pure** functions (status derivation, stats, formatting). No React,
    no side effects — unit-testable in isolation.

Rules:
- Functional components only. **TypeScript strict, no `any`.**
- Keep files under ~150 LOC. If a component grows, extract a child.
- **Named exports** for components/hooks/helpers (default export only where a
  framework requires it: `page.tsx`, `layout.tsx`, `loading.tsx`).
- `"use client"` goes on the boundary (the Screen and hook files). Leaf
  components imported only by client components inherit it — don't sprinkle it.
- No duplicated JSX — a repeated block is a component.
- Don't introduce abstractions with a single caller unless they clarify intent.
- Preserve behaviour on refactors: same Tailwind classes, endpoints, routing,
  auth, loading/delete/download behaviour.

Reference implementation: `src/app/workflows/` (page → WorkflowsScreen → Sidebar
/ DashboardNav (SearchBar / DownloadExtensionButton / UserAvatar) → WorkflowCard
→ StatusBadge / WorkflowMetrics / WorkflowFooter), `src/hooks/useWorkflows.ts`,
`src/lib/workflow-status.ts`.

## Backend architecture (`src/server/`)

- **Domain** (`domain/`) defines interfaces only — never imports Prisma/bcrypt/jwt.
- **Repository pattern**: services depend on `I*Repository`; Prisma impls live in
  `infra/`. **Strategy pattern**: `IPasswordHasher`, `ITokenService`.
  **Registry**: per-type validators.
- One **composition root** (`container.ts`) wires concretes to interfaces.
- Services take a `userId` and enforce ownership at the data layer
  (`findByIdForUser`), so authorization lives in one place.
- Errors extend `AppError` (status + code); the HTTP layer maps them uniformly.
- Read env only in `config.ts`. Never throw at module load.

## Testing

Unit-test services/strategies/lib with in-memory fakes (`src/server/testing/`) —
no DB. Run `npm test`, `npm run typecheck`, `npm run lint` before considering a
change done.
