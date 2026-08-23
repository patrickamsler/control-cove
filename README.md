# Control Cove

A small home-automation dashboard for MQTT devices: read temperature/humidity sensors
and switch lights on and off from the browser.

Built with TypeScript, React (client) and Node/Express + socket.io (server).

## Architecture

The **server** is the only MQTT participant — the browser never talks to the broker:

```
                      ┌─ http/  (REST + Swagger) ─┐
MQTT broker <-> mqtt/ ─┼─ domain/DeviceService ────┼─> React client
                      └─ ws/    (socket.io) ──────┘
```

`server/src` is layered: `domain/` owns the devices and their state and knows nothing
about transports, while `mqtt/`, `http/` and `ws/` are adapters over it.

Three packages, each with its own `package.json`:

- `shared/` — the DTOs: zod schemas plus the types inferred from them
- `client/` — React app
- `server/` — Express + socket.io + MQTT client

`client` and `server` both depend on `shared` (via `file:../shared`), so the REST
responses and socket events are defined once and type-checked on both sides.

## Prerequisites

* Node.js and npm
* An MQTT broker (for local development: `docker compose -f docker/docker-compose.yaml up`
  starts Mosquitto on 1883 MQTT / 9001 WebSocket)

## Configuration

Create the env files (they are gitignored):

`server/.env`
```
HTTP_PORT=3001
MQTT_URL=mqtt://192.168.1.2:1883
MQTT_USERNAME=<your-username>
MQTT_PASSWORD=<your-password>
NODE_ENV=development
LOG_PATH=./logs
LOG_LEVEL=info
```

`client/.env`
```
REACT_APP_SERVER_URL=http://localhost:3001
```

## Devices

Devices are configured, not discovered. Edit:

- `server/src/domain/sensor-config.json` — `id`, `name`, `statusTopic`
  (payload: JSON with numeric `temperature` / `humidity`)
- `server/src/domain/switch-config.json` — `id`, `name`, `commandTopic`, `stateTopic`
  (payload: the plain strings `on` / `off`; anything else is logged and ignored)

Both files are loaded, validated with zod (unique ids, non-empty topics), and exposed
as typed `switches` / `sensors` arrays plus `findSwitchById` / `findSensorById` lookups
by `server/src/domain/devices.ts`. Consumers import from there instead of the JSON
files. Ids are unique within a device type only — switch 1 and sensor 1 are different
devices.

## Setup

```bash
git clone <repository-url>
cd control-cove
npm run install:all
npm start          # client on :3000, server on HTTP_PORT
```

`shared/` is compiled to `shared/dist` (CommonJS for the server, ESM for the client's
bundler), which the other two packages import — so it is built first by `install:all`
and `build`. `npm start` runs `tsc -w` on it alongside the
apps; if you run the apps individually, re-run `npm run build:shared` after editing it.

## Commands

```bash
npm run install:all    # install deps in shared/, client/ and server/
npm start              # run all three together
npm run start:client   # client only
npm run start:server   # server only
npm run start:shared   # shared in watch mode only
npm run build          # build shared + client, compile server to server/dist
npm run build:shared   # shared only
npm test               # client and server tests
```

## API

- `GET /api/switches` — all configured switches with their latest known state
- `GET /api/sensors` — all configured sensors with their latest reading
- `GET /api-docs` — Swagger UI (the OpenAPI document itself is at `/api-docs.json`)
- socket.io events — emitted: `initial`, `sensor`, `switch`; received: `updateSwitch`

REST and socket.io carry the same DTOs, defined in `shared/`: the endpoints return
arrays of them, the events carry one device at a time. The OpenAPI schemas are
generated from those same zod schemas, so the docs cannot drift from the payloads.

State is kept in memory only; it is empty after a restart until devices publish again,
and `state` / `temperature` / `humidity` are simply absent until then.
