---
id: configuration-server-admin
title: Server & Admin
description: Data port, TLS, certificate hot-reload, admin port, and health probes
slug: /configuration/server-admin
---

# Server & Admin

## Server

The data port serves API traffic. Optionally protected by TLS or mTLS. The admin port and observability stack are
configured in separate top-level sections - see [Admin](#admin) and [Observability](observability).

```yaml
gateway:
  server:
    port: 7805
    timeout: 20s
    header_timeout: 5s
    tls:
      enabled: true
      cert_file: /etc/aastro/server.crt
      key_file: /etc/aastro/server.key
      min_version: "1.2"
      client_auth: require
      client_ca_file: /etc/aastro/client-ca.crt
```

| Field                | Type     | Required      | Default | Description                                                                   |
|----------------------|----------|---------------|---------|-------------------------------------------------------------------------------|
| `port`               | int      | true          | -       | Data port for API traffic                                                     |
| `timeout`            | duration | false         | `5s`    | Read and write timeout for the data port                                      |
| `header_timeout`     | duration | false         | `5s`    | Maximum time to read request headers. Defends against Slowloris-style attacks |
| `tls.enabled`        | bool     | false         | `false` | Enable TLS on the data port                                                   |
| `tls.cert_file`      | string   | if enabled    | -       | Path to the server certificate (PEM)                                          |
| `tls.key_file`       | string   | if enabled    | -       | Path to the server private key (PEM)                                          |
| `tls.min_version`    | string   | false         | `1.2`   | Minimum TLS version: `1.2` or `1.3`                                           |
| `tls.client_auth`    | string   | false         | `none`  | Client certificate policy: `none`, `optional`, or `require`                   |
| `tls.client_ca_file` | string   | if not `none` | -       | CA bundle used to verify client certificates                                  |

**Timeout:** `timeout` applies per request to reading the body and writing the response. For streaming flows
with long-lived connections (SSE, chunked transfer), set a high value or rely on upstream-side timeouts. Admin-side
timeouts are configured independently - see [Admin](#admin).

**header_timeout:** unlike `timeout`, this only covers reading request headers. It primarily protects against
Slowloris attacks, which open many connections and dribble headers slowly to exhaust the server. The admin port has its
own `header_timeout` field.

**TLS:** `client_auth: require` rejects any TLS connection that does not present a valid client certificate
signed by `client_ca_file`. `optional` accepts connections without a certificate but validates any certificate that is
presented. `none` disables client authentication entirely. The same `client_ca_file` is used in both `require` and
`optional` modes.

**TLS version:** TLS 1.0 and 1.1 are intentionally not selectable - both are deprecated by RFC 8996 and disabled
in modern clients.

## TLS Certificate Hot-Reload

Aastro reloads TLS certificates without restarting the process or dropping
connections. This applies to **both** the inbound data port (`server.tls`) and
every upstream that uses mTLS (`upstreams[].tls`). There is no flag to enable it
and no reload command to run - rotation is picked up automatically on the paths
already configured.

```yaml
gateway:
  server:
    tls:
      enabled: true
      cert_file: /etc/aastro/server.crt   # replace this file → reloaded automatically
      key_file: /etc/aastro/server.key
      client_ca_file: /etc/aastro/client-ca.crt
```

**How it works:** Aastro watches the *directories* containing your `cert_file`,
`key_file`, `ca_file`, and `client_ca_file` - not the individual files. When any
of them changes, the new material is read, validated, and atomically swapped into
memory. New TLS handshakes use the new certificate; connections already
established finish on the old one and pick up the new certificate when they next
reconnect.

Directory-level watching is deliberate: it handles both atomic file replacement on
a host (where tools write to a temporary file and rename it over the target) and
Kubernetes secret mounts (where the projected files are updated via a symlink swap
rather than an in-place write). Rotation through cert-manager, Vault Agent, or
SPIFFE/SPIRE is therefore hands-off.

**Validation before swap:** a rotation is applied only if the new certificate -
and CA bundle, if configured - parse successfully. If the material on disk is
malformed, the error is logged and the previously loaded certificate stays live: a
broken rotation cannot take the listener down. When a certificate and its CA are
rotated together, a failure in either leaves *both* the previous certificate and
the previous CA in place, so the listener is never left in a half-updated state.

:::tip
**Confirming a reload:** each successful reload emits an `info` log line:

`{"level":"info","msg":"tls certs reloaded","dir":"/etc/aastro/certs"}`

A failed reload emits `tls reload failed, keeping old cert` at `error` level.
Watch for the latter in production - it means the certificate on disk rotated but
Aastro rejected it, so the live certificate is now older than what your cert
manager believes is deployed.
:::

:::tip
Because Aastro watches the whole directory, unrelated writes in a certificate directory (an OpenSSL `.srl` serial
file, or a temporary file written next to the target) can trigger an extra reload. These are harmless - the reload
re-reads and re-validates the same material, which is a no-op - but if you want quiet logs, keep CA-management
artifacts and temporary files out of the directories that hold your live certificates. In Kubernetes this is
automatic: each secret mounts into its own directory.
:::

## Admin

Aastro runs admin endpoints on a separate listener: health probes, metrics (when the Prometheus exporter is used), and
pprof. The admin port binds to `127.0.0.1` by default and is **never** TLS-terminated.

This separation is intentional: it lets you put strict client-certificate requirements on the data port without breaking
Prometheus scraping or Kubernetes probes, which would otherwise need to be issued client certificates as well.

```yaml
gateway:
  admin:
    port: 9090
    bind_addr: 127.0.0.1
    timeout: 5m
    header_timeout: 5s
    enable_pprof: true
```

| Field            | Type     | Required | Default     | Description                                                                                      |
|------------------|----------|----------|-------------|--------------------------------------------------------------------------------------------------|
| `port`           | int      | true     | -           | Admin port. Must differ from `server.port`                                                       |
| `bind_addr`      | string   | false    | `127.0.0.1` | Bind address for the admin port. Use `0.0.0.0` only when Prometheus runs outside the pod network |
| `timeout`        | duration | false    | `5m`        | Read and write timeout for the admin port. Generous default accommodates long pprof captures     |
| `header_timeout` | duration | false    | `5s`        | Maximum time to read request headers on the admin port                                           |
| `enable_pprof`   | bool     | false    | `false`     | Expose Go pprof endpoints under `/debug/pprof/`                                                  |

**Bind address:** binding to `127.0.0.1` means admin endpoints are reachable only from within the container/pod.
kubelet probes, in-cluster Prometheus, and local pprof clients all work fine - they share the network namespace. If you
need to scrape from outside (e.g. external Prometheus), set `bind_addr: 0.0.0.0` deliberately and ensure your network
policy treats this port as internal.

**Timeout:** the 5-minute default is sized for `pprof.Profile` and `pprof.Trace`, which hold the connection open
for the entire sampling duration (default 30s, but often longer for production diagnostics). Health probes and metrics
scrapes complete in milliseconds, so the upper bound rarely matters in practice. If you need longer captures, bump this
value.

**pprof:** pprof endpoints live on the admin port at `/debug/pprof/`, `/debug/pprof/cmdline`,
`/debug/pprof/profile`, `/debug/pprof/symbol`, and `/debug/pprof/trace`. Because admin binds to localhost by default,
pprof is reachable only from inside the container - exactly what you want for production diagnostics.

## Health & Readiness

Aastro exposes two probe endpoints on the admin port:

| Endpoint        | Purpose         | Returns                                                                           |
|-----------------|-----------------|-----------------------------------------------------------------------------------|
| `GET /__health` | Liveness probe  | Always `200 OK` while the process can serve HTTP                                  |
| `GET /__ready`  | Readiness probe | `200 OK` when ready to receive traffic, `503 Service Unavailable` during shutdown |

Both endpoints return `application/json` and require no configuration.

`/__health` is meant for *liveness* - its only job is to confirm the process is alive.
It does not check dependencies, because a failing dependency does not get better by restarting the gateway. `/__ready`
is meant for *readiness* - its job is to gate inbound traffic. During graceful shutdown, `/__ready` returns `503`
*before* the data port stops accepting connections, giving Kubernetes time to remove the pod from the service endpoints.
This prevents in-flight requests from being dropped during rolling deployments.

**Kubernetes example:**

```yaml
livenessProbe:
  httpGet:
    path: /__health
    port: 9090
  initialDelaySeconds: 5
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /__ready
    port: 9090
  initialDelaySeconds: 1
  periodSeconds: 2
```
