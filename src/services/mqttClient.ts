import mqtt, { MqttClient } from 'mqtt';


let client: MqttClient;

export const connectToBroker = (onConnect?: () => void) => {
  if (!client) {
    const options = {
      username: 'iot',
      password: 'watt-timbrel-pepper-biology'
    };
    client = mqtt.connect('ws://192.168.1.2:9001', options);
    client.on('connect', () => {
      console.log('connected to MQTT broker')
      if (onConnect) {
        onConnect();
      }
    });
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
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to topic ${topic}: ${err}`);
      } else {
        console.log(`Successfully subscribed to topic ${topic}`);
      }
    });

    client.on('message', (receivedTopic, message) => {
      console.log(`Received message on topic ${receivedTopic}: ${message.toString()}`);
      if (receivedTopic === topic) {
        onMessage(message.toString());
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
  }
}