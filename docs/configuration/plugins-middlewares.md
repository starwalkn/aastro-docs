---
id: configuration-plugins-middlewares
title: Plugins & Middlewares
description: Registering plugins and middlewares on a flow
slug: /configuration/plugins-middlewares
---

# Plugins & Middlewares

This page covers only the configuration syntax for attaching plugins and middlewares to a flow. To write a custom
plugin or middleware, see [Plugin & Middleware Development](../plugin-development); for what ships with Aastro out of
the box, see [Built-in Plugins & Middlewares](../builtins).

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
|----------|--------|----------|---------|-------------------------------------------------------------|
| `name`   | string | true     | -       | Plugin identifier                                         |
| `source` | string | true     | -       | `builtin` (included with Aastro) or `file` (custom `.so`) |
| `path`   | string | if file  | -       | Directory containing the `.so` file                       |
| `config` | map    | false    | `{}`    | Plugin-specific configuration passed at initialization    |

Plugins run in two phases:

- **Request phase** - before the upstream call. Can read and modify the request context and headers
- **Response phase** - after the response is built. Can modify response headers and body

Plugin execution order within each phase matches the order defined in configuration.

:::warning
Plugins are loaded as Go shared objects (`.so`). They must be compiled with the **exact same Go version** as the gateway
binary. A version mismatch causes a panic at startup. Plugins within a single flow are deduplicated by name - a plugin
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
standard `http.Handler` middleware and execute in the order defined - the first middleware in the list is the outermost
wrapper.

Middlewares wrap the HTTP handler and run for every request regardless of upstream results. Plugins are invoked
explicitly at defined phases in the request lifecycle. Use middlewares for cross-cutting concerns (authentication,
logging, recovery), and plugins for data transformation.

Built-in middlewares:

| Name         | Description                                                |
|--------------|--------------------------------------------------------------|
| `recoverer`  | Recovers from panics and returns `500` instead of crashing |
| `logger`     | Structured request logging with latency and status         |
| `auth`       | JWT validation (HS256, RS256 with static key or JWKS)      |
| `compressor` | Response compression (gzip, deflate, br)                   |
| `cors`       | Cross-Origin Resource Sharing headers                      |
