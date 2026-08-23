import { Request, Response } from "express";
import { sensors, switches } from "../config/devices";
import { SensorDataDto } from "../dto/SensorDataDto"
import { SensorDataService } from "../services/SensorDataService";

export class SensorDataController {
  constructor(private sensorDataService: SensorDataService) {
  }

  public getSensorData = (req: Request, res: Response) => {
    const sensorData = this.createSensorDataDtoFromConfig();
    this.addCurrentState(sensorData); // TODO : Should this be omitted entirely if no state has been received yet? (See comment in SensorDataController.addCurrentState)
    res.json(sensorData);
  }

  private addCurrentState = (sensorData: SensorDataDto) => {
    sensorData.switches.forEach((switchData) => {
      const switchState = this.sensorDataService.getSwitchData(switchData.id);
      if (switchState) {
        switchData.state = switchState.state;
      }
    });
    sensorData.environmentSensors.forEach((sensorData) => {
      const sensorState = this.sensorDataService.getSensorData(sensorData.id);
      if (sensorState) {
        sensorData.temperature = sensorState.temperature;
        sensorData.humidity = sensorState.humidity;
      }
    });
  }

  private createSensorDataDtoFromConfig(): SensorDataDto {
    return {
      switches: switches.map((config) => ({id: config.id, name: config.name})),
      environmentSensors: sensors.map((config) => ({id: config.id, name: config.name}))
    };
  }
}