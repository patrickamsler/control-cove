import React, { useEffect, useState } from 'react';
import { FormControlLabel, Switch, Stack } from '@mui/material';
import CoveCard from "../CoveCard/CoveCard";
import { SwitchConfigDto } from "../../dto/SwitchConfigDto";


interface LightControlProps {
  switchConfigs: SwitchConfigDto[];
}

const LightControl: React.FC<LightControlProps> = ({ switchConfigs }) => {
  const [switchStates, setSwitchStates] = useState(
      switchConfigs.map(() => false)
  );

  // useEffect(() => {
  //     subscribeToTopics();
  //   return () => {
  //     unsubscribeFromTopics();
  //   };
  // }, []);
  //
  // const subscribeToTopics = () => {
  //   lightConfig.forEach((light, index) => {
  //     subscribeToTopic(light.stateTopic, (message) => {
  //       setSwitchStates((prevStates) => {
  //         const newStates = [...prevStates];
  //         newStates[index] = message === 'on';
  //         return newStates;
  //       });
  //     });
  //   });
  // }
  //
  // const unsubscribeFromTopics = () => {
  //   lightConfig.forEach((light) => {
  //     unsubscribeFromTopic(light.stateTopic);
  //   });
  // }

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>, index: number) => {
    // const switchState = event.target.checked;
    // setSwitchStates((prevStates) => {
    //   const newStates = [...prevStates];
    //   newStates[index] = switchState;
    //   return newStates;
    // });
    // publishMessage(commandTopic, switchState ? 'on' : 'off');
  };

  return (
      <CoveCard title={'Light'}>
          <Stack direction="column" spacing={2}>
            {switchConfigs.map((switchConfig) => (
                <FormControlLabel
                    control={
                      <Switch
                          checked={false}
                          onChange={(event) => handleSwitchChange(event, switchConfig.id)}
                          name={`Switch ${switchConfig.id}`}
                      />
                    }
                    label={switchConfig.name}
                    key={switchConfig.id}
                />
            ))}
          </Stack>
      </CoveCard>
  );
}

export default LightControl;