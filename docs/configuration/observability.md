---
id: configuration-observability
title: Observability
description: Enabling metrics and tracing instrumentation
slug: /configuration/observability
---

# Observability

Metrics and tracing are configured under a single `observability` section. Both are independently enableable. This
page covers only the enabling/toggle configuration - for available metrics, Grafana panels, and error-kind labels see
[Metrics](../metrics); for span structure, attributes, and sampling see [Tracing](../tracing).

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
|--------------------------|----------|------------|---------|----------------------------------------------------|
| `metrics.enabled`        | bool     | false      | `false` | Enable metrics instrumentation                    |
| `metrics.exporter`       | string   | if enabled | -       | `prometheus` or `otlp`                            |
| `metrics.otlp.endpoint`  | string   | if otlp    | -       | OTLP HTTP endpoint (e.g. `otel-collector:4318`)   |
| `metrics.otlp.insecure`  | bool     | false      | `false` | Disable TLS for the OTLP connection               |
| `metrics.otlp.interval`  | duration | false      | `60s`   | Push interval for OTLP metrics                    |
| `tracing.enabled`        | bool     | false      | `false` | Enable trace export                               |
| `tracing.exporter`       | string   | if enabled | -       | `otlp` (only OTLP is supported)                   |
| `tracing.sampling_ratio` | float    | false      | `1.0`   | Fraction of traces to sample, between `0` and `1` |
| `tracing.otlp.endpoint`  | string   | if enabled | -       | OTLP HTTP endpoint for trace export               |
| `tracing.otlp.insecure`  | bool     | false      | `false` | Disable TLS for the OTLP connection               |
| `tracing.otlp.interval`  | duration | false      | `60s`   | Batch span export interval                        |

**Metrics:** with `exporter: prometheus`, the `/metrics` endpoint is served on the **admin port**, not the data
port. This means Prometheus does not need a client certificate even when the data port enforces mTLS. With
`exporter: otlp`, no endpoint is exposed - metrics are pushed on the configured interval. See the [Metrics](../metrics)
page for available metrics and Grafana setup.

**Trace propagation:** Aastro installs the standard W3C Trace Context propagator unconditionally - even when
`tracing.enabled: false`. Incoming `traceparent` headers are extracted and propagated to upstreams regardless of whether
Aastro itself exports spans. This preserves distributed tracing context across deployments that haven't enabled the OTLP
exporter yet.

:::tip
`sampling_ratio: 1.0` exports every trace, which is fine for low-traffic services and indispensable during debugging,
but expensive at scale. For high-RPS production deployments consider `0.01` to `0.1` (1-10% sampling). Span data
volume scales linearly with this value.
:::
