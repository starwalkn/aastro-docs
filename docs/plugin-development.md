---
id: plugin-development
title: Plugin & Middleware Development
description: How to write custom plugins and middlewares for Aastro
slug: /plugin-development
---

# Plugin & Middleware Development

Aastro can be extended with custom plugins and middlewares compiled as Go shared objects (`.so`). Both use the same loading mechanism — the difference is when and how they execute.

- **Plugin** — invoked at a specific phase in the request lifecycle (before scatter or after aggregation). Works with the gateway's `sdk.Context`.
- **Middleware** — wraps the entire flow handler as a standard `http.Handler`. Executes for every request regardless of upstream results.

## Requirements

- Go version from `aastro -V`
- The plugin must be compiled with the **exact same Go version** as the gateway binary. A mismatch causes a panic at startup.
- Import `github.com/starwalkn/aastro/sdk` — this is the only dependency required.

## Writing a Plugin

A plugin implements the `sdk.Plugin` interface:

```go
type Plugin interface {
    Info()    PluginInfo
    Init(cfg map[string]interface{}) error
    Type()    PluginType
    Execute(ctx Context) error
}
```

`PluginType` determines the execution phase:

| Constant | Phase | What you can do |
|---|---|---|
| `sdk.PluginTypeRequest` | Before upstream scatter | Read and modify request headers, add context values |
| `sdk.PluginTypeResponse` | After aggregation | Read and modify response headers and body |

### Example: request plugin that adds a header

```go
package main

import (
    "github.com/starwalkn/aastro/sdk"
)

type requestIDPlugin struct{}

func NewPlugin() sdk.Plugin { return &requestIDPlugin{} }

func (p *requestIDPlugin) Info() sdk.PluginInfo {
    return sdk.PluginInfo{
        Name:        "add-header",
        Description: "Adds a custom header to every upstream request",
        Version:     "v1.0.0",
        Author:      "you",
    }
}

func (p *requestIDPlugin) Init(_ map[string]interface{}) error {
	return nil
}

func (p *requestIDPlugin) Type() sdk.PluginType {
    return sdk.PluginTypeRequest
}

func (p *requestIDPlugin) Execute(ctx sdk.Context) error {
    ctx.Request().Header.Set("X-Gateway", "aastro")
    return nil
}
```

### Example: response plugin that transforms the body

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"

    "github.com/starwalkn/aastro/sdk"
)

type wrapPlugin struct{}

func NewPlugin() sdk.Plugin { return &wrapPlugin{} }

func (p *wrapPlugin) Info() sdk.PluginInfo {
    return sdk.PluginInfo{Name: "wrap", Version: "v1.0.0"}
}

func (p *wrapPlugin) Init(_ map[string]interface{}) error {
	return nil
}

func (p *wrapPlugin) Type() sdk.PluginType {
    return sdk.PluginTypeResponse
}

func (p *wrapPlugin) Execute(ctx sdk.Context) error {
    resp := ctx.Response()
    if resp == nil || resp.Body == nil {
        return nil
    }

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return fmt.Errorf("read body: %w", err)
    }

    wrapped, err := json.Marshal(map[string]json.RawMessage{
        "payload": body,
    })
    if err != nil {
        return fmt.Errorf("marshal: %w", err)
    }

    resp.Body = io.NopCloser(bytes.NewReader(wrapped))
    resp.ContentLength = int64(len(wrapped))
    ctx.SetResponse(resp)

    return nil
}
```

### sdk.Context

`sdk.Context` is the per-request context passed to every plugin:

```go
type Context interface {
    Request()              *http.Request   // The incoming HTTP request
    Response()             *http.Response  // The aggregated response (nil in request phase)
    SetResponse(*http.Response)            // Replace the response (response phase only)
}
```

In the **request phase**, `Response()` returns `nil` — aggregation has not happened yet. In the **response phase**, both `Request()` and `Response()` are available.

:::warning
`SetResponse` must be called after any modification to the response — modifying the `*http.Response` fields directly without calling `SetResponse` has no effect on the final output.
:::

## Writing a Middleware

A middleware implements the `sdk.Middleware` interface:

```go
type Middleware interface {
    Name()    string
    Init(cfg map[string]interface{}) error
    Handler(next http.Handler) http.Handler
}
```

Optionally, if the middleware holds background resources (goroutines, connections), implement `sdk.Closer`:

```go
type Closer interface {
    Close() error
}
```

Aastro calls `Close()` on shutdown for any middleware that implements it.

### Example: simple logger middleware

```go
package main

import (
    "log"
    "net/http"
    "time"

    "github.com/starwalkn/aastro/sdk"
)

type loggerMiddleware struct {
    enabled bool
}

func NewMiddleware() sdk.Middleware { return &loggerMiddleware{} }

func (m *loggerMiddleware) Name() string { return "simple-logger" }

func (m *loggerMiddleware) Init(cfg map[string]interface{}) error {
    if v, ok := cfg["enabled"].(bool); ok {
        m.enabled = v
    }

    return nil
}

func (m *loggerMiddleware) Handler(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if !m.enabled {
            next.ServeHTTP(w, r)
            return
        }

        start := time.Now()
        next.ServeHTTP(w, r)
        log.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(start))
    })
}
```

## Building the .so File

Both plugins and middlewares are compiled with `-buildmode=plugin`:

```bash
# Plugin
go build -buildmode=plugin -o myplugin.so ./myplugin

# Middleware
go build -buildmode=plugin -o mymiddleware.so ./mymiddleware
```

The exported entry point must be named exactly `NewPlugin` for plugins and `NewMiddleware` for middlewares. Aastro looks up these symbols by name at load time.

:::info
`-buildmode=plugin` is only supported on Linux and macOS. Windows is not supported.
:::

## Project Structure

A typical custom plugin repository looks like this:

```
myplugin/
├── go.mod           # must use the same Go version as Aastro
├── main.go          # package main, exports NewPlugin()
└── Makefile
```

`go.mod` must declare `package main` is fine — the binary is never run directly.

The `go.mod` should reference the same `github.com/starwalkn/aastro/sdk` version as the gateway:

```go
module github.com/yourname/myplugin

go 1.25.4

require github.com/starwalkn/aastro/sdk v0.3.0
```

## Registering in Configuration

```yaml
flows:
  - path: /api/users/{id}
    method: GET
    plugins:
      - name: add-header       # matches Info().Name
        source: file
        path: /etc/aastro/plugins/
        config:
          some_key: some_value
    middlewares:
      - name: simple-logger
        source: file
        path: /etc/aastro/middlewares/
        config:
          enabled: true
    aggregation:
      strategy: merge
    upstreams:
      - ...
```

The `path` field points to the **directory** containing the `.so` file. Aastro resolves the full path as `{path}/{name}.so`.

## Execution Order

```
Middlewares (outermost first)
  └── Request plugins (in config order)
        └── Upstream scatter
              └── Aggregation
                    └── Response plugins (in config order)
```

Middlewares wrap the entire handler including plugins. Within each phase, plugins execute in the order they appear in configuration.

Plugins with the same `name` are deduplicated — if the same plugin is listed twice in a flow, it is loaded and executed only once.
