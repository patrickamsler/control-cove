import { SwitchConfigDto } from "./switch-config-dto";
import { SensorConfigDto } from "./sensor-config-dto";

export interface ConfigDto {
  switches: SwitchConfigDto[],
  sensors: SensorConfigDto[]
}