---
id: builtins
title: Built-in Plugins & Middlewares
description: Reference for all built-in plugins and middlewares shipped with Kono
slug: /builtins
---

# Built-in Plugins & Middlewares

Kono ships with a set of ready-to-use plugins and middlewares. They are available without any additional installation — set `source: builtin` in the flow configuration.

---

## Plugins

Plugins operate on the JSON response body after aggregation. All three built-in plugins run in the **response phase**.

### camelify

Transforms all JSON field names in the response body to `camelCase`.

```yaml
plugins:
  - name: camelify
    source: builtin
```

No configuration parameters.

**Example:**

```json
// Before
{ "user_id": 1, "first_name": "Alice", "last_login_at": "2026-01-01" }

// After
{ "userId": 1, "firstName": "Alice", "lastLoginAt": "2026-01-01" }
```

Transformation is applied recursively to nested objects and arrays. If the response body is not valid JSON, the body is passed through unchanged without error.

---

### snakeify

Transforms all JSON field names in the response body to `snake_case`.

```yaml
plugins:
  - name: snakeify
    source: builtin
```

No configuration parameters.

**Example:**

```json
// Before
{ "userId": 1, "firstName": "Alice", "lastLoginAt": "2026-01-01" }

// After
{ "user_id": 1, "first_name": "Alice", "last_login_at": "2026-01-01" }
```

Transformation is applied recursively to nested objects and arrays. If the response body is not valid JSON, the body is passed through unchanged without error.

---

### masker

Replaces the values of specified fields with `***` in the JSON response body.

```yaml
plugins:
  - name: masker
    source: builtin
    config:
      fields:
        - password
        - token
        - credit_card
```

| Parameter | Type | Description |
|---|---|---|
| `fields` | list[string] | Field names whose values will be replaced with `***` |

**Example:**

```json
// Before
{ "email": "alice@example.com", "token": "secret123", "name": "Alice" }

// After
{ "email": "alice@example.com", "token": "***", "name": "Alice" }
```

Masking is applied recursively — if a specified field appears at any nesting level, it is masked. Field matching is case-sensitive and exact. If `fields` is empty or not configured, the plugin is a no-op.

---

## Middlewares

Middlewares wrap the entire flow handler and run for every request. They execute in the order defined in configuration — the first middleware listed is the outermost wrapper.

### recoverer

Catches panics in downstream handlers and returns a `500 Internal Server Error` instead of crashing the process.

```yaml
middlewares:
  - name: recoverer
    source: builtin
    config:
      enabled: true
      include_stack: false
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Enable the middleware |
| `include_stack` | bool | `false` | Include the goroutine stack trace in the error log |

:::warning
Place `recoverer` first in the middleware list so it wraps all other middlewares and handlers.
:::

---

### logger

Logs each request with method, path, status code, duration, and request ID.

```yaml
middlewares:
  - name: logger
    source: builtin
    config:
      enabled: true
      log_body: false
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `true` | Enable the middleware |
| `log_body` | bool | `false` | Log the request body. Body is read into memory and replayed — do not enable for large payloads |

Log output uses structured JSON fields: `method`, `path`, `status`, `duration`, `request_id`, and optionally `body`.

---

### compressor

Compresses the response body using gzip or deflate when the client signals support via `Accept-Encoding`.

```yaml
middlewares:
  - name: compressor
    source: builtin
    config:
      enabled: true
      alg: gzip
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `enabled` | bool | `false` | Enable the middleware |
| `alg` | string | `gzip` | Compression algorithm: `gzip` or `deflate` |

The middleware checks the incoming `Accept-Encoding` header. If the header does not include the configured algorithm, the response is passed through uncompressed. `Content-Length` is removed from the response since the compressed body length is unknown in advance.

---

### cors

Handles Cross-Origin Resource Sharing (CORS) headers and preflight requests.

```yaml
middlewares:
  - name: cors
    source: builtin
    config:
      allowed_origins:
        - "https://app.example.com"
        - "https://admin.example.com"
      allowed_methods:
        - GET
        - POST
      allowed_headers:
        - Authorization
        - Content-Type
      allow_credentials: false
      max_age: 3600
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `allowed_origins` | list[string] | `[]` | Allowed origins. Use `"*"` to allow all origins |
| `allowed_methods` | list[string] | `[]` | Allowed HTTP methods for CORS requests |
| `allowed_headers` | list[string] | `[]` | Allowed headers for CORS requests |
| `allow_credentials` | bool | `false` | Set `Access-Control-Allow-Credentials: true` |
| `max_age` | int | `0` | Preflight cache duration in seconds (`Access-Control-Max-Age`) |

Preflight requests (`OPTIONS` with `Origin` and `Access-Control-Request-Method` headers) are handled automatically and return `204 No Content`. Requests from disallowed origins receive `403 Forbidden`.

:::warning
`allow_credentials: true` cannot be combined with `allowed_origins: ["*"]`. Using wildcard origins with credentials is rejected at initialization.
:::

---

### auth

Validates JWT tokens from the `Authorization: Bearer <token>` header. Supports three key sources: HMAC shared secret, static RSA public key, and JWKS endpoint.

**HS256 — HMAC shared secret:**

```yaml
middlewares:
  - name: auth
    source: builtin
    config:
      alg: HS256
      issuer: "https://auth.example.com"
      audience: "api"
      hmac_secret: "dGhpcyBpcyBhIHNlY3JldA=="
```

The `hmac_secret` value must be **base64-encoded**.

**RS256 — static RSA public key:**

```yaml
middlewares:
  - name: auth
    source: builtin
    config:
      alg: RS256
      issuer: "https://auth.example.com"
      audience: "api"
      rsa_public_key: |
        -----BEGIN PUBLIC KEY-----
        MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...
        -----END PUBLIC KEY-----
```

**RS256 — JWKS endpoint:**

```yaml
middlewares:
  - name: auth
    source: builtin
    config:
      alg: RS256
      issuer: "https://auth.example.com"
      audience: "api"
      jwks_url: "https://auth.example.com/.well-known/jwks.json"
      jwks_refresh_timeout: "5s"
      jwks_refresh_interval: "5m"
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `alg` | string | — | Signing algorithm: `HS256` or `RS256` |
| `issuer` | string | — | Expected `iss` claim value |
| `audience` | string | — | Expected `aud` claim value |
| `hmac_secret` | string | — | Base64-encoded HMAC secret. Required for `HS256` |
| `rsa_public_key` | string | — | PEM-encoded RSA public key. Used for static RS256 |
| `jwks_url` | string | — | URL of the JWKS endpoint. Takes priority over `rsa_public_key` for RS256 |
| `jwks_refresh_timeout` | duration | `5s` | HTTP timeout for each JWKS fetch request |
| `jwks_refresh_interval` | duration | `5m` | How often the JWKS cache is refreshed in the background |

**Validation:** the middleware verifies the signature, expiry (`exp`), not-before (`nbf`), issuer (`iss`), and audience (`aud`) claims. A 5-second leeway is applied to `exp` and `nbf` to tolerate minor clock skew.

**JWKS caching:** on startup, the middleware performs a blocking fetch of the JWKS endpoint. If the fetch fails, initialization fails and the gateway does not start. After that, keys are refreshed in the background every `jwks_refresh_interval`. On a cache miss during request handling (unknown `kid`), an immediate on-demand refresh is triggered before rejecting the token.

**Unauthorized response:** all validation failures return `401 Unauthorized` with no detail about the specific failure reason.

---