import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CoreProvider } from './context/CoreContext';
import { ClerkProvider, useAuth } from '@clerk/clerk-react';
import './index.css';

function ClerkTokenSync() {
    const { isLoaded, isSignedIn, getToken } = useAuth();
    
    React.useEffect(() => {
        if (!isLoaded || !isSignedIn) return;
        
        const pushToken = async () => {
            try {
                const token = await getToken();
                if (token && window.electronAPI?.cloudUpdateToken) {
                    window.electronAPI.cloudUpdateToken(token);
                }
            } catch (err) {
                // Ignore token fetch errors in background
            }
        };
        
        pushToken();
        const interval = setInterval(pushToken, 50000); // refresh every 50s
        return () => clearInterval(interval);
    }, [isLoaded, isSignedIn, getToken]);

    return null;
}

const root = createRoot(document.getElementById('root'));

const PUBLISHABLE_KEY = process.env.CLERK_PUBLISHABLE_KEY;

if (!PUBLISHABLE_KEY) {
  console.warn("Missing Publishable Key for Clerk");
}

root.render(
    <React.StrictMode>
        <ClerkProvider publishableKey={PUBLISHABLE_KEY || 'missing-key'} afterSignOutUrl="/">
            <ClerkTokenSync />
            <CoreProvider>
                <App />
            </CoreProvider>
        </ClerkProvider>
    </React.StrictMode>
);
