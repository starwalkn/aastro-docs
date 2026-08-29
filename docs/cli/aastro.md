---
id: cli-aastro
title: aastro (daemon)
description: Reference for the aastro gateway daemon
slug: /cli/aastro
---

# aastro (daemon)

The daemon. Running `aastro` without flags loads the configuration and starts the gateway. All other operations are
flags rather than subcommands, following the convention used by `nginx`, `haproxy`, and other long-lived system
services.

## Usage

```
aastro [options]
```

## Options

| Short | Long                | Description                                                       |
|-------|---------------------|-----------------------------------------------------------------------|
| `-c`  | `--config`          | Configuration file path (env: `AASTRO_CONFIG`)                    |
| `-t`  | `--test`            | Test configuration and exit                                       |
| `-T`  | `--test-dump`       | Test configuration, dump effective config to stdout, exit         |
| `-q`  | `--quiet`           | Suppress non-error output (useful in CI alongside `-t`)           |
| `-v`  | `--version`         | Print version and exit                                            |
| `-V`  | `--version-verbose` | Print version with build details (commit, build date, Go version) |
| `-h`  | `--help`            | Print help and exit                                               |

## Configuration Path Resolution

When `--config` is not specified, Aastro looks for the configuration file in this order:

1. The `AASTRO_CONFIG` environment variable
2. The default path `/etc/aastro/config.yaml`

If neither is set or the file is missing, Aastro exits with an error.

## Exit codes

| Code | Meaning                                          |
|------|---------------------------------------------------|
| `0`  | Success                                          |
| `1`  | Generic runtime error                            |
| `2`  | Configuration error (parse, validation, missing) |

The configuration error code is distinct so that CI pipelines can react differently to a bad config versus a runtime
failure.

## Testing Configuration

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

## Dumping the Effective Configuration

`aastro -T` performs the same validation as `-t`, then writes the **effective configuration** to stdout - the
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
The dumped configuration is valid input for Aastro - you can feed it back via `-c`. Round-tripping is supported.
:::

## Version Information

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

Use `-V` when reporting bugs - the commit hash uniquely identifies the source revision the binary was built from.

## Running in Docker

The official image runs `aastro` as the entrypoint, so flags pass through directly:

```bash
# Start the daemon with a mounted config
docker run -v $(pwd)/config.yaml:/etc/aastro/config.yaml starwalkn/aastro:1.2.3

# Test a config without starting the daemon
docker run -v $(pwd)/config.yaml:/etc/aastro/config.yaml starwalkn/aastro:1.2.3 -t

# Check the installed version
docker run --rm starwalkn/aastro:1.2.3 -V
```

## Signals

Aastro responds to standard process signals:

| Signal    | Behaviour                                          |
|-----------|-------------------------------------------------------|
| `SIGINT`  | Graceful shutdown (drain in-flight requests, exit) |
| `SIGTERM` | Graceful shutdown                                  |

The graceful shutdown timeout is 10 seconds. After that, in-flight requests are abandoned and the process exits.
