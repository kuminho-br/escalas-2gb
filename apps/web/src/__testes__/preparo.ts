import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { esquecerUnidadeDaAba } from '@/lib/unidade-de-trabalho';

configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  localStorage.clear();
  esquecerUnidadeDaAba();
  vi.unstubAllGlobals();
});
