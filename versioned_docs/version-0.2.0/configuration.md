---
id: configuration
title: Configuration
description: Configuration Reference
slug: /configuration
---

# Configuration Reference

Kono uses a single declarative YAML configuration file.

:::info
Only YAML is supported. JSON and TOML are not supported to reduce complexity and avoid inconsistencies.
:::

## Root
---

```yaml
schema: v1
debug: false
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `schema` | string | ✅ | — | Must be `v1` |
| `debug` | bool | | `false` | Enables debug logging. Adds verbose output across router, scatter, and upstream components |

## Server
---

```yaml
gateway:
  server:
    port: 7805
    timeout: 20s
    pprof:
      enabled: true
      port: 6060
    metrics:
      enabled: true
      exporter: otlp
      otlp:
        endpoint: otel-collector:4318
        insecure: true
        interval: 10s
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `port` | int | ✅ | — | HTTP port the gateway listens on |
| `timeout` | duration | | `5s` | Read and write timeout applied to all incoming requests |
| `pprof.enabled` | bool | | `false` | Enable Go pprof profiling server |
| `pprof.port` | int | if enabled | — | Port for the pprof server |
| `metrics.enabled` | bool | | `false` | Enable metrics instrumentation |
| `metrics.exporter` | string | if enabled | — | `prometheus` or `otlp` |
| `metrics.otlp.endpoint` | string | if otlp | — | OTLP HTTP endpoint (e.g. `otel-collector:4318`) |
| `metrics.otlp.insecure` | bool | | `false` | Disable TLS for the OTLP connection |
| `metrics.otlp.interval` | duration | | `60s` | How often metrics are pushed to the OTLP endpoint |

**Timeout nuance:** `timeout` applies to both reading the request body and writing the response. For passthrough flows with long-lived connections (SSE, chunked transfer), set a high value or rely on upstream-side timeout management, since the gateway timeout will terminate the connection.

**pprof nuance:** the pprof server binds only to `localhost` — it is not accessible externally regardless of network configuration.

**Metrics nuance:** with `exporter: prometheus`, a `/metrics` endpoint is exposed on the same port as the gateway. With `exporter: otlp`, no endpoint is exposed — metrics are pushed on the configured interval. See the [Metrics](metrics) page for available metrics and Grafana setup.

## Routing
---

```yaml
gateway:
  routing:
    trusted_proxies:
      - 127.0.0.1/32
      - 10.0.0.0/8
    rate_limiter:
      enabled: true
      config:
        limit: 100
        window: 1s
    flows:
      - ...
```

| Field | Type | Default | Description |
|---|---|---|---|
| `trusted_proxies` | list[CIDR] | `[]` | IP ranges whose `X-Forwarded-*` headers are trusted |
| `rate_limiter.enabled` | bool | `false` | Enable per-IP rate limiting |
| `rate_limiter.config` | map | — | Rate limiter configuration (`limit`, `window`) |

**Trusted proxies nuance:** when a request arrives from an IP that is _not_ in `trusted_proxies`, Kono overwrites `X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`, and `Forwarded` with values derived from the actual connection. When a request comes from a _trusted_ IP, Kono appends to the existing chain rather than overwriting — preserving the full proxy path. Leave this list empty if Kono is your outermost edge.

**Rate limiter nuance:** the limit is applied per client IP after trusted proxy resolution. The IP used for rate limiting is the same one extracted from `X-Forwarded-For` / `X-Real-IP` / `RemoteAddr`.

## Flows
---

A flow defines how an incoming request is matched, processed, and dispatched to upstreams.

```yaml
flows:
  - path: /api/v1/users/{user_id}
    method: GET
    max_parallel_upstreams: 10
    aggregation:
      strategy: merge
      best_effort: true
      on_conflict:
        policy: prefer
        prefer_upstream: users
    plugins:
      - ...
    middlewares:
      - ...
    upstreams:
      - ...
```

```yaml
# Passthrough flow — no aggregation
flows:
  - path: /api/v1/events/{user_id}
    method: GET
    passthrough: true
    upstreams:
      - ...
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `path` | string | ✅ | — | URL path to match. Supports `{param}` path parameters |
| `method` | string | ✅ | — | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` |
| `passthrough` | bool | | `false` | Enable unbuffered streaming proxy mode. See [Passthrough](#passthrough) |
| `aggregation` | object | if not passthrough | — | Aggregation configuration. Not required when `passthrough: true` |
| `max_parallel_upstreams` | int | | `2 × NumCPU` | Maximum number of upstream calls dispatched concurrently for this flow |

**max_parallel_upstreams nuance:** this is a per-request semaphore, not a global connection pool. If a flow has 5 upstreams and `max_parallel_upstreams: 3`, the first 3 upstream calls are dispatched immediately; the remaining 2 wait until a slot is released. The gateway blocks until all upstreams return or the request context is cancelled.

### Aggregation
---

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `aggregation.strategy` | string | ✅ | — | `merge`, `array`, or `namespace` |
| `aggregation.best_effort` | bool | | `false` | Return partial results when some upstreams fail |
| `aggregation.on_conflict.policy` | string | if merge | `overwrite` | Key collision policy: `overwrite`, `first`, `error`, `prefer` |
| `aggregation.on_conflict.prefer_upstream` | string | if prefer | — | Name of the upstream whose values win on collision |

**best_effort nuance:** when `true` and some upstreams fail, the gateway returns HTTP `206 Partial Content` with both `data` (from successful upstreams) and `errors` (from failed ones). When `false`, a single upstream failure causes the entire request to fail with the appropriate error code — no partial data is returned.

### Aggregation Strategies
---

| Strategy | Description |
|---|---|
| `merge` | Merges JSON objects from all upstreams into a single flat object. All upstreams must return a JSON object at the root level |
| `array` | Wraps each upstream response as an element in a JSON array, preserving order |
| `namespace` | Places each upstream response under a key equal to the upstream `name`: `{"users": {...}, "stats": {...}}` |

**merge nuance:** `merge` requires all upstream responses to be JSON objects (`{}`). If any upstream returns a JSON array or primitive, it is treated as a malformed response. With `best_effort: true` such a response contributes an `UPSTREAM_MALFORMED` error but does not stop aggregation.

**namespace nuance:** if an upstream returns a `null` body (empty response with no content), its key is written as `null` rather than omitted. This makes missing upstream data explicit rather than invisible.

### Conflict Policies (merge only)
---

| Policy | Description |
|---|---|
| `overwrite` | The last upstream to set a key wins |
| `first` | The first upstream to set a key wins; later values are ignored |
| `error` | Any key collision immediately returns `409 Conflict` with no data |
| `prefer` | The value from `prefer_upstream` always wins on collision; order of other upstreams does not matter |

### Passthrough
---

When `passthrough: true`, the flow proxies the request directly to a single upstream without reading the body into memory or aggregating the response. The response body is streamed chunk-by-chunk to the client.

- Requires exactly one upstream — configuration validation rejects multiple upstreams
- `aggregation` config is ignored and not required
- Request-phase plugins still run before the upstream call
- Response-phase plugins do **not** run — the body is already streaming by the time they would execute
- Designed for Server-Sent Events (SSE), chunked transfer, and any long-lived HTTP connection

## Upstreams
---

```yaml
upstreams:
  - name: users
    hosts:
      - http://user-service-1.local
      - http://user-service-2.local
    path: /v1/users/{user_id}
    method: GET
    timeout: 3s
    forward_queries: ["*"]
    forward_headers: ["Authorization", "X-*"]
    forward_params: ["user_id"]
    transport:
      max_idle_conns: 100
      max_idle_conns_per_host: 50
      idle_conn_timeout: 90s
    policy:
      ...
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | ✅ | — | Upstream identifier used in logs, metrics, and `namespace` aggregation |
| `hosts` | string or list | ✅ | — | Target host(s). Multiple hosts activate load balancing |
| `path` | string | | — | Upstream path. `{param}` placeholders are expanded from flow path parameters |
| `method` | string | | original | HTTP method override. Falls back to the incoming request method |
| `timeout` | duration | | `3s` | Per-attempt timeout. Does not include total retry duration |
| `forward_queries` | list | | `[]` | Query parameters to forward. `"*"` forwards all |
| `forward_headers` | list | | `[]` | Headers to forward. Supports exact names, prefix wildcards (`"X-*"`), or `"*"` for all |
| `forward_params` | list | | `[]` | Flow path parameters to forward as query string keys. `"*"` forwards all |
| `transport.max_idle_conns` | int | | `100` | Maximum idle connections across all hosts |
| `transport.max_idle_conns_per_host` | int | | `50` | Maximum idle connections per host |
| `transport.idle_conn_timeout` | duration | | `90s` | How long an idle connection is kept in the pool before being closed |

**path nuance:** path parameters from the flow path (e.g. `{user_id}`) are substituted into the upstream path. Parameters used in `path` must be declared in the flow `path` — validation rejects undeclared parameters at startup.

**forward_params nuance:** `forward_params` appends path parameters as query string keys — it does not substitute them into the upstream path. Use `path: /v1/users/{user_id}` for path substitution, and `forward_params` when the upstream expects them as query args.

**timeout nuance:** `timeout` applies per attempt. With `retry.max_retries: 3` and `timeout: 2s`, the worst-case total time before the request fails is `3 × 2s = 6s` (plus backoff delay). Set the flow-level `server.timeout` high enough to accommodate the full retry budget.

**method nuance:** request body is only forwarded for `POST`, `PUT`, and `PATCH`. For other methods the body is discarded regardless of the incoming request.

## Upstream Policy
---

```yaml
policy:
  allowed_statuses: [200, 201, 204]
  require_body: false
  max_response_body_size: 1048576
  header_blacklist: ["X-Internal-Token"]
  retry:
    max_retries: 3
    retry_on_statuses: [500, 502, 503]
    backoff_delay: 200ms
  circuit_breaker:
    enabled: true
    max_failures: 5
    reset_timeout: 10s
  load_balancing:
    mode: round_robin
```

| Field | Type | Default | Description |
|---|---|---|---|
| `allowed_statuses` | list[int] | `[]` | Accepted HTTP status codes. Responses outside this list are treated as policy violations |
| `require_body` | bool | `false` | When `true`, an empty response body is treated as a policy violation |
| `max_response_body_size` | int (bytes) | `0` (unlimited) | Maximum upstream response body size. Responses exceeding this are rejected |
| `header_blacklist` | list[string] | `[]` | Response headers stripped before passing to the aggregator |
| `retry.max_retries` | int | `0` | Maximum number of retry attempts after the initial request fails |
| `retry.retry_on_statuses` | list[int] | `[]` | HTTP status codes that trigger a retry |
| `retry.backoff_delay` | duration | `0` | Fixed delay between retry attempts |
| `circuit_breaker.enabled` | bool | `false` | Enable circuit breaker for this upstream |
| `circuit_breaker.max_failures` | int | — | Consecutive failures before opening the circuit |
| `circuit_breaker.reset_timeout` | duration | — | Time in open state before transitioning to half-open |
| `load_balancing.mode` | string | — | `round_robin` or `least_conns`. Only active when multiple `hosts` are configured |

**allowed_status_codes nuance:** policy violations (wrong status code, empty body) are recorded _after_ the circuit breaker update. A misconfigured `allowed_status_codes` that rejects a healthy `200` response will not cause the circuit breaker to open — only true transport-level failures (timeout, connection error, 5xx) count toward the circuit breaker threshold.

**circuit_breaker nuance:** the breaker has three states. **Closed** — requests pass through normally. **Open** — all requests are immediately rejected without contacting the upstream; the `circuit_open` error kind is recorded. **Half-open** — one probe request is allowed through; success closes the breaker, failure returns it to open. State is exposed via the `kono_circuit_breaker_state` metric: `0`=closed, `1`=open, `2`=half-open.

**retry nuance:** retries only trigger when the response status matches `retry_on_statuses` _or_ when the upstream returns an error (connection failure, timeout). A successful response with an unexpected status code (caught by `allowed_status_codes`) does _not_ trigger a retry.

**load_balancer nuance:** `round_robin` cycles through hosts sequentially per request using an atomic counter. `least_conns` picks the host with the fewest active connections at the time of dispatch. With a single host, the `mode` setting is ignored.

## Plugins
---

```yaml
plugins:
  - name: snakeify
    source: builtin
  - name: myplugin
    source: file
    path: /etc/kono/plugins/
    config:
      key: value
```

| Field | Type | Required | Default | Description |
|---|---|---|---|---|
| `name` | string | ✅ | — | Plugin identifier |
| `source` | string | ✅ | — | `builtin` (included with Kono) or `file` (custom `.so`) |
| `path` | string | if file | — | Directory containing the `.so` file |
| `config` | map | | `{}` | Plugin-specific configuration passed at initialization |

Plugins run in two phases:

- **Request phase** — before upstream scatter. Can read and modify the request context and headers
- **Response phase** — after aggregation. Can modify response headers and body

Plugin execution order within each phase matches the order defined in configuration.

:::warning
Plugins are loaded as Go shared objects (`.so`). They must be compiled with the **exact same Go version** as the gateway binary. A version mismatch causes a panic at startup. Plugins within a single flow are deduplicated by name — a plugin listed twice is loaded only once.
:::

## Middlewares
---

```yaml
middlewares:
  - name: recoverer
    source: builtin
  - name: auth
    source: builtin
    config:
      alg: HS256
      issuer: https://auth.example.com
      audience: api
      hmac_secret: "base64secret"
  - name: logger
    source: builtin
```

Middlewares use the same `name`, `source`, `path`, and `config` fields as plugins. They wrap the entire flow handler as standard `http.Handler` middleware and execute in the order defined — the first middleware in the list is the outermost wrapper.

**Middleware vs plugin nuance:** middlewares wrap the HTTP handler and run for every request regardless of upstream results. Plugins are invoked explicitly at defined phases in the request lifecycle. Use middlewares for cross-cutting concerns (authentication, logging, recovery), and plugins for data transformation.

Built-in middlewares:

| Name | Description |
|---|---|
| `recoverer` | Recovers from panics and returns `500` instead of crashing |
| `logger` | Structured request logging with latency and status |
| `auth` | JWT validation (HS256, RS256 with static key or JWKS) |
| `compressor` | Response compression (gzip, deflate, br) |
| `cors` | Cross-Origin Resource Sharing headers |

---