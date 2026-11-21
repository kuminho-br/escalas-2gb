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
import { dataBr, LISTA_NAO_CARREGOU, Secao } from './Secao';

export function Afastamentos({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const tipos = useQuery(consultaCatalogo('tipos-afastamento'));
  const ativos = tipos.data?.filter((t) => t.ativo) ?? [];
  // o aviso é para quando não há lista nenhuma: uma nova busca que falha deixa a lista que já estava na tela
  const tiposNaoCarregaram = tipos.isError && !tipos.data;
  const [tipo, setTipo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const tipoEscolhido = tipo || ativos[0]?.id || '';
  // o formulário aberto com uma data digitada é alteração pendente: trocar de ficha pergunta antes
  usePendencia('afastamento', aberto && Boolean(inicio || fim));

  function fechar() {
    setAberto(false);
    setTipo('');
    setInicio('');
    setFim('');
    setErro(null);
  }

  const { salvando, travar } = useTrava();
  const incluir = travar(gravar);
  async function gravar() {
    setErro(null);
    try {
      await criarAfastamento(ficha.id, { tipoAfastamentoId: tipoEscolhido, inicio, fim });
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
      <ul className="mb-4 grid gap-1.5">
        {ficha.afastamentos.map((a) => (
          <li key={a.id} className="flex items-center gap-3 text-sm">
            <span className="font-medium">{a.tipo}</span>
            <span className="text-apagado">de {dataBr(a.inicio)} a {dataBr(a.fim)}</span>
            <Button size="xs" variant="ghost" className="ml-auto" onClick={() => void apagar(a)}>Remover</Button>
          </li>
        ))}
        {ficha.afastamentos.length === 0 && <li className="text-sm text-apagado">Nenhum afastamento.</li>}
      </ul>
      {erro && <p role="alert" className="mb-3 text-sm text-alerta">{erro}</p>}
      {!aberto && (
        <div>
          <Button type="button" variant="outline" onClick={() => setAberto(true)}>Incluir afastamento</Button>
        </div>
      )}
      {aberto && (
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
          <div className="flex gap-2">
            <Button type="submit" disabled={!tipoEscolhido || salvando}>Salvar</Button>
            <Button type="button" variant="ghost" onClick={fechar}>Cancelar</Button>
          </div>
        </form>
      )}
    </Secao>
  );
}
