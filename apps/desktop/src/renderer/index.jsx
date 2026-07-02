import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { CoreProvider } from './context/CoreContext';
import './index.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        this.setState({ errorInfo });
        console.error("Uncaught error:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace', backgroundColor: '#fff', height: '100vh', overflow: 'auto' }}>
                    <h2>Something went wrong.</h2>
                    <details style={{ whiteSpace: 'pre-wrap' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }
        return this.props.children;
    }
}

const root = createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <CoreProvider>
            <ErrorBoundary>
                <App />
            </ErrorBoundary>
        </CoreProvider>
    </React.StrictMode>
);
