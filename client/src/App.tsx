import React, { useEffect, useState } from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import LightControl from './components/LightControl/LightControl';
import { Box, CssBaseline, Grid } from '@mui/material';
import SensorDisplay from './components/SensorDisplay/SensorDisplay';
import io from 'socket.io-client';
import { EnvironmentSensorDto } from "./dto/EnvironmentSensorDto";
import { SwitchDto } from "./dto/SwitchDto";
import { SwitchEvent } from "./dto/SwitchEvent";
import { EnvironmentSensorEvent } from "./dto/EnvironmentSensorEvent";

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const App = () => {
  const serverUrl = process.env.REACT_APP_SERVER_URL;
  if (!serverUrl) {
    throw new Error('REACT_APP_SERVER_URL is not set');
  }
  const [environmentSensors, setEnvironmentSensors] = useState<null | EnvironmentSensorDto[]>(null);
  const [switches, setSwitches] = useState<null | SwitchDto[]>(null);
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    const fetchData = async () => {
        const response = await fetch(`${serverUrl}/api/sensors`);
        if (!response.ok) {
          setError(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setEnvironmentSensors(result.environmentSensors);
        setSwitches(result.switches);
      }

      fetchData();
  }, []);

  const updateSwitches = (message: SwitchEvent) => {
    setSwitches((prevSwitches) => {
      if (!prevSwitches) {
        return prevSwitches;
      }
      return prevSwitches.map((sw) => {
        if (sw.id === message.id) {
          return {...sw, state: message.data.state};
        }
        return sw;
      });
    });
  }

  const updateSensorData = (message: EnvironmentSensorEvent) => {
    setEnvironmentSensors((prevSensors) => {
      if (!prevSensors) {
        return prevSensors;
      }
      return prevSensors.map((sensor) => {
        if (sensor.id === message.id) {
          return {...sensor, temperature: message.data.temperature, humidity: message.data.humidity};
        }
        return sensor;
      });
    });
  }

  useEffect(() => {
    const socket = io(serverUrl);
    socket.on('switch', (message: SwitchEvent) => {
      updateSwitches(message);
    });
    socket.on('sensor', (message: EnvironmentSensorEvent) => {
      updateSensorData(message);
    });
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!switches || !environmentSensors) {
    return <div>Loading...</div>;
  }

  return (
      <ThemeProvider theme={theme}>
        <CssBaseline/>
        <Box padding={2}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <LightControl
                  switches={switches}
              />
            </Grid>
            <Grid item xs={6}>
              <SensorDisplay
                  environmentSensors={environmentSensors}
              />
            </Grid>
          </Grid>
        </Box>
      </ThemeProvider>
  );
}

export default App;