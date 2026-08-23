import CoveCard from "../CoveCard/CoveCard";
import { Box, Stack } from "@mui/material";
import DeviceThermostatIcon from '@mui/icons-material/DeviceThermostat';
import { SensorDto } from "@control-cove/shared";

type SensorDisplayProps = {
  sensors : SensorDto[];
}

const SensorDisplay: React.FC<SensorDisplayProps> = ({sensors}) => {

  function formatSensor(sensor: SensorDto) {
    return <>{sensor.temperature !== undefined ? sensor.temperature.toFixed(1) : '-'}°C
      / {sensor.humidity !== undefined ? sensor.humidity.toFixed(1) : '-'}% {sensor.name}</>;
  }

  return (
      <CoveCard title="Sensors">
        <Stack direction="column" spacing={2}>
          {sensors.map((sensor) => (
              <div key={sensor.id}>
                <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
                  <DeviceThermostatIcon color="primary"/>
                  <Box sx={{ mr: 2 }}>
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