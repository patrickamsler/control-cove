# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
npm run install:all      # install deps in shared/, client/ and server/ (builds shared first)
npm start                # concurrently: shared tsc -w + Vite dev server + tsx watch server
npm run start:client     # Vite dev server only, port 3000
npm run start:server     # server only (tsx watch)
npm run start:shared     # shared tsc -w only (both cjs + esm)
npm run build            # shared tsc -> client tsc -b + vite build -> server tsc
npm run build:shared     # shared only
npm test                 # both suites: client then server
npm run test:client      # Vitest tests in client/
npm run test:server      # Vitest tests in server/
```

**`shared/` must be built before either package compiles.** `tsx watch` and Vite both
read `shared/dist`, not its source, so after editing `shared/src` run
`npm run build:shared` — or keep `npm run start:shared` running, which `npm start`
already does. That watch script runs `tsc -w` over **both** the cjs and esm projects
concurrently: watching only cjs would refresh the server and the `.d.ts` files while
Vite kept serving a stale `dist/esm`, so the client would type-check green against
the new contract while running the old code.

`shared` is built **twice**: `dist/cjs` (for the server, via `main`) and `dist/esm`
(for Vite, via the `import` condition in `exports`). Both halves are load bearing, for
different reasons. The server's `tsc` output is `module: commonjs`, so it `require()`s
the package. Vite would happily pre-bundle the CJS build instead — nothing breaks — but
`shared`'s `require('zod')` then resolves through zod's own `require` condition to
`zod/index.cjs`, whose `exports.x = ...` assignments defeat Rollup's tree-shaking, so
the **whole** of zod lands in the bundle rather than the parts the four DTO schemas
reach. Measured: 437 kB (gzip 137) with `dist/esm`, 724 kB (gzip 186) without.
`scripts/write-module-type.js` stamps a `package.json` with the right `"type"` into each
output directory (it runs once up front in the watch script too, since `tsc -w` never
writes those files), and `shared/src` uses explicit `.js` import extensions so both
builds are genuinely loadable.

Because `@control-cove/shared` is installed as a symlinked `file:` dependency, Vite
would leave it out of dependency pre-bundling by default and serve its bare `zod`
import unbundled on every reload; `optimizeDeps.include` in `client/vite.config.ts`
opts it back in. If the client fails to resolve the package after changing that
layout, clear Vite's dep cache (`rm -rf client/node_modules/.vite`).

Client tests use **Vitest + jsdom**, configured in the `test` block of
`client/vite.config.ts` rather than a separate file, since Vite and Vitest share the
resolver here:

```bash
npm test --prefix client                        # vitest run
npm run test:watch --prefix client              # watch mode
npm run test:types --prefix client              # tsc -b --force over src + vite.config.ts
npm run lint --prefix client                    # eslint flat config
npm test --prefix client -- -t "test name"      # single test
```

`src/setupTests.ts` registers the `@testing-library/jest-dom/vitest` matchers, and
`globals: true` (matching `server/`) is what lets `@testing-library/react` install its
automatic cleanup. `test.env` supplies `VITE_SERVER_URL: ''`, because
`api/config.ts` throws at **import** time when the variable is absent — and Vitest's
automocking imports the real module to derive its shape.

Server tests use **Vitest**, colocated as `src/**/*.test.ts`:

```bash
npm test --prefix server                        # vitest run
npm run test:watch --prefix server              # watch mode
npm run test:coverage --prefix server           # v8 coverage
npm run test:types --prefix server              # tsc --noEmit over src + tests
npm test --prefix server -- -t "test name"      # single test
```

Test files are excluded from `tsconfig.json` so `npm run build --prefix server` never emits them into `dist/`; `tsconfig.test.json` type-checks them instead. `src/test/setup.ts` globally mocks `src/logger.ts` (its `DailyRotateFile` transport would otherwise write real files on import) and sets dummy `MQTT_*` env vars. Tests that touch the device lists mock `../domain/devices` with the fixtures in `src/test/fixtures.ts`, so they do not break when the real device lists change. `WebSocketService` has no tests — it constructs a `socket.io` `Server` in its constructor with no injection seam; the logic that used to make that a problem now lives in `registerWebSocketHandlers`, which is tested against a fake. There is no lint script in `server/`.

Local MQTT broker for development: `docker compose -f docker/docker-compose.yaml up` (Mosquitto, 1883 MQTT / 9001 WebSocket).

## Architecture

Three-package monorepo (no workspaces — each of `shared/`, `client/` and `server/` has its own `package.json` and `tsconfig.json`; the two apps depend on `shared` via `file:../shared`).

**The server is the only MQTT participant.** The browser never talks to the broker.

```
                      ┌─ http/  (REST + Swagger) ─┐
MQTT broker <-> mqtt/ ─┼─ domain/DeviceService ────┼─> client
                      ├─ ws/    (socket.io) ──────┘
                      └─ mcp/   (agents)
```

`server/src` is layered: `domain/` holds the device config and `DeviceService` and
imports no transport; `mqtt/`, `http/`, `ws/` and `mcp/` are adapters over it. Each
calls `DeviceService` and never reaches into another adapter.

Wiring happens in `server/src/index.ts`: services are constructed manually and injected by hand (no DI container). Construction order matters — `MqttDeviceGateway` is the `SwitchCommandPort` that `DeviceService` needs, and `DeviceService` is what the gateway pushes readings into, so the gateway is built first and `gateway.start(deviceService)` is called last. MQTT subscriptions and websocket handlers are registered only inside the `connectToBroker` callback, so nothing is wired until the first successful broker connection. The REST routes and the MCP router are registered unconditionally and serve device names without a broker.

- `mqtt/MqttClient` — single mqtt client, one listener per topic (later `subscribeToTopic` on the same topic replaces the previous listener). Sessions are clean, so it tracks `connectedBefore` and re-subscribes all stored topics on reconnect rather than re-running the `onConnect` wiring.
- `mqtt/MqttDeviceGateway` — parses broker payloads with the zod schemas in `mqtt/payloads.ts` and calls `DeviceService.applySensorReading` / `applySwitchState`; implements `SwitchCommandPort` to publish `on`/`off` to a switch's `commandTopic`.
- `domain/DeviceService` — merges the static device config with the latest known state and emits `switch` / `sensor` change callbacks. Nothing is persisted; state is empty after restart until devices publish. Unknown values stay **absent** from the DTOs rather than null.
- `ws/registerWebSocketHandlers` — emits `initial` to each new socket, fans `DeviceService` changes out as `switch` / `sensor`, and validates inbound `updateSwitch` payloads.
- `http/routes` — `GET /api/switches`, `GET /api/sensors`; `http/openapi.ts` builds the OpenAPI document served at `/api-docs` (UI) and `/api-docs.json`.
- `mcp/registerMcpHandlers` — the five agent-facing tools (`list_switches`, `get_switch`, `set_switch`, `list_sensors`, `get_sensor`) plus read-only resources (`devices://all`, `switch://{id}`, `sensor://{id}`); `mcp/routes.ts` mounts them on Streamable HTTP at `/mcp`. There is no UI in the repo — `npm run mcp:inspect --prefix server` launches the official MCP Inspector against it.

**The MCP layer answers, where the WebSocket layer drops.** Every other adapter follows the
same rule for bad input — `safeParse`, `logger.error`, `return` — because a malformed socket
frame has no one waiting on it. An MCP tool call always has an agent waiting, so problems come
back as `isError` results it can act on (`No switch with id 999. Call list_switches to see the
available ids.`) rather than silently doing nothing. The log line is kept as well.

**`set_switch` waits for the device.** `DeviceService.setSwitch` is fire-and-forget: it
publishes to the `commandTopic` and the state map only moves when the device reports back on its
`stateTopic`. Returning "ok" there would tell an agent a light changed when it may be unplugged,
so `set_switch` subscribes *before* commanding, then races the confirmation against
`MCP_COMMAND_TIMEOUT_MS` (default 5000). On timeout it returns an error that states exactly what
is known — the command was published, the outcome is not. This is why `onSwitchChanged` /
`onSensorChanged` return a disposer, and why `DeviceService` calls `setMaxListeners(0)`:
concurrent tool calls each hold a short-lived listener.

`mcp/schemas.ts` holds the tool input schemas and is server-internal, for the same reason
`mqtt/payloads.ts` is — the tool surface an agent sees is its own contract, not a mirror of the
browser API. Tool *outputs* do reuse the shared DTOs. Every field carries a `.describe()`; that
text is what the agent reads to choose arguments, so it is load bearing.

The transport at `/mcp` is **stateless**: `sessionIdGenerator: undefined`, and a fresh
`McpServer` per request. `enableJsonResponse: true` makes it answer with plain JSON instead of
SSE — no server-initiated notifications are sent, so the stream buys nothing, and a plain body
is far easier to read from `curl`. Because `index.ts` mounts a fully permissive `cors()`,
`/mcp` is wrapped in `originValidation` — without it any page on the LAN could toggle the
user's lights from a browser. Requests with no `Origin` header (every real MCP client, the
Inspector included) pass; `MCP_ALLOWED_ORIGINS` extends the list beyond localhost.

**There is deliberately no MCP UI in this repo.** `/api-docs` can embed Swagger because
`swagger-ui-dist` is a pre-built static bundle; MCP has no equivalent. The official
`@modelcontextprotocol/inspector` is a standalone CLI app (it pulls vite, react, ink and the
native `@napi-rs/keyring`, which would not survive the arm64/armv7 image), its old
`inspector-client` split package is deprecated, and the mountable third-party option carries
React and a dozen other peers. So the Inspector runs as a dev script instead:
`npm run mcp:inspect --prefix server`, which is `npx @modelcontextprotocol/inspector
--server-url http://localhost:3001/mcp --transport http` (the port is `server/.env`'s dev
`HTTP_PORT`; the image uses 8080). A hand-written page was tried and removed — it was ~340
lines to maintain against a moving spec.

`server/tsconfig.json` uses `"module": "node16"` rather than `"commonjs"` because the
`@modelcontextprotocol/*` packages describe themselves only through an `exports` map, which
TypeScript's implicit `node10` resolution cannot read. Emit is unchanged (CommonJS, since
`server/package.json` has no `"type": "module"`); the `require` condition supplies the `.d.cts`
types. The one visible consequence is that dynamic `import()` specifiers now need explicit
`.js` extensions, which is why the `vi.mock` one-liners read `'../test/fixtures.js'`.

**DTOs are shared, not duplicated.** `shared/` exports zod schemas and the types inferred from them; both packages import from `@control-cove/shared`. Add or change a field there and both sides fail to compile until they agree — there is no manual sync step.

**Socket event contract** — `ServerToClientEvents` / `ClientToServerEvents` in `shared/src/events.ts`, applied to socket.io's generics on both ends, so event names and payload shapes are compile-time checked. Emitted: `switch` | `sensor` | `initial`; received: `updateSwitch`. REST and WebSocket carry the **same** DTOs: the endpoints return arrays of them, the events carry one at a time. The MQTT payload schemas (`server/src/mqtt/payloads.ts`) are deliberately separate and server-internal — the broker's wire format is not the API.

**Devices are configured, not discovered.** `server/src/domain/sensor-config.json` (id, name, statusTopic) and `switch-config.json` (id, name, commandTopic, stateTopic) hold the raw device lists; `domain/devices.ts` loads both, validates them with zod at startup (unique ids, non-empty topics) and exports typed `switches` / `sensors` arrays plus `findSwitchById(id)` / `findSensorById(id)`. Everything imports from `devices.ts`, never the JSON files directly. Adding a device means editing the JSON files; the numeric `id` is the key used across REST, websocket events and the state maps, and is only unique **within** a device type — switch 1 and sensor 1 are different devices. Switch state topics carry the plain strings `on`/`off` (anything else is logged and ignored); sensor status topics carry JSON with numeric `temperature`/`humidity` plus an optional `device_id` (malformed payloads are logged and dropped).

`device_id` is **server-internal**: the sensor payload's value (falling back to the topic when the device does not send one) is stored on `DeviceService`'s `SensorReading` and read back with `getSensorReading(id)`, for logging and for the MCP layer, where `get_sensor` returns it. It is deliberately absent from `SensorDto`, so it never reaches the browser over REST or the socket. Switches have no `device_id` — the old value was just a substring of `stateTopic`, which `findSwitchById(id)` already provides.

**Client structure**: `api/` (REST fetch + socket factory, both reading `api/config.ts`), `hooks/useDevices.ts` (all device state — REST snapshot, socket `initial`, live updates, `setSwitch`), and presentational components. `App.tsx` holds layout only. REST responses are validated with the shared schemas, so a server/client mismatch surfaces as an error rather than as `undefined` deep in a component.

## Deployment

One image, one process: the root `Dockerfile` builds all three packages and copies the Vite
output (`client/build`, kept off Vite's default `dist` so the existing paths hold) to `server/public`, which `server/src/index.ts` serves with `express.static` plus an
SPA fallback registered **after** `/api` and `/api-docs` so those keep winning. The fallback
route is `'/*splat'` — Express 5 uses path-to-regexp v8, where the bare `'*'` of Express 4
throws at registration. The static block is guarded by `fs.existsSync`, so `npm run dev`
without a client build still serves the API alone.

Because the client is served same-origin, `VITE_SERVER_URL` is built as the **empty
string** and `client/src/api/config.ts` therefore rejects only `undefined`, not `''`.
`api/socket.ts` must call `io()` with no argument in that case — `io('')` is not the same
thing. `.dockerignore` excludes `**/.env*` so the local `client/.env` (`localhost:3001`)
cannot leak in and override the same-origin build.

The runtime stage preserves the `/app/shared` ↔ `/app/server` layout, because
`server/node_modules/@control-cove/shared` is a **symlink** to `../../../shared` created by
the `file:` dependency; `COPY` dereferences symlinks, so the Dockerfile re-creates it
explicitly. `npm ci --prefix shared` builds `shared` on its own via its `prepare` script,
and `npm prune --omit=dev` runs only *after* every build, since that build needs its
devDep `typescript`.

`logger.ts` writes to the console unconditionally (not only in development) so `docker logs`
shows something, and always writes rotated files under `LOG_PATH` — the container needs that
directory writable. `dotenv.config()` never overrides real environment variables, so the
image carries no `.env`.

## Configuration

Env files are gitignored; `.env` and `.env.production` exist in both `client/` and `server/`.

- `server/.env`: `HTTP_PORT`, `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `NODE_ENV`, `LOG_PATH`, optional `LOG_LEVEL`, optional `MCP_ALLOWED_ORIGINS` (comma-separated hostnames allowed to call `/mcp` from a browser; localhost is always allowed) and optional `MCP_COMMAND_TIMEOUT_MS` (default 5000).
- `client/.env`: `VITE_SERVER_URL` — `api/config.ts` throws at import if unset. Vite only
  exposes variables prefixed `VITE_`.

`server/src/logger.ts` (winston) always writes daily-rotated files under `LOG_PATH`; console output is always on. Prefer `logger` over `console.log` in server code.
