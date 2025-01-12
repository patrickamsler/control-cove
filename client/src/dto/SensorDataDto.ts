import { SwitchDto } from "./SwitchDto";
import { EnvironmentSensorDto } from "./EnvironmentSensorDto";

export interface SensorDataDto {
  switches: SwitchDto[],
  environmentSensors: EnvironmentSensorDto[]
}