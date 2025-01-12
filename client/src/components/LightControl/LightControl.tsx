import React, { useEffect, useState } from 'react';
import { FormControlLabel, Switch, Stack } from '@mui/material';
import CoveCard from "../CoveCard/CoveCard";
import { SwitchDto } from "../../dto/SwitchDto";


interface LightControlProps {
  switches: SwitchDto[];
  actionHandler: (id: number, state: boolean) => void;
}

const LightControl: React.FC<LightControlProps> = ({ switches, actionHandler }) => {
  return (
      <CoveCard title={'Light'}>
          <Stack direction="column" spacing={2}>
            {switches.map((sw) => (
                <FormControlLabel
                    control={
                      <Switch
                          checked={sw.state}
                          onChange={(event) => actionHandler(sw.id, event.target.checked)}
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