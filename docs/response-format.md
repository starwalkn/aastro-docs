---
id: response-format
title: Response Format
description: Response Format Reference
slug: /response-format
---

# Response Format

Aastro has no single gateway-authored envelope. What a client receives depends on the flow's shape and on whether the
gateway itself, or an upstream, produced the response:

| Flow shape | On success / partial success | On a gateway-side failure |
|---|---|---|
| **Single upstream** (proxy mode) | Forwarded **as-is** | [Problem Details](#problem-details) |
| **Multiple upstreams** (aggregating) | Aggregated data, no wrapper | [Problem Details](#problem-details) |
| **`streaming: true`** | Streamed **as-is** | Problem Details, only before the first byte - see [Streaming & SSE](streaming) |

A client only ever unwraps something gateway-shaped when there is no upstream data to report at all: every upstream
failed, or the request was rejected before reaching one (rate limit, payload too large, a plugin error, auth
rejection). That shape is an [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457) Problem Details document, not a
bespoke envelope.

For a single-upstream flow, "forwarded as-is" covers the upstream's status, headers, and body verbatim - including a
3xx or 4xx. For a multi-upstream flow, "aggregated data" is the `merge`/`array`/`namespace` result itself, with
nothing wrapping it. Both are detailed below.

## Multi-Upstream (Aggregating) Flows

A flow with more than one upstream fans out to all of them and combines the results per its `aggregation.strategy`
(`merge`, `array`, or `namespace` - see [Routing & Flows](configuration/routing-flows#aggregation)).

- **Full success** - every upstream succeeded - returns `200 OK` with the aggregated result as the body, exactly the
  `merge`/`array`/`namespace` output, nothing wrapping it.
- **Partial success** - `aggregation.best_effort: true` and at least one upstream failed, but at least one
  succeeded - returns `206 Partial Content`. The body has the **same shape** as the 200 case, built only from the
  upstreams that succeeded. Which upstreams failed, and why, moves to the `X-Partial-Errors` response header (one
  value per failure) instead of a body field - a client never has to branch on response shape depending on whether
  every upstream happened to succeed.
- **Full failure** - `best_effort: false` and any upstream failed, or `best_effort: true` and *every* upstream
  failed - returns a [Problem Details](#problem-details) document. There is no data to return. The status is usually
  `502`, with one exception: if every *failed* upstream answered with its own 4xx and they all agree on the exact
  status code, that status is used instead of `502` (successful upstreams, if any, don't factor into that check).
  This mirrors the status-propagation behavior single-upstream flows always get (below), just requiring unanimous
  agreement across upstreams first.

```
HTTP/1.1 206 Partial Content
X-Request-ID: 018f4a2b-7c3d-7e4f-a5b6-c7d8e9f0a1b2
X-Request-Fingerprint: 3f9a1c2b7e4d5061
X-Partial-Errors: UPSTREAM_UNAVAILABLE
Content-Type: application/json; charset=utf-8

{
  "id": "42",
  "name": "Alice"
}
```

A single upstream's own 3xx or 4xx answer is **not** forwarded to the client for a multi-upstream flow the way it is
for a single-upstream one (below) - it is classified as an aggregation failure (`UPSTREAM_REDIRECT` /
`UPSTREAM_CLIENT_ERROR`) like any other upstream error, and contributes to a partial or full failure accordingly.

## Single-Upstream Flows (Proxy Mode)

A flow with exactly one upstream never reaches the aggregator - it has nothing to aggregate. Instead it is dispatched
through its own proxy path, and the response it returns depends on what the upstream did:

- **The upstream answered** - with a success, a redirect, or a client error (2xx, 3xx, or 4xx) - its status, headers,
  and body are forwarded to the client **exactly as received**. This includes bodies that aren't valid JSON: a 4xx
  HTML error page from the upstream reaches the client as HTML, not translated into a gateway error. `X-Request-ID`
  and `X-Request-Fingerprint` are still added to the response headers, and `Content-Type` still defaults to
  `application/json; charset=utf-8` if the upstream didn't set one - but there is no gateway wrapping of any kind.
- **The gateway itself failed the request** - the upstream was unreachable, timed out, returned a 5xx, or the
  response failed a gateway policy check (e.g. `require_body`) - a [Problem Details](#problem-details) document is
  returned instead, using the [status codes](#http-status-codes) and [error codes](#error-codes) below. There is no
  upstream body worth forwarding in this case.
- `413 Request Entity Too Large` is still returned before the upstream is ever called, same as for any other flow.

This is a deliberate difference from a multi-upstream flow, where every outcome - including a single failed
upstream - is reported through aggregation. A single-upstream flow acts as a transparent proxy for anything the
upstream actually answers with; only a genuine gateway-side failure is translated into a gateway error.

A `streaming: true` flow (necessarily single-upstream) goes further: it never buffers the body, so it can't fall back
to Problem Details once bytes have started reaching the client. See [Streaming & SSE](streaming) for that narrower
case.

## Problem Details

Any response with no upstream data to report - a full aggregation failure, a single-upstream gateway-side failure, or
an early rejection before a flow's upstream was ever called - is an RFC 9457 Problem Details document, served as
`application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Upstream unavailable",
  "status": 502,
  "errors": ["UPSTREAM_UNAVAILABLE"]
}
```

| Field | Type | Description |
|---|---|---|
| `type` | string | Always the literal `"about:blank"` - see below |
| `title` | string | Human-readable summary of the highest-priority entry in `errors`. Wording may change over time; don't match against it |
| `status` | integer | HTTP status code, repeated here per RFC 9457 |
| `detail` | string | Occurrence-specific explanation, when there is one. Omitted otherwise |
| `errors` | list[string] | Every distinct [error code](#error-codes) behind this response - always at least one. More than one only for a multi-upstream failure where several upstreams failed differently |

`type` is always `"about:blank"` - RFC 9457's own placeholder for "no further-specific type" - never a real,
dereferencable URI. A real one, even a stable non-existent one under the gateway's own docs domain, would name the
software fronting the request to anyone who receives an error: that's reconnaissance, since it tells a caller they're
behind an aggregating gateway and invites probing for what that implies about the backend topology. `errors` is the
machine-readable discriminator instead - a closed, generic enum that says nothing about what's behind the gateway.

## HTTP Status Codes

| Status | Condition |
|---|---|
| `200 OK` | Single-upstream flow: the upstream answered 2xx. Multi-upstream flow: every upstream succeeded |
| `206 Partial Content` | Multi-upstream flow with `best_effort: true`: at least one upstream failed but at least one succeeded |
| `3xx` | Single-upstream flow only: the upstream's own redirect status, forwarded verbatim |
| `4xx` | Single-upstream flow: the upstream's own client-error status, forwarded verbatim. Multi-upstream flow: only on a full failure where every failed upstream agreed on the same 4xx - see [above](#multi-upstream-aggregating-flows) |
| `401 Unauthorized` | Auth middleware rejected the request before it reached a flow |
| `404 Not Found` | No flow matched the request path or method. Response is plain text, not a Problem Details document |
| `409 Conflict` | `on_conflict: error` policy triggered by a key collision during merge aggregation |
| `413 Request Entity Too Large` | Request body exceeded the gateway limit (5 MB) |
| `429 Too Many Requests` | Rate limiter rejected the request |
| `500 Internal Server Error` | Internal gateway error |
| `502 Bad Gateway` | The default gateway-side failure status: an upstream was unreachable, timed out, or returned a 5xx, or (multi-upstream) failed upstreams disagreed on status |
| `503 Service Unavailable` | Client disconnected before a response was received (`ABORTED`) |

When multiple errors are present (a multi-upstream failure with several distinct causes), the gateway picks the one
with the highest priority to determine the status code and `title`. The full set is always in `errors`.

## Error Codes

| Code | HTTP Status | Description |
|---|---|---|
| `RATE_LIMIT_EXCEEDED` | 429 | Request rejected by the rate limiter |
| `UNAUTHORIZED` | 401 | Rejected by the `auth` middleware - missing, malformed, or invalid credentials |
| `PAYLOAD_TOO_LARGE` | 413 | Request body exceeded the 5 MB gateway limit |
| `UPSTREAM_UNAVAILABLE` | 502 | Upstream timed out, refused connection, or circuit breaker is open |
| `UPSTREAM_ERROR` | 502 | Upstream returned HTTP 5xx |
| `UPSTREAM_CLIENT_ERROR` | 502 | A multi-upstream flow: an upstream returned HTTP 4xx. (For a single-upstream flow this status is forwarded to the client directly instead - see [Single-Upstream Flows](#single-upstream-flows-proxy-mode)) |
| `UPSTREAM_REDIRECT` | 502 | A multi-upstream flow: an upstream returned HTTP 3xx. (Same single-upstream exception as above) |
| `UPSTREAM_MALFORMED` | 502 | Upstream returned a body that could not be parsed as JSON (`merge` strategy), or failed a gateway policy check such as `require_body` |
| `UPSTREAM_BODY_TOO_LARGE` | 502 | Upstream response body exceeded `max_response_body_size` |
| `VALUE_CONFLICT` | 409 | Key collision during merge aggregation with `on_conflict: error` |
| `ABORTED` | 503 | Request was cancelled by the client before completion |
| `INTERNAL` | 500 | Unexpected internal gateway error |

## Response Headers

| Header | Present when | Description |
|---|---|---|
| `X-Request-ID` | Reached an upstream | Reuses the incoming `X-Request-ID` request header if the client sent one; otherwise a new lowercase UUIDv7 is generated |
| `X-Request-Fingerprint` | Reached an upstream | 16-char hex hash of method, route template, header names, and query parameter names |
| `X-Partial-Errors` | Multi-upstream `206` | One value per failed upstream (an [error code](#error-codes)). Repeated when more than one upstream failed |

```
X-Request-ID: 018f4a2b-7c3d-7e4f-a5b6-c7d8e9f0a1b2
```

Neither `X-Request-ID` nor `X-Request-Fingerprint` is added for a request rejected before the upstream call: rate
limiting, `auth` (or any other) middleware rejection, request-body-too-large, and request-phase plugin failures all
write a bare Problem Details response with neither header. They're also absent from `streaming: true` responses (see
[Streaming & SSE](streaming)).

## Examples

**Multi-upstream, full success - `merge` strategy:**

```
HTTP/1.1 200 OK
X-Request-ID: 018f4a2b-7c3d-7e4f-a5b6-c7d8e9f0a1b2
X-Request-Fingerprint: 3f9a1c2b7e4d5061
Content-Type: application/json; charset=utf-8

{
  "id": "42",
  "name": "Alice",
  "posts": 142,
  "theme": "dark"
}
```

**Multi-upstream, partial success - one upstream failed, `best_effort: true`:**

```
HTTP/1.1 206 Partial Content
X-Request-ID: 018f4a2b-7c3d-7e4f-a5b6-c7d8e9f0a1b2
X-Request-Fingerprint: 3f9a1c2b7e4d5061
X-Partial-Errors: UPSTREAM_UNAVAILABLE
Content-Type: application/json; charset=utf-8

{
  "id": "42",
  "name": "Alice"
}
```

**Multi-upstream, full failure - upstream unavailable, `best_effort: false`:**

```
HTTP/1.1 502 Bad Gateway
X-Request-ID: 018f4a2b-7c3d-7e4f-a5b6-c7d8e9f0a1b2
X-Request-Fingerprint: 3f9a1c2b7e4d5061
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Upstream unavailable",
  "status": 502,
  "errors": ["UPSTREAM_UNAVAILABLE"]
}
```

**Single-upstream flow - upstream answered with a 404 (forwarded as-is, not translated):**

```
HTTP/1.1 404 Not Found
X-Request-ID: 018f4a2b-7c3d-7e4f-a5b6-c7d8e9f0a1b2
X-Request-Fingerprint: 3f9a1c2b7e4d5061
Content-Type: application/json

{
  "error": "user not found"
}
```

**Single-upstream flow - upstream unreachable (gateway-side failure, Problem Details):**

```
HTTP/1.1 502 Bad Gateway
X-Request-ID: 018f4a2b-7c3d-7e4f-a5b6-c7d8e9f0a1b2
X-Request-Fingerprint: 3f9a1c2b7e4d5061
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Upstream unavailable",
  "status": 502,
  "errors": ["UPSTREAM_UNAVAILABLE"]
}
```

**Rate limit exceeded - early error, rejected before a flow was reached:**

```
HTTP/1.1 429 Too Many Requests
Content-Type: application/problem+json

{
  "type": "about:blank",
  "title": "Rate limit exceeded",
  "status": 429,
  "errors": ["RATE_LIMIT_EXCEEDED"]
}
```

This and other early rejections - `UNAUTHORIZED`, `PAYLOAD_TOO_LARGE`, `INTERNAL` from a request-phase plugin - carry
no `X-Request-ID` or `X-Request-Fingerprint`: those headers are only ever added once a flow actually dispatches to an
upstream (see [Response Headers](#response-headers) above).
