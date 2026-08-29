import io, { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents } from '@control-cove/shared';
import { SERVER_URL } from './config';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// `io('')` is not the same as `io()` — only the no-argument form connects to the
// origin the page was served from, which is what an empty SERVER_URL means.
export const createSocket = (): AppSocket => (SERVER_URL ? io(SERVER_URL) : io());
