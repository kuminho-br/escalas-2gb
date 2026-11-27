import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useState } from 'react';
import { consultaPerfisDeTeste, escolherPerfilDeTeste } from '@/api/laboratorio';
import { mensagemDe } from '@/api/cliente';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { trocarDeMundo } from './trocar-de-mundo';

/**
 * Escolher o perfil de teste (6.59): os cinco, cada um com o nome. Serve para entrar no Laboratório (o cartão da tela inicial) e para trocar de perfil (a faixa).
 * Escolher liga o modo, limpa as consultas e leva à tela inicial do Laboratório.
 */
export function EscolherPerfil({ aberto, aoFechar, atual }: { aberto: boolean; aoFechar: () => void; atual?: string }) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const perfis = useQuery({ ...consultaPerfisDeTeste(), enabled: aberto });
  const [erro, setErro] = useState<string | null>(null);
  const [escolhendo, setEscolhendo] = useState(false);

  async function escolher(perfilId: string) {
    setErro(null);
    setEscolhendo(true);
    try {
      await escolherPerfilDeTeste(perfilId);
    } catch (e) {
      setErro(mensagemDe(e));
      setEscolhendo(false);
      return;
    }
    trocarDeMundo(true, queryClient);
    setEscolhendo(false);
    aoFechar();
    await router.invalidate();
    await router.navigate({ to: '/', ignoreBlocker: true });
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && aoFechar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Escolha um perfil de teste</DialogTitle>
          <DialogDescription>Você usa o sistema como esse perfil, com dados de teste. Nada do que fizer aqui vale.</DialogDescription>
        </DialogHeader>
        {perfis.isError && <p role="alert" className="text-corpo text-alerta">{mensagemDe(perfis.error)}</p>}
        {erro && <p role="alert" className="text-corpo text-alerta">{erro}</p>}
        <ul className="grid gap-2">
          {perfis.data?.map((p) => (
            <li key={p.perfilId}>
              <Button type="button" variant="secundario" disabled={escolhendo} aria-current={p.perfilId === atual ? 'true' : undefined} onClick={() => void escolher(p.perfilId)} className="w-full justify-start">
                {p.nome}
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
