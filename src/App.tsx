import React from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import LightControl from './components/LightControl';
import { CssBaseline, Box } from '@mui/material';

const theme = createTheme({
  palette: {
    mode: 'dark',
  },
});

const App = () => {
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