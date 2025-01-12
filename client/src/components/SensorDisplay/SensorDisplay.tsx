import React, { useEffect, useState } from 'react';
import CoveCard from "../CoveCard/CoveCard";
import { Box, Stack, Typography } from "@mui/material";
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import { EnvironmentSensorDto } from "../../dto/EnvironmentSensorDto";

type SensorDisplayProps = {
  environmentSensors : EnvironmentSensorDto[];
}

const SensorDisplay: React.FC<SensorDisplayProps> = ({environmentSensors}) => {

  function formatSensor(sensor: EnvironmentSensorDto) {
    return <>{sensor.temperature !== undefined ? sensor.temperature.toFixed(1) : '-'}°C
      / {sensor.humidity !== undefined ? sensor.humidity.toFixed(1) : '-'}% {sensor.name}</>;
  }

  return (
      <CoveCard title="Sensors">
        <Stack direction="column" spacing={2}>
          {environmentSensors.map((sensor) => (
              <div key={sensor.id}>
                <Box display="flex" alignItems="center" mb={2}>
                  <DeviceThermostatIcon color="primary"/>
                  <Box mr={2}>
                    {formatSensor(sensor)}
                  </Box>
                </Box>
              </div>
          ))}
        </Stack>
      </CoveCard>
  );
}

export default SensorDisplay;