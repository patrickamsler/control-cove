import { switchUpdateSchema } from '@control-cove/shared';
import { DeviceService } from '../domain/DeviceService';
import { WebSocketService } from './WebSocketService';
import logger from '../logger';

/**
 * Bridges the domain to the socket: a full snapshot on connect, one event per
 * change, and validated inbound switch commands.
 */
export function registerWebSocketHandlers(
  webSocketService: WebSocketService,
  deviceService: DeviceService,
): void {
  webSocketService.onConnection((socket) => {
    socket.emit('initial', {
      switches: deviceService.getSwitches(),
      sensors: deviceService.getSensors(),
    });
  });

  deviceService.onSwitchChanged((data) => webSocketService.emit('switch', data));
  deviceService.onSensorChanged((data) => webSocketService.emit('sensor', data));

  webSocketService.onEvent('updateSwitch', (payload) => {
    const update = switchUpdateSchema.safeParse(payload);
    if (!update.success) {
      logger.error(`Ignoring malformed updateSwitch payload: ${JSON.stringify(payload)}`);
      return;
    }
    logger.info('Received switch event', update.data);
    deviceService.setSwitch(update.data.id, update.data.state);
  });
}
