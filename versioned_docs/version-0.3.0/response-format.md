---
id: response-format
title: Response Format
description: Response Format Reference
slug: /response-format
---

# Response Format

Every response from Kono follows a consistent JSON envelope — whether the request succeeded, partially succeeded, or failed entirely.

```json
{
  "data": { ... },
  "errors": ["ERROR_CODE"],
  "meta": {
    "request_id": "01hwz3k...",
    "partial": false
  }
}
```

| Field | Type | Description |
|---|---|---|
| `data` | any | Aggregated upstream data. `null` when all upstreams failed |
| `errors` | list[string] | Error codes. Empty on full success |
| `meta.request_id` | string | ULID identifying this request. Matches the `X-Request-ID` response header |
| `meta.partial` | bool | `true` when `best_effort: true` and at least one upstream failed |

## HTTP Status Codes
---

The gateway selects the HTTP status code based on the aggregation outcome:

| Status | Condition |
|---|---|
| `200 OK` | All upstreams responded successfully |
| `206 Partial Content` | `best_effort: true` and at least one upstream failed — `data` contains partial results, `errors` lists what went wrong |
| `404 Not Found` | No flow matched the request path or method. Response is plain text, not JSON |
| `409 Conflict` | `on_conflict: error` policy triggered by a key collision during merge aggregation |
| `413 Request Entity Too Large` | Request body exceeded the gateway limit (5 MB) |
| `429 Too Many Requests` | Rate limiter rejected the request |
| `500 Internal Server Error` | Internal gateway error |
| `502 Bad Gateway` | One or more upstreams failed and `best_effort: false` |
| `503 Service Unavailable` | Client disconnected before a response was received (`ABORTED`) |

When multiple errors are present, the gateway picks the one with the highest priority to determine the status code. The full list of errors is always included in the response body.

:::info
Early errors — those that occur before a flow is reached (rate limit, payload too large) — return the JSON envelope without a `meta` field, since no `request_id` has been assigned yet.
:::

## Error Codes
---

| Code | HTTP Status | Description |
|---|---|---|
| `RATE_LIMIT_EXCEEDED` | 429 | Request rejected by the rate limiter |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeded the 5 MB gateway limit |
| `UPSTREAM_UNAVAILABLE` | 502 | Upstream timed out, refused connection, or circuit breaker is open |
| `UPSTREAM_ERROR` | 502 | Upstream returned HTTP 5xx |
| `UPSTREAM_MALFORMED` | 502 | Upstream returned a body that could not be parsed as JSON (merge strategy only) |
| `UPSTREAM_BODY_TOO_LARGE` | 502 | Upstream response body exceeded `max_response_body_size` |
| `VALUE_CONFLICT` | 409 | Key collision during merge aggregation with `on_conflict: error` |
| `ABORTED` | 503 | Request was cancelled by the client before completion |
| `INTERNAL` | 500 | Unexpected internal gateway error |

## X-Request-ID Header
---

Every response includes an `X-Request-ID` header. If the incoming request already carries an `X-Request-ID` header, the gateway reuses that value — enabling end-to-end request tracing across services. If not, a new lowercase ULID is generated.

```
X-Request-ID: 01hwz3kbpq3e8xt4n1v7gfm2rz
```

The same value is available in the response body under `meta.request_id`.

## Examples
---

**Full success — merge strategy:**

```
HTTP/1.1 200 OK
X-Request-ID: 01hwz3kbpq3e8xt4n1v7gfm2rz
Content-Type: application/json; charset=utf-8

{
  "data": {
    "id": "42",
    "name": "Alice",
    "posts": 142,
    "theme": "dark"
  },
  "errors": [],
  "meta": {
    "request_id": "01hwz3kbpq3e8xt4n1v7gfm2rz",
    "partial": false
  }
}
```

**Partial success — one upstream failed, `best_effort: true`:**

```
HTTP/1.1 206 Partial Content
X-Request-ID: 01hwz3kbpq3e8xt4n1v7gfm2rz
Content-Type: application/json; charset=utf-8

{
  "data": {
    "id": "42",
    "name": "Alice"
  },
  "errors": ["UPSTREAM_UNAVAILABLE"],
  "meta": {
    "request_id": "01hwz3kbpq3e8xt4n1v7gfm2rz",
    "partial": true
  }
}
```

**Full failure — upstream unavailable, `best_effort: false`:**

```
HTTP/1.1 502 Bad Gateway
X-Request-ID: 01hwz3kbpq3e8xt4n1v7gfm2rz
Content-Type: application/json; charset=utf-8

{
  "data": null,
  "errors": ["UPSTREAM_UNAVAILABLE"],
  "meta": {
    "request_id": "01hwz3kbpq3e8xt4n1v7gfm2rz",
    "partial": false
  }
}
```

**Rate limit exceeded — early error, no `meta`:**

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/json; charset=utf-8

{
  "data": null,
  "errors": ["RATE_LIMIT_EXCEEDED"]
}
```

:::info
Passthrough flows (`passthrough: true`) bypass the JSON envelope entirely. The upstream response body and headers are forwarded verbatim — no `data`/`errors`/`meta` wrapping is applied.
:::

---