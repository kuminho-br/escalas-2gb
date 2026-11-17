import '@fontsource/barlow/400.css';
import '@fontsource/barlow/500.css';
import '@fontsource/barlow/600.css';
import '@fontsource/barlow-semi-condensed/500.css';
import '@fontsource/barlow-semi-condensed/600.css';
import './estilo.css';
import { QueryClient } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { criarRoteador } from './roteador';

const queryClient = new QueryClient();
const router = criarRoteador(queryClient);

createRoot(document.getElementById('raiz')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
