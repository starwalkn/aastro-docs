---
id: cli
title: Command-line interface
description: Reference for the aastro and aastroctl command-line tools
slug: /cli
---

# Command-line interface

Aastro ships as two binaries:

- **`aastro`** — the gateway daemon. Starts the HTTP server, tests configuration, prints version information.
- **`aastroctl`** — companion tool for developers and DevOps. Generates plugin scaffolding and (in future versions)
  communicates with a running daemon.

Both follow standard Unix conventions: short and long flags (`-c` / `--config`), grouped short flags (`-tq` is `-t -q`),
`--` as a positional argument terminator, and `KEY=VALUE` for long flag values.

## aastro

The daemon. Running `aastro` without flags loads the configuration and starts the gateway. All other operations are
flags rather than subcommands, following the convention used by `nginx`, `haproxy`, and other long-lived system
services.

### Usage

```
aastro [options]
```

### Options

| Short | Long                | Description                                                       |
|-------|---------------------|-------------------------------------------------------------------|
| `-c`  | `--config`          | Configuration file path (env: `AASTRO_CONFIG`)                    |
| `-t`  | `--test`            | Test configuration and exit                                       |
| `-T`  | `--test-dump`       | Test configuration, dump effective config to stdout, exit         |
| `-q`  | `--quiet`           | Suppress non-error output (useful in CI alongside `-t`)           |
| `-v`  | `--version`         | Print version and exit                                            |
| `-V`  | `--version-verbose` | Print version with build details (commit, build date, Go version) |
| `-h`  | `--help`            | Print help and exit                                               |

### Configuration path resolution

When `--config` is not specified, Aastro looks for the configuration file in this order:

1. The `AASTRO_CONFIG` environment variable
2. The default path `/etc/aastro/config.yaml`

If neither is set or the file is missing, Aastro exits with an error.

### Exit codes

| Code | Meaning                                          |
|------|--------------------------------------------------|
| `0`  | Success                                          |
| `1`  | Generic runtime error                            |
| `2`  | Configuration error (parse, validation, missing) |

The configuration error code is distinct so that CI pipelines can react differently to a bad config versus a runtime
failure.

### Testing configuration

`aastro -t` parses the configuration file, applies defaults, resolves environment substitutions, and validates the
result. It does **not** start the server, bind ports, or connect to upstreams.

```bash
$ aastro -t -c config.yaml
aastro: configuration file config.yaml test is successful
$ echo $?
0
```

In CI you typically want silence on success and noise only on failure:

```bash
$ aastro -tq -c config.yaml || exit $?
```

On failure, the error is printed to stderr regardless of `-q`:

```bash
$ aastro -t -c broken.yaml
aastro: configuration file broken.yaml test failed
aastro: yaml: line 5: did not find expected key
$ echo $?
2
```

### Dumping the effective configuration

`aastro -T` performs the same validation as `-t`, then writes the **effective configuration** to stdout — the
configuration as Aastro actually sees it after defaults are applied, environment variables are substituted, and includes
are resolved.

This is useful for:

- Diffing the effective config between deploys
- Verifying that environment substitution produced the expected values
- Snapshot-testing the configuration in a repository

```bash
$ aastro -T -c config.yaml > effective.yaml
aastro: configuration file config.yaml test is successful

$ head -3 effective.yaml
# configuration file config.yaml test is successful
# aastro/v1.2.3 at 2026-05-26T14:30:00Z
#
```

Diagnostic output goes to stderr; the dump goes to stdout. This makes redirection clean:

```bash
$ aastro -T -c config.yaml | yq '.gateway.flows[].path'
```

:::info
The dumped configuration is valid input for Aastro — you can feed it back via `-c`. Round-tripping is supported.
:::

### Version information

`aastro -v` prints a single-line product/version string:

```bash
$ aastro -v
aastro/v1.2.3
```

`aastro -V` prints the full build manifest, including the commit hash, build date, and Go runtime:

```bash
$ aastro -V
aastro version: aastro/v1.2.3
built with:     go1.25.4 (linux/amd64)
built at:       2026-05-26T14:30:00Z
commit:         abc1234
```

Use `-V` when reporting bugs — the commit hash uniquely identifies the source revision the binary was built from.

### Running in Docker

The official image runs `aastro` as the entrypoint, so flags pass through directly:

```bash
# Start the daemon with a mounted config
docker run -v $(pwd)/config.yaml:/etc/aastro/config.yaml starwalkn/aastro:1.2.3

# Test a config without starting the daemon
docker run -v $(pwd)/config.yaml:/etc/aastro/config.yaml starwalkn/aastro:1.2.3 -t

# Check the installed version
docker run --rm starwalkn/aastro:1.2.3 -V
```

### Signals

Aastro responds to standard process signals:

| Signal    | Behaviour                                          |
|-----------|----------------------------------------------------|
| `SIGINT`  | Graceful shutdown (drain in-flight requests, exit) |
| `SIGTERM` | Graceful shutdown                                  |

The graceful shutdown timeout is 10 seconds. After that, in-flight requests are abandoned and the process exits.

## aastroctl

The companion tool. Unlike `aastro`, it uses a subcommand-based CLI similar to `kubectl` or `git`, because it bundles
unrelated operations (plugin scaffolding today; daemon administration in future releases).

### Usage
---

```
aastroctl <command> [flags]
```

### Commands

| Command          | Description                                               |
|------------------|-----------------------------------------------------------|
| `plugin init`    | Generate a new plugin or middleware skeleton              |
| `openapi export` | Generate an OpenAPI document from a gateway configuration |
| `help`           | Show help for any command (also available via `--help`)   |

### Global flags

| Long        | Description                               |
|-------------|-------------------------------------------|
| `--version` | Print version with build details and exit |
| `--help`    | Print help and exit                       |

### `aastroctl plugin init`

Generates a starter `.go` file for a new plugin or middleware. The generated code compiles as-is — you can run
`go build -buildmode=plugin` on it immediately and load the resulting `.so` into Aastro.

```
aastroctl plugin init --type=<type> --name=<name> [flags]
```

**Flags:**

| Flag            | Required | Description                                                            |
|-----------------|----------|------------------------------------------------------------------------|
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

See [Plugin & Middleware Development](plugin-development) for the full guide on writing plugins.

### `aastroctl openapi export`

Generates an OpenAPI 3.1 (or 3.0) document from a gateway configuration. The configuration is loaded through the same
pipeline as the gateway itself — defaults applied, validation performed — so the resulting document describes what the
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
# Generate a request-phase plugin
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

### `aastroctl openapi import`

Generates a gateway configuration from an OpenAPI 3.x document — the inverse of `openapi export`. Documents produced by
`openapi export --extensions` are reconstructed losslessly; foreign documents are scaffolded into a working starting
point. The generated configuration is validated before it is written, so `import` never emits a config the gateway
would reject.

```bash
aastroctl openapi import -i <document> [flags]
```

**Flags:**

| Flag             | Short | Default        | Description                                                          |
|------------------|-------|----------------|----------------------------------------------------------------------|
| `--in`           | `-i`  | required       | OpenAPI document to import (`yaml` or `json`)                        |
| `--out`          | `-o`  | `-`            | Output configuration file (`-` for stdout)                          |
| `--default-host` |       | `servers[0]`   | Upstream host for scaffolded flows; falls back to a placeholder      |
| `--mode`         |       | `envelope`     | Flow shape for scaffolded operations: `envelope` or `passthrough`   |
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

# Scaffold streaming-style flows as passthrough
aastroctl openapi import -i events-api.yaml --mode passthrough -o aastro.yaml
```

#### Lossless import vs. scaffolding

The command has two modes of operation, chosen automatically per operation:

- **Lossless reconstruction** — operations carrying an `x-aastro` extension (written by `openapi export --extensions`)
  are restored in full: flows, aggregation, upstreams, per-upstream `policy`, and `transport`. Fields left at their
  gateway defaults are omitted from the result, so the output is minimal and reads like a hand-written config rather
  than an exhaustive dump.
- **Scaffolding** — operations without the extension (any third-party document) become single-upstream flows. Path
  parameters, and the query and header parameters declared on the operation, are turned into `forward_params`,
  `forward_queries`, and `forward_headers`. The upstream host comes from `--default-host`, then `servers[0]`, then a
  `https://CHANGE-ME.internal` placeholder. Flows default to `array` aggregation, or to passthrough under
  `--mode passthrough`.

Some inputs are inferred rather than restored:

- Operations that respond with a streamed `*/*` body are scaffolded as passthrough flows regardless of `--mode`.
- If any operation carries a `429` response, the rate limiter is enabled with default settings.

#### What is not restored

Secrets and credentials never appear in an OpenAPI document, so they cannot be reconstructed. Where the input signals
that something was configured, `import` emits a warning instead of guessing:

- **Plugin and middleware configurations** — only their names survive in `x-aastro`. Each is reported so you can
  re-add its config block manually.
- **TLS material** — an upstream that used TLS is restored with `tls.enabled: true` and system roots, and a warning
  reminds you to re-add certificate or CA paths for mTLS or a private CA. The upstream fails the handshake loudly
  rather than silently downgrading to plain HTTP.
- **Auth requirements** in foreign documents — a `security` requirement on an operation becomes a warning to configure
  the `auth` middleware.

Warnings go to stderr; the configuration goes to stdout, so redirection stays clean:

```bash
aastroctl openapi import -i openapi.yaml -o aastro.yaml 2> import-warnings.log
```

:::info
Round-tripping a config through `export --extensions` and back is stable: the topology is reconstructed exactly.
Plugin and middleware config blocks are the only parts that need re-adding by hand, because their contents are never
written to the spec.
:::

:::info
The generated configuration is intentionally minimal — fields at their gateway defaults are omitted and re-applied on
load. If you prefer a config with every effective value pinned explicitly (for example, to stay independent of a
future change in gateway defaults), materialize it with `aastro -T`:

```bash
aastroctl openapi import -i openapi.yaml -o - | aastro -T -c /dev/stdin > aastro.yaml
```
:::

## Conventions

A few conventions to keep in mind when scripting against either binary.

### Output streams

- **stdout** carries the primary output of the command — version strings, configuration dumps, future command results.
- **stderr** carries diagnostic messages — `test is successful`, `created myplugin.go`, error reports.

This means redirection works the way you expect:

```bash
aastro -T -c config.yaml > snapshot.yaml      # dump only, diagnostics to terminal
aastro -t -c config.yaml 2> test.log          # log diagnostics, no stdout
aastroctl --version | cut -d/ -f2             # parse just the version
```

### Short flag grouping

Short boolean flags can be combined. These are equivalent:

```bash
aastro -t -q -c config.yaml
aastro -tq -c config.yaml
aastro -tqc config.yaml
```

The value-taking flag (`-c` here) must come last in the group; its argument follows immediately.

### Environment variables

| Variable        | Used by  | Description                              |
|-----------------|----------|------------------------------------------|
| `AASTRO_CONFIG` | `aastro` | Default config path (overridden by `-c`) |

Additional environment variables for configuration values themselves are documented
under [Configuration](configuration).