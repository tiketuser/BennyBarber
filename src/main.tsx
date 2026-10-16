import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { createBackend } from './data';
import { BackendProvider } from './data/BackendProvider';
import './index.css';

const backend = createBackend();

if (import.meta.env.PROD) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BackendProvider backend={backend}>
      <App />
    </BackendProvider>
  </StrictMode>,
);
