import { Request, Response } from "express";
import switchConfig from "../config/light-config.json";
import sensorConfig from "../config/sensor-config.json";
import { SensorDataDto } from "../dto/SensorDataDto"
import { SensorDataService } from "../services/SensorDataService";

export class SensorDataController {
  constructor(private sensorDataService: SensorDataService) {
  }

  public getSensorData = (req: Request, res: Response) => {
    const sensorData = this.createSensorDataDtoFromConfig();
    this.addCurrentState(sensorData);
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
      switches: switchConfig.map((config) => ({id: config.id, name: config.name})),
      environmentSensors: sensorConfig.map((config) => ({id: config.id, name: config.name}))
    };
  }
}