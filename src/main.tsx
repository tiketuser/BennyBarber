import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { createBackend } from './data';
import { BackendProvider } from './data/BackendProvider';
import './index.css';

if (import.meta.env.PROD) registerSW({ immediate: true });

// Render once the backend knows who is signed in, so a returning user never sees the login screen flash.
createBackend().then((backend) =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BackendProvider backend={backend}>
        <App />
      </BackendProvider>
    </StrictMode>,
  ),
);
