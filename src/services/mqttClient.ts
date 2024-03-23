import mqtt, { MqttClient } from 'mqtt';


let client: MqttClient;

export const connectToBroker = () => {
  if (!client) {
    const options = {
      username: 'iot',
      password: 'watt-timbrel-pepper-biology'
    };
    client = mqtt.connect('ws://192.168.1.2:9001', options);
    client.on('connect', () =>
        console.log('connected to MQTT broker')
    );
  }
  return client;
};

export const disconnectFromBroker = () => {
  if (client) {
    client.end();
  }
};

export const publishMessage = (topic: string, message: string) => {
  if (client) {
    client.publish(topic, message);
  }
}

export const subscribeToTopic = (topic: string, onMessage: (message: string) => void) => {
  if (client) {
    client.subscribe(topic, (err) => {
      if (err) {
        console.error(`Failed to subscribe to topic ${topic}: ${err}`);
      } else {
        console.log(`Successfully subscribed to topic ${topic}`);
      }
    });

    client.on('message', (receivedTopic, message) => {
      if (receivedTopic === topic) {
        onMessage(message.toString());
      }
    });
  }
}