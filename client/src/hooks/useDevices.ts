import { useCallback, useEffect, useRef, useState } from 'react';
import { SensorDto, SwitchDto } from '@control-cove/shared';
import { fetchSensors, fetchSwitches } from '../api/rest';
import { AppSocket, createSocket } from '../api/socket';

/** Replaces the entry with the same id, leaving the rest untouched. */
const replaceById = <T extends { id: number }>(devices: T[] | null, update: T): T[] | null =>
  devices && devices.map((device) => (device.id === update.id ? update : device));

/**
 * Owns the device state: a REST snapshot on mount, then live socket updates.
 * The socket's own `initial` snapshot is applied too, so updates that arrive
 * before the REST request resolves are not lost.
 */
export const useDevices = () => {
  const [switches, setSwitches] = useState<SwitchDto[] | null>(null);
  const [sensors, setSensors] = useState<SensorDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<AppSocket | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSwitches(), fetchSensors()])
      .then(([loadedSwitches, loadedSensors]) => {
        if (cancelled) {
          return;
        }
        // A socket snapshot may already have arrived; it is equally current, so
        // only fill in what is still missing.
        setSwitches((current) => current ?? loadedSwitches);
        setSensors((current) => current ?? loadedSensors);
      })
      .catch((cause: Error) => {
        if (!cancelled) {
          setError(cause.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const socket = createSocket();
    socketRef.current = socket;

    socket.on('initial', ({ switches: initialSwitches, sensors: initialSensors }) => {
      setSwitches(initialSwitches);
      setSensors(initialSensors);
    });
    socket.on('switch', (update) => setSwitches((current) => replaceById(current, update)));
    socket.on('sensor', (update) => setSensors((current) => replaceById(current, update)));

    return () => {
      socketRef.current = null;
      socket.disconnect();
    };
  }, []);

  const setSwitch = useCallback((id: number, state: boolean) => {
    if (!socketRef.current) {
      console.error('Socket not initialized');
      return;
    }
    socketRef.current.emit('updateSwitch', { id, state });
  }, []);

  return {
    switches,
    sensors,
    error,
    loading: !error && (switches === null || sensors === null),
    setSwitch,
  };
};
