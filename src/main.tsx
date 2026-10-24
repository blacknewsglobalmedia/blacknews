import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PoliciesProvider} from './context/PoliciesContext.tsx';
import './index.css';
import './styles/assemble.css';
import './styles/led.css';
import {initAssemble} from './lib/assemble';

initAssemble(); // antes del primer render: la clase del <html> evita el parpadeo

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PoliciesProvider>
      <App />
    </PoliciesProvider>
  </StrictMode>,
);
