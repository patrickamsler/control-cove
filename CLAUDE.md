# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

All commands run from the repo root unless noted.

```bash
npm run install:all      # install deps in both client/ and server/
npm start                # concurrently: CRA dev server (client) + ts-node-dev (server)
npm run start:client     # CRA only, port 3000
npm run start:server     # server only (ts-node-dev --respawn --transpile-only)
npm run build            # client CRA build + server tsc -> server/dist
npm test                 # both suites: client then server
npm run test:client      # CRA/Jest tests in client/
npm run test:server      # Vitest tests in server/
```

Single test (from `client/`): `npm test -- -t "test name"` or `npm test -- App.test.tsx`.

Server tests use **Vitest**, colocated as `src/**/*.test.ts`:

```bash
npm test --prefix server                        # vitest run
npm run test:watch --prefix server              # watch mode
npm run test:coverage --prefix server           # v8 coverage
npm run test:types --prefix server              # tsc --noEmit over src + tests
npm test --prefix server -- -t "test name"      # single test
```

Test files are excluded from `tsconfig.json` so `npm run build --prefix server` never emits them into `dist/`; `tsconfig.test.json` type-checks them instead. `src/test/setup.ts` globally mocks `src/logger.ts` (its `DailyRotateFile` transport would otherwise write real files on import) and sets dummy `MQTT_*` env vars. Service and controller tests mock `../config/devices` with the fixtures in `src/test/fixtures.ts`, so they do not break when the real device lists change. `WebSocketService` has no tests — it constructs a `socket.io` `Server` in its constructor with no injection seam. There is no lint script in `server/`.

Local MQTT broker for development: `docker compose -f docker/docker-compose.yaml up` (Mosquitto, 1883 MQTT / 9001 WebSocket).

## Architecture

Two-package monorepo (no workspaces — each of `client/` and `server/` has its own `package.json` and `tsconfig.json`).

**The server is the only MQTT participant.** The browser never talks to the broker. Data flows:

```
MQTT broker <-> server/MqttService <-> SensorDataService / ActorService <-> WebSocketService (socket.io) <-> React App.tsx
```

Wiring happens in `server/src/index.ts`: services are constructed manually and injected by hand (no DI container). MQTT topic subscriptions and websocket handlers are registered only inside the `connectToBroker` callback, so nothing is wired until the first successful broker connection.

- `MqttService` — single mqtt client, one listener per topic (later `subscribeToTopic` on the same topic replaces the previous listener). Sessions are clean, so it tracks `connectedBefore` and re-subscribes all stored topics on reconnect rather than re-running the `onConnect` wiring.
- `SensorDataService` — subscribes to config-defined topics, keeps latest readings in in-memory `Map`s (nothing is persisted; state is empty after restart until devices publish), and emits `sensor` / `switch` events. On each new socket connection it emits `initial` with a snapshot of both maps.
- `ActorService` — inbound direction only: listens for the `updateSwitch` socket event and publishes `on`/`off` to the switch's `commandTopic`.
- `SensorDataController` — `GET /api/sensors`, builds the DTO shape from the JSON config files and overlays whatever live state exists.

**Socket event contract** (typed in `WebSocketService`): emitted `switch` | `sensor` | `initial`; received `updateSwitch`. Changing these requires matching edits in `client/src/App.tsx`.

**Devices are configured, not discovered.** `server/src/config/sensor-config.json` (id, name, statusTopic) and `switch-config.json` (id, name, commandTopic, stateTopic) hold the raw device lists; `server/src/config/devices.ts` loads both, validates them at startup (unique ids, non-empty topics), and exports typed `switches` / `sensors` arrays plus `findSwitchById(id)` / `findSensorById(id)` lookups. `SensorDataController`, `ActorService`, and `SensorDataService` all import from `devices.ts`, never the JSON files directly. Adding a device means editing the JSON files; the numeric `id` is the key used across REST, websocket events and the storage maps. Switch state topics carry the plain strings `on`/`off`; sensor status topics carry JSON with numeric `temperature`/`humidity` (malformed payloads are logged and dropped in `parseSensorPayload`).

**DTOs are duplicated**, not shared: `client/src/dto/` and `server/src/dto/` hold parallel copies. Keep them in sync manually when changing the API shape.

## Configuration

Env files are gitignored; `.env` and `.env.production` exist in both packages.

- `server/.env`: `HTTP_PORT`, `MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD`, `NODE_ENV`, `LOG_PATH`, optional `LOG_LEVEL`.
- `client/.env`: `REACT_APP_SERVER_URL` — App.tsx throws at render if unset.

`server/src/logger.ts` (winston) always writes daily-rotated files under `LOG_PATH`; console output is added only when `NODE_ENV=development`. Prefer `logger` over `console.log` in server code.
