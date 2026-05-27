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

| Command       | Description                                             |
|---------------|---------------------------------------------------------|
| `plugin init` | Generate a new plugin or middleware skeleton            |
| `help`        | Show help for any command (also available via `--help`) |

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