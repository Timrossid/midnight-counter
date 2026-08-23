import { Buffer } from 'buffer';

// Midnight SDK packages rely on Node.js `Buffer`, which does not exist in the
// browser. Polyfill it before any other imports run.
(globalThis as any).Buffer = Buffer;

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './App.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
