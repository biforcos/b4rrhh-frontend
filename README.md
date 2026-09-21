# B4RRHH — backoffice

**B4RRHH is a personnel administration system and a configurable payroll engine.**
Employment history is temporal by construction — the domain itself refuses overlaps and
gaps instead of hoping the database will catch them — and payroll is computed from a
dependency graph that is configuration rather than code, so any amount on a payslip can be
opened all the way down to the step that produced it.

This repository is the backoffice: the screens where people, their history, the
organisation and the calculated payslips are looked at and changed. Everything else — the
other repositories and the documents they share — starts at the workspace repository, which is
[`../README.md`](../README.md) once it is laid out beside this one. **That repository is
not mirrored to GitHub**, so if you arrived from
[github.com/biforcos](https://github.com/biforcos) this page is the way in, and the
siblings to lay out beside it are `b4rrhh-backend`, `b4rrhh-frontend`, `b4rrhh-designer`
and `b4rrhh-workforce-loader`, cloned into `b4rrhh_backend`, `b4rrhh_frontend`,
`b4rrhh_designer` and `b4rrhh_workforce_loader`.

It has no domain of its own. Every rule lives in the [backend](../b4rrhh_backend), and this
repository talks to it through one generated client — see *The contract* below.

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Angular — standalone components, control-flow syntax |
| Language | TypeScript |
| Reactivity | Angular Signals, with RxJS at the transport edge |
| UI library | PrimeNG, with a custom theme |
| Testing | Vitest |
| API client | OpenAPI Generator (`typescript-angular`) |
| Build | Angular CLI + Vite |

Exact versions are in [`package.json`](package.json), which is the only place they cannot
go stale.

---

## What is in it

**People.** An employee opens into a tabbed detail view: the overview, contact details,
the presence with everything anchored to it — contracts, labor classification, work
centres, working time — the organisational assignments, identifier documents, payroll
inputs, and the lifecycle workflows.

The tabs are not CRUD forms with a common shell. Each section declares how it is
maintained — a slot that is replaced, a timeline that can only be appended to and closed,
a workflow, or read-only — and the button names the real action instead of saying *Edit*
at everything (ADR-010, ADR-016).

**The organisation.** Companies with their addresses and contacts, work centres with their
history, cost centres.

**The rule system.** The catalogue that drives behaviour everywhere else: rule systems,
entity types and entities, catalogue bindings and options, agreement category profiles.

**Payroll.** The payslip viewer, and the runs that produced them. Opening an amount leads
to where it came from — and from there, to the [designer](../b4rrhh_designer), which draws
the graph that calculated it.

Feedback is a system-level capability: a section publishes its outcome to the global
message service and never renders its own success or error banner (ADR-022, ADR-023).

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

### Reactive state with signals

A store keeps its state in writable signals and exposes them read-only; anything derived is
a `computed()`, so a page waiting on three requests asks one question instead of juggling
three flags. Components are `OnPush` throughout — which is less an optimisation than a
consequence: with signals there is nothing left for Angular to guess.

### Backend Availability Guard

A `BackendAvailabilityStore` checks backend health at app init via the Spring Actuator endpoint. The router outlet is gated: if the backend is unreachable the app renders an informative fallback instead of a broken UI.

### Request Deduplication

Stores track request IDs internally and discard stale responses, preventing race conditions on rapid user navigation.

---

## The contract

The backend owns the API contract. This repository versions a snapshot of it in `openapi/`,
and the client is generated from that snapshot — never written, never versioned.

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

Custom adapters in `core/api/clients/` and transformation logic in `core/api/mappers/` wrap the generated client — insulating the app from breaking changes in the generated layer.

### What stops the snapshot going stale

The chain is *backend contract → versioned snapshot → generated client*, and refreshing the
snapshot is a manual step that happens in another repository and depends on someone
remembering. Nobody remembers every time, and a stale snapshot is worse than a broken one:
the build goes green against a contract that no longer exists.

Two things hold it:

- **`npm run api:check`** fails the build when the snapshot in `openapi/` is not the
  contract on the backend's `main`. It runs in the pipeline, and locally it reads the
  sibling `../b4rrhh_backend` checkout instead of asking anyone for a token. Its failure
  message names the exact command that fixes it — a red that someone else caused and that
  does not say what to do gets learnt away, and a guardrail people ignore stops protecting
  precisely when it matters.
- **The generated client is derived code**, ignored by git and rebuilt on every build and
  every start. Unlike the snapshot, it cannot quietly be old.

The [designer](../b4rrhh_designer) consumes the same contract but does version its
generated types, so it carries a second lock this repository does not need — and a third
one for the paths the code actually calls.

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

### The designer, and why it is proxied too

The Valorización drawer embeds the [designer](../b4rrhh_designer) in a frame, at `/designer/` **of
the same origin** (`frontend#66`). Same origin is not a convenience: it is what makes the frame
share `localStorage` — and with it the session — and what lets the two views talk with
`postMessage` without crossing a boundary. In the demo that path is served by the backoffice's
nginx, which proxies `/designer/` to the designer's own container ([nginx.conf](nginx.conf)).

There is no nginx in front of `ng serve`, so `proxy.conf.json` mirrors that one rule: `/designer`
goes to the designer's Vite dev server on `localhost:5173`. Without it the path falls through to
Angular's SPA fallback, which answers `index.html` with a `200` — the frame renders the backoffice
inside the backoffice instead of failing, which is the confusing way for this to break.

So the drawer's third tab needs **two** dev servers:

```bash
cd ../b4rrhh_designer && npm run dev   # 5173, base /designer/
cd ../b4rrhh_frontend  && npm start    # 4200, proxies /api and /designer
```

Open the backoffice on 4200 — never the designer on 5173 directly, or the frame is cross-origin and
nothing works.

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

## Where the backlog is

The threads that produced these decisions live in a **private Gitea** and are not
mirrored: the Issues tab here is empty, and a `(#93)` or a `b4rrhh/backend#91` in a commit
message points at something you cannot open from GitHub. It is a known limitation, and it
leaves in reach the half that is worth more anyway — **the why is written inside the
commit**, not behind the link.

## License

This project is source-available under a Business Source License (BSL).

Commercial use is not permitted without explicit authorization.

See [LICENSE.md](LICENSE.md) for details.
