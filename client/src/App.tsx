import React, { useEffect, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LightControl from './components/LightControl/LightControl';
import { CssBaseline, Box, Grid } from '@mui/material';
import SensorDisplay from './components/SensorDisplay/SensorDisplay';
import { connectToBroker, disconnectFromBroker } from "./services/mqttClient";

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const App = () => {

  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    connectToBroker(() => {
      setIsConnected(true);
    });
    return () => {
      disconnectFromBroker();
      setIsConnected(false);
    };
  }, []);

  if (!isConnected) {
    return <div>Connecting to MQTT broker...</div>;
  }

  return (
      <ThemeProvider theme={theme}>
        <CssBaseline/>
        <Box padding={2}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <LightControl/>
            </Grid>
            <Grid item xs={6}>
              <SensorDisplay/>
            </Grid>
          </Grid>
        </Box>
      </ThemeProvider>
  );
}

export default App;