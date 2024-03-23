import React from 'react';
import { Card, CardContent, FormControlLabel, Switch, Stack } from '@mui/material';

const LightControl = () => {
  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log(`Switch with label ${event.target.name} is now ${event.target.checked ? 'On' : 'Off'}`);
  };

  return (
      <Card>
        <CardContent>
          <Stack direction="column" spacing={2}>
            <FormControlLabel
                control={<Switch onChange={handleSwitchChange} name="Switch 1" />}
                label="Switch 1"
            />
            <FormControlLabel
                control={<Switch onChange={handleSwitchChange} name="Switch 2" />}
                label="Switch 2"
            />
          </Stack>
        </CardContent>
      </Card>
  );
}

export default LightControl;