import React, { useEffect, useState } from 'react';
import { Card, CardContent, FormControlLabel, Switch, Stack } from '@mui/material';
import {
  connectToBroker,
  disconnectFromBroker,
  publishMessage,
  subscribeToTopic
} from "../../services/mqttClient";

const lightConfig = [
  {
    name: 'Dining Room Light',
    commandTopic: 'shellies/shelly1-C45BBE4744D5/relay/0/command',
    stateTopic: 'shellies/shelly1-C45BBE4744D5/relay/0',
  },
  {
    name: 'Kitchen Light',
    commandTopic: 'shellies/shelly1-349454735FE0/relay/0/command',
    stateTopic: 'shellies/shelly1-349454735FE0/relay/0',
  },
  {
    name: 'Living Room Light',
    commandTopic: 'shellies/shelly1-3494547359B3/relay/0/command',
    stateTopic: 'shellies/shelly1-3494547359B3/relay/0',
  },
  {
    name: 'Entrance Light',
    commandTopic: 'shellies/shelly1-349454737F5C/relay/0/command',
    stateTopic: 'shellies/shelly1-349454737F5C/relay/0',
  },
  {
    name: 'Bedroom Light',
    commandTopic: 'shellies/shelly1-349454735FDB/relay/0/command',
    stateTopic: 'shellies/shelly1-349454735FDB/relay/0',
  }
]


const LightControl = () => {
  const [switchStates, setSwitchStates] = useState(
      lightConfig.map(() => false)
  );

  useEffect(() => {
    connectToBroker(() => {
      // subscribe to state topics for each light
      lightConfig.forEach((light, index) => {
        subscribeToTopic(light.stateTopic, (message) => {
          setSwitchStates((prevStates) => {
            const newStates = [...prevStates];
            newStates[index] = message === 'on';
            return newStates;
          });
        });
      });
    });

    return () => {
      disconnectFromBroker();
    };
  }, []);

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
      <Card>
        <CardContent>
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
        </CardContent>
      </Card>
  );
}

export default LightControl;