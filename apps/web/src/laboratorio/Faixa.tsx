import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { FlaskConical } from 'lucide-react';
import { useEffect, useState } from 'react';
import { podeDescartar } from '@/componentes/AlteracoesPendentes';
import { buscarPerfilEmUso, consultaFerramentas, encerrarSessaoNoLaboratorio } from '@/api/laboratorio';
import { DeixarRetorno } from './DeixarRetorno';
import { EscolherPerfil } from './EscolherPerfil';
import { trocarDeMundo } from './trocar-de-mundo';

/** O aviso que a tela inicial mostra quando a sessão no Laboratório acabou (expirou, ou foi encerrada em outra aba). */
export const AVISO_LABORATORIO_ENCERRADO = 'laboratorio-encerrado';

/**
 * A faixa do Laboratório (6.59): fixa no alto de toda tela do modo, com cor e listras só dela. Diz onde a pessoa está, com que perfil, e deixa trocar de perfil
 * ou sair. Confere a sessão ao abrir e a cada volta à aba: se ela acabou (outra aba saiu ou trocou), o modo desliga e a pessoa volta ao real com um aviso.
 */
export function Faixa() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [trocando, setTrocando] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [retornando, setRetornando] = useState(false);
  const emTeste = (useQuery(consultaFerramentas()).data ?? []).filter((x) => x.situacao === 'em_teste');
  const emUso = useQuery({ queryKey: ['laboratorio', 'em-uso'], queryFn: buscarPerfilEmUso, refetchOnWindowFocus: true, retry: false, staleTime: 0 });

  useEffect(() => {
    // `null` é a resposta "não há sessão no Laboratório"; erro ou carregando não desligam nada
    if (emUso.data !== null) return;
    trocarDeMundo(false, queryClient);
    void router.invalidate().then(() => router.navigate({ to: '/', search: { aviso: AVISO_LABORATORIO_ENCERRADO } as never, ignoreBlocker: true }));
  }, [emUso.data, queryClient, router]);

  async function sair() {
    // quem tem alteração pendente é avisado antes (como no Sair da conta): ao desistir, nada muda
    if (!podeDescartar()) return;
    setSaindo(true);
    try {
      await encerrarSessaoNoLaboratorio();
    } catch {
      // a sessão no servidor pode ficar: o modo desliga mesmo assim, e a conta real nunca ficou sem acesso ao real
    }
    trocarDeMundo(false, queryClient);
    setSaindo(false);
    await router.invalidate();
    await router.navigate({ to: '/', ignoreBlocker: true });
  }

  return (
    <div role="region" aria-label="Laboratório" data-faixa-do-laboratorio className="faixa-do-laboratorio sticky top-0 z-45 flex h-[var(--faixa)] flex-wrap content-center items-center gap-x-4 gap-y-0.5 overflow-hidden px-3 text-apoio leading-5 font-medium text-white md:px-6">
      <FlaskConical aria-hidden className="size-4 shrink-0" />
      <span className="font-semibold">Laboratório: dados de teste. Nada aqui vale.</span>
      <span className="ml-auto flex min-w-0 items-center gap-3 max-md:w-full max-md:justify-between">
        {emTeste.length > 0 && (
          <button type="button" onClick={() => setRetornando(true)} className="shrink-0 underline decoration-white/60 underline-offset-2 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            Deixar retorno
          </button>
        )}
        {emUso.data && (
          <button type="button" onClick={() => setTrocando(true)} className="min-w-0 truncate underline decoration-white/60 underline-offset-2 hover:decoration-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {`Testando como: ${emUso.data.nome}`}
          </button>
        )}
        <button type="button" disabled={saindo} onClick={() => void sair()} className="shrink-0 rounded-controle border border-white/70 px-2 hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          Sair do Laboratório
        </button>
      </span>
      {retornando && <DeixarRetorno ferramentas={emTeste} aoFechar={() => setRetornando(false)} />}
      <EscolherPerfil aberto={trocando} aoFechar={() => setTrocando(false)} atual={emUso.data?.perfilId} />
    </div>
  );
}
