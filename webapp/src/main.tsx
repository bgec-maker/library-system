import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import Boot from './boot';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boot />
  </StrictMode>
);
