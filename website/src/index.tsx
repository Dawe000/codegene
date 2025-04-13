import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

console.log('React script loading...');

try {
  const rootElement = document.getElementById('root');
  console.log('Root element found:', rootElement);
  
  if (rootElement) {
    const root = ReactDOM.createRoot(rootElement);
    console.log('Root created, attempting to render...');
    
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log('Render called');
  } else {
    console.error('Root element not found');
  }
} catch (error) {
  console.error('Error initializing React:', error);
}
