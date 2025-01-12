import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LightControl from './components/LightControl/LightControl';
import { CssBaseline, Box, Grid } from '@mui/material';
import SensorDisplay from './components/SensorDisplay/SensorDisplay';
import { ConfigDto } from "./dto/ConfigDto";
import io, { Socket } from 'socket.io-client';

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
  const [configData, setConfigData] = useState<null | ConfigDto>(null);
  const [error, setError] = useState<null | string>(null)

  useEffect(() => {
    const fetchData = async () => {
        const response = await fetch(`${serverUrl}/api/config`);
        if (!response.ok) {
          setError(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setConfigData(result);
      }

      fetchData();
  }, []);

  useEffect(() => {
    const socket = io(serverUrl);
    socket.on('initial', (message: any) => {
      console.log(JSON.stringify(message, null, 2));
    });
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }
  if (!configData) {
    return <div>Loading...</div>;
  }

  return (
      <ThemeProvider theme={theme}>
        <CssBaseline/>
        <Box padding={2}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <LightControl
                  switchConfigs={configData.switches}
              />
            </Grid>
            <Grid item xs={6}>
              <SensorDisplay
                  sensorConfigs={configData.sensors}
              />
            </Grid>
          </Grid>
        </Box>
      </ThemeProvider>
  );
}

export default App;