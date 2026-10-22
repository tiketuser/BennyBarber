import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app/App';
import { createBackend } from './data';
import { BackendProvider } from './data/BackendProvider';
import './index.css';

// A new version installs itself and reloads the page (registerType autoUpdate). Phones keep tabs open for days, so
// besides on load it is also looked for whenever the page comes back to the screen, and every half hour.
if (import.meta.env.PROD)
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      if (!reg) return;
      const check = () => document.visibilityState === 'visible' && reg.update().catch(() => {});
      document.addEventListener('visibilitychange', check);
      setInterval(check, 30 * 60 * 1000);
    },
  });

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
