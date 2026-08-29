import { vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useDevices } from './useDevices';
import { createSocket } from '../api/socket';
import { fetchSensors, fetchSwitches } from '../api/rest';

vi.mock('../api/rest');
vi.mock('../api/socket');

const mockedFetchSwitches = vi.mocked(fetchSwitches);
const mockedFetchSensors = vi.mocked(fetchSensors);
const mockedCreateSocket = vi.mocked(createSocket);

const restSwitches = [
  { id: 1, name: 'Kitchen' },
  { id: 2, name: 'Bedroom', state: false },
];
const restSensors = [{ id: 1, name: 'Livingroom' }];

// Stands in for the socket: records handlers so tests can drive server events.
const fakeSocket = () => {
  const handlers: Record<string, (payload: any) => void> = {};
  return {
    on: vi.fn((event: string, callback: (payload: any) => void) => {
      handlers[event] = callback;
    }),
    emit: vi.fn(),
    disconnect: vi.fn(),
    server: (event: string, payload: unknown) => act(() => handlers[event](payload)),
    hasHandler: (event: string) => event in handlers,
  };
};

let socket: ReturnType<typeof fakeSocket>;

beforeEach(() => {
  vi.clearAllMocks();
  socket = fakeSocket();
  mockedCreateSocket.mockReturnValue(socket as any);
  mockedFetchSwitches.mockResolvedValue(restSwitches);
  mockedFetchSensors.mockResolvedValue(restSensors);
});

describe('the initial load', () => {
  it('starts out loading with no devices', async () => {
    const { result } = renderHook(() => useDevices());

    expect(result.current.loading).toBe(true);
    expect(result.current.switches).toBeNull();
    expect(result.current.sensors).toBeNull();

    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it('exposes the devices returned by the REST endpoints', async () => {
    const { result } = renderHook(() => useDevices());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.switches).toEqual(restSwitches);
    expect(result.current.sensors).toEqual(restSensors);
    expect(result.current.error).toBeNull();
  });

  it('reports a failed request as an error instead of loading forever', async () => {
    mockedFetchSwitches.mockRejectedValue(new Error('HTTP error! status: 500'));

    const { result } = renderHook(() => useDevices());

    await waitFor(() => expect(result.current.error).toBe('HTTP error! status: 500'));
    expect(result.current.loading).toBe(false);
  });
});

describe('socket updates', () => {
  it('applies the initial snapshot without waiting for the REST response', async () => {
    // A REST request that never settles, so only the socket can supply the data.
    mockedFetchSwitches.mockReturnValue(new Promise(() => {}));
    mockedFetchSensors.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useDevices());

    socket.server('initial', { switches: restSwitches, sensors: restSensors });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.switches).toEqual(restSwitches);
  });

  it('does not let a late REST response overwrite the socket snapshot', async () => {
    const live = [{ id: 1, name: 'Kitchen', state: true }, { id: 2, name: 'Bedroom', state: true }];
    const { result } = renderHook(() => useDevices());

    socket.server('initial', { switches: live, sensors: restSensors });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.switches).toEqual(live);
  });

  it('replaces only the switch named in a switch event', async () => {
    const { result } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    socket.server('switch', { id: 2, name: 'Bedroom', state: true });

    expect(result.current.switches).toEqual([
      { id: 1, name: 'Kitchen' },
      { id: 2, name: 'Bedroom', state: true },
    ]);
  });

  it('replaces only the sensor named in a sensor event', async () => {
    const { result } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    socket.server('sensor', { id: 1, name: 'Livingroom', temperature: 21.5, humidity: 48 });

    expect(result.current.sensors).toEqual([
      { id: 1, name: 'Livingroom', temperature: 21.5, humidity: 48 },
    ]);
  });

  it('ignores an event for an unknown device id', async () => {
    const { result } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    socket.server('switch', { id: 999, name: 'Ghost', state: true });

    expect(result.current.switches).toEqual(restSwitches);
  });

  it('disconnects the socket on unmount', async () => {
    const { result, unmount } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    unmount();

    expect(socket.disconnect).toHaveBeenCalled();
  });
});

describe('setSwitch', () => {
  it('emits an updateSwitch event', async () => {
    const { result } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSwitch(2, true));

    expect(socket.emit).toHaveBeenCalledWith('updateSwitch', { id: 2, state: true });
  });

  it('does not apply the new state optimistically', async () => {
    const { result } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.setSwitch(2, true));

    expect(result.current.switches).toEqual(restSwitches);
  });
});
