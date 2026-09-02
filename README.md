# B4RRHH — HR Management Backoffice

**B4RRHH** is a full-featured HR management backoffice built with Angular 21. It covers the complete employee lifecycle — from hire to termination — alongside payroll management, organizational structure, and a configurable rule-system engine for business rules.

The frontend communicates with a [Spring Boot backend](../b4rrhh_backend) via a contract-first OpenAPI integration: the API contract is owned by the backend and the client is generated automatically.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Angular 21.2 (standalone components, control-flow syntax) |
| Language | TypeScript 5.9 |
| Reactivity | Angular Signals + RxJS 7.8 |
| UI library | PrimeNG 21.1 with custom theme |
| Testing | Vitest |
| API client | OpenAPI Generator (`typescript-angular`) |
| Build | Angular CLI + Vite |

---

## Features

### Employee Management
Complete employee lifecycle management with a tabbed detail view per employee:

- **Overview** — status summary, active presence, contract highlights
- **Contact** — contact details (phone, email, etc.)
- **Presence** — work center assignments, contracts, labor classification, and working-time segments
- **Organization** — cost center distribution and organizational assignments
- **Identity** — identifier documents
- **Payroll** — payroll inputs and concept assignments
- **Lifecycle** — hire and re-hire workflows with period and catalog selection

### Organizational Structure
- Company profiles with addresses and contacts
- Work centers with history and contact information
- Cost center management

### Rule System Engine
A configuration layer for business rules that drives catalog behavior across the application:

- Rule system definitions (CRUD)
- Rule entity types and instances
- Catalog bindings and options
- Agreement category profiles (convenios / categorías)

### Payroll
- Payroll receipts viewer
- Payroll operation tracking

---

## Architecture

The frontend follows a strict layered architecture per feature, inspired by hexagonal design:

```
Component  →  Store  →  Gateway  →  Client (generated)
                ↓
            Mapper  ↔  Model
```

| Layer | Role |
|---|---|
| **Component** | Presentation logic only — renders signals, dispatches actions |
| **Store** | State container using Angular Signals — loading/error/data signals |
| **Gateway** | Data access — wraps API client, returns Observables |
| **Client** | Auto-generated from the OpenAPI contract, never edited manually |
| **Mapper** | Transforms API responses to domain models, and commands back to requests |
| **Model** | TypeScript interfaces representing the domain — no coupling to API shapes |

Each feature is lazy-loaded and self-contained under its own route subtree.

### Reactive State with Signals

Stores expose readonly signals for granular reactivity:

```typescript
// EmployeeAddressStore
private readonly addressesState = signal<ReadonlyArray<EmployeeAddressModel>>([]);
readonly addresses = this.addressesState.asReadonly();
```

Derived state is expressed with `computed()`:

```typescript
// EmployeeOverviewPageComponent
protected readonly loading = computed(
  () => this.loadingDetail() || this.loadingPresences() || this.loadingContracts(),
);
protected readonly activePresence = computed(
  () => this.resolveActivePresence(this.presences()),
);
```

All components use `ChangeDetectionStrategy.OnPush` for performance.

### Backend Availability Guard

A `BackendAvailabilityStore` checks backend health at app init via the Spring Actuator endpoint. The router outlet is gated: if the backend is unreachable the app renders an informative fallback instead of a broken UI.

### Request Deduplication

Stores track request IDs internally and discard stale responses, preventing race conditions on rapid user navigation.

---

## API Client Generation

The source of truth for the OpenAPI contract lives in the backend repository. This repository versions a snapshot of it in `openapi/`; the generated client is derived from that snapshot and never committed.

```
b4rrhh_backend/openapi/personnel-administration-api.yaml  ← source of truth
        │
        ▼  npm run api:pull        (only to update the contract — commit the result)
openapi/personnel-administration-api.yaml               ← versioned snapshot
        │
        ▼  npm run api:generate    (runs automatically before build and start)
src/app/core/api/generated/                             ← generated client (not committed, do not edit)
```

The two verbs are different things:

| Script | When you need it |
|---|---|
| `npm run api:generate` | Always. Rebuilds the client from the versioned snapshot in `openapi/`; needs nothing external. It runs automatically as `prebuild`/`prestart`, so a clean clone builds with `npm ci && npm run build`. |
| `npm run api:pull` | Only to bring a **new** contract from a sibling `b4rrhh_backend` checkout. Its result — a modified `openapi/*.yaml` — is a change to review and commit. |
| `npm run api:refresh` | `api:pull` + `api:generate` in one step, for the same case as `api:pull`. |

The generated client is not committed: it is derived code, ignored by git and regenerated on every build.

Custom adapters in `core/api/clients/` and transformation logic in `core/api/mappers/` wrap the generated client — insulating the app from breaking changes in the generated layer.

---

## Project Structure

```
src/app/
├── core/
│   ├── api/
│   │   ├── generated/          # OpenAPI-generated client (do not edit)
│   │   ├── clients/            # Custom adapters wrapping generated services
│   │   └── mappers/            # Shared request/response transformations
│   ├── auth/                   # Local dev login page
│   ├── availability/           # Backend health monitoring
│   ├── layout/                 # App shell and placeholder pages
│   └── theme/                  # PrimeNG theme preset
│
├── features/
│   ├── employee/               # Employee lifecycle (largest feature)
│   ├── company/                # Company management
│   ├── work-center/            # Work center management
│   └── nomina/                 # Payroll receipts and operations
│
├── rulesystem/
│   ├── rule-system/            # Rule system CRUD
│   ├── catalog/                # Entity types and catalog
│   └── agreement-category-profile/
│
└── shared/
    └── ui/                     # Reusable presentational components
        ├── master-detail-page-shell/
        ├── section-card/
        ├── period-table/
        └── ...
```

---

## Running Locally

### Prerequisites

- Node.js 22+
- The [b4rrhh_backend](../b4rrhh_backend) running on `localhost:8080`

### Setup

```bash
npm install
npm start
```

The dev server runs on `http://localhost:4200`. API calls are proxied to the backend via [proxy.conf.json](proxy.conf.json) — no CORS configuration needed during development.

### Build and Tests

```bash
npm run build
npm run test
```

### Formatting

Prettier owns the formatting of everything under `src` (`.ts`, `.html`, `.scss`), with the
configuration in [.prettierrc](.prettierrc). The pipeline runs `format:check` and fails the
build on any file that is not formatted, so a clean `git status` means what it says.

```bash
npm run format        # rewrite files in place
npm run format:check  # what the pipeline runs
```

The one-off commit that formatted the whole tree is listed in
[.git-blame-ignore-revs](.git-blame-ignore-revs). Tell `git blame` to skip it, once per clone:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

---

## License

This project is source-available under a Business Source License (BSL).

Commercial use is not permitted without explicit authorization.

See [LICENSE.md](LICENSE.md) for details.
