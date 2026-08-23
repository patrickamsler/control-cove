import io, { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@control-cove/shared';
import { SERVER_URL } from './config';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export const createSocket = (): AppSocket => io(SERVER_URL);
