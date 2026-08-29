# Control Cove

[![Tests](https://github.com/patrickamsler/control-cove/actions/workflows/tests.yml/badge.svg)](https://github.com/patrickamsler/control-cove/actions/workflows/tests.yml)
[![Release](https://github.com/patrickamsler/control-cove/actions/workflows/release.yml/badge.svg)](https://github.com/patrickamsler/control-cove/actions/workflows/release.yml)

A small home-automation dashboard for MQTT devices: read temperature/humidity sensors
and switch lights on and off from the browser.

Built with TypeScript, React (client) and Node/Express + socket.io (server).

## Table of contents

- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Configuration](#configuration)
- [Devices](#devices)
- [Setup](#setup)
- [Commands](#commands)
- [Deployment](#deployment)
  - [Releases](#releases)
- [API](#api)

## Architecture

The server sends and receives MQTT events and is the only package that talks to the
MQTT broker. The web client communicates with the server through WebSockets and
REST; it does not connect to MQTT directly.

```text
┌─────────────┐       MQTT       ┌────────┐       REST/HTTP (read)       ┌────────────┐
│ MQTT broker │ <--------------> │ Server │ -------------------------->  │ Web client │
└─────────────┘                  │        │ <--------------------------> │            │
                                 └────────┘      WebSocket events        └────────────┘
```

The project contains three packages:

- `client/` — the React web client
- `server/` — the REST, WebSocket, and MQTT server
- `shared/` — shared DTO schemas and TypeScript types

Both `client` and `server` depend on `shared`, keeping their REST and WebSocket data
types consistent.

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

## Deployment

The whole app ships as a single Docker image: the Express server serves the compiled
React bundle from `server/public` alongside the API, so the browser talks to the origin it
loaded from — one process, one port, no CORS.

```bash
docker buildx build --platform linux/arm64 -t control-cove:latest --load .
docker run -p 8080:8080 \
  -e MQTT_URL=mqtt://broker:1883 -e MQTT_USERNAME=... -e MQTT_PASSWORD=... \
  -v control-cove-logs:/var/log/control-cove \
  control-cove:latest
```

The image reads its configuration from real environment variables, not a `.env` file:
`MQTT_URL`, `MQTT_USERNAME`, `MQTT_PASSWORD` are required; `HTTP_PORT` (8080),
`LOG_PATH` (`/var/log/control-cove`) and `LOG_LEVEL` have defaults.

`REACT_APP_SERVER_URL` is a **build-time** value baked into the bundle. The Dockerfile
defaults it to the empty string, which means "same origin". Point it somewhere else with
`--build-arg REACT_APP_SERVER_URL=https://…` only if the client is hosted separately.

`docker/docker-compose.yaml` runs the app together with a local Mosquitto broker
(`docker compose -f docker/docker-compose.yaml up --build`); bring up just the broker for
development with `docker compose -f docker/docker-compose.yaml up mosquitto`.

### Releases

Every push to `main` runs `.github/workflows/release.yml`: a semver git tag is derived from the
conventional-commit messages since the last tag (`feat:` → minor, `fix:` → patch,
`BREAKING CHANGE` → major, otherwise patch) and pushed as `vX.Y.Z`. The Docker image is
built for `linux/amd64` and `linux/arm64` and published to Docker Hub as
`patrickamsler/control-cove:X.Y.Z` and `patrickamsler/control-cove:latest`.

```bash
docker run -p 8080:8080 -e MQTT_URL=mqtt://broker:1883 patrickamsler/control-cove:latest
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
