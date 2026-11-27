import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { saida } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { podeDescartar } from '@/componentes/AlteracoesPendentes';
import { authCliente } from '@/auth-cliente';
import { sairDoModo } from '@/laboratorio/modo';

/** O "Sair": só sai da tela quando o servidor confirmou (num computador compartilhado, a sessão não pode ficar válida). */
export function useSair() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [erroSair, setErroSair] = useState<string | null>(null);

  async function sair() {
    // pergunta antes de encerrar a sessão: se a pessoa desistir, ela continua logada e com as alterações
    if (!podeDescartar()) return;
    setErroSair(null);
    // um pedido que ainda estava no ar e volta 401 depois daqui é o próprio Sair, não uma sessão que terminou
    saida.marcar(true);
    try {
      const { error } = await authCliente.signOut();
      if (error) throw error;
    } catch {
      saida.marcar(false);
      setErroSair('Não foi possível sair. Confira a conexão e tente de novo.');
      return;
    }
    // quem sai da conta sai do Laboratório também: a próxima entrada, nesta aba, é no real
    sairDoModo();
    queryClient.clear();
    queryClient.setQueryData(consultaEu.queryKey, null);
    await navigate({ to: '/entrar', ignoreBlocker: true });
  }
  return { sair, erroSair };
}
