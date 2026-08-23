import { vi } from 'vitest';

// Importing any service pulls in src/logger.ts, which builds a DailyRotateFile
// transport at import time. Mock it globally so tests never touch the filesystem.
vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Dummy broker credentials so MqttClient.connectToBroker() gets past its guard.
// Individual tests override or delete these as needed.
process.env.MQTT_URL = 'mqtt://localhost:1883';
process.env.MQTT_USERNAME = 'test-user';
process.env.MQTT_PASSWORD = 'test-password';
