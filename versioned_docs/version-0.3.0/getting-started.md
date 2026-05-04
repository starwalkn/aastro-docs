---
id: getting-started
title: Getting Started
description: Getting Started
slug: /getting-started
---

# Getting Started

## Requirements
---

- Go 1.22+ (for building from source)
- Docker (for container deployment)

## Install via Docker
---

```bash
docker pull starwalkn/kono:latest

docker run \
  -p 7805:7805 \
  -v $(pwd)/kono.yaml:/app/kono.yaml \
  -e KONO_CONFIG=/app/kono.yaml \
  starwalkn/kono:latest
```

## Build from Source
---

```bash
git clone https://github.com/starwalkn/kono.git
cd kono

make all GOOS=linux GOARCH=amd64

./bin/kono serve
```

## CLI Commands
---

| Command | Description |
|---|---|
| `kono serve` | Start the gateway |
| `kono validate` | Validate the configuration file without starting |
| `kono viz` | Visualize flow configuration as a diagram |

## Configuration Path Resolution
---

Kono resolves the configuration file in this order:

1. `--config` flag: `kono --config /etc/kono/config.yaml serve`
2. `KONO_CONFIG` environment variable
3. Default path: `/etc/kono/config.yaml`

## Minimal Configuration
---

```yaml
schema: v1

gateway:
  server:
    port: 7805
    timeout: 10s

  routing:
    flows:
      - path: /api/hello
        method: GET
        aggregation:
          strategy: array
          best_effort: false
        upstreams:
          - name: hello
            hosts: http://your-service.local
            path: /hello
            method: GET
            timeout: 3s
```

Start the gateway:

```bash
kono serve
```

Send a request:

```bash
curl http://localhost:7805/api/hello
```

## Health Check
---

Kono exposes a built-in health endpoint. The `__` prefix avoids conflicts with user-defined flow paths.

```bash
curl http://localhost:7805/__health
# → 200 OK
```

## Validate Configuration
---

```bash
kono validate

# or with explicit path
kono --config /etc/kono/config.yaml validate
```

Validation checks schema, required fields, unknown aggregation strategies, upstream policy constraints, and path parameter consistency between flows and upstreams. Errors are reported with human-readable field paths.

---