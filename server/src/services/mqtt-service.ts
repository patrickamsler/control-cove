import mqtt, { MqttClient } from 'mqtt';

export class MqttService {

  private client?: MqttClient;
  private listeners: { [topic: string]: (message: string) => void } = {};

  connectToBroker = (onConnect?: () => void) => {
    if (!this.client) {
      if (!process.env.MQTT_USERNAME || !process.env.MQTT_PASSWORD) {
        throw new Error('Broker username and password are required');
      }
      const options = {
        username: process.env.MQTT_USERNAME,
        password: process.env.MQTT_PASSWORD,
      };
      try {
        const url = process.env.MQTT_URL as string;
        this.client = mqtt.connect(url, options);
        this.client.on('connect', () => {
          console.log('connected to MQTT broker')
          if (onConnect) {
            onConnect();
          }
        });
        this.client.on('message', (topic, message) => {
          if (this.listeners[topic]) {
            console.log(`Received message on topic ${topic}: ${message.toString()}`);
            this.listeners[topic](message.toString());
          }
        });
        this.client.on('error', (error) => {
          console.error(`MQTT connection error: ${error}`);
        });
      } catch (error) {
        console.error(`Failed to connect to MQTT broker: ${error}`);
      }
    }
  };

  disconnectFromBroker = () => {
    if (this.client && this.client.connected) {
      this.client.end();
    }
  };

  publishMessage = (topic: string, message: string) => {
    if (this.client && this.client.connected) {
      console.log(`Publishing message to topic ${topic}: ${message}`);
      this.client.publish(topic, message);
    }
  }

  subscribeToTopic = (topic: string, onMessage: (message: string) => void) => {
    if (this.client && this.client.connected) {
      console.log(`Subscribing to topic ${topic} ${Object.keys(this.listeners).length}`);
      this.client.subscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to subscribe to topic ${topic}: ${err}`);
        } else {
          console.log(`Successfully subscribed to topic ${topic}`);
          this.listeners[topic] = onMessage; // only store the latest listener
        }
      });
    }
  }

  unsubscribeFromTopic = (topic: string) => {
    if (this.client && this.client.connected) {
      this.client.unsubscribe(topic, (err) => {
        if (err) {
          console.error(`Failed to unsubscribe from topic ${topic}: ${err}`);
        } else {
          console.log(`Successfully unsubscribed from topic ${topic}`);
        }
      });
      delete this.listeners[topic]; // remove the listener
    }
  }
}