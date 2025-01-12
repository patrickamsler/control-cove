import React, { useEffect, useState } from 'react';
import { FormControlLabel, Switch, Stack } from '@mui/material';
import CoveCard from "../CoveCard/CoveCard";
import { SwitchDto } from "../../dto/SwitchDto";


interface LightControlProps {
  switches: SwitchDto[];
}

const LightControl: React.FC<LightControlProps> = ({ switches }) => {
  return (
      <CoveCard title={'Light'}>
          <Stack direction="column" spacing={2}>
            {switches.map((sw) => (
                <FormControlLabel
                    control={
                      <Switch
                          checked={sw.state}
                          // onChange={(event) => handleSwitchChange(event, sw.id)}
                          name={`Switch ${sw.id}`}
                      />
                    }
                    label={sw.name}
                    key={sw.id}
                />
            ))}
          </Stack>
      </CoveCard>
  );
}

export default LightControl;