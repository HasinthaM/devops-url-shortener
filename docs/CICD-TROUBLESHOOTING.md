# CI/CD Troubleshooting Guide

Problems hit while completing the CI/CD pipeline (`.github/workflows/ci.yml`, `codeql.yml`), with the
cause and fix for each. Entries are in the order they were found.

| # | Job / step | Symptom | Type |
|---|-----------|---------|------|
| 1 | Validate → Audit | `npm audit` reports a high vulnerability in `effect` | Code (dependency) |
| 2 | Secret Scan (Gitleaks) | `Resource not accessible by integration` (403) | Code (workflow permissions) |
| 3 | CodeQL → analyze, Trivy SARIF upload | `Code scanning is not enabled for this repository` | GitHub repo setting (workaround applied) |
| 4 | Docker → Trivy gate | 10 fixable HIGH findings in the image | Code (Dockerfile) |
| 5 | Docker → set up Trivy | `Unable to resolve action aquasecurity/trivy-action@0.28.0` | Code (workflow) |
| 5b | Docker → set up Trivy | `Unable to resolve action aquasecurity/setup-trivy@v0.2.1` | Code (workflow) |
| 5c | Docker → upload SARIF | `Resource not accessible by integration` (get a workflow run) | Code (workflow permissions) |
| 6 | Local | Trivy DB download `context deadline exceeded` | Local environment |
| 7 | Local | Docker commands fail / no server version | Local environment |
| 8 | GitHub web UI | `A file with the same name already exists` | Usage |

## Current status

| Item | State |
|------|-------|
| `npm audit`, lint, typecheck, tests, Hadolint, Trivy gate | Pass locally (verified before pushing) |
| Gitleaks permissions, Trivy action version, `actions: read` | Fixed in workflows |
| Code scanning (Security tab uploads) | **Not enabled in repo settings.** Temporary artifact-based workaround is in place (see section 3) |
| GHCR publish, attestation | Runs only on push to `main` or a `v*.*.*` tag, never on PRs. Not yet verified on `main` |

---

## 1. `npm audit` fails on `effect`

**Where:** `Validate` job, step `npm audit --omit=dev --audit-level=high`.

**Cause:** A production dependency pulled in a version of `effect` with a known high-severity
advisory. The pipeline is configured to fail on `high` or above.

**Fix:** Force the patched version through an npm `overrides` entry in `package.json` and refresh
`package-lock.json` (commit `fix(deps): override effect to patched version`).

**Verify:**

```bash
npm ci --ignore-scripts
npm audit --omit=dev --audit-level=high   # expect: found 0 vulnerabilities
```

**Lesson:** The fix lived on a short-lived branch whose remote was later deleted, so `main` did not
have it. Before deleting a branch, confirm its commits are in `main`
(`git branch --contains <sha>`). It was recovered with `git cherry-pick`.

---

## 2. Gitleaks: `Resource not accessible by integration`

**Where:** `Secret Scan (Gitleaks)` job on pull requests.

**Error:**

```
RequestError [HttpError]: Resource not accessible by integration
status: 403  url: .../pulls/9/commits
x-accepted-github-permissions: pull_requests=read
```

**Cause:** The workflow sets `permissions: contents: read` at the top. On a PR, gitleaks lists the
PR's commits through the GitHub API, which needs `pull-requests: read`. The header
`x-accepted-github-permissions: pull_requests=read` names the missing permission.

**Fix:** Grant the permission on that one job only (least privilege):

```yaml
secret-scan:
  permissions:
    contents: read
    pull-requests: read
```

**Notes:**
- Both permissions are read-only, and no other job gets wider access.
- `is an individual user. No license key is required` in the log is informational. A license key is
  only needed for organisation-owned repos.
- The `DeprecationWarning` lines come from inside the action and are harmless.
- If Gitleaks later flags the README example `ADMIN_API_KEY="dev-secret-admin-key-change-in-production"`,
  add a `.gitleaks.toml` allowlist for that placeholder, or reword it.

---

## 3. CodeQL: `Code scanning is not enabled for this repository`

**Where:** `CodeQL` workflow, step `github/codeql-action/analyze`.

**Symptom:** The analysis itself succeeds ("scanned 38 out of 38 TypeScript files"), then the upload
fails with `Please verify that the necessary features are enabled`.

**Cause:** This is a repository setting, not a code bug. GitHub rejects SARIF uploads until code
scanning is turned on. `codeql.yml` already has `security-events: write`.

**Fix (GitHub UI, no code change):**
1. Repo → **Settings → Code security** (or *Advanced Security*).
2. Under **Code scanning → Tools → CodeQL analysis**, choose **Set up → Advanced**. Do not choose
   *Default*, because it conflicts with the existing `codeql.yml`. Close the editor without committing.
3. Re-run the failed jobs.

**Notes:**
- Code scanning is free on public repos. Private repos need GitHub Code Security (paid).
- The same setting fixes the Trivy `upload-sarif` step in `ci.yml`.
- If you can't enable it, either remove the CodeQL workflow or set `upload: never` on the analyze
  step so it no longer fails the run.

**Temporary workaround in this repo:** While code scanning was still off, the workflows were changed
so the pipeline doesn't fail on the upload:
- `codeql.yml`: `analyze` uses `upload: never` and `output: codeql-results`, and the SARIF is saved
  as the `codeql-results` artifact (Actions run page → Artifacts).
- `ci.yml`: the Trivy SARIF is saved as the `trivy-results` artifact, and the `upload-sarif` step has
  `continue-on-error: true`.

The Trivy **gate** (fails on fixable CRITICAL/HIGH) is unchanged and still blocks vulnerable images.
CodeQL findings do not block merges either way.

**To undo once code scanning is enabled:** in `codeql.yml` remove `upload: never`, `output`, and the
"Save CodeQL results" step; in `ci.yml` remove `continue-on-error: true` (keeping the artifact step
is harmless).

---

## 4. Trivy gate: 10 fixable HIGH vulnerabilities in the image

**Where:** `Build, Scan & Publish Image` job, step `Trivy gate (fail on fixable CRITICAL/HIGH)`.

**Found by:** Running the same scan locally before pushing (see *Local checks* below).

**Result:** 0 findings in the Alpine OS packages, and 10 HIGH in Node packages: `brace-expansion`,
`ip-address`, `pacote`, `picomatch`, `sigstore`.

**Cause:** All 10 were inside `/usr/local/lib/node_modules/npm`, the npm that ships with the
`node:22-alpine` base image. The app's own dependencies were clean: `npm audit` reported 0, and the
app's `ip-address` was already 10.7.6. The runtime image never uses npm, because it starts with
`node dist/server.js`.

**Fix:** Remove the unused package managers in the `runtime` stage of the `Dockerfile`, before
`USER node`:

```dockerfile
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg
```

**Why this is safe:** The `migrate` stage builds from the `build` stage, not `runtime`, so it keeps
npm for `prisma migrate deploy`. The image also gets smaller and has less attack surface.

**Verified:** Hadolint clean, Trivy `Total: 0 (HIGH: 0, CRITICAL: 0)`, and the container starts with
`GET /health` returning 200.

---

## 5. `Unable to resolve action aquasecurity/trivy-action@0.28.0`

**Where:** `Build, Scan & Publish Image` job, at "Prepare all required actions", before any step
runs.

**Cause:** The upstream repo's tags start with `v` (`v0.28.0`). The workflow said `0.28.0`, which
doesn't exist.

**Fix:** Pin both Trivy steps to the commit SHA of `v0.28.0`, with the version in a comment:

```yaml
uses: aquasecurity/trivy-action@915b19bbe73b92a6cf82a1bc12b087c9a19a5fe2 # v0.28.0
```

A SHA can't be re-pointed to different code the way a tag can, which is better for supply-chain
safety.

**Check any action reference** (read-only):

```bash
git ls-remote --tags https://github.com/<owner>/<repo> "refs/tags/<tag>"
```

No output means the tag doesn't exist. All other actions in the workflows were checked this way and
resolve.

**Caveat:** The SHA was taken from the tag as published at the time. To audit it, compare it with
the release page at https://github.com/aquasecurity/trivy-action/releases.

---

### 5b. Follow-up: `Unable to resolve action aquasecurity/setup-trivy@v0.2.1`

**Where:** Same job, same stage ("Getting action download info"), after fix 5 got further.

**Cause:** `trivy-action` is a composite action that calls other actions internally. v0.28.0 depends
on `aquasecurity/setup-trivy@v0.2.1`, and that tag has since been removed upstream (only `v0.2.6`
and later remain). Pinning your own reference can't fix a broken dependency inside the action.

**Fix:** Upgrade to a `trivy-action` release whose internal dependency still exists. `v0.36.0` uses
`setup-trivy@v0.2.6`:

```yaml
uses: aquasecurity/trivy-action@a9c7b0f06e461e9d4b4d1711f154ee024b8d7ab8 # v0.36.0
```

The inputs this workflow uses (`image-ref`, `format`, `output`, `severity`, `ignore-unfixed`,
`exit-code`) all still exist in v0.36.0.

**Check an action's own dependencies** before pinning it:

```bash
curl -s https://raw.githubusercontent.com/<owner>/<repo>/<tag>/action.yaml | grep "uses:"
git ls-remote --tags https://github.com/<owner>/<dependency>
```

---

### 5c. `upload-sarif`: `Resource not accessible by integration` (get a workflow run)

**Where:** `Upload Trivy results to GitHub Security tab` step in the `docker` job.

**Error:** `Error: Resource not accessible by integration - https://docs.github.com/rest/actions/workflow-runs#get-a-workflow-run`

**Cause:** `upload-sarif` calls the "get a workflow run" API, which needs `actions: read`. The
`docker` job declares its permissions explicitly (`contents`, `packages`, `security-events`,
`id-token`, `attestations`). When a job declares any permission, every permission it doesn't list
becomes `none`, so `actions: read` was missing.

**Fix:** Add `actions: read` to that job's permissions (read-only):

```yaml
permissions:
  contents: read
  packages: write
  security-events: write
  actions: read
  id-token: write
  attestations: write
```

**Also changed:** The log warned that CodeQL Action v3 is deprecated in December 2026. All
`github/codeql-action/*` references (`upload-sarif` in `ci.yml`, `init` and `analyze` in
`codeql.yml`) now use `@v4`.

**Remember:** Code scanning must also be enabled in the repo settings (see section 3), or the upload
will still be rejected.

---

## 6. Local Trivy: `context deadline exceeded`

**Symptom:**

```
FATAL init error: DB error: failed to download vulnerability DB ... context deadline exceeded
```

**Cause:** A network timeout while downloading Trivy's vulnerability database. It is **not** a scan
result, and the image was not scanned.

**Fix:** Retry with a longer timeout (`--timeout 30m`). The database is cached after the first
success, so later runs are fast.

---

## 7. Docker commands fail locally

**Symptom:** `docker info` shows no server version; builds can't connect.

**Cause:** The Docker Desktop daemon wasn't running.

**Fix:** Start Docker Desktop and wait until it reports "running".

**Git Bash gotcha:** Git Bash rewrites paths like `/var/run/docker.sock`, giving
`mkdir C:\Program Files\Git\var: Access is denied`. Prefer scanning an exported tarball and mounting
it read-only, which also avoids mounting the Docker socket into a container.

---

## 8. GitHub web UI: `A file with the same name already exists`

**Where:** Creating or uploading a file through GitHub's website or a desktop app.

**Cause:** Not a git or CI error. A file with that path already exists on the branch (for example
`docs/CICD-TROUBLESHOOTING.md`), and the web editor refuses duplicates.

**Fix:** Edit the existing file (pencil icon) instead of creating a new one, or choose a different
name. Changes made locally and pushed with `git push` don't hit this error.

**Check what's on the branch:**

```bash
git fetch --prune
git status -sb                       # local vs origin
git ls-tree -r --name-only origin/<branch> | grep -i <name>
```

---

## Local checks (run before every push)

These mirror the CI jobs so most failures are caught in minutes.

```bash
npm ci --ignore-scripts
npm audit --omit=dev --audit-level=high
npx prisma generate
npm run format:check
npm run lint
npm run typecheck
npm test -- --coverage

docker build --target runtime -t scan-target:ci .
docker run --rm -i hadolint/hadolint:v2.12.0 hadolint --failure-threshold warning - < Dockerfile

docker save scan-target:ci -o scan-target.tar
docker run --rm -v "$PWD:/work:ro" aquasec/trivy:0.58.0 image --timeout 30m \
  --input /work/scan-target.tar --severity CRITICAL,HIGH --ignore-unfixed --exit-code 1
```

Use `npm ci --ignore-scripts` so dependency install scripts don't run on your machine.

## Repository settings checklist (not in code)

- **Settings → Code security:** enable code scanning (CodeQL, Advanced), Dependency graph,
  Dependabot alerts and secret protection. Until code scanning is on, the SARIF-upload workaround
  from section 3 stays in the workflows. Remove it afterwards.
- **Settings → Actions → General → Workflow permissions:** "Read and write", so the GHCR push works
  after merge.
- **Branch protection on `main`:** require a PR and the CI checks to pass.
- **GHCR package:** after the first push, link the package to the repo and set its visibility.

## Workflow lessons

- Do CI/CD work on a branch from `main` and merge through a PR (`feat/cicd-completion`).
- Before deleting a branch or closing a PR, confirm its commits are in `main`.
- Never force-push, skip hooks, or merge with a red check.
