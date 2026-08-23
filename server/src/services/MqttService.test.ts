import { EventEmitter } from 'events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import mqtt from 'mqtt';
import { MqttService } from './MqttService';

vi.mock('mqtt', () => ({ default: { connect: vi.fn() } }));

class FakeMqttClient extends EventEmitter {
  connected = false;
  publish = vi.fn((_topic: string, _message: string, callback?: (err?: Error) => void) => callback?.());
  subscribe = vi.fn((_topic: string, callback?: (err?: Error) => void) => callback?.());
  unsubscribe = vi.fn((_topic: string, callback?: (err?: Error) => void) => callback?.());
  end = vi.fn(() => {
    this.connected = false;
  });

  goOnline() {
    this.connected = true;
    this.emit('connect');
  }
}

const connectMock = vi.mocked(mqtt.connect);

let client: FakeMqttClient;
let service: MqttService;

beforeEach(() => {
  client = new FakeMqttClient();
  connectMock.mockReset();
  connectMock.mockReturnValue(client as unknown as ReturnType<typeof mqtt.connect>);
  service = new MqttService();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('MqttService.connectToBroker', () => {
  it.each(['MQTT_USERNAME', 'MQTT_PASSWORD'])('throws when %s is missing', (variable) => {
    vi.stubEnv(variable, '');

    expect(() => service.connectToBroker()).toThrow('Broker username and password are required');
    expect(connectMock).not.toHaveBeenCalled();
  });

  it('connects to the configured url with the configured credentials', () => {
    service.connectToBroker();

    expect(connectMock).toHaveBeenCalledExactlyOnceWith('mqtt://localhost:1883', {
      username: 'test-user',
      password: 'test-password',
    });
  });

  it('does not create a second client on a repeated call', () => {
    service.connectToBroker();
    service.connectToBroker();

    expect(connectMock).toHaveBeenCalledTimes(1);
  });

  it('runs the onConnect callback once the broker connects', () => {
    const onConnect = vi.fn();
    service.connectToBroker(onConnect);
    expect(onConnect).not.toHaveBeenCalled();

    client.goOnline();

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('swallows a connection error instead of crashing the process', () => {
    service.connectToBroker();

    expect(() => client.emit('error', new Error('boom'))).not.toThrow();
  });
});

describe('MqttService reconnect behaviour', () => {
  it('does not re-run onConnect on a reconnect', () => {
    const onConnect = vi.fn();
    service.connectToBroker(onConnect);
    client.goOnline();

    client.goOnline();

    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it('restores all stored subscriptions after a reconnect', () => {
    service.connectToBroker();
    client.goOnline();
    service.subscribeToTopic('topic/a', vi.fn());
    service.subscribeToTopic('topic/b', vi.fn());
    client.subscribe.mockClear();

    client.goOnline();

    expect(client.subscribe).toHaveBeenCalledTimes(2);
    expect(client.subscribe).toHaveBeenCalledWith('topic/a', expect.any(Function));
    expect(client.subscribe).toHaveBeenCalledWith('topic/b', expect.any(Function));
  });

  it('subscribes to nothing on reconnect when no topics are stored', () => {
    service.connectToBroker();
    client.goOnline();

    client.goOnline();

    expect(client.subscribe).not.toHaveBeenCalled();
  });
});

describe('MqttService subscriptions', () => {
  beforeEach(() => {
    service.connectToBroker();
    client.goOnline();
  });

  it('subscribes on the client and routes matching messages to the listener', () => {
    const onMessage = vi.fn();
    service.subscribeToTopic('topic/a', onMessage);

    expect(client.subscribe).toHaveBeenCalledWith('topic/a', expect.any(Function));

    client.emit('message', 'topic/a', Buffer.from('hello'));

    expect(onMessage).toHaveBeenCalledExactlyOnceWith('hello');
  });

  it('keeps only the latest listener for a topic', () => {
    const first = vi.fn();
    const second = vi.fn();
    service.subscribeToTopic('topic/a', first);
    service.subscribeToTopic('topic/a', second);

    client.emit('message', 'topic/a', Buffer.from('hello'));

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledExactlyOnceWith('hello');
  });

  it('ignores messages on topics without a listener', () => {
    const onMessage = vi.fn();
    service.subscribeToTopic('topic/a', onMessage);

    expect(() => client.emit('message', 'topic/unknown', Buffer.from('hello'))).not.toThrow();
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('unsubscribes on the client and stops routing messages', () => {
    const onMessage = vi.fn();
    service.subscribeToTopic('topic/a', onMessage);

    service.unsubscribeFromTopic('topic/a');

    expect(client.unsubscribe).toHaveBeenCalledWith('topic/a', expect.any(Function));
    client.emit('message', 'topic/a', Buffer.from('hello'));
    expect(onMessage).not.toHaveBeenCalled();
  });

  it('does not restore an unsubscribed topic after a reconnect', () => {
    service.subscribeToTopic('topic/a', vi.fn());
    service.unsubscribeFromTopic('topic/a');
    client.subscribe.mockClear();

    client.goOnline();

    expect(client.subscribe).not.toHaveBeenCalled();
  });
});

describe('MqttService publishing', () => {
  it('publishes to the given topic once connected', () => {
    service.connectToBroker();
    client.goOnline();

    service.publishMessage('topic/a', 'on');

    expect(client.publish).toHaveBeenCalledWith('topic/a', 'on', expect.any(Function));
  });

  it('reports a publish failure without throwing', () => {
    service.connectToBroker();
    client.goOnline();
    client.publish.mockImplementationOnce((_topic, _message, callback) => callback?.(new Error('nope')));

    expect(() => service.publishMessage('topic/a', 'on')).not.toThrow();
  });

  it('does nothing when publishing before the client exists', () => {
    expect(() => service.publishMessage('topic/a', 'on')).not.toThrow();
    expect(client.publish).not.toHaveBeenCalled();
  });

  it('does nothing when subscribing before the client exists', () => {
    expect(() => service.subscribeToTopic('topic/a', vi.fn())).not.toThrow();
    expect(client.subscribe).not.toHaveBeenCalled();
  });
});

describe('MqttService.disconnectFromBroker', () => {
  it('ends the client when it is connected', () => {
    service.connectToBroker();
    client.goOnline();

    service.disconnectFromBroker();

    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it('does not end a client that is not connected', () => {
    service.connectToBroker();

    service.disconnectFromBroker();

    expect(client.end).not.toHaveBeenCalled();
  });

  it('is a no-op when no client was ever created', () => {
    expect(() => service.disconnectFromBroker()).not.toThrow();
  });
});
