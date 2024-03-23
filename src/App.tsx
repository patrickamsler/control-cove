import React, { useEffect } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LightControl from './components/LightControl/LightControl';
import { CssBaseline, Box } from '@mui/material';
import { connectToBroker, disconnectFromBroker } from "./services/mqttClient";

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const App = () => {

  // useEffect(() => {
  //   connectToBroker();
  //   return () => {
  //     disconnectFromBroker();
  //   };
  // }, []);

  return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box padding={2}>
          <LightControl />
        </Box>
      </ThemeProvider>
  );
}

export default App;