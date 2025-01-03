import mqtt, { MqttClient } from 'mqtt';
import brokerConfig from '../config/broker-config.json';

let client: MqttClient;
const listeners: { [topic: string]: (message: string) => void } = {};

export const connectToBroker = (onConnect?: () => void) => {
  if (!client) {
    if (!brokerConfig.username || !brokerConfig.password) {
      throw new Error('Broker username and password are required');
    }
    const options = {
      username: brokerConfig.username,
      password: brokerConfig.password,
    };
    try {
      // read the broker URL from the config file
      const url = brokerConfig.host + ':' + brokerConfig.port;
      client = mqtt.connect(url, options);
      client.on('connect', () => {
        console.log('connected to MQTT broker')
        if (onConnect) {
          onConnect();
        }
      });
      client.on('message', (topic, message) => {
        if (listeners[topic]) {
          console.log(`Received message on topic ${topic}: ${message.toString()}`);
          listeners[topic](message.toString());
        }
      });
      client.on('error', (error) => {
        console.error(`MQTT connection error: ${error}`);
      });
    } catch (error) {
      console.error(`Failed to connect to MQTT broker: ${error}`);
    }
  }
  return client;
};

export const disconnectFromBroker = () => {
  if (client.connected) {
    client.end();
  }
};

export const publishMessage = (topic: string, message: string) => {
  if (client.connected) {
    console.log(`Publishing message to topic ${topic}: ${message}`);
    client.publish(topic, message);
  }
}

export const subscribeToTopic = (topic: string, onMessage: (message: string) => void) => {
  if (client.connected) {
    console.log(`Subscribing to topic ${topic} ${Object.keys(listeners).length}`);
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to topic ${topic}: ${err}`);
      } else {
        console.log(`Successfully subscribed to topic ${topic}`);
        listeners[topic] = onMessage; // only store the latest listener
      }
    });
  }
}

export const unsubscribeFromTopic = (topic: string) => {
  if (client.connected) {
    client.unsubscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to unsubscribe from topic ${topic}: ${err}`);
      } else {
        console.log(`Successfully unsubscribed from topic ${topic}`);
      }
    });
    delete listeners[topic]; // remove the listener
  }
}