import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LightControl from './components/LightControl/LightControl';
import { CssBaseline, Box, Grid } from '@mui/material';
import SensorDisplay from './components/SensorDisplay/SensorDisplay';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const App = () => {

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