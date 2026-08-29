---
id: cli-conventions
title: Conventions
description: Shared CLI conventions for aastro and aastroctl
slug: /cli/conventions
---

# Conventions

A few conventions to keep in mind when scripting against either binary.

## Output Streams

- **stdout** carries the primary output of the command - version strings, configuration dumps, future command results.
- **stderr** carries diagnostic messages - `test is successful`, `created myplugin.go`, error reports.

This means redirection works the way you expect:

```bash
aastro -T -c config.yaml > snapshot.yaml      # dump only, diagnostics to terminal
aastro -t -c config.yaml 2> test.log          # log diagnostics, no stdout
aastroctl --version | cut -d/ -f2             # parse just the version
```

## Short Flag Grouping

Short boolean flags can be combined. These are equivalent:

```bash
aastro -t -q -c config.yaml
aastro -tq -c config.yaml
aastro -tqc config.yaml
```

The value-taking flag (`-c` here) must come last in the group; its argument follows immediately.

## Environment Variables

| Variable        | Used by  | Description                              |
|-----------------|----------|---------------------------------------------|
| `AASTRO_CONFIG` | `aastro` | Default config path (overridden by `-c`) |

Additional environment variables for configuration values themselves are documented
under [Configuration](../configuration).
