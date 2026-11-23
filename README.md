# DevOps URL Shortener Platform – Backend Foundation

[![CI Pipeline](https://github.com/hasin-ops/devops-url-shortener/actions/workflows/ci.yml/badge.svg)](https://github.com/hasin-ops/devops-url-shortener/actions)
[![CodeQL](https://github.com/hasin-ops/devops-url-shortener/actions/workflows/codeql.yml/badge.svg)](https://github.com/hasin-ops/devops-url-shortener/security/code-scanning)
![Node.js](https://img.shields.io/badge/Node.js-LTS-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Express](https://img.shields.io/badge/Express-4.x%2F5.x-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?logo=kubernetes&logoColor=white)

A production-grade, highly maintainable, and observable URL Shortener REST API engineered in TypeScript and Node.js. Built as a solid architectural foundation designed to be systematically extended with modern DevOps, SRE, containerization, and Kubernetes practices.

---

## 📑 Table of Contents

- [Overview & Objectives](#-overview--objectives)
- [Key Features](#-key-features)
- [Technology Stack](#-technology-stack)
- [System Architecture](#-system-architecture)
- [Database Design](#-database-design)
- [API Specifications](#-api-specifications)
- [Repository Structure](#-repository-structure)
- [Prerequisites](#-prerequisites)
- [Installation & Local Setup](#-installation--local-setup)
- [Environment Variables](#-environment-variables)
- [Database Migrations](#-database-migrations)
- [Running the Application](#-running-the-application)
- [Testing](#-testing)
- [Interactive API Documentation (Swagger)](#-interactive-api-documentation-swagger)
- [DevOps & Cloud-Native Roadmap](#-devops--cloud-native-roadmap)

---

## 🎯 Overview & Objectives

This project is the core backend service of a comprehensive DevOps portfolio platform. Instead of creating a trivial demo, it implements real-world software engineering and DevOps readiness patterns:

- **Layered Clean Architecture**: Strict separation of concerns (Routes, Controllers, Services, Repositories).
- **Sub-25ms Redirects**: Decoupled, non-blocking click tracking designed to protect redirect latency.
- **Defensive Security**: SSRF prevention against private IP ranges, Helmet security headers, CORS origin filtering, and granular rate-limiting.
- **Enterprise Observability Foundation**: Kubernetes dual-probe readiness (`/ready`) and liveness (`/health`) checks, structured JSON logging with Pino, and request-id correlation (`x-request-id`).
- **Resilient Collision Handling**: Cryptographically secure Base62 random short codes with automated database collision retry recovery.

---

## 🚀 Key Features

1. **Short URL Generation**: Generates 7-character Base62 tokens ($62^7 \approx 3.52 \times 10^{12}$ unique permutations).
2. **High-Speed Redirection**: Dispatches HTTP 302 Found redirects to avoid permanent client-side cache poisoning.
3. **Decoupled Click Analytics**: Records click timestamps, user-agents, and referrers asynchronously without blocking redirect response times.
4. **Link Lifecycle & Expiration**: Optional ISO 8601 expiration timestamps with automatic HTTP 410 Gone enforcement.
5. **Soft Deletion & Anti-Hijacking**: URLs are soft-deactivated (`isActive: false`) rather than abruptly dropped, preserving audit trails and preventing malicious link re-registration.
6. **Administrative Authorization**: Management endpoints (such as `DELETE`) require an API key (`x-api-key` or `Authorization: Bearer <key>`).
7. **SSRF Guard**: Destination URLs targeting `localhost`, `127.0.0.1`, cloud metadata IP (`169.254.169.254`), or private subnets (`10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`) are strictly rejected.

---

## 🛠️ Technology Stack

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Runtime** | Node.js (v20+ LTS / v22 / v24) | High-performance asynchronous JavaScript engine |
| **Language** | TypeScript (Strict Mode) | Type safety, strict null checking, interfaces & DTOs |
| **Framework** | Express.js | Minimalist, battle-tested web framework |
| **Database** | PostgreSQL | ACID-compliant relational persistence |
| **ORM** | Prisma | Type-safe schema definition and migrations |
| **Validation** | Zod | Runtime schema validation with custom refinements |
| **Logging** | Pino & Pino-HTTP | High-throughput structured JSON logging with redaction |
| **API Docs** | Swagger / OpenAPI 3.0 | Interactive Swagger UI at `/docs` |
| **Testing** | Jest & Supertest | Comprehensive unit and integration test coverage |
| **Security** | Helmet, CORS, Rate-Limit | Defense-in-depth HTTP hardening |

---

## 🏛️ System Architecture

### Request Flow Diagram

```mermaid
sequenceDiagram
    autonumber
    actor Client
    participant Proxy as Reverse Proxy (Nginx/Ingress)
    participant Middlewares as Middlewares (ReqId, RateLimit, Pino, Auth, Zod)
    participant Controller as UrlController
    participant Service as UrlService
    participant Analytics as AnalyticsService
    participant Repo as UrlRepository
    participant DB as PostgreSQL

    Client->>Proxy: HTTP Request
    Proxy->>Middlewares: Forward Request
    Middlewares->>Middlewares: Inject RequestId, verify rate limits, validate payload
    Middlewares->>Controller: Invokes Action
    
    alt Short URL Redirection (GET /:shortCode)
        Controller->>Service: getForRedirect(shortCode)
        Service->>Repo: findByShortCode(shortCode)
        Repo->>DB: SELECT * FROM urls WHERE short_code = ?
        DB-->>Repo: UrlEntity
        Repo-->>Service: UrlEntity
        Service-->>Controller: Validated UrlEntity
        Controller->>Client: HTTP 302 Found (Location: destinationUrl)
        Note over Controller,Analytics: Decoupled / Non-blocking Asynchronous Call
        Controller--)Analytics: recordClickAsync({ urlId, referrer, userAgent })
        Analytics--)DB: INSERT INTO url_click_analytics ...
    else URL Creation (POST /api/v1/urls)
        Controller->>Service: createUrl({ originalUrl, expiresAt })
        Service->>Repo: create({ originalUrl, shortCode, expiresAt })
        Repo->>DB: INSERT INTO urls ...
        DB-->>Repo: Saved record
        Repo-->>Service: UrlEntity
        Service-->>Controller: CreateUrlResponseDto
        Controller->>Client: HTTP 201 Created
    end
```

---

## 🗄️ Database Design

### Entity-Relationship Diagram

```mermaid
erDiagram
    URL ||--o{ URL_CLICK_ANALYTICS : "tracks clicks"
    
    URL {
        uuid id PK "UUID v4"
        text original_url "Destination URL"
        varchar(16) short_code UK "Unique Base62 code"
        boolean is_active "Default true"
        timestamp created_at "UTC timestamp"
        timestamp updated_at "UTC timestamp"
        timestamp expires_at "Nullable UTC timestamp"
    }

    URL_CLICK_ANALYTICS {
        uuid id PK "UUID v4"
        uuid url_id FK "References URL(id) ON DELETE CASCADE"
        timestamp clicked_at "UTC timestamp"
        text referrer "Nullable referrer URL"
        text user_agent "Nullable client user agent"
    }
```

### Indexing Decisions
- `urls.short_code`: **Unique index** enabling $O(1)$ fast lookups for redirection.
- `urls.created_at`: Index for administrative sorting and pagination.
- `urls(is_active, expires_at)`: Compound index for filtering out deactivated/expired links.
- `url_click_analytics.url_id`: Index for aggregate count calculation (`COUNT(*) WHERE url_id = ?`).
- `url_click_analytics.clicked_at`: Index for chronological time-series analytics.

---

## 📡 API Specifications

| Method | Endpoint | Description | Auth Required | Rate Limited |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/urls` | Create a shortened URL | No | Strict (20 req/min) |
| `GET` | `/:shortCode` | Fast 302 redirect to destination | No | High-throughput (500 req/min) |
| `GET` | `/api/v1/urls/:shortCode` | Retrieve URL metadata | No | Standard (100 req/min) |
| `GET` | `/api/v1/urls/:shortCode/stats` | Retrieve total clicks & metrics | Yes (API key) | Standard (100 req/min) |
| `DELETE` | `/api/v1/urls/:shortCode` | Soft-deactivate short URL | Yes (`x-api-key`) | Standard (100 req/min) |
| `GET` | `/health` | Liveness health check | No | Unrestricted |
| `GET` | `/ready` | Readiness check (DB ping) | No | Unrestricted |
| `GET` | `/docs` | Interactive Swagger UI | No | Standard |

---

## 📁 Repository Structure

```
devops-url-shortener/
├── .github/
│   └── workflows/
│       └── ci.yml                 # Automated CI (lint, format, typecheck, tests)
├── docs/
│   ├── architecture.md            # Architecture & design documentation
│   ├── database-design.md         # Schema, ER diagram, indexing rationale
│   └── api-specification.md       # OpenAPI / API endpoint contract
├── prisma/
│   ├── schema.prisma              # Data models and mappings
│   └── migrations/                # Version-controlled SQL migrations
├── src/
│   ├── app.ts                     # Express app setup & middleware mounting
│   ├── server.ts                  # Server lifecycle, graceful shutdown handler
│   ├── config/
│   │   ├── env.ts                 # Zod-validated environment config
│   │   ├── database.ts            # Prisma client singleton instance
│   │   ├── logger.ts              # Pino logger configuration
│   │   └── swagger.ts             # Swagger / OpenAPI specification
│   ├── modules/
│   │   ├── urls/
│   │   │   ├── url.routes.ts      # URL route handlers
│   │   │   ├── url.controller.ts  # HTTP request/response mapper
│   │   │   ├── url.service.ts     # Business logic, code generation, collisions
│   │   │   ├── url.repository.ts  # Database abstraction for URL entity
│   │   │   ├── url.schema.ts      # Zod validation schemas
│   │   │   ├── url.types.ts       # Domain DTOs and interfaces
│   │   │   └── url.mapper.ts      # DB to client-safe DTO conversion
│   │   └── analytics/
│   │       ├── analytics.service.ts    # Async click recording & stats
│   │       ├── analytics.repository.ts # Analytics DB queries
│   │       └── analytics.types.ts      # Analytics interfaces
│   ├── middlewares/
│   │   ├── auth.middleware.ts        # Admin API key / extensible auth
│   │   ├── error.middleware.ts       # Centralized error handler & status mapping
│   │   ├── not-found.middleware.ts   # 404 handler for unknown routes
│   │   ├── request-id.middleware.ts  # Correlation ID injection (x-request-id)
│   │   ├── rate-limit.middleware.ts  # Express-rate-limit configurations
│   │   └── validate.middleware.ts    # Generic Zod validation middleware
│   ├── routes/
│   │   └── index.ts               # Top-level router (health, ready, api/v1, redirect)
│   ├── utils/
│   │   ├── generate-short-code.ts # Crypto Base62 generator
│   │   ├── async-handler.ts       # Express async route wrapper
│   │   └── errors.ts              # Custom AppError hierarchy
│   └── types/
│       └── express.d.ts           # Custom Express Request type augmentations
├── tests/
│   ├── unit/
│   │   ├── generate-short-code.test.ts
│   │   ├── url.service.test.ts
│   │   ├── url.schema.test.ts
│   │   └── errors.test.ts
│   └── integration/
│       ├── health.test.ts
│       └── url.integration.test.ts
├── .dockerignore
├── .env.example                   # Complete documented environment template
├── .gitignore
├── .prettierrc
├── eslint.config.mjs              # Modern flat ESLint configuration
├── jest.config.ts                 # TypeScript Jest configuration
├── package.json
└── tsconfig.json                  # Strict TypeScript configuration
```

---

## ⚙️ Prerequisites

- **Node.js**: `v20.x` or `v22.x` (LTS) / `v24.x`
- **npm**: `v10.x` or `v11.x`
- **PostgreSQL**: `v15` or `v16` (Local or Docker container)

---

## 💻 Installation & Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/hasin-ops/devops-url-shortener.git
cd devops-url-shortener
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Ensure your `DATABASE_URL` matches your local PostgreSQL connection credentials:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/url_shortener?schema=public"
ADMIN_API_KEY="dev-secret-admin-key-change-in-production"
```

---

## 🗄️ Database Migrations

Generate the Prisma Client and run the initial migration:
```bash
# Generate Prisma Client
npm run prisma:generate

# Apply migrations against PostgreSQL
npm run prisma:migrate
```

To explore the database visually:
```bash
npm run prisma:studio
```

---

## 🏃 Running the Application

### Development mode (with live reload via tsx)
```bash
npm run dev
```

### Production build & execution
```bash
# 1. Compile TypeScript into dist/
npm run build

# 2. Run compiled production bundle
npm start
```

---

## 🧪 Testing

The test suite includes unit tests for business logic, schemas, and cryptographic code generation, alongside integration tests for HTTP endpoints and probes.

```bash
# Run all tests
npm test

# Run tests with code coverage analysis
npm run test:coverage

# Run TypeScript typecheck without emitting output
npm run typecheck

# Check code linting
npm run lint

# Format code with Prettier
npm run format
```

---

## 📖 Interactive API Documentation (Swagger)

Once the application is running, open your browser and navigate to:
```
http://localhost:3000/docs
```
You can inspect request schemas, error codes, and test endpoints interactively.

Raw OpenAPI JSON specification is available at:
```
http://localhost:3000/docs-json
```

---

## 🔄 CI/CD & Security Pipeline

Everything below runs on **GitHub Actions** (free for public repositories) and is defined as code in `.github/`.

### Pipeline overview

```
 push / PR ──► validate ─────────┐
              dockerfile-lint ───┼──► docker: build ► Trivy scan ► gate ► push to GHCR ► attest
              secret-scan ───────┘                                     (main & tags only)

 push / PR / weekly ──► CodeQL (separate workflow)
 weekly            ──► Dependabot opens update PRs
```

The three quality jobs run in parallel; the `docker` job only starts if all of them pass, so a broken or insecure build is never published.

### What each piece does

| Piece | File | What it does & why it matters |
| --- | --- | --- |
| **Validate job** | `ci.yml` → `validate` | Spins up a real PostgreSQL service container, then runs `npm ci`, `npm audit`, Prettier, ESLint, TypeScript typecheck and the Jest suite with coverage. Proves every commit builds and passes tests against a real database, not mocks. |
| **Coverage artifact** | `ci.yml` → `Upload Coverage Report` | Saves the `coverage/` report as a downloadable build artifact (14 days) so you can inspect which lines are untested. |
| **Concurrency control** | `ci.yml` → `concurrency` | When you push again to the same branch, the older still-running pipeline is cancelled. Saves runner minutes and avoids stale results. |
| **Least-privilege permissions** | `ci.yml` → `permissions` | The workflow token is read-only by default; only the `docker` job is granted `packages: write` / `security-events: write`. Limits the blast radius if a step is compromised. |
| **Hadolint** | `ci.yml` → `dockerfile-lint`, `.hadolint.yaml` | Lints the `Dockerfile` against Docker best practices (and ShellCheck for `RUN` lines): unpinned tags, missing flags, bad layer patterns. Catches mistakes before the image is built. |
| **Gitleaks** | `ci.yml` → `secret-scan` | Scans the **entire git history** (`fetch-depth: 0`) for committed API keys, passwords and tokens. A leaked secret in an old commit is still a leak, so history matters, not just the latest files. |
| **Docker Buildx + layer cache** | `ci.yml` → `docker` | Builds the multi-stage image with BuildKit and caches layers in the GitHub Actions cache, so unchanged stages (e.g. `npm ci`) are not rebuilt every run. |
| **Trivy image scan** | `ci.yml` → `docker` | Scans the exact built image (OS packages + npm dependencies) for known CVEs. Results are uploaded as SARIF to the repo's **Security → Code scanning** tab. |
| **Trivy quality gate** | `ci.yml` → `docker` | A second Trivy run **fails the pipeline** on any *fixable* `CRITICAL`/`HIGH` vulnerability (`ignore-unfixed: true` avoids blocking on issues nobody can patch yet). Shift-left security: vulnerable images never reach the registry. |
| **GHCR publishing** | `ci.yml` → `docker` | On pushes to `main` and version tags, pushes the image to the **GitHub Container Registry** (`ghcr.io/<owner>/<repo>`), authenticated with the built-in `GITHUB_TOKEN`, so no stored credentials are needed. Skipped on pull requests. |
| **Semantic-version tagging** | `docker/metadata-action` | `main` → `:main`, `:latest`, `:sha-<commit>`. Pushing git tag `v1.2.3` → `:1.2.3`, `:1.2`, `:1`. Every image is traceable to a commit and versions are immutable and predictable. |
| **SBOM** | `sbom: true` | Attaches a Software Bill of Materials to the image listing every package inside it, which is useful for audits and for answering "are we affected by CVE-X?" |
| **Provenance attestation** | `provenance: mode=max` + `attest-build-provenance` | Records a signed, verifiable statement of *which repo, commit and workflow built the image* (SLSA-style supply-chain security). Consumers can verify the image was not tampered with or built elsewhere. |
| **CodeQL** | `codeql.yml` | GitHub's SAST engine analyses the TypeScript source for vulnerabilities (injection, unsafe regex, SSRF, etc.) using the `security-and-quality` query suite. Runs on every push/PR and weekly to pick up new queries. Findings appear in **Security → Code scanning**. |
| **Dependabot** | `dependabot.yml` | Opens weekly PRs to update npm packages, the Docker base image and the GitHub Actions versions themselves. Updates are grouped to avoid PR spam, and each PR runs through the full pipeline before merging. |

### Releasing a version

```bash
git tag v1.0.0
git push origin v1.0.0
```

The pipeline then publishes `ghcr.io/<owner>/<repo>:1.0.0`, `:1.0` and `:1`.

### Pulling the published image

```bash
docker pull ghcr.io/hasin-ops/devops-url-shortener:latest
```

> **One-time GitHub setup:** after the first successful run, open the repo's **Packages** and set the image visibility to *public* if you want others to pull it. Under **Settings → Code security**, enable *Code scanning* and *Dependabot alerts*.

---

## 🗺️ DevOps & Cloud-Native Roadmap

- [x] **Dockerization**: Multi-stage `alpine` Dockerfile, non-root user, `HEALTHCHECK`.
- [x] **Docker Compose**: PostgreSQL, one-shot migrations and the app with health checks.
- [x] **CI/CD Automation**: GitHub Actions for lint, test, Hadolint, Gitleaks, CodeQL, Trivy, GHCR publishing, SBOM and provenance. Dependabot keeps dependencies current.
- [ ] **Redis Caching**: Decorator-pattern cache layer on `UrlRepository` for sub-5ms cached redirects.
- [ ] **Asynchronous Message Queue**: Integrating BullMQ or RabbitMQ to stream click events to dedicated background workers.
- [ ] **Prometheus & Grafana**: Exporting RED metrics (Rate, Errors, Duration) and building monitoring dashboards.
- [ ] **Kubernetes Manifests & Helm Chart**: Deployments, Services, ConfigMaps, Secrets, Horizontal Pod Autoscaler (HPA), and PDBs.
- [ ] **Infrastructure as Code & GitOps**: Terraform on a free tier, deployed via Argo CD.
