import { createContext } from 'react';

/** O que se pede ao aviso de resultado: `desfazer` põe o botão "Desfazer" (8 s no ar); `erro` o faz de erro (espera a pessoa); `tentarDeNovo` põe o botão do erro. */
export type PedidoDeAviso = { texto: string; desfazer?: () => Promise<void>; erro?: boolean; tentarDeNovo?: () => void };

/** O que se pergunta numa confirmação: `perigoso` faz do verbo o botão perigoso cheio; `digitar` o apaga até a pessoa digitar aquele texto (a matrícula, ao apagar). */
export type PedidoDeConfirmacao = { titulo: string; texto?: string; verbo: string; perigoso?: boolean; digitar?: string };

export type RespostaDoSistema = {
  avisar: (a: PedidoDeAviso) => void;
  confirmar: (c: PedidoDeConfirmacao) => Promise<boolean>;
};

export const ContextoDeResposta = createContext<RespostaDoSistema | null>(null);
