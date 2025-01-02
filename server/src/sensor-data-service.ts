export interface SensorData {
  device_id: String
  humidity: Number
  temperature: Number
}

let sensorDataStorage: Map<String, SensorData> = new Map();

export function addSensorData(topic: String, data: SensorData): void {
  sensorDataStorage.set(topic, data);
}