import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CoreProvider } from './context/CoreContext';
import './index.css';

const root = createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <CoreProvider>
            <App />
        </CoreProvider>
    </React.StrictMode>
);
