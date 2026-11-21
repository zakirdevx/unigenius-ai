import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { ChatProvider } from './context/ChatContext.jsx';
import { SpeedProvider } from './context/SpeedContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider>
      <SpeedProvider>
        <ChatProvider>
          <App />
        </ChatProvider>
      </SpeedProvider>
    </ThemeProvider>
  </StrictMode>,
);
