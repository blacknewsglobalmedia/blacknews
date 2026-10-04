import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PoliciesProvider} from './context/PoliciesContext.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PoliciesProvider>
      <App />
    </PoliciesProvider>
  </StrictMode>,
);
