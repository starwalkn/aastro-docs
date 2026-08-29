---
id: configuration-upstreams
title: Upstreams & Policy
description: Upstream targets, upstream TLS, retries, circuit breaker, and load balancing
slug: /configuration/upstreams
---

# Upstreams & Policy

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
|-------------------------------------|----------------|----------|----------|------------------------------------------------------------------------------------------|
| `name`                              | string         | true     | -        | Upstream identifier used in logs, metrics, and `namespace` aggregation                 |
| `hosts`                             | string or list | true     | -        | Target host(s). Multiple hosts activate load balancing                                 |
| `path`                              | string         | false    | -        | Upstream path. `{param}` placeholders are expanded from flow path parameters           |
| `method`                            | string         | false    | original | HTTP method override. Falls back to the incoming request method                        |
| `timeout`                           | duration       | false    | `3s`     | Per-attempt timeout. Does not include total retry duration                             |
| `forward_queries`                   | list           | false    | `[]`     | Query parameters to forward. `"*"` forwards all                                        |
| `forward_headers`                   | list           | false    | `[]`     | Headers to forward. Supports exact names, prefix wildcards (`"X-*"`), or `"*"` for all |
| `forward_params`                    | list           | false    | `[]`     | Flow path parameters to forward as query string keys. `"*"` forwards all               |
| `transport.max_idle_conns`          | int            | false    | `100`    | Maximum idle connections across all hosts                                              |
| `transport.max_idle_conns_per_host` | int            | false    | `50`     | Maximum idle connections per host                                                      |
| `transport.idle_conn_timeout`       | duration       | false    | `90s`    | How long an idle connection is kept in the pool before being closed                    |

**path parameters:** path parameters from the flow path (e.g. `{user_id}`) are substituted into the upstream path.
Parameters used in `path` must be declared in the flow `path` - validation rejects undeclared parameters at startup.

**forward_params:** `forward_params` appends path parameters as query string keys - it does not substitute them
into the upstream path. Use `path: /v1/users/{user_id}` for path substitution, and `forward_params` when the upstream
expects them as query args.

**timeout:** `timeout` applies per attempt. With `retry.max_retries: 3` and `timeout: 2s`, the worst-case total
time before the request fails is `3 × 2s = 6s` (plus backoff delay). Set the flow-level `server.timeout` high enough to
accommodate the full retry budget.

**method:** request body is only forwarded for `POST`, `PUT`, and `PATCH`. For other methods the body is
discarded regardless of the incoming request.

### Upstream TLS

When an upstream uses an HTTPS host, Aastro establishes a TLS connection using the system root CAs by default - no
configuration needed for public HTTPS endpoints. The `tls:` block is required only when you need to override that
default, typically because:

- The upstream uses a private or self-signed CA (set `ca_file`)
- The upstream requires mutual TLS (set `cert_file` and `key_file`)
- You need to pin the SNI hostname (set `server_name`) because the upstream is addressed by IP

| Field                      | Type   | Default | Description                                                                                    |
|----------------------------|--------|---------|--------------------------------------------------------------------------------------------------|
| `tls.enabled`              | bool   | `false` | Apply TLS overrides for this upstream. When omitted or `false`, system defaults are used       |
| `tls.cert_file`            | string | -       | Client certificate for mTLS. Must be set together with `key_file`                              |
| `tls.key_file`             | string | -       | Client private key for mTLS. Must be set together with `cert_file`                             |
| `tls.ca_file`              | string | -       | Custom CA bundle for verifying the upstream certificate. Falls back to system roots if omitted |
| `tls.server_name`          | string | -       | Override SNI / hostname verification. Useful when `hosts` contains IPs                         |
| `tls.insecure_skip_verify` | bool   | `false` | Disable certificate verification. **Do not use in production**                                 |
| `tls.min_version`          | string | `1.2`   | Minimum TLS version: `1.2` or `1.3`                                                            |

**mTLS nuance:** `cert_file` and `key_file` must either both be set (enabling mTLS) or both be empty (disabling it).
Setting only one is a validation error.

**server_name:** by default, Go derives SNI from the URL host. If your `hosts` are IP addresses (or DNS names
that don't match the certificate's SAN), set `server_name` to the value the upstream certificate is actually issued for.

**Hot-reload:** upstream client certificates and CA bundles are reloaded
automatically when the files change, exactly like the server certificate. See
[TLS Certificate Hot-Reload](server-admin#tls-certificate-hot-reload).

:::warning
`insecure_skip_verify` is a deliberate escape hatch for local development or initial migration, not a production
setting. Aastro logs a loud warning on startup for every upstream that uses it - treat any occurrence of that warning
in production logs as a finding to remediate.
:::

## Upstream Policy

```yaml
policy:
  require_body: false
  max_response_body_size: 1048576
  header_blacklist: [ "X-Internal-Token" ]
  follow_redirects: true
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
|---------------------------------|--------------|-----------------|--------------------------------------------------------------------------------------------|
| `require_body`                  | bool         | `false`         | When `true`, an empty response body is treated as a policy violation                     |
| `max_response_body_size`        | int (bytes)  | `0` (unlimited) | Maximum upstream response body size. Responses exceeding this are rejected               |
| `follow_redirects`              | bool         | `false`         | Option controlling whether the gateway follows upstream redirects                        |
| `header_blacklist`              | list[string] | `[]`            | Response headers stripped before passing to the aggregator or the client                 |
| `retry.max_retries`             | int          | `0`             | Maximum number of retry attempts after the initial request fails                         |
| `retry.retry_on_statuses`       | list[int]    | `[]`            | HTTP status codes that trigger a retry                                                   |
| `retry.backoff_delay`           | duration     | `0`             | Fixed delay between retry attempts                                                       |
| `circuit_breaker.enabled`       | bool         | `false`         | Enable circuit breaker for this upstream                                                 |
| `circuit_breaker.max_failures`  | int          | -               | Consecutive failures before opening the circuit                                          |
| `circuit_breaker.reset_timeout` | duration     | -               | Time in open state before transitioning to half-open                                     |
| `load_balancing.mode`           | string       | -               | `round_robin` or `least_conns`. Only active when multiple `hosts` are configured         |

**require_body:** policy violations (empty body when `require_body: true`) are recorded _after_ the circuit
breaker update - a misconfigured `require_body` that rejects a healthy response will not cause the circuit breaker to
open. Only true transport-level failures (timeout, connection error, 5xx) count toward the circuit breaker threshold.

**header_blacklist:** matching is case-insensitive - entries are canonicalized the same way `net/http` canonicalizes
response headers, so `header_blacklist: ["x-secret"]` blocks a header the upstream sent as `X-Secret` just as reliably
as an exact-cased entry would.

**circuit_breaker:** the breaker has three states. **Closed** - requests pass through normally. **Open** - all
requests are immediately rejected without contacting the upstream; the `circuit_open` error kind is recorded.
**Half-open** - one probe request is allowed through; success closes the breaker, failure returns it to open. State is
exposed via the `aastro_circuit_breaker_state` metric: `0`=closed, `1`=open, `2`=half-open.

**retry:** retries only trigger when the response status matches `retry_on_statuses` _or_ when the upstream
returns a transport-level error (connection failure, timeout) - those always retry regardless of
`retry_on_statuses`. Idempotency of the effective method (the upstream's own `method`, or the flow's method when
unset) is still checked first: a retry never fires for a non-idempotent method such as `POST`.

**load_balancer:** `round_robin` cycles through hosts sequentially per request using an atomic counter.
`least_conns` picks the host with the fewest active connections at the time of dispatch. With a single host, the `mode`
setting is ignored.
