import React, { useEffect, useState } from 'react';
import CoveCard from "../CoveCard/CoveCard";
import { Box, Stack, Typography } from "@mui/material";
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import { EnvironmentSensorDto } from "../../dto/EnvironmentSensorDto";

type SensorData = {
  temperature: string;
  humidity: string;
}

type SensorDisplayProps = {
  environmentSensors : EnvironmentSensorDto[];
}

const SensorDisplay: React.FC<SensorDisplayProps> = ({environmentSensors}) => {
  const [sensorData, setSensorData] = useState<SensorData[]>(
      environmentSensors.map(() => ({temperature: " - ", humidity: " - "}))
  );

  // useEffect(() => {
  //   sensorConfig.forEach((sensor, index) => {
  //     subscribeToTopic(sensor.statusTopic, (message) => {
  //       const data = JSON.parse(message);
  //       data.humidity = data.humidity.toFixed(1);
  //       data.temperature = data.temperature.toFixed(1);
  //       setSensorData((prevData) => {
  //         const newData = [...prevData];
  //         newData[index] = data;
  //         return newData;
  //       });
  //     });
  //   });
  // }, []);

  return (
      <CoveCard title="Sensors">
        <Stack direction="column" spacing={2}>
          {environmentSensors.map((sensor) => (
              <div key={sensor.id}>
                {/*<Typography variant="body1">*/}
                  <Box display="flex" alignItems="center" mb={2}>
                    <DeviceThermostatIcon color="primary" />
                    <Box mr={2}>
                      {sensor.temperature}°C / {sensor.humidity}% {sensor.name}
                    </Box>
                  </Box>
                {/*</Typography>*/}
              </div>
          ))}
        </Stack>
      </CoveCard>
  );
}

export default SensorDisplay;