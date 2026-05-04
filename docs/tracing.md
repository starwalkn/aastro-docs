---
id: tracing
title: Tracing
description: Distributed tracing with OpenTelemetry
slug: /tracing
---

# Tracing

Kono uses [OpenTelemetry](https://opentelemetry.io/) for distributed tracing. Spans are exported via OTLP/HTTP to any
OpenTelemetry-compatible backend — OTel Collector, Jaeger, Tempo, Datadog, Honeycomb.

W3C `traceparent` and `tracestate` headers are propagated automatically: incoming traces are continued, outgoing
requests to upstreams carry the trace context. The propagator is installed regardless of whether tracing is enabled, so
kono stays transparent for distributed trace context even with tracing turned off.

```yaml
gateway:
  server:
    tracing:
      enabled: true
      exporter: otlp
      sampling_ratio: 1.0
      otlp:
        endpoint: otel-collector:4318
        insecure: true
        interval: 5s
```

| Field                    | Type     | Default | Description                                                      |
|--------------------------|----------|---------|------------------------------------------------------------------|
| `tracing.enabled`        | bool     | `false` | Enable tracing instrumentation                                   |
| `tracing.exporter`       | string   | —       | Currently only `otlp` is supported                               |
| `tracing.sampling_ratio` | float    | `1.0`   | Fraction of new root traces to sample. `1.0` = all, `0.0` = none |
| `tracing.otlp.endpoint`  | string   | —       | OTLP HTTP endpoint to push spans to                              |
| `tracing.otlp.insecure`  | bool     | `false` | Disable TLS for the OTLP connection                              |
| `tracing.otlp.interval`  | duration | `5s`    | Batch timeout — maximum time before a non-full batch is flushed  |

:::info
`tracing.otlp.interval` is the batch timeout, not a push interval. Spans are also flushed automatically when the batch
reaches its size limit (512 spans). For low-traffic services, smaller values reduce visibility lag in the backend; for
high-traffic services, the size limit dominates and the timeout rarely fires.
:::

## Span Hierarchy
---

A typical request to a fan-out flow produces this tree:

```
kono.request                   [SpanKindServer]
├── kono.plugin request-phase plugin
├── kono.plugin ...
├── kono.scatter
│   ├── kono.upstream          [SpanKindClient]
│   ├── kono.upstream          [SpanKindClient]
│   └── kono.upstream          [SpanKindClient]
└── kono.plugin response-phase plugin
```

Passthrough flows skip `kono.scatter` and have a single `kono.upstream` span:

```
kono.request                   [SpanKindServer]
└── kono.upstream              [SpanKindClient, mode=passthrough]
```

| Span            | When opened                               | When closed                                  | Parent                                             |
|-----------------|-------------------------------------------|----------------------------------------------|----------------------------------------------------|
| `kono.request`  | Request enters `Router.ServeHTTP`         | Response written or rate-limit rejection     | Remote (from `traceparent`) or none                |
| `kono.plugin`   | Before each plugin's `Execute`            | After plugin returns                         | `kono.request`                                     |
| `kono.scatter`  | Beginning of scatter fan-out              | All upstream goroutines completed            | `kono.request`                                     |
| `kono.upstream` | Beginning of upstream call (per upstream) | Upstream call returns, including all retries | `kono.scatter` (or `kono.request` for passthrough) |

## Span Attributes
---

### `kono.request`

| Attribute                  | Description                                                                         |
|----------------------------|-------------------------------------------------------------------------------------|
| `http.method`              | Request method                                                                      |
| `http.route`               | Matched flow path with parameter placeholders, e.g. `/users/{id}`                   |
| `url.path`                 | Raw request path                                                                    |
| `http.status_code`         | Final response status                                                               |
| `kono.request.id`          | ULID identifying the request                                                        |
| `kono.request.fingerprint` | 16-char hex hash of method, route template, header names, and query parameter names |

### `kono.upstream`

| Attribute                  | Description                                                   |
|----------------------------|---------------------------------------------------------------|
| `http.method`              | Method used for the upstream call                             |
| `http.url`                 | Full upstream URL with parameters expanded                    |
| `http.status_code`         | HTTP status returned by the upstream                          |
| `server.address`           | Upstream host:port                                            |
| `kono.upstream.name`       | Configured upstream name                                      |
| `kono.upstream.host`       | Host selected by the load balancer                            |
| `kono.upstream.wait_us`    | Microseconds spent waiting for the parallelism semaphore      |
| `kono.upstream.error_kind` | Error classification on failure (see [Metrics](./metrics.md)) |
| `kono.upstream.mode`       | `passthrough` for passthrough flows; absent otherwise         |
| `kono.flow.path`           | Flow path the upstream was called from                        |

### `kono.scatter`

| Attribute                   | Description                        |
|-----------------------------|------------------------------------|
| `kono.upstream.count`       | Number of upstreams in the scatter |
| `kono.aggregation.strategy` | `merge`, `array`, or `namespace`   |

### `kono.plugin`

| Attribute          | Description             |
|--------------------|-------------------------|
| `kono.plugin.name` | Configured plugin name  |
| `kono.plugin.type` | `request` or `response` |

### Span Events

| Event                | When recorded                                                                                                                                                                |
|----------------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `semaphore.acquired` | Recorded on `kono.upstream` when the semaphore wait exceeded the configured threshold. Useful to visually distinguish wait time from actual upstream work in waterfall views |

## Resource Attributes
---

Every exported span carries resource attributes describing the kono process. The same resource is attached to metrics,
so traces and metrics from one process are correlated by `service.name` and `service.instance.id` in the backend.

| Attribute                                          | Source                                              |
|----------------------------------------------------|-----------------------------------------------------|
| `service.name`                                     | `gateway.service.name` (default: `kono`)            |
| `service.version`                                  | Build-time `-ldflags "-X main.version=…"` injection |
| `host.name`, `process.pid`, `process.command_args` | Auto-detected at startup                            |
| `telemetry.sdk.*`                                  | OTel SDK metadata                                   |

Additional attributes from the `OTEL_RESOURCE_ATTRIBUTES` environment variable are merged in.

## Sampling
---

Sampling determines which traces are recorded. Kono uses a `ParentBased` sampler that respects the incoming
`traceparent` flag — if an upstream service has already decided to sample a trace, kono honors that decision regardless
of `sampling_ratio`. Only **new root traces** (requests without an incoming `traceparent`) are subject to ratio-based
sampling.

| `sampling_ratio` | New root traces                                          |
|------------------|----------------------------------------------------------|
| `1.0`            | All sampled                                              |
| `0.1`            | 10% sampled, deterministically by trace ID               |
| `0.0`            | None sampled, but incoming sampled traces still recorded |

The decision for `TraceIDRatioBased(ratio)` is made by hashing the trace ID — the same trace ID always yields the same
decision across services, ensuring trace consistency.

:::info
For development and staging, use `sampling_ratio: 1.0` to capture all traces. For production at high RPS, lower values (
e.g. `0.05`) keep ingestion costs manageable while still providing statistical visibility.
:::

## Propagation
---

Kono propagates W3C trace context bidirectionally:

- **Inbound** — `traceparent` and `tracestate` headers from incoming requests are extracted into the request context.
  The resulting `kono.request` span becomes a child of the upstream's span.
- **Outbound** — when calling an upstream, kono injects the current trace context into the outgoing request's
  `traceparent` header. If the upstream is OTel-instrumented, its handler will see kono's span as the parent.

`baggage` headers are also propagated, allowing cross-service key-value context (e.g. `tenant_id`) to flow through the
gateway.

The propagator is installed unconditionally — even with `tracing.enabled: false`, kono still extracts and re-injects
`traceparent`. This makes the gateway transparent to distributed tracing even when its own spans are not recorded.

## Disabled Mode
---

When `tracing.enabled: false`:

- No spans are exported.
- No OTLP connection is opened.
- The W3C propagator is still installed — incoming `traceparent` headers are forwarded to upstreams unchanged.
- The internal `otel.Tracer` returns a no-op tracer; instrumented code paths run with minimal overhead.

## Setup with OpenTelemetry Collector
---

A typical setup with the OTel Collector and Jaeger:

```yaml
# docker-compose.yaml
services:
  kono:
    image: kono:latest
    volumes:
      - ./kono.yaml:/etc/kono/config.yaml
    ports: [ "7805:7805" ]
    depends_on: [ otel-collector ]

  otel-collector:
    image: otel/opentelemetry-collector-contrib:0.115.0
    command: [ "--config=/etc/otel-collector.yaml" ]
    volumes:
      - ./otel-collector.yaml:/etc/otel-collector.yaml
    depends_on: [ jaeger ]

  jaeger:
    image: jaegertracing/all-in-one:1.62
    environment:
      COLLECTOR_OTLP_ENABLED: "true"
    ports: [ "16686:16686" ]
```

```yaml
# otel-collector.yaml
receivers:
  otlp:
    protocols:
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    timeout: 1s

exporters:
  otlp/jaeger:
    endpoint: jaeger:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [ otlp ]
      processors: [ batch ]
      exporters: [ otlp/jaeger ]
```

```yaml
# kono.yaml
gateway:
  service:
    name: kono
  server:
    tracing:
      enabled: true
      exporter: otlp
      sampling_ratio: 1.0
      otlp:
        endpoint: otel-collector:4318
        insecure: true
        interval: 1s
```

After a request, find the trace in Jaeger UI at `http://localhost:16686` — service `kono`, operation `kono.request`.

## Reading Waterfalls
---

A few patterns to recognize when looking at a kono trace:

**Long `kono.upstream.wait_us`.** The upstream span starts at the same time as its siblings, but most of its duration is
the semaphore wait. Look for the `semaphore.acquired` event to see where actual work begins. To increase parallelism,
raise `max_parallel_upstreams` on the flow.

**`kono.upstream` span with error status and `kono.upstream.error_kind=connection`.** The upstream was unreachable.
Check the `kono_circuit_breaker_state` metric — if it is `1` (open), the breaker rejected subsequent requests without
contacting the upstream.

**Trace stops at `kono.request` with no upstream spans.** The request was rejected before reaching the scatter — usually
due to a payload-too-large error, or a plugin failure. Look at `http.status_code` on `kono.request`.

**Single trace spanning multiple services.** When upstreams are also OTel-instrumented, their spans appear as children
of `kono.upstream`, giving end-to-end visibility from client to backend.

---