---
id: configuration
title: Configuration
description: Configuration Reference
slug: /configuration
---

# Configuration Reference

Aastro uses a single declarative YAML configuration file.

:::info
Only YAML is supported. JSON and TOML are not supported to reduce complexity and avoid inconsistencies.
:::

The top-level structure splits responsibilities into focused sections:

- **`server`** — the data port that serves API traffic
- **`admin`** — a separate port for health probes, metrics, and pprof
- **`observability`** — metrics and tracing instrumentation
- **`routing`** — flows, upstreams, and rate limiting

## Root

```yaml
schema: v1
debug: false
```

| Field    | Type   | Required | Default | Description                                                                                |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------|
| `schema` | string | true     | —       | Must be `v1`                                                                               |
| `debug`  | bool   | false    | `false` | Enables debug logging. Adds verbose output across router, scatter, and upstream components |

## Server

The data port serves API traffic. Optionally protected by TLS or mTLS. The admin port and observability stack are
configured in separate top-level sections — see [Admin](#admin) and [Observability](#observability).

```yaml
gateway:
  server:
    port: 7805
    timeout: 20s
    header_timeout: 5s
    tls:
      enabled: true
      cert_file: /etc/aastro/server.crt
      key_file: /etc/aastro/server.key
      min_version: "1.2"
      client_auth: require
      client_ca_file: /etc/aastro/client-ca.crt
```

| Field                | Type     | Required      | Default | Description                                                                   |
|----------------------|----------|---------------|---------|-------------------------------------------------------------------------------|
| `port`               | int      | true          | —       | Data port for API traffic                                                     |
| `timeout`            | duration | false         | `5s`    | Read and write timeout for the data port                                      |
| `header_timeout`     | duration | false         | `5s`    | Maximum time to read request headers. Defends against Slowloris-style attacks |
| `tls.enabled`        | bool     | false         | `false` | Enable TLS on the data port                                                   |
| `tls.cert_file`      | string   | if enabled    | —       | Path to the server certificate (PEM)                                          |
| `tls.key_file`       | string   | if enabled    | —       | Path to the server private key (PEM)                                          |
| `tls.min_version`    | string   | false         | `1.2`   | Minimum TLS version: `1.2` or `1.3`                                           |
| `tls.client_auth`    | string   | false         | `none`  | Client certificate policy: `none`, `optional`, or `require`                   |
| `tls.client_ca_file` | string   | if not `none` | —       | CA bundle used to verify client certificates                                  |

**Timeout nuance:** `timeout` applies per request to reading the body and writing the response. For passthrough flows
with long-lived connections (SSE, chunked transfer), set a high value or rely on upstream-side timeouts. Admin-side
timeouts are configured independently — see [Admin](#admin).

**header_timeout nuance:** unlike `timeout`, this only covers reading request headers. It primarily protects against
Slowloris attacks, which open many connections and dribble headers slowly to exhaust the server. The admin port has its
own `header_timeout` field.

**TLS nuance:** `client_auth: require` rejects any TLS connection that does not present a valid client certificate
signed by `client_ca_file`. `optional` accepts connections without a certificate but validates any certificate that is
presented. `none` disables client authentication entirely. The same `client_ca_file` is used in both `require` and
`optional` modes.

**TLS version nuance:** TLS 1.0 and 1.1 are intentionally not selectable — both are deprecated by RFC 8996 and disabled
in modern clients.

## Admin

Aastro runs admin endpoints on a separate listener: health probes, metrics (when the Prometheus exporter is used), and
pprof. The admin port binds to `127.0.0.1` by default and is **never** TLS-terminated.

This separation is intentional: it lets you put strict client-certificate requirements on the data port without breaking
Prometheus scraping or Kubernetes probes, which would otherwise need to be issued client certificates as well.

```yaml
gateway:
  admin:
    port: 9090
    bind_addr: 127.0.0.1
    timeout: 5m
    header_timeout: 5s
    enable_pprof: true
```

| Field            | Type     | Required | Default     | Description                                                                                      |
|------------------|----------|----------|-------------|--------------------------------------------------------------------------------------------------|
| `port`           | int      | true     | —           | Admin port. Must differ from `server.port`                                                       |
| `bind_addr`      | string   | false    | `127.0.0.1` | Bind address for the admin port. Use `0.0.0.0` only when Prometheus runs outside the pod network |
| `timeout`        | duration | false    | `5m`        | Read and write timeout for the admin port. Generous default accommodates long pprof captures     |
| `header_timeout` | duration | false    | `5s`        | Maximum time to read request headers on the admin port                                           |
| `enable_pprof`   | bool     | false    | `false`     | Expose Go pprof endpoints under `/debug/pprof/`                                                  |

**Bind address nuance:** binding to `127.0.0.1` means admin endpoints are reachable only from within the container/pod.
kubelet probes, in-cluster Prometheus, and local pprof clients all work fine — they share the network namespace. If you
need to scrape from outside (e.g. external Prometheus), set `bind_addr: 0.0.0.0` deliberately and ensure your network
policy treats this port as internal.

**Timeout nuance:** the 5-minute default is sized for `pprof.Profile` and `pprof.Trace`, which hold the connection open
for the entire sampling duration (default 30s, but often longer for production diagnostics). Health probes and metrics
scrapes complete in milliseconds, so the upper bound rarely matters in practice. If you need longer captures, bump this
value.

**pprof nuance:** pprof endpoints live on the admin port at `/debug/pprof/`, `/debug/pprof/cmdline`,
`/debug/pprof/profile`, `/debug/pprof/symbol`, and `/debug/pprof/trace`. Because admin binds to localhost by default,
pprof is reachable only from inside the container — exactly what you want for production diagnostics.

## Health & Readiness

Aastro exposes two probe endpoints on the admin port:

| Endpoint        | Purpose         | Returns                                                                           |
|-----------------|-----------------|-----------------------------------------------------------------------------------|
| `GET /__health` | Liveness probe  | Always `200 OK` while the process can serve HTTP                                  |
| `GET /__ready`  | Readiness probe | `200 OK` when ready to receive traffic, `503 Service Unavailable` during shutdown |

Both endpoints return `application/json` and require no configuration.

**Liveness vs readiness nuance:** `/__health` is meant for *liveness* — its only job is to confirm the process is alive.
It does not check dependencies, because a failing dependency does not get better by restarting the gateway. `/__ready`
is meant for *readiness* — its job is to gate inbound traffic. During graceful shutdown, `/__ready` returns `503`
*before* the data port stops accepting connections, giving Kubernetes time to remove the pod from the service endpoints.
This prevents in-flight requests from being dropped during rolling deployments.

**Kubernetes example:**

```yaml
livenessProbe:
  httpGet:
    path: /__health
    port: 9090
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /__ready
    port: 9090
  initialDelaySeconds: 1
  periodSeconds: 2
```

## Observability

Metrics and tracing are configured under a single `observability` section. Both are independently enableable.

```yaml
gateway:
  observability:
    metrics:
      enabled: true
      exporter: prometheus
      otlp:
        endpoint: otel-collector:4318
        insecure: true
        interval: 10s
    tracing:
      enabled: true
      exporter: otlp
      sampling_ratio: 1.0
      otlp:
        endpoint: otel-collector:4318
        insecure: true
        interval: 10s
```

| Field                    | Type     | Required   | Default | Description                                       |
|--------------------------|----------|------------|---------|---------------------------------------------------|
| `metrics.enabled`        | bool     | false      | `false` | Enable metrics instrumentation                    |
| `metrics.exporter`       | string   | if enabled | —       | `prometheus` or `otlp`                            |
| `metrics.otlp.endpoint`  | string   | if otlp    | —       | OTLP HTTP endpoint (e.g. `otel-collector:4318`)   |
| `metrics.otlp.insecure`  | bool     | false      | `false` | Disable TLS for the OTLP connection               |
| `metrics.otlp.interval`  | duration | false      | `60s`   | Push interval for OTLP metrics                    |
| `tracing.enabled`        | bool     | false      | `false` | Enable trace export                               |
| `tracing.exporter`       | string   | if enabled | —       | `otlp` (only OTLP is supported)                   |
| `tracing.sampling_ratio` | float    | false      | `1.0`   | Fraction of traces to sample, between `0` and `1` |
| `tracing.otlp.endpoint`  | string   | if enabled | —       | OTLP HTTP endpoint for trace export               |
| `tracing.otlp.insecure`  | bool     | false      | `false` | Disable TLS for the OTLP connection               |
| `tracing.otlp.interval`  | duration | false      | `60s`   | Batch span export interval                        |

**Metrics nuance:** with `exporter: prometheus`, the `/metrics` endpoint is served on the **admin port**, not the data
port. This means Prometheus does not need a client certificate even when the data port enforces mTLS. With
`exporter: otlp`, no endpoint is exposed — metrics are pushed on the configured interval. See the [Metrics](metrics)
page for available metrics and Grafana setup.

**Sampling ratio nuance:** `sampling_ratio: 1.0` exports every trace, which is fine for low-traffic services and
indispensable during debugging, but expensive at scale. For high-RPS production deployments consider `0.01` to `0.1` (
1-10% sampling). Span data volume scales linearly with this value.

**Trace propagation nuance:** Aastro installs the standard W3C Trace Context propagator unconditionally — even when
`tracing.enabled: false`. Incoming `traceparent` headers are extracted and propagated to upstreams regardless of whether
Aastro itself exports spans. This preserves distributed tracing context across deployments that haven't enabled the OTLP
exporter yet.

## Routing

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

| Field                  | Type       | Default | Description                                         |
|------------------------|------------|---------|-----------------------------------------------------|
| `trusted_proxies`      | list[CIDR] | `[]`    | IP ranges whose `X-Forwarded-*` headers are trusted |
| `rate_limiter.enabled` | bool       | `false` | Enable per-IP rate limiting                         |
| `rate_limiter.config`  | map        | —       | Rate limiter configuration (`limit`, `window`)      |

**Trusted proxies nuance:** when a request arrives from an IP that is _not_ in `trusted_proxies`, Aastro overwrites
`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`, and `Forwarded` with values derived from
the actual connection. When a request comes from a _trusted_ IP, Aastro appends to the existing chain rather than
overwriting — preserving the full proxy path. Leave this list empty if Aastro is your outermost edge.

**Rate limiter nuance:** the limit is applied per client IP after trusted proxy resolution. The IP used for rate
limiting is the same one extracted from `X-Forwarded-For` / `X-Real-IP` / `RemoteAddr`.

## Flows

A flow defines how an incoming request is matched, processed, and dispatched to upstreams.

```yaml
flows:
  - path: /api/v1/users/{user_id}
    method: GET
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

| Field                | Type   | Required           | Default      | Description                                                             |
|----------------------|--------|--------------------|--------------|-------------------------------------------------------------------------|
| `path`               | string | true               | —            | URL path to match. Supports `{param}` path parameters                   |
| `method`             | string | true               | —            | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` |
| `passthrough`        | bool   | false              | `false`      | Enable unbuffered streaming proxy mode. See [Passthrough](#passthrough) |
| `aggregation`        | object | if not passthrough | —            | Aggregation configuration. Not required when `passthrough: true`        |

### Aggregation

| Field                                     | Type   | Required  | Default     | Description                                                   |
|-------------------------------------------|--------|-----------|-------------|---------------------------------------------------------------|
| `aggregation.strategy`                    | string | true      | —           | `merge`, `array`, or `namespace`                              |
| `aggregation.best_effort`                 | bool   | false     | `false`     | Return partial results when some upstreams fail               |
| `aggregation.on_conflict.policy`          | string | if merge  | `overwrite` | Key collision policy: `overwrite`, `first`, `error`, `prefer` |
| `aggregation.on_conflict.prefer_upstream` | string | if prefer | —           | Name of the upstream whose values win on collision            |

**best_effort nuance:** when `true` and some upstreams fail, the gateway returns HTTP `206 Partial Content` with both
`data` (from successful upstreams) and `errors` (from failed ones). When `false`, a single upstream failure causes the
entire request to fail with the appropriate error code — no partial data is returned.

### Aggregation Strategies

| Strategy    | Description                                                                                                                 |
|-------------|-----------------------------------------------------------------------------------------------------------------------------|
| `merge`     | Merges JSON objects from all upstreams into a single flat object. All upstreams must return a JSON object at the root level |
| `array`     | Wraps each upstream response as an element in a JSON array, preserving order                                                |
| `namespace` | Places each upstream response under a key equal to the upstream `name`: `{"users": {...}, "stats": {...}}`                  |

**merge nuance:** `merge` requires all upstream responses to be JSON objects (`{}`). If any upstream returns a JSON
array or primitive, it is treated as a malformed response. With `best_effort: true` such a response contributes an
`UPSTREAM_MALFORMED` error but does not stop aggregation.

**namespace nuance:** if an upstream returns a `null` body (empty response with no content), its key is written as
`null` rather than omitted. This makes missing upstream data explicit rather than invisible.

### Conflict Policies (merge only)

| Policy      | Description                                                                                         |
|-------------|-----------------------------------------------------------------------------------------------------|
| `overwrite` | The last upstream to set a key wins                                                                 |
| `first`     | The first upstream to set a key wins; later values are ignored                                      |
| `error`     | Any key collision immediately returns `409 Conflict` with no data                                   |
| `prefer`    | The value from `prefer_upstream` always wins on collision; order of other upstreams does not matter |

### Passthrough

When `passthrough: true`, the flow proxies the request directly to a single upstream without reading the body into
memory or aggregating the response. The response body is streamed chunk-by-chunk to the client.

- Requires exactly one upstream — configuration validation rejects multiple upstreams
- `aggregation` config is ignored and not required
- Request-phase plugins still run before the upstream call
- Response-phase plugins do **not** run — the body is already streaming by the time they would execute
- Designed for Server-Sent Events (SSE), chunked transfer, and any long-lived HTTP connection

## Upstreams

```yaml
upstreams:
  - name: users
    hosts:
      - https://user-service-1.internal
      - https://user-service-2.internal
    path: /v1/users/{user_id}
    method: GET
    timeout: 3s
    forward_queries: [ "*" ]
    forward_headers: [ "Authorization", "X-*" ]
    forward_params: [ "user_id" ]
    transport:
      max_idle_conns: 100
      max_idle_conns_per_host: 50
      idle_conn_timeout: 90s
    tls:
      enabled: true
      cert_file: /etc/aastro/clients/users.crt
      key_file: /etc/aastro/clients/users.key
      ca_file: /etc/aastro/internal-ca.crt
      server_name: user-service.internal
      min_version: "1.2"
    policy:
      ...
```

| Field                               | Type           | Required | Default  | Description                                                                            |
|-------------------------------------|----------------|----------|----------|----------------------------------------------------------------------------------------|
| `name`                              | string         | true     | —        | Upstream identifier used in logs, metrics, and `namespace` aggregation                 |
| `hosts`                             | string or list | true     | —        | Target host(s). Multiple hosts activate load balancing                                 |
| `path`                              | string         | false    | —        | Upstream path. `{param}` placeholders are expanded from flow path parameters           |
| `method`                            | string         | false    | original | HTTP method override. Falls back to the incoming request method                        |
| `timeout`                           | duration       | false    | `3s`     | Per-attempt timeout. Does not include total retry duration                             |
| `forward_queries`                   | list           | false    | `[]`     | Query parameters to forward. `"*"` forwards all                                        |
| `forward_headers`                   | list           | false    | `[]`     | Headers to forward. Supports exact names, prefix wildcards (`"X-*"`), or `"*"` for all |
| `forward_params`                    | list           | false    | `[]`     | Flow path parameters to forward as query string keys. `"*"` forwards all               |
| `transport.max_idle_conns`          | int            | false    | `100`    | Maximum idle connections across all hosts                                              |
| `transport.max_idle_conns_per_host` | int            | false    | `50`     | Maximum idle connections per host                                                      |
| `transport.idle_conn_timeout`       | duration       | false    | `90s`    | How long an idle connection is kept in the pool before being closed                    |

**path nuance:** path parameters from the flow path (e.g. `{user_id}`) are substituted into the upstream path.
Parameters used in `path` must be declared in the flow `path` — validation rejects undeclared parameters at startup.

**forward_params nuance:** `forward_params` appends path parameters as query string keys — it does not substitute them
into the upstream path. Use `path: /v1/users/{user_id}` for path substitution, and `forward_params` when the upstream
expects them as query args.

**timeout nuance:** `timeout` applies per attempt. With `retry.max_retries: 3` and `timeout: 2s`, the worst-case total
time before the request fails is `3 × 2s = 6s` (plus backoff delay). Set the flow-level `server.timeout` high enough to
accommodate the full retry budget.

**method nuance:** request body is only forwarded for `POST`, `PUT`, and `PATCH`. For other methods the body is
discarded regardless of the incoming request.

### Upstream TLS

When an upstream uses an HTTPS host, Aastro establishes a TLS connection using the system root CAs by default — no
configuration needed for public HTTPS endpoints. The `tls:` block is required only when you need to override that
default, typically because:

- The upstream uses a private or self-signed CA (set `ca_file`)
- The upstream requires mutual TLS (set `cert_file` and `key_file`)
- You need to pin the SNI hostname (set `server_name`) because the upstream is addressed by IP

| Field                      | Type   | Default | Description                                                                                    |
|----------------------------|--------|---------|------------------------------------------------------------------------------------------------|
| `tls.enabled`              | bool   | `false` | Apply TLS overrides for this upstream. When omitted or `false`, system defaults are used       |
| `tls.cert_file`            | string | —       | Client certificate for mTLS. Must be set together with `key_file`                              |
| `tls.key_file`             | string | —       | Client private key for mTLS. Must be set together with `cert_file`                             |
| `tls.ca_file`              | string | —       | Custom CA bundle for verifying the upstream certificate. Falls back to system roots if omitted |
| `tls.server_name`          | string | —       | Override SNI / hostname verification. Useful when `hosts` contains IPs                         |
| `tls.insecure_skip_verify` | bool   | `false` | Disable certificate verification. **Do not use in production**                                 |
| `tls.min_version`          | string | `1.2`   | Minimum TLS version: `1.2` or `1.3`                                                            |

**mTLS nuance:** `cert_file` and `key_file` must either both be set (enabling mTLS) or both be empty (disabling it).
Setting only one is a validation error.

**server_name nuance:** by default, Go derives SNI from the URL host. If your `hosts` are IP addresses (or DNS names
that don't match the certificate's SAN), set `server_name` to the value the upstream certificate is actually issued for.

**insecure_skip_verify nuance:** when enabled, Aastro logs a loud warning on startup for every upstream that uses this
flag. It is a deliberate escape hatch for local development or initial migration, not a production setting. Treat any
occurrence of this in production logs as a finding to remediate.

## Upstream Policy

```yaml
policy:
  allowed_statuses: [ 200, 201, 204 ]
  require_body: false
  max_response_body_size: 1048576
  header_blacklist: [ "X-Internal-Token" ]
  retry:
    max_retries: 3
    retry_on_statuses: [ 500, 502, 503 ]
    backoff_delay: 200ms
  circuit_breaker:
    enabled: true
    max_failures: 5
    reset_timeout: 10s
  load_balancing:
    mode: round_robin
```

| Field                           | Type         | Default         | Description                                                                              |
|---------------------------------|--------------|-----------------|------------------------------------------------------------------------------------------|
| `allowed_statuses`              | list[int]    | `[]`            | Accepted HTTP status codes. Responses outside this list are treated as policy violations |
| `require_body`                  | bool         | `false`         | When `true`, an empty response body is treated as a policy violation                     |
| `max_response_body_size`        | int (bytes)  | `0` (unlimited) | Maximum upstream response body size. Responses exceeding this are rejected               |
| `header_blacklist`              | list[string] | `[]`            | Response headers stripped before passing to the aggregator                               |
| `retry.max_retries`             | int          | `0`             | Maximum number of retry attempts after the initial request fails                         |
| `retry.retry_on_statuses`       | list[int]    | `[]`            | HTTP status codes that trigger a retry                                                   |
| `retry.backoff_delay`           | duration     | `0`             | Fixed delay between retry attempts                                                       |
| `circuit_breaker.enabled`       | bool         | `false`         | Enable circuit breaker for this upstream                                                 |
| `circuit_breaker.max_failures`  | int          | —               | Consecutive failures before opening the circuit                                          |
| `circuit_breaker.reset_timeout` | duration     | —               | Time in open state before transitioning to half-open                                     |
| `load_balancing.mode`           | string       | —               | `round_robin` or `least_conns`. Only active when multiple `hosts` are configured         |

**allowed_status_codes nuance:** policy violations (wrong status code, empty body) are recorded _after_ the circuit
breaker update. A misconfigured `allowed_status_codes` that rejects a healthy `200` response will not cause the circuit
breaker to open — only true transport-level failures (timeout, connection error, 5xx) count toward the circuit breaker
threshold.

**circuit_breaker nuance:** the breaker has three states. **Closed** — requests pass through normally. **Open** — all
requests are immediately rejected without contacting the upstream; the `circuit_open` error kind is recorded. *
*Half-open** — one probe request is allowed through; success closes the breaker, failure returns it to open. State is
exposed via the `aastro_circuit_breaker_state` metric: `0`=closed, `1`=open, `2`=half-open.

**retry nuance:** retries only trigger when the response status matches `retry_on_statuses` _or_ when the upstream
returns an error (connection failure, timeout). A successful response with an unexpected status code (caught by
`allowed_status_codes`) does _not_ trigger a retry.

**load_balancer nuance:** `round_robin` cycles through hosts sequentially per request using an atomic counter.
`least_conns` picks the host with the fewest active connections at the time of dispatch. With a single host, the `mode`
setting is ignored.

## Plugins

```yaml
plugins:
  - name: snakeify
    source: builtin
  - name: myplugin
    source: file
    path: /etc/aastro/plugins/
    config:
      key: value
```

| Field    | Type   | Required | Default | Description                                               |
|----------|--------|----------|---------|-----------------------------------------------------------|
| `name`   | string | true     | —       | Plugin identifier                                         |
| `source` | string | true     | —       | `builtin` (included with Aastro) or `file` (custom `.so`) |
| `path`   | string | if file  | —       | Directory containing the `.so` file                       |
| `config` | map    | false    | `{}`    | Plugin-specific configuration passed at initialization    |

Plugins run in two phases:

- **Request phase** — before upstream scatter. Can read and modify the request context and headers
- **Response phase** — after aggregation. Can modify response headers and body

Plugin execution order within each phase matches the order defined in configuration.

:::warning
Plugins are loaded as Go shared objects (`.so`). They must be compiled with the **exact same Go version** as the gateway
binary. A version mismatch causes a panic at startup. Plugins within a single flow are deduplicated by name — a plugin
listed twice is loaded only once.
:::

## Middlewares

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

Middlewares use the same `name`, `source`, `path`, and `config` fields as plugins. They wrap the entire flow handler as
standard `http.Handler` middleware and execute in the order defined — the first middleware in the list is the outermost
wrapper.

**Middleware vs plugin nuance:** middlewares wrap the HTTP handler and run for every request regardless of upstream
results. Plugins are invoked explicitly at defined phases in the request lifecycle. Use middlewares for cross-cutting
concerns (authentication, logging, recovery), and plugins for data transformation.

Built-in middlewares:

| Name         | Description                                                |
|--------------|------------------------------------------------------------|
| `recoverer`  | Recovers from panics and returns `500` instead of crashing |
| `logger`     | Structured request logging with latency and status         |
| `auth`       | JWT validation (HS256, RS256 with static key or JWKS)      |
| `compressor` | Response compression (gzip, deflate, br)                   |
| `cors`       | Cross-Origin Resource Sharing headers                      |
