import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router';
import { registerSW } from 'virtual:pwa-register';
import { setStore, Store } from '@journal/core';
import { DexieDriver } from './db/dexieDriver';
import App from './App';
import { StudentProvider } from './state/student';
import { SyncProvider } from './sync/SyncProvider';
import './index.css';

// Сховище підключається один раз: ядро працює через порт, не знаючи про IndexedDB.
setStore(new Store(new DexieDriver()));

registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <SyncProvider>
        <StudentProvider>
          <App />
        </StudentProvider>
      </SyncProvider>
    </HashRouter>
  </StrictMode>,
);
