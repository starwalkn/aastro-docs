---
id: cli
title: Command-Line Interface
description: Reference for the aastro and aastroctl command-line tools
slug: /cli
---

# Command-Line Interface

Aastro ships as two binaries:

- **[`aastro`](cli/aastro)** - the gateway daemon. Starts the HTTP server, tests configuration, prints version information.
- **[`aastroctl`](cli/aastroctl)** - companion tool for developers and DevOps. Generates plugin scaffolding and (in
  future versions) communicates with a running daemon.

Both follow standard Unix conventions: short and long flags (`-c` / `--config`), grouped short flags (`-tq` is `-t -q`),
`--` as a positional argument terminator, and `KEY=VALUE` for long flag values - see [Conventions](cli/conventions) for
the details shared by both binaries.

| Page                            | Covers                                                                          |
|----------------------------------|------------------------------------------------------------------------------------|
| [`aastro`](cli/aastro)           | Daemon flags, config testing/dumping, version info, Docker, signals            |
| [`aastroctl`](cli/aastroctl)     | `plugin init`, `openapi export`, `openapi import`                              |
| [Conventions](cli/conventions)   | Output streams, short flag grouping, environment variables                     |
