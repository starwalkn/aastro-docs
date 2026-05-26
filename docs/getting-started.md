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
docker pull starwalkn/aastro:latest

docker run \
  -p 7805:7805 \
  -v $(pwd)/config.yaml:/etc/aastro/config.yaml \
  -e AASTRO_CONFIG=/etc/aastro/config.yaml \
  starwalkn/aastro:latest
```

## Build from Source
---

```bash
git clone https://github.com/starwalkn/aastro.git
cd aastro

make all GOOS=linux GOARCH=amd64

./bin/aastro -c /path/to/config.yaml
```

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
aastro -c /path/to/config.yaml
```

Send a request:

```bash
curl http://localhost:7805/api/hello
```

## Health Check
---

Aastro exposes a built-in health endpoint. The `__` prefix avoids conflicts with user-defined flow paths.

```bash
curl http://localhost:7805/__health
# → 200 OK
```

---