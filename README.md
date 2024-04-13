# Control Cove

Control Cove is a project developed using TypeScript and React. It is designed to control IoT devices using MQTT protocol directly from the browser.

## Prerequisites
* Node.js and npm installed on your machine.
* An MQTT broker available for connection.

## Configuration
Before you can run the project, you need to set up the MQTT broker configuration.
Create a broker-config.json file in the src/config directory.

```json
{
  "host": "ws://192.168.1.2",
  "port": 9001,
  "username": "<your-username>",
  "password": "<your-password>"
}
```

## Setup

1. Clone the repository to your local machine.
```bash
git clone <repository-url>
cd control-cove
npm install
npm run build
```

2. Start the development server.
```bash
npm start
```