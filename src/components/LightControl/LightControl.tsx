import React, { useEffect, useState } from 'react';
import { Card, CardContent, FormControlLabel, Switch, Stack, Typography } from '@mui/material';
import {
  connectToBroker,
  disconnectFromBroker,
  publishMessage,
  subscribeToTopic
} from "../../services/mqttClient";
import lightConfig from "../../config/light-config.json";
import CoveCard from "../CoveCard/CoveCard";


const LightControl = () => {
  const [switchStates, setSwitchStates] = useState(
      lightConfig.map(() => false)
  );

  useEffect(() => {
    connectToBroker(() => {
      subscribeToTopics();
    });
    return () => {
      disconnectFromBroker();
    };
  }, []);

  const subscribeToTopics = () => {
    lightConfig.forEach((light, index) => {
      subscribeToTopic(light.stateTopic, (message) => {
        setSwitchStates((prevStates) => {
          const newStates = [...prevStates];
          newStates[index] = message === 'on';
          return newStates;
        });
      });
    });
  }

  const handleSwitchChange = (event: React.ChangeEvent<HTMLInputElement>, index: number, commandTopic: string) => {
    const switchState = event.target.checked;
    setSwitchStates((prevStates) => {
      const newStates = [...prevStates];
      newStates[index] = switchState;
      return newStates;
    });
    publishMessage(commandTopic, switchState ? 'on' : 'off');
  };

  return (
      <CoveCard title={'Light Control'}>
          <Stack direction="column" spacing={2}>
            {lightConfig.map((light, index) => (
                <FormControlLabel
                    control={
                      <Switch
                          checked={switchStates[index]}
                          onChange={(event) => handleSwitchChange(event, index, light.commandTopic)}
                          name={`Switch ${index + 1}`}
                      />
                    }
                    label={light.name}
                    key={index}
                />
            ))}
          </Stack>
      </CoveCard>
  );
}

export default LightControl;