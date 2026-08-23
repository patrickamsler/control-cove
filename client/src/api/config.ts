/**
 * Reads the server URL from the CRA environment. Kept out of the components so
 * a missing variable fails at module load instead of during a render.
 */
const serverUrl = process.env.REACT_APP_SERVER_URL;

if (!serverUrl) {
  throw new Error('REACT_APP_SERVER_URL is not set');
}

export const SERVER_URL: string = serverUrl;
