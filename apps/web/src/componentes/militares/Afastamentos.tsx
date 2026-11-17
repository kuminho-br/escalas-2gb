import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { FichaMilitar } from 'contratos';
import { useState, type FormEvent } from 'react';
import { mensagemDe } from '@/api/cliente';
import { consultaCatalogo } from '@/api/configuracoes';
import { apagarAfastamento, atualizarMilitares, criarAfastamento } from '@/api/militares';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mesAtual } from '@/lib/meses';
import { dataBr, Secao } from './Secao';

const ultimoDia = (mes: string) => {
  const [a, m] = mes.split('-').map(Number);
  return `${mes}-${String(new Date(a!, m!, 0).getDate()).padStart(2, '0')}`;
};

export function Afastamentos({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const tipos = useQuery(consultaCatalogo('tipos-afastamento'));
  const ativos = tipos.data?.filter((t) => t.ativo) ?? [];
  const [tipo, setTipo] = useState('');
  const [mesAtalho, setMesAtalho] = useState(mesAtual());
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const tipoEscolhido = tipo || ativos[0]?.id || '';

  async function incluir(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await criarAfastamento(ficha.id, { tipoAfastamentoId: tipoEscolhido, inicio, fim });
      atualizarMilitares(queryClient, ficha.id);
      setInicio('');
      setFim('');
    } catch (err) {
      setErro(mensagemDe(err));
    }
  }

  async function apagar(id: string) {
    setErro(null);
    try {
      await apagarAfastamento(id);
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
            <Button size="xs" variant="ghost" className="ml-auto" onClick={() => void apagar(a.id)}>Apagar</Button>
          </li>
        ))}
        {ficha.afastamentos.length === 0 && <li className="text-sm text-apagado">Nenhum afastamento.</li>}
      </ul>
      <form onSubmit={incluir} className="grid gap-3 border-t border-linha pt-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="grid gap-1.5">
            <Label htmlFor="af-tipo">Tipo de afastamento</Label>
            <Selecao id="af-tipo" value={tipoEscolhido} onChange={(e) => setTipo(e.target.value)}>
              {ativos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </Selecao>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="af-mes">Mês do atalho</Label>
            <div className="flex gap-2">
              <Input id="af-mes" type="month" value={mesAtalho} onChange={(e) => setMesAtalho(e.target.value)} className="w-40" />
              <Button
                type="button"
                variant="outline"
                disabled={!mesAtalho}
                onClick={() => {
                  setInicio(`${mesAtalho}-01`);
                  setFim(ultimoDia(mesAtalho));
                }}
              >
                Mês inteiro
              </Button>
            </div>
          </div>
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
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        <div>
          <Button type="submit" disabled={!tipoEscolhido}>Incluir afastamento</Button>
        </div>
      </form>
    </Secao>
  );
}
