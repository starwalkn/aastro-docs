---
id: configuration
title: Configuration
description: How Aastro's declarative YAML configuration file is structured and organized
slug: /configuration
---

# Configuration Reference

Aastro uses a single declarative YAML configuration file.

:::info
Only YAML is supported. JSON and TOML are not supported to reduce complexity and avoid inconsistencies.
:::

The configuration is organized into focused sections, each covered on its own page:

| Section | Covers |
|---|---|
| [Server & Admin](configuration/server-admin) | The data port, TLS/mTLS, certificate hot-reload, the admin port, health & readiness probes |
| [Observability](configuration/observability) | Enabling metrics and tracing instrumentation |
| [Routing & Flows](configuration/routing-flows) | Trusted proxies, rate limiting, flow matching, aggregation, streaming |
| [Upstreams & Policy](configuration/upstreams) | Upstream targets, upstream TLS, retries, circuit breaker, load balancing |
| [Plugins & Middlewares](configuration/plugins-middlewares) | Registering plugins and middlewares on a flow |

## Root

```yaml
schema: v1
debug: false
```

| Field    | Type   | Required | Default | Description                                                                                |
|----------|--------|----------|---------|--------------------------------------------------------------------------------------------|
| `schema` | string | true     | -       | Must be `v1`                                                                               |
| `debug`  | bool   | false    | `false` | Enables debug logging. Adds verbose output across router, scatter, and upstream components |
