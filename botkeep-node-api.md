# BotKeep Node.js HTTP API Guide

**Agent-ready reference · verified 15 October 2026**

## Scope and limits

This guide documents the HTTP API in BotKeep's downloadable **Express API** starter and the Node.js hosting requirements published by BotKeep. It does **not** document a BotKeep account/control-panel API. The public documentation does not publish a control-plane REST or OpenAPI contract; during verification, `/api-docs`, `/docs/api` and `/openapi.json` returned 404, while `api.botkeep.cloud/docs` returned 403. No platform endpoints, API keys or auth scheme should be inferred from those results.

The routes below exist only when the deployed app contains the Express starter (or implements the same contract). The starter is a minimal example, not a production-ready private-data API: it has no authentication, database, rate limiting, CORS policy or published OpenAPI spec.

## Agent handoff

Use these rules when another agent builds or deploys this service:

- Target the Node.js 22.x runtime at version 22.9 or newer, as specified by BotKeep's starter page; confirm the exact runtime shown in the BotKeep creation form.
- Keep the starter's routes and JSON shapes unless the user explicitly approves an API redesign. Do not invent additional BotKeep endpoints.
- Run `npm run check` and `npm start`; commit `package-lock.json` and use `npm ci` for repeatable installs.
- For BotKeep hosting, bind to `0.0.0.0` and the assigned `SERVER_PORT`, then enable HTTPS routing in **Domains**. The downloaded starter itself reads `HOST` and `PORT` (defaulting to `127.0.0.1:3000`), so adapt its listener or map the assigned port to `PORT` before deployment.
- Put secrets in BotKeep's Environment settings. Never commit `.env`, API keys or passwords, or include them in an uploaded ZIP.
- Do not claim the sample is protected or persistent: authentication and a database are not included. Add authorization, rate limits and durable storage before handling private data.
- The production base URL depends on the domain configured in BotKeep. Obtain it from the Domains panel; do not make up a hostname.

## Runtime and project setup

BotKeep's starter uses Express **5.2.1**, ECMAScript modules and Node.js. Its package scripts are:

```json
{
  "type": "module",
  "engines": { "node": ">=22.9.0" },
  "scripts": {
    "start": "node --env-file-if-exists=.env index.js",
    "check": "node --check index.js"
  },
  "dependencies": { "express": "5.2.1" }
}
```

The starter's `check` script checks JavaScript syntax; it is not an endpoint or integration test. A lockfile is generated locally and should be committed.

```sh
npm install
npm run check
npm start
```

Local base URL: `http://127.0.0.1:3000`. Hosted base URL: `https://<domain-configured-in-BotKeep-Domains>` after routing is enabled and any custom-domain DNS verification is complete. BotKeep's template preview does not run the process or activate HTTP/TLS networking.

### Listener configuration

This is a recommended adaptation that reconciles the two published settings. The hosting guide names `SERVER_PORT` and `0.0.0.0`; the starter source reads `PORT` and `HOST` and defaults to loopback/3000. The snippet below is **not** the starter's original code.

```js
const rawPort = process.env.SERVER_PORT || process.env.PORT || '3000'
const port = Number(rawPort)
const host = process.env.HOST || (process.env.SERVER_PORT ? '0.0.0.0' : '127.0.0.1')

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('Invalid listening port')
}

const server = app.listen(port, host, () => {
  console.log(`API ready on ${host}:${port}`)
})
```

Do not bind a hosted service only to `127.0.0.1`; that loopback binding is suitable for local development but may prevent the hosting router from reaching the process. Do not hard-code port `3000` for production.

## API contract

All sample endpoints return JSON. There is no `/v1` prefix in the starter. No authentication is implemented, and no request body is required by either endpoint.

| Method and path | Query | Success response | Behavior |
| --- | --- | --- | --- |
| `GET /health` | None | `200` `{"status":"ok"}` | Static process health response; it does not check a database or other dependency. |
| `GET /api/greeting` | Optional `name` | `200` `{"message":"Hello, Ada!"}` | Trims `name`; missing/non-string value falls back to `builder`. The trimmed value must contain 1–60 characters. |

### `GET /health`

```sh
curl -i "$BASE_URL/health"
```

Response:

```http
HTTP/1.1 200 OK
Content-Type: application/json; charset=utf-8

{"status":"ok"}
```

Because the response is unconditional, use it as a simple process/liveness check only. If the API later depends on a database or queue, add a separate readiness check that verifies those dependencies.

### `GET /api/greeting`

Send the optional name as a URL-encoded query parameter:

```sh
curl -i --get --data-urlencode "name=Botkeep" "$BASE_URL/api/greeting"
```

```json
{"message":"Hello, Botkeep!"}
```

The starter trims whitespace before checking the length. With no `name`, it responds with `{"message":"Hello, builder!"}`. An empty/whitespace-only name or a name longer than 60 characters returns `400`:

```json
{"error":"Name must contain 1–60 characters."}
```

Use URL encoding rather than concatenating untrusted text into a URL. The current API has no write route; do not send application data expecting it to be stored.

### Node.js client example

Node.js 22 includes `fetch`. Set `API_BASE_URL` to the local address or the actual domain configured in BotKeep.

```js
const baseUrl = process.env.API_BASE_URL || 'http://127.0.0.1:3000'
const url = new URL('/api/greeting', baseUrl)
url.searchParams.set('name', 'Botkeep')

const response = await fetch(url, {
  headers: { accept: 'application/json' },
})
const body = await response.json()

if (!response.ok) {
  throw new Error(`API ${response.status}: ${body.error || response.statusText}`)
}

console.log(body.message)
```

The starter's public sample routes do not require a token. That is not a safe default for private business data; add an authentication design before exposing such routes.

## Errors and current implementation behavior

| HTTP status | Response body | Trigger in the starter |
| --- | --- | --- |
| `400` | `{"error":"Name must contain 1–60 characters."}` | `name` is empty after trimming or exceeds 60 characters. |
| `400` | `{"error":"Invalid JSON"}` | A request with JSON content has malformed JSON. |
| `404` | `{"error":"Not found"}` | A path or HTTP method is not handled by the two GET routes. |
| `500` | `{"error":"Request failed"}` | Any other error passed to the generic error handler. |

The app configures `express.json({ limit: '16kb' })`. **Starter edge case:** the error handler converts every parser error other than status 400 to 500. An over-limit JSON request can therefore be reported as `500 Request failed` rather than `413 Payload Too Large`. If adding write routes, fix this mapping and document the resulting contract; do not describe the current behavior as a clean 413 response.

The starter disables Express's `X-Powered-By` header and handles `SIGINT`/`SIGTERM` by closing the HTTP server, with a 10-second forced-exit fallback. It logs startup to stdout; it does not define a stable error code, request ID, retry policy or rate-limit response format.

## Deploy on BotKeep

1. Keep `package.json` at the selected project root. For a monorepo, point BotKeep to the directory containing it.
2. Keep `package-lock.json`; do not upload `node_modules`, build caches or a nested outer folder that hides the project root.
3. Configure the start command as `npm start`. Test `npm run check` and `npm start` locally first.
4. Reconcile the listener with BotKeep's runtime: `0.0.0.0` plus the assigned `SERVER_PORT` per the Node.js hosting guide. The starter's unmodified listener uses `HOST`/`PORT`; check the deployed code rather than assuming those names are interchangeable.
5. Add secrets in the BotKeep Environment panel, not in Git or the ZIP. Use non-secret environment variables for ordinary configuration.
6. Enable the address and HTTPS routing in **Domains**. A custom domain requires DNS verification. The starter preview is not a live network deployment.
7. Start the workload and inspect **Console** for `API ready on ...`; request `/health` through the configured public URL.
8. Keep source and important data copies outside BotKeep. Use a database or designated persistent files for durable state; process memory is cleared on restart, and backups should be independent.

BotKeep's GitHub update flow is not described as a zero-downtime build-and-swap pipeline. Review the restart choice during updates. The homepage's current Standard Free allocation is one workload with 512 MB RAM, 50% CPU and 1 GB storage, shared across the account; check current plan details and capacity before sizing an API. “24/7” is not an uptime SLA.

## Production checklist

- [ ] Bind to `0.0.0.0` and the actual assigned port; HTTPS routing is enabled in Domains.
- [ ] The route contract and status codes are covered by automated tests.
- [ ] Private routes require authentication and authorization; credentials are stored as secrets and never logged.
- [ ] Add rate limiting, request validation, an intentional CORS allowlist (if browser clients need CORS), and safe error handling.
- [ ] Persist required data outside process memory and maintain independent backups.
- [ ] Keep request bodies bounded; return correct statuses for malformed and oversized JSON.
- [ ] Treat `/health` as liveness only; add readiness checks if dependencies are introduced.
- [ ] Test resource use under representative traffic; BotKeep's resource planner is not a requests-per-second guarantee.
- [ ] If you add routes, publish/version an OpenAPI spec that matches the implementation. The starter itself does not include one.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Process starts but public URL cannot reach it | Confirm Domains routing is enabled, the process binds to `0.0.0.0`, and it uses the assigned `SERVER_PORT`; loopback and a hard-coded local port are common causes. |
| `404 {"error":"Not found"}` | Confirm the path and method. The starter implements only `GET /health` and `GET /api/greeting`. |
| `400` from greeting | Trim the value and keep it to 1–60 characters; URL-encode query values. |
| Local start fails on Node option/dependency | Use Node.js 22.9+ within the 22.x line offered by BotKeep, run `npm ci` after committing the lockfile, and inspect Console output. |
| API returns `500` after a large JSON body | The starter's generic handler maps non-400 parser errors to 500; lower the body size or update the handler to preserve 413. |

## Sources

All BotKeep-specific behavior below was checked against the public pages and the ZIP downloaded from the Express API starter on 15 October 2026. Recheck the BotKeep creation form and Domains panel because runtime options and assigned addresses can change.

1. [Express API starter](https://botkeep.cloud/templates/express-api) — requirements, local routes, limits, exclusions and downloadable source.
2. [Node.js hosting guide](https://botkeep.cloud/hosting/nodejs) — host/port binding, domains, persistence and resource guidance.
3. [BotKeep documentation index](https://botkeep.cloud/docs) — published user-facing guides.
4. [Deploy from GitHub](https://botkeep.cloud/docs/github) — project root, secrets and repository update workflow.
5. [Deploy from ZIP](https://botkeep.cloud/docs/zip) — archive layout, exclusions and upload steps.

**If the intended task is to manage BotKeep workloads through a BotKeep platform API**, request its official API reference or OpenAPI file. This guide deliberately does not guess that separate, unpublished contract.
