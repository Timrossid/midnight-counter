// Shim so the Midnight SDK's `import { WebSocket } from 'isomorphic-ws'` works
// in the browser. `isomorphic-ws/browser.js` only provides a *default* export,
// so this file re-exports it as a named `WebSocket`.
import ws from 'isomorphic-ws/browser.js';

export const WebSocket = ws;
export default ws;
