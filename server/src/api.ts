import { Request, Response, Express } from 'express';
import { publishSensorData } from './mqtt-client';

export function setupRestEndpoints(app: Express) {
  // GET endpoint to retrieve all sensor data
  app.get('/api/sensorData', (req: Request, res: Response) => {
    // return res.status(200).json(getAllSensorData());
  });

  // POST endpoint to add new sensor data
  app.post('/api/sensorData', (req: Request, res: Response) => {
    // const data: SensorData = req.body;
    //
    // try {
    //   publishSensorData(data);
    //   addSensorData(data);
    //   res.status(200).json({ message: 'Data sent to MQTT broker', data });
    // } catch (error) {
    //   console.error('[REST] Failed to publish data to broker:', error);
    //   res.status(500).json({ message: 'Failed to publish data', error });
    // }
  });
}