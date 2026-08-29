---
id: streaming
title: Streaming & SSE
description: Streaming proxy mode for SSE and chunked transfer
slug: /streaming
---

# Streaming & SSE

Streaming mode proxies a request directly to a single upstream without buffering the body or aggregating the response. The upstream response is streamed chunk-by-chunk to the client as it arrives.

This is the correct mode for:

- **Server-Sent Events (SSE)** - long-lived connections where the server pushes events over time
- **Chunked transfer encoding** - large responses streamed without a known `Content-Length`
- **Any response where buffering is unacceptable** - AI streaming APIs, live data feeds, file downloads

A plain single-upstream flow already forwards the upstream's response verbatim on success - see
[Single-Upstream Flows](response-format#single-upstream-flows-proxy-mode). Streaming goes one step further: it never
buffers the body at all, so the response reaches the client incrementally instead of only after the full upstream
answer has arrived. Reach for streaming specifically when that incremental delivery matters, not just for an
unwrapped response.

## Configuration

```yaml
flows:
  - path: /api/events/{user_id}
    method: GET
    streaming: true
    upstreams:
      - name: stream
        hosts: http://stream-service.local
        path: /events/{user_id}
        forward_params: ["user_id"]
        forward_headers: ["Authorization", "Last-Event-ID"]
```

| Constraint | Details |
|---|---|
| Exactly one upstream | Streaming does not support fan-out. Configuration validation rejects flows with multiple upstreams |
| `aggregation` not required | The `aggregation` block is ignored and may be omitted when `streaming: true` |
| Request plugins run | Plugins with `PluginTypeRequest` execute normally before the upstream call |
| Response plugins do not run | The response body is already streaming by the time response plugins would execute |

## How It Works

The streaming pipeline differs from the standard flow in several ways:

**No body buffering.** The standard pipeline reads the entire request body into memory (`io.ReadAll`) before dispatching to upstreams. In streaming mode, the original request body is passed as a stream directly to the upstream - `ContentLength` and `TransferEncoding` are forwarded as-is.

**Chunked streaming.** The upstream response body is copied to the client in 16 KiB chunks. After each chunk is written, `Flush()` is called if the underlying `ResponseWriter` supports it. This ensures events reach the client immediately rather than accumulating in a buffer.

**Content-Length removed.** Even if the upstream sets `Content-Length`, it is stripped before writing the response headers. A streaming response has no known final size, and a `Content-Length` that contradicts the actual body length would confuse clients and intermediate proxies.

**Hop-by-hop headers stripped.** `Connection`, `Transfer-Encoding`, `Keep-Alive`, `TE`, `Upgrade`, and other hop-by-hop headers are removed from the upstream response before forwarding to the client. All other upstream headers - including `Content-Type`, `Cache-Control`, and `X-Accel-Buffering` - are forwarded verbatim.

**Double-write protection.** A `trackingWriter` wrapper tracks whether `WriteHeader` or `Write` have already been called. If the upstream errors _after_ partially writing the response, Aastro skips the fallback Problem Details response described below - headers are already sent and the connection state cannot be rolled back.

## SSE-Specific Considerations

For a proper SSE setup, the upstream should set these response headers:

```
Content-Type: text/event-stream
Cache-Control: no-cache
```

`Cache-Control: no-cache` signals to intermediate proxies (nginx, CDN layers) that they should not buffer the response. Without it, some proxies will accumulate the body before forwarding, breaking the streaming behaviour entirely.

If aastro runs behind nginx, the upstream should also set:

```
X-Accel-Buffering: no
```

This disables nginx's proxy buffer for the connection. Aastro forwards this header unchanged.

**Reconnection support.** When an `EventSource` connection is dropped, browsers automatically reconnect and include the `Last-Event-ID` header with the ID of the last received event. To support seamless resumption, forward this header to the upstream:

```yaml
forward_headers: ["Last-Event-ID"]
```

## Response Format

A streaming upstream's status code, headers, and body are forwarded to the client verbatim, chunk by chunk, with no
gateway wrapping of any kind - neither `X-Request-ID` nor `X-Request-Fingerprint` is added, unlike every other flow
shape (see [Response Headers](response-format#response-headers)).

If the upstream call fails *before anything has been written to the client* - connection refused, DNS failure, the
call erroring out immediately - Aastro falls back to a `502` [Problem Details](response-format#problem-details)
response (`UPSTREAM_UNAVAILABLE`). Once the first byte has reached the client, that fallback is no longer possible
(see Double-write protection above): the connection simply ends, and the client has to treat a truncated body as a
failure on its own.

## No Timeout

The standard upstream `timeout` field is not applied in streaming mode - the connection lives as long as the upstream keeps it open or the client disconnects. If the client disconnects, the request context is cancelled and `streamCopy` returns immediately, releasing all resources.

To protect against abandoned upstream connections, rely on the upstream service's own keep-alive and idle timeout settings.
