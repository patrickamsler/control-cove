/**
 * Reads the server URL from the Vite environment. Kept out of the components so
 * a missing variable fails at module load instead of during a render.
 *
 * An explicit empty string means "same origin as the page" — that is how the
 * single-image Docker build runs, where Express serves the bundle itself.
 */
const serverUrl = import.meta.env.VITE_SERVER_URL;

if (serverUrl === undefined) {
  throw new Error('VITE_SERVER_URL is not set (use "" to talk to the serving origin)');
}

export const SERVER_URL: string = serverUrl;
