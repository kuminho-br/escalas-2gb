import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaCatalogo } from '@/api/configuracoes';
import { usePendencia, useTrava } from '@/componentes/AlteracoesPendentes';
import { apagarAfastamento, atualizarMilitares, criarAfastamento } from '@/api/militares';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { DonoDoBloco, dataBr, LISTA_NAO_CARREGOU, Secao } from './Secao';

export function Afastamentos({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  // afastamento é do Pecúlio: sem papel acima da lotação, a lista é só leitura
  const peculio = ficha.podeEditar.peculio;
  const tipos = useQuery(consultaCatalogo('tipos-afastamento'));
  const ativos = tipos.data?.filter((t) => t.ativo) ?? [];
  // o aviso é para quando não há lista nenhuma: uma nova busca que falha deixa a lista que já estava na tela
  const tiposNaoCarregaram = tipos.isError && !tipos.data;
  const [tipo, setTipo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [motivo, setMotivo] = useState('');
  const [boletim, setBoletim] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const tipoEscolhido = tipo || ativos[0]?.id || '';
  // o formulário aberto com uma data digitada é alteração pendente: trocar de ficha pergunta antes
  usePendencia('afastamento', aberto && Boolean(inicio || fim || motivo || boletim));

  function fechar() {
    setAberto(false);
    setTipo('');
    setInicio('');
    setFim('');
    setMotivo('');
    setBoletim('');
    setErro(null);
  }

  const { salvando, travar } = useTrava();
  const incluir = travar(gravar);
  async function gravar() {
    setErro(null);
    try {
      // o motivo e o boletim só vão quando preenchidos
      await criarAfastamento(ficha.id, { tipoAfastamentoId: tipoEscolhido, inicio, fim, ...(motivo.trim() ? { motivo: motivo.trim() } : {}), ...(boletim.trim() ? { boletim: boletim.trim() } : {}) });
      atualizarMilitares(queryClient, ficha.id);
      fechar();
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  async function apagar(a: FichaMilitar['afastamentos'][number]) {
    if (!window.confirm(`Remover o afastamento ${a.tipo} de ${dataBr(a.inicio)} a ${dataBr(a.fim)}?`)) return;
    setErro(null);
    try {
      await apagarAfastamento(a.id);
      atualizarMilitares(queryClient, ficha.id);
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  return (
    <Secao titulo="Afastamentos">
      {!peculio && <DonoDoBloco unidadeDeCima={ficha.podeEditar.unidadeDeCima} />}
      <ul className="mb-4 grid gap-1.5">
        {ficha.afastamentos.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
            <span className="font-medium">{a.tipo}</span>
            <span className="text-apagado">de {dataBr(a.inicio)} a {dataBr(a.fim)}</span>
            {peculio && <Button size="xs" variant="ghost" className="ml-auto" onClick={() => void apagar(a)}>Remover</Button>}
            {a.motivo && <span className="basis-full text-xs text-apagado">{`Motivo: ${a.motivo}`}</span>}
            {a.boletim && <span className="basis-full text-xs text-apagado">{`Boletim: ${a.boletim}`}</span>}
          </li>
        ))}
        {ficha.afastamentos.length === 0 && <li className="text-sm text-apagado">Nenhum afastamento.</li>}
      </ul>
      {erro && <p role="alert" className="mb-3 text-sm text-alerta">{erro}</p>}
      {peculio && !aberto && (
        <div>
          <Button type="button" variant="outline" onClick={() => setAberto(true)}>Incluir afastamento</Button>
        </div>
      )}
      {peculio && aberto && (
        <form onSubmit={(e) => { e.preventDefault(); void incluir(); }} className="grid gap-3 border-t border-linha pt-3">
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="af-tipo">Tipo de afastamento</Label>
            <Selecao id="af-tipo" value={tipoEscolhido} onChange={(e) => setTipo(e.target.value)} aria-invalid={tiposNaoCarregaram || undefined} aria-describedby={tiposNaoCarregaram ? 'af-tipo-erro' : undefined}>
              {ativos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
            {tiposNaoCarregaram && <p id="af-tipo-erro" className="text-xs text-alerta">{LISTA_NAO_CARREGOU}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:max-w-md">
            <div className="grid gap-1.5">
              <Label htmlFor="af-inicio">Início</Label>
              <Input id="af-inicio" type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="af-fim">Fim</Label>
              <Input id="af-fim" type="date" value={fim} onChange={(e) => setFim(e.target.value)} required />
            </div>
          </div>
          <div className="grid gap-1.5 sm:max-w-md">
            <Label htmlFor="af-motivo">Motivo</Label>
            <Input id="af-motivo" maxLength={200} placeholder="Opcional" value={motivo} aria-describedby="af-motivo-aviso" onChange={(e) => setMotivo(e.target.value)} />
            <p id="af-motivo-aviso" className="text-xs text-apagado">Não escreva diagnóstico.</p>
          </div>
          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="af-boletim">Boletim do afastamento</Label>
            <Input id="af-boletim" maxLength={60} value={boletim} placeholder="Opcional" onChange={(e) => setBoletim(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={!tipoEscolhido || salvando}>Salvar</Button>
            <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
          </div>
        </form>
      )}
    </Secao>
  );
}
