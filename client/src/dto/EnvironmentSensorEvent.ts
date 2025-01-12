export interface EnvironmentSensorEvent {
  id: number;
  data: {
    device_id: String
    humidity: number
    temperature: number
  }
}