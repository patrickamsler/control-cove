import { SwitchConfigDto } from "./SwitchConfigDto";
import { SensorConfigDto } from "./SensorConfigDto";

export interface ConfigDto {
  switches: SwitchConfigDto[],
  sensors: SensorConfigDto[]
}