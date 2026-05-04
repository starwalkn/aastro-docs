---
id: metrics
title: Metrics
description: Metrics Overview
slug: /metrics
---

# Metrics

Kono uses [OpenTelemetry](https://opentelemetry.io/) for instrumentation. Metrics can be exported via two backends:

- **Prometheus** — OTel Prometheus exporter exposes a `/metrics` endpoint for scraping
- **OTLP** — pushes metrics to any OpenTelemetry-compatible backend (OTel Collector, Grafana, Datadog, etc.)

```yaml
gateway:
  server:
    metrics:
      enabled: true
      exporter: prometheus  # or: otlp
      otlp:
        endpoint: otel-collector:4318
        insecure: true
        interval: 10s
```

| Field                   | Type     | Default | Description                                    |
|-------------------------|----------|---------|------------------------------------------------|
| `metrics.enabled`       | bool     | `false` | Enable metrics instrumentation                 |
| `metrics.exporter`      | string   | —       | `prometheus` or `otlp`                         |
| `metrics.otlp.endpoint` | string   | —       | OTLP HTTP endpoint to push metrics to          |
| `metrics.otlp.insecure` | bool     | `false` | Disable TLS for the OTLP connection            |
| `metrics.otlp.interval` | duration | `60s`   | How often to push metrics to the OTLP endpoint |

:::info
When using `exporter: prometheus`, the `/metrics` endpoint is available on the same port as the gateway. When using
`exporter: otlp`, no HTTP endpoint is exposed — metrics are pushed on the configured interval.
:::

## Available Metrics
---

| Metric                           | Type      | Labels                      | Description                                                               |
|----------------------------------|-----------|-----------------------------|---------------------------------------------------------------------------|
| `kono_requests_total`            | Counter   | `route`, `method`, `status` | Total incoming requests that reached a flow, labeled by final HTTP status |
| `kono_requests_duration_seconds` | Histogram | `route`, `method`           | End-to-end request latency from gateway entry to response write           |
| `kono_requests_in_flight`        | Gauge     | —                           | Current number of requests being processed                                |
| `kono_failed_requests_total`     | Counter   | `reason`                    | Requests rejected before reaching a flow (see reasons below)              |
| `kono_upstream_requests_total`   | Counter   | `route`, `upstream`         | Total requests dispatched to each upstream                                |
| `kono_upstream_errors_total`     | Counter   | `route`, `upstream`, `kind` | Upstream errors broken down by error kind                                 |
| `kono_upstream_latency_seconds`  | Histogram | `route`, `upstream`         | Time from upstream request dispatch to response received                  |
| `kono_upstream_retries_total`    | Counter   | `route`, `upstream`         | Number of retry attempts per upstream                                     |
| `kono_circuit_breaker_state`     | Gauge     | `upstream`                  | Circuit breaker state: `0`=closed, `1`=open, `2`=half-open                |

## Histogram Buckets
---

Kono uses fixed bucket boundaries tuned for typical gateway latencies:

| Metric                           | Boundaries (seconds)                                    |
|----------------------------------|---------------------------------------------------------|
| `kono_requests_duration_seconds` | 0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5 |
| `kono_upstream_latency_seconds`  | 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5     |

## Upstream Error Kinds
---

The `kind` label on `kono_upstream_errors_total` reflects the internal error classification:

| Kind               | Description                                                                  |
|--------------------|------------------------------------------------------------------------------|
| `timeout`          | Upstream did not respond within the configured timeout                       |
| `connection`       | Failed to establish a connection to the upstream                             |
| `bad_status`       | Upstream returned HTTP 5xx                                                   |
| `read_error`       | Connection was closed while reading the response body                        |
| `body_too_large`   | Response body exceeded `max_response_body_size`                              |
| `canceled`         | Request was canceled by the client before a response was received            |
| `circuit_open`     | Request was rejected by an open circuit breaker — upstream was not contacted |
| `policy_violation` | Response violated upstream policy (`allowed_statuses`, `require_body`)       |

## Failure Reasons
---

`kono_failed_requests_total` tracks requests that never reach a flow:

| Reason              | Description                                         |
|---------------------|-----------------------------------------------------|
| `too_many_requests` | Rate limiter rejected the request                   |
| `no_matched_flow`   | No flow matched the request path or method          |
| `body_too_large`    | Request body exceeded the gateway-wide limit (5 MB) |

## Grafana
---

When using `exporter: otlp`, the recommended setup is:

```
kono → [OTLP HTTP] → OTel Collector → [remote_write] → Prometheus ← Grafana
```

The OTel Collector receives metrics from kono, transforms them, and pushes to Prometheus via `remote_write`. Prometheus
must be started with `--web.enable-remote-write-receiver`.

When using `exporter: prometheus`, Prometheus scrapes kono directly — no Collector needed.

### Recommended Panels
---

| Panel                | Query                                                                          |
|----------------------|--------------------------------------------------------------------------------|
| RPS                  | `rate(kono_requests_total[1m])`                                                |
| p99 latency          | `histogram_quantile(0.99, rate(kono_requests_duration_seconds_bucket[5m]))`    |
| Error rate           | `rate(kono_requests_total{status=~"5.."}[1m]) / rate(kono_requests_total[1m])` |
| Upstream error rate  | `rate(kono_upstream_errors_total[1m])`                                         |
| Circuit breaker open | `kono_circuit_breaker_state == 1`                                              |
| Retry pressure       | `rate(kono_upstream_retries_total[5m])`                                        |
| In-flight requests   | `kono_requests_in_flight`                                                      |
| Upstream p95 latency | `histogram_quantile(0.95, rate(kono_upstream_latency_seconds_bucket[5m]))`     |

:::info
Counter metrics like `kono_requests_total` are monotonically increasing — they never decrease. Always use `rate()` or
`increase()` in Grafana queries rather than the raw counter value.
:::