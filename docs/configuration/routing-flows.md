---
id: configuration-routing-flows
title: Routing & Flows
description: Trusted proxies, rate limiting, flow matching, aggregation, and streaming
slug: /configuration/routing-flows
---

# Routing & Flows

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
| `rate_limiter.config`  | map        | -       | Rate limiter configuration (`limit`, `window`)      |

**Trusted proxies:** when a request arrives from an IP that is _not_ in `trusted_proxies`, Aastro overwrites
`X-Forwarded-For`, `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Forwarded-Port`, and `Forwarded` with values derived from
the actual connection. When a request comes from a _trusted_ IP, Aastro appends to the existing chain rather than
overwriting - preserving the full proxy path. Leave this list empty if Aastro is your outermost edge.

**Rate limiter:** the limit is applied per client IP after trusted proxy resolution. The IP used for rate
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
# Streaming flow - no aggregation
flows:
  - path: /api/v1/events/{user_id}
    method: GET
    streaming: true
    upstreams:
      - ...
```

| Field         | Type   | Required        | Default | Description                                                                            |
|---------------|--------|-----------------|---------|-----------------------------------------------------------------------------------------|
| `path`        | string | true            | -       | URL path to match. Supports `{param}` path parameters                                   |
| `method`      | string | true            | -       | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS`                 |
| `streaming`   | bool   | false           | `false` | Enable unbuffered streaming proxy mode. See [Streaming](#streaming)                     |
| `aggregation` | object | if >1 upstream  | -       | Aggregation configuration. Only required for flows with more than one upstream - see below |

A flow with exactly one upstream never reads `aggregation`, streaming or not - it is dispatched by its own proxy path
instead of the aggregator. See [Single-Upstream Flows](../response-format#single-upstream-flows-proxy-mode) for how its
response differs from a multi-upstream flow's.

### Aggregation

| Field                                     | Type   | Required  | Default     | Description                                                   |
|-------------------------------------------|--------|-----------|-------------|-----------------------------------------------------------------|
| `aggregation.strategy`                    | string | true      | -           | `merge`, `array`, or `namespace`                              |
| `aggregation.best_effort`                 | bool   | false     | `false`     | Return partial results when some upstreams fail               |
| `aggregation.on_conflict.policy`          | string | if merge  | `overwrite` | Key collision policy: `overwrite`, `first`, `error`, `prefer` |
| `aggregation.on_conflict.prefer_upstream` | string | if prefer | -           | Name of the upstream whose values win on collision            |

When `best_effort` is `true` and some (but not all) upstreams fail, the gateway returns HTTP `206 Partial Content`
with the aggregated data from the successful upstreams as the body - the same shape a full `200` would have - and
the failed upstreams' error codes in the `X-Partial-Errors` response header, one value per failure. When `false`, a
single upstream failure causes the entire request to fail: an [RFC 9457 Problem Details](../response-format#problem-details)
document is returned instead, with no data at all. See [Response Format](../response-format#multi-upstream-aggregating-flows)
for the full behavior, including the response headers and the exact status code chosen on failure.

### Aggregation Strategies

| Strategy    | Description                                                                                                                 |
|-------------|-------------------------------------------------------------------------------------------------------------------------------|
| `merge`     | Merges JSON objects from all upstreams into a single flat object. All upstreams must return a JSON object at the root level |
| `array`     | Wraps each upstream response as an element in a JSON array, preserving order                                                |
| `namespace` | Places each upstream response under a key equal to the upstream `name`: `{"users": {...}, "stats": {...}}`                  |

**merge:** `merge` requires all upstream responses to be JSON objects (`{}`). If any upstream returns a JSON
array or primitive, it is treated as a malformed response. With `best_effort: true` such a response contributes an
`UPSTREAM_MALFORMED` error but does not stop aggregation.

**namespace:** if an upstream returns a `null` body (empty response with no content), its key is written as
`null` rather than omitted. This makes missing upstream data explicit rather than invisible.

### Conflict Policies (merge only)

| Policy      | Description                                                                                         |
|-------------|-------------------------------------------------------------------------------------------------------|
| `overwrite` | The last upstream to set a key wins                                                                 |
| `first`     | The first upstream to set a key wins; later values are ignored                                      |
| `error`     | Any key collision immediately returns `409 Conflict` with no data                                   |
| `prefer`    | The value from `prefer_upstream` always wins on collision; order of other upstreams does not matter |

### Streaming

When `streaming: true`, the flow proxies the request directly to a single upstream without reading the body into
memory or aggregating the response. The response body is streamed chunk-by-chunk to the client.

- Requires exactly one upstream - configuration validation rejects multiple upstreams
- `aggregation` config is ignored and not required
- Request-phase plugins still run before the upstream call
- Response-phase plugins do **not** run - the body is already streaming by the time they would execute
- Designed for Server-Sent Events (SSE), chunked transfer, and any long-lived HTTP connection

See [Streaming & SSE](../streaming) for the full guide. A non-streaming flow with exactly one upstream is *also* proxied
rather than aggregated, just buffered - see [Single-Upstream Flows](../response-format#single-upstream-flows-proxy-mode).
