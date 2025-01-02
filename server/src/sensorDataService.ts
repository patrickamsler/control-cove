export interface SensorData {
  timestamp: number;
  value: number;
}

let sensorDataStorage: SensorData[] = [];

export function getAllSensorData(): SensorData[] {
  return sensorDataStorage;
}

export function addSensorData(data: SensorData): void {
  sensorDataStorage.push(data);
}