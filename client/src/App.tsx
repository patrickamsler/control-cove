import React from 'react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { Box, CssBaseline, Grid } from '@mui/material';
import LightControl from './components/LightControl/LightControl';
import SensorDisplay from './components/SensorDisplay/SensorDisplay';
import { useDevices } from './hooks/useDevices';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const App = () => {
  const { switches, sensors, error, loading, setSwitch } = useDevices();

  if (error) {
    return <div>Error: {error}</div>;
  }
  if (loading || !switches || !sensors) {
    return <div>Loading...</div>;
  }

  return (
      <ThemeProvider theme={theme}>
        <CssBaseline/>
        <Box sx={{ p: 2 }}>
          <Grid container spacing={2}>
            <Grid size={6}>
              <LightControl
                  switches={switches}
                  actionHandler={setSwitch}
              />
            </Grid>
            <Grid size={6}>
              <SensorDisplay
                  sensors={sensors}
              />
            </Grid>
          </Grid>
        </Box>
      </ThemeProvider>
  );
}

export default App;
