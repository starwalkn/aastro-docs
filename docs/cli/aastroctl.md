---
id: cli-aastroctl
title: aastroctl
description: Reference for the aastroctl companion tool
slug: /cli/aastroctl
---

# aastroctl

The companion tool. Unlike `aastro`, it uses a subcommand-based CLI similar to `kubectl` or `git`, because it bundles
unrelated operations (plugin scaffolding today; daemon administration in future releases).

## Usage

```
aastroctl <command> [flags]
```

## Commands

| Command          | Description                                               |
|------------------|---------------------------------------------------------------|
| `plugin init`    | Generate a new plugin or middleware skeleton              |
| `openapi export` | Generate an OpenAPI document from a gateway configuration |
| `help`           | Show help for any command (also available via `--help`)   |

## Global Flags

| Long        | Description                               |
|-------------|----------------------------------------------|
| `--version` | Print version with build details and exit |
| `--help`    | Print help and exit                       |

## `aastroctl plugin init`

Generates a starter `.go` file for a new plugin or middleware. The generated code compiles as-is - you can run
`go build -buildmode=plugin` on it immediately and load the resulting `.so` into Aastro.

```
aastroctl plugin init --type=<type> --name=<name> [flags]
```

**Flags:**

| Flag            | Required | Description                                                            |
|-----------------|----------|----------------------------------------------------------------------------|
| `--type`        | yes      | Plugin type: `request`, `response`, or `middleware`                    |
| `--name`        | yes      | Plugin name (used in `Info().Name` and as the default output filename) |
| `--description` | no       | Plugin description for `Info().Description`                            |
| `--author`      | no       | Author name for `Info().Author`                                        |
| `--out`         | no       | Output file path (default: `<name>.go` in the current directory)       |

**Examples:**

```bash
# Generate a request-phase plugin
aastroctl plugin init --type=request --name=add-header

# Generate a middleware in a specific location
aastroctl plugin init --type=middleware --name=ratelimit --out=./plugins/ratelimit/main.go

# With full metadata
aastroctl plugin init \
  --type=response \
  --name=wrap-payload \
  --description="Wraps response bodies in a JSON envelope" \
  --author="ops-team"
```

The generated file is formatted with `gofmt` before writing. If the output path already exists, the command refuses to
overwrite it.

See [Plugin & Middleware Development](../plugin-development) for the full guide on writing plugins.

## `aastroctl openapi export`

Generates an OpenAPI 3.1 (or 3.0) document from a gateway configuration. The configuration is loaded through the same
pipeline as the gateway itself - defaults applied, validation performed - so the resulting document describes what the
gateway will actually execute, and a broken configuration fails here before it reaches a deploy.

```bash
aastroctl openapi export [flags]
```

**Flags:**

| Flag            | Short | Default       | Description                                                       |
|-----------------|-------|---------------|-------------------------------------------------------------------|
| `--config`      | `-c`  | `aastro.yaml` | Path to the gateway configuration                                 |
| `--out`         | `-o`  | `-`           | Output file (`-` for stdout)                                      |
| `--format`      |       | by extension  | `yaml` or `json`; inferred from the output extension, else `yaml` |
| `--oas-version` |       | `3.1`         | OpenAPI version: `3.1` or `3.0`                                   |
| `--server`      |       | no            | Server URL for `servers[]`; repeat the flag for multiple entries  |
| `--title`       |       | service name  | `info.title`                                                      |
| `--api-version` |       | `0.0.0`       | `info.version`                                                    |
| `--extensions`  |       | off           | Embed `x-aastro` snapshots of each flow for future config import  |

**Examples:**

```bash
# Print the document to stdout
aastroctl openapi export -c config.yaml

# Write YAML and JSON files (format inferred from the extension)
aastroctl openapi export -c config.yaml -o openapi.yaml
aastroctl openapi export -c config.yaml -o openapi.json

# Target OpenAPI 3.0 for older client generators
aastroctl openapi export -c config.yaml --oas-version 3.0 -o openapi.yaml

# Full metadata for a published spec
aastroctl openapi export -c config.yaml \
  --title "Customer API" \
  --api-version 1.4.0 \
  --server https://api.example.com \
  --extensions \
  -o openapi.yaml
```

## `aastroctl openapi import`

Generates a gateway configuration from an OpenAPI 3.x document - the inverse of `openapi export`. Documents produced by
`openapi export --extensions` are reconstructed losslessly; foreign documents are scaffolded into a working starting
point. The generated configuration is validated before it is written, so `import` never emits a config the gateway
would reject.

```bash
aastroctl openapi import -i <document> [flags]
```

**Flags:**

| Flag             | Short | Default        | Description                                                          |
|------------------|-------|----------------|--------------------------------------------------------------------------|
| `--in`           | `-i`  | required       | OpenAPI document to import (`yaml` or `json`)                        |
| `--out`          | `-o`  | `-`            | Output configuration file (`-` for stdout)                          |
| `--default-host` |       | `servers[0]`   | Upstream host for scaffolded flows; falls back to a placeholder      |
| `--mode`         |       | `proxy`        | Flow shape for scaffolded operations: `proxy` or `streaming`        |
| `--server-port`  |       | `7805`         | Gateway data port written into the generated config                 |
| `--admin-port`   |       | `9090`         | Gateway admin port written into the generated config                |
| `--force`        |       | off            | Overwrite the output file if it already exists                      |

**Examples:**

```bash
# Print the generated configuration to stdout
aastroctl openapi import -i openapi.yaml

# Write to a file (refuses to overwrite unless --force)
aastroctl openapi import -i openapi.yaml -o aastro.yaml

# Import a JSON document (format detected automatically)
aastroctl openapi import -i openapi.json -o aastro.yaml

# Scaffold a foreign spec, pointing every flow at one host
aastroctl openapi import -i petstore.yaml --default-host https://backend.internal -o aastro.yaml

# Scaffold streaming-style flows as streaming
aastroctl openapi import -i events-api.yaml --mode streaming -o aastro.yaml
```

### Lossless Import vs. Scaffolding

The command has two modes of operation, chosen automatically per operation:

- **Lossless reconstruction** - operations carrying an `x-aastro` extension (written by `openapi export --extensions`)
  are restored in full: flows, aggregation, upstreams, per-upstream `policy`, and `transport`. Fields left at their
  gateway defaults are omitted from the result, so the output is minimal and reads like a hand-written config rather
  than an exhaustive dump.
- **Scaffolding** - operations without the extension (any third-party document) become single-upstream flows. Path
  parameters, and the query and header parameters declared on the operation, are turned into `forward_params`,
  `forward_queries`, and `forward_headers`. The upstream host comes from `--default-host`, then `servers[0]`, then a
  `https://CHANGE-ME.internal` placeholder. Since a scaffolded flow always has exactly one upstream, it never needs
  `aggregation`: `--mode proxy` (the default) leaves it unset and the flow proxies the upstream's response as-is, and
  `--mode streaming` sets `streaming: true` instead.

Some inputs are inferred rather than restored:

- Operations that respond with a streamed `*/*` body are scaffolded as streaming flows regardless of `--mode`.
- If any operation carries a `429` response, the rate limiter is enabled with default settings.

### What Is Not Restored

Secrets and credentials never appear in an OpenAPI document, so they cannot be reconstructed. Where the input signals
that something was configured, `import` emits a warning instead of guessing:

- **Plugin and middleware configurations** - only their names survive in `x-aastro`. Each is reported so you can
  re-add its config block manually.
- **TLS material** - an upstream that used TLS is restored with `tls.enabled: true` and system roots, and a warning
  reminds you to re-add certificate or CA paths for mTLS or a private CA. The upstream fails the handshake loudly
  rather than silently downgrading to plain HTTP.
- **Auth requirements** in foreign documents - a `security` requirement on an operation becomes a warning to configure
  the `auth` middleware.

Warnings go to stderr; the configuration goes to stdout, so redirection stays clean:

```bash
aastroctl openapi import -i openapi.yaml -o aastro.yaml 2> import-warnings.log
```

Round-tripping a config through `export --extensions` and back is stable: the topology is reconstructed exactly.
Plugin and middleware config blocks are the only parts that need re-adding by hand, because their contents are never
written to the spec.

:::tip
The generated configuration is intentionally minimal - fields at their gateway defaults are omitted and re-applied on
load. If you prefer a config with every effective value pinned explicitly (for example, to stay independent of a
future change in gateway defaults), materialize it with `aastro -T`:

```bash
aastroctl openapi import -i openapi.yaml -o - | aastro -T -c /dev/stdin > aastro.yaml
```
:::
