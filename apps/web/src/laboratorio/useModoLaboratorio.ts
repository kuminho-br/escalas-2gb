import { useSyncExternalStore } from 'react';
import { aoMudarModo, emLaboratorio } from './modo';

/** O site está em modo Laboratório (nesta aba)? Muda na hora, para a faixa e os cartões aparecerem e sumirem sem recarregar. */
export const useModoLaboratorio = (): boolean => useSyncExternalStore(aoMudarModo, emLaboratorio, () => false);
