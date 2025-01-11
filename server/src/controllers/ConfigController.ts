import { Request, Response } from "express";
import switchConfig from "../config/light-config.json";
import sensorConfig from "../config/sensor-config.json";
import { ConfigDto } from "../dto/ConfigDto"

export const getSensorConfig = (req: Request, res: Response) => {
  res.json(createConfigDto());
}

function createConfigDto(): ConfigDto {
  return {
    switches: switchConfig.map((config) => ({id: config.id, name: config.name})),
    sensors: sensorConfig.map((config) => ({id: config.id, name: config.name}))
  };
}