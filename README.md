# Control Cove

A small home-automation dashboard for MQTT devices: read temperature/humidity sensors
and switch lights on and off from the browser.

Built with TypeScript, React (client) and Node/Express + socket.io (server).

## Architecture

The **server** is the only MQTT participant — the browser never talks to the broker:

```
MQTT broker <-> server (MqttService) <-> socket.io <-> React client
```

Two packages, each with its own `package.json`:

- `client/` — React app
- `server/` — Express + socket.io + MQTT client

## Prerequisites

* Node.js and npm
* An MQTT broker (for local development: `docker compose -f docker/docker-compose.yaml up`
  starts Mosquitto on 1883 MQTT / 9001 WebSocket)

## Configuration

Create the env files (they are gitignored):

`server/.env`
```
HTTP_PORT=8080
MQTT_URL=mqtt://192.168.1.2:1883
MQTT_USERNAME=<your-username>
MQTT_PASSWORD=<your-password>
NODE_ENV=development
LOG_PATH=./logs
LOG_LEVEL=info
```

`client/.env`
```
REACT_APP_SERVER_URL=http://localhost:8080
```

## Devices

Devices are configured, not discovered. Edit:

- `server/src/config/sensor-config.json` — `id`, `name`, `statusTopic`
  (payload: JSON with numeric `temperature` / `humidity`)
- `server/src/config/light-config.json` — `id`, `name`, `commandTopic`, `stateTopic`
  (payload: the plain strings `on` / `off`)

## Setup

```bash
git clone <repository-url>
cd control-cove
npm run install:all
npm start          # client on :3000, server on HTTP_PORT
```

## Commands

```bash
npm run install:all    # install deps in client/ and server/
npm start              # run client and server together
npm run start:client   # client only
npm run start:server   # server only
npm run build          # build client + compile server to server/dist
npm test               # client tests
```

## API

- `GET /api/sensors` — current sensors and switches
- socket.io events — emitted: `initial`, `sensor`, `switch`; received: `updateSwitch`

State is kept in memory only; it is empty after a restart until devices publish again.
