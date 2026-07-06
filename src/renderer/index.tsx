import React from 'react';
import ReactDOM from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import App from './App';
import './lib/styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    <Toaster
      position="bottom-right"
      toastOptions={{
        style: { background: '#323234', color: '#fff', borderRadius: '8px', fontSize: '13px' },
        success: { iconTheme: { primary: '#20AC64', secondary: '#fff' } },
        error: { iconTheme: { primary: '#E24729', secondary: '#fff' } },
        duration: 4000,
      }}
    />
  </React.StrictMode>
);
