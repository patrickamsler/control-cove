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