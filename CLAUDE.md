# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
npm run install:all      # install deps in shared/, client/ and server/ (builds shared first)
npm start                # concurrently: shared tsc -w + CRA dev server + tsx watch server
npm run start:client     # CRA only, port 3000
npm run start:server     # server only (tsx watch)
npm run start:shared     # shared tsc -w only
npm run build            # shared tsc -> client CRA build -> server tsc
npm run build:shared     # shared only
npm test                 # both suites: client then server
npm run test:client      # CRA/Jest tests in client/ (--watchAll=false)
npm run test:server      # Vitest tests in server/
```

**`shared/` must be built before either package compiles.** `tsx watch` and CRA both
read `shared/dist`, not its source, so after editing `shared/src` run
`npm run build:shared` — or keep `npm run start:shared` running, which `npm start`
already does.

`shared` is built **twice**: `dist/cjs` (for the server, via `main`) and `dist/esm`
(for webpack, via the `import` condition in `exports`). This is not gold-plating — CRA 5
has no webpack rule for `.cjs`, so a CommonJS-only `shared` makes webpack resolve zod
through its `require` condition to `zod/index.cjs`, which then falls through to
file-loader and is emitted as a **static asset**. The import silently becomes a URL
string and `z.object` throws `Cannot read properties of undefined` in the browser —
while `tsc` and `react-scripts build` both report success. `scripts/write-module-type.js`
stamps a `package.json` with the right `"type"` into each output directory, and
`shared/src` uses explicit `.js` import extensions so both builds are genuinely loadable.

If the client fails to resolve `@control-cove/shared` after changing that layout, clear
CRA's webpack cache (`rm -rf client/node_modules/.cache`) — it caches module resolution
across dev-server restarts and will keep serving the old paths.

Single test (from `client/`): `npm test -- -t "test name"` or `npm test -- useDevices`.

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
                      └─ ws/    (socket.io) ──────┘
                         mcp/   (planned)
```

`server/src` is layered: `domain/` holds the device config and `DeviceService` and
imports no transport; `mqtt/`, `http/` and `ws/` are adapters over it. A planned
`mcp/` adapter slots in the same way — it should call `DeviceService`, not reach into
another adapter.

Wiring happens in `server/src/index.ts`: services are constructed manually and injected by hand (no DI container). Construction order matters — `MqttDeviceGateway` is the `SwitchCommandPort` that `DeviceService` needs, and `DeviceService` is what the gateway pushes readings into, so the gateway is built first and `gateway.start(deviceService)` is called last. MQTT subscriptions and websocket handlers are registered only inside the `connectToBroker` callback, so nothing is wired until the first successful broker connection. The REST routes are registered unconditionally and serve device names without a broker.

- `mqtt/MqttClient` — single mqtt client, one listener per topic (later `subscribeToTopic` on the same topic replaces the previous listener). Sessions are clean, so it tracks `connectedBefore` and re-subscribes all stored topics on reconnect rather than re-running the `onConnect` wiring.
- `mqtt/MqttDeviceGateway` — parses broker payloads with the zod schemas in `mqtt/payloads.ts` and calls `DeviceService.applySensorReading` / `applySwitchState`; implements `SwitchCommandPort` to publish `on`/`off` to a switch's `commandTopic`.
- `domain/DeviceService` — merges the static device config with the latest known state and emits `switch` / `sensor` change callbacks. Nothing is persisted; state is empty after restart until devices publish. Unknown values stay **absent** from the DTOs rather than null.
- `ws/registerWebSocketHandlers` — emits `initial` to each new socket, fans `DeviceService` changes out as `switch` / `sensor`, and validates inbound `updateSwitch` payloads.
- `http/routes` — `GET /api/switches`, `GET /api/sensors`; `http/openapi.ts` builds the OpenAPI document served at `/api-docs` (UI) and `/api-docs.json`.

**DTOs are shared, not duplicated.** `shared/` exports zod schemas and the types inferred from them; both packages import from `@control-cove/shared`. Add or change a field there and both sides fail to compile until they agree — there is no manual sync step.

**Socket event contract** — `ServerToClientEvents` / `ClientToServerEvents` in `shared/src/events.ts`, applied to socket.io's generics on both ends, so event names and payload shapes are compile-time checked. Emitted: `switch` | `sensor` | `initial`; received: `updateSwitch`. REST and WebSocket carry the **same** DTOs: the endpoints return arrays of them, the events carry one at a time. The MQTT payload schemas (`server/src/mqtt/payloads.ts`) are deliberately separate and server-internal — the broker's wire format is not the API.

**Devices are configured, not discovered.** `server/src/domain/sensor-config.json` (id, name, statusTopic) and `switch-config.json` (id, name, commandTopic, stateTopic) hold the raw device lists; `domain/devices.ts` loads both, validates them with zod at startup (unique ids, non-empty topics) and exports typed `switches` / `sensors` arrays plus `findSwitchById(id)` / `findSensorById(id)`. Everything imports from `devices.ts`, never the JSON files directly. Adding a device means editing the JSON files; the numeric `id` is the key used across REST, websocket events and the state maps, and is only unique **within** a device type — switch 1 and sensor 1 are different devices. Switch state topics carry the plain strings `on`/`off` (anything else is logged and ignored); sensor status topics carry JSON with numeric `temperature`/`humidity` plus an optional `device_id` (malformed payloads are logged and dropped).

`device_id` is **server-internal**: the sensor payload's value (falling back to the topic when the device does not send one) is stored on `DeviceService`'s `SensorReading` and read back with `getSensorReading(id)`, for logging and the planned MCP layer. It is deliberately absent from `SensorDto`, so it never reaches the browser over REST or the socket. Switches have no `device_id` — the old value was just a substring of `stateTopic`, which `findSwitchById(id)` already provides.

**Client structure**: `api/` (REST fetch + socket factory, both reading `api/config.ts`), `hooks/useDevices.ts` (all device state — REST snapshot, socket `initial`, live updates, `setSwitch`), and presentational components. `App.tsx` holds layout only. REST responses are validated with the shared schemas, so a server/client mismatch surfaces as an error rather than as `undefined` deep in a component.

## Configuration

Env files are gitignored; `.env` and `.env.production` exist in both `client/` and `server/`.

- `server/.env`: `HTTP_PORT`, `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `NODE_ENV`, `LOG_PATH`, optional `LOG_LEVEL`.
- `client/.env`: `REACT_APP_SERVER_URL` — `api/config.ts` throws at import if unset.

`server/src/logger.ts` (winston) always writes daily-rotated files under `LOG_PATH`; console output is added only when `NODE_ENV=development`. Prefer `logger` over `console.log` in server code.
