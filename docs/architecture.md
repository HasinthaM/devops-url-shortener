# DevOps URL Shortener Platform – Backend Architecture

## Overview

The DevOps URL Shortener Platform is a production-grade, extensible REST API engineered to demonstrate modern backend and DevOps practices. It provides core URL shortening, fast HTTP 302 redirection, click tracking analytics, and URL lifecycle management.

## Architectural Principles

1. **Modular Layered Architecture**:
   - **Routes**: Declarative endpoint routing and middleware assignment.
   - **Controllers**: HTTP translation (params, query, body), DTO mapping, and response formatting. Zero business logic or database queries.
   - **Services**: Pure business logic (e.g. short-code generation, collision retries, expiration rules, stats calculation). Isolated from Express `req`/`res`.
   - **Repositories**: Isolated data access layer abstracting Prisma ORM queries.
   - **Middlewares**: Cross-cutting concerns including correlation IDs, structured logging, security headers (Helmet), CORS, rate limiting, and centralized error handling.

2. **Decoupled Analytics Ingestion**:
   - URL redirection (`GET /:shortCode`) delivers sub-25ms response times.
   - Click analytics ingestion is non-blocking and decoupled from the redirect response.
   - Prepared for asynchronous event bus / queue integration (e.g. Redis, RabbitMQ, Kafka) in future DevOps phases.

3. **Kubernetes & Cloud-Native Observability**:
   - Dual-probe model: `/health` (liveness) for process health and `/ready` (readiness) for dependency verification (PostgreSQL connectivity).
   - Structured JSON logging via Pino with correlation ID propagation (`x-request-id`).

