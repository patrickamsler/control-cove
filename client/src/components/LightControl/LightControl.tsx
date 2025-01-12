import React, { useEffect, useState } from 'react';
import { FormControlLabel, Switch, Stack } from '@mui/material';
import CoveCard from "../CoveCard/CoveCard";
import { SwitchDto } from "../../dto/SwitchDto";


interface LightControlProps {
  switches: SwitchDto[];
}

const LightControl: React.FC<LightControlProps> = ({ switches }) => {
  const [switchStates, setSwitchStates] = useState(
      switches.map(() => false)
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
            {switches.map((sw) => (
                <FormControlLabel
                    control={
                      <Switch
                          checked={sw.state}
                          onChange={(event) => handleSwitchChange(event, sw.id)}
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