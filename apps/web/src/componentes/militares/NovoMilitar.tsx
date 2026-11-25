import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useState, type FormEvent } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { consultaUnidadesDaBusca } from '@/api/consulta';
import { atualizarMilitares, consultaPostos, consultaQuadros, consultaUnidadesDeLotacao, criarMilitar } from '@/api/militares';
import type { Eu } from '@/api/eu';
import { atualizarPeculio, secoesDoCadastro } from '@/api/peculio';
import { Campo } from '@/componentes/Campo';
import { EscolherUnidade } from '@/componentes/EscolherUnidade';
import { Selecao } from '@/componentes/Selecao';
import { useDescartarDigitado } from '@/componentes/DescartarDigitado';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { hoje } from '@/lib/meses';
import { avisoDaLista } from './Secao';

/**
 * O militar novo, no módulo Pecúlio: os dados do Pecúlio (matrícula, posto-graduação, quadro, nome completo, nome de guerra, antiguidade) e a
 * lotação (seção e "lotado desde"). Entra como Pronto, sem equipe, fora do quadro de motoristas, sem CNH e não voluntário: a seção ajusta
 * esses dados depois, pela ficha ou pela importação "Dados da escala".
 */
export function NovoMilitar({ eu, aoFechar }: { eu: Eu; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const descarte = useDescartarDigitado(aoFechar);
  const navigate = useNavigate();
  const postos = useQuery(consultaPostos);
  const quadros = useQuery(consultaQuadros);
  const secoes = useQuery(consultaUnidadesDeLotacao);
  // a árvore da corporação dá lugar às unidades do cadastro (as de cima entram como passagem)
  const todas = useQuery(consultaUnidadesDaBusca);
  const [secao, setSecao] = useState('');
  const [posto, setPosto] = useState('');
  const [quadro, setQuadro] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [salvando, setSalvando] = useState(false);
  const postoEscolhido = posto || postos.data?.[0]?.id || '';
  // só os quadros que contêm o posto-graduação; com um só, ele já vale
  const doPosto = (quadros.data ?? []).filter((q) => q.postoGradIds.includes(postoEscolhido));
  const quadroEscolhido = doPosto.some((q) => q.id === quadro) ? quadro : doPosto.length === 1 ? doPosto[0]!.id : '';
  // a unidade é escolhida pela árvore (6.45); com uma só, ela já vale, e com mais de uma nenhuma vem escolhida por acaso
  const doCadastro = secoesDoCadastro(eu, secoes.data ?? []);
  const secaoEscolhida = doCadastro.some((s) => s.id === secao) ? secao : doCadastro.length === 1 ? doCadastro[0]!.id : '';

  async function cadastrar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const antiguidade = String(f.get('antiguidade') ?? '').trim();
    setErro(null);
    setSalvando(true);
    try {
      const ficha = await criarMilitar(secaoEscolhida, {
        matricula: String(f.get('matricula')).trim(),
        postoGradId: postoEscolhido,
        ...(quadroEscolhido ? { quadroId: quadroEscolhido } : {}),
        nomeCompleto: String(f.get('nomeCompleto')).trim(),
        nomeGuerra: String(f.get('nomeGuerra')).trim().toUpperCase(),
        antiguidade: antiguidade ? Number(antiguidade) : null,
        motorista: false,
        cnh: [],
        voluntarioJes: false,
        lotacao: { equipeId: null, jornada: 'pronto', desde: String(f.get('desde')) },
      });
      atualizarMilitares(queryClient);
      atualizarPeculio(queryClient);
      aoFechar();
      await navigate({ to: '/peculio/militar/$id', params: { id: ficha.id }, search: {} });
    } catch (err) {
      setErro(mensagemDe(err));
      setCampos(camposDe(err));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open onOpenChange={descarte.aoMudarAberto}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo militar</DialogTitle>
          <DialogDescription>Equipe, jornada, motorista, CNH e afastamentos ficam na ficha e nos dados da escala, depois de cadastrar.</DialogDescription>
        </DialogHeader>
        <form ref={descarte.ref} onSubmit={cadastrar} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Campo id="nm-matricula" rotulo="Matrícula" erro={campos.matricula}>
              <Input id="nm-matricula" name="matricula" placeholder="123456-7" required />
            </Campo>
            <Campo id="nm-posto" rotulo="Posto-graduação" erro={campos.postoGradId ?? avisoDaLista(postos)}>
              <Selecao id="nm-posto" name="posto" value={postoEscolhido} onChange={(e) => setPosto(e.target.value)} required>
                {postos.data?.map((p) => <option key={p.id} value={p.id}>{p.sigla}</option>)}
              </Selecao>
            </Campo>
          </div>
          <Campo id="nm-quadro" rotulo="Quadro" erro={campos.quadroId}>
            <Selecao id="nm-quadro" name="quadro" value={quadroEscolhido} onChange={(e) => setQuadro(e.target.value)}>
              {doPosto.length !== 1 && <option value="">Escolher depois</option>}
              {doPosto.map((q) => <option key={q.id} value={q.id}>{q.sigla}</option>)}
            </Selecao>
          </Campo>
          <Campo id="nm-completo" rotulo="Nome completo" erro={campos.nomeCompleto}>
            <Input id="nm-completo" name="nomeCompleto" required />
          </Campo>
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Campo id="nm-nome" rotulo="Nome de guerra" erro={campos.nomeGuerra}>
              <Input id="nm-nome" name="nomeGuerra" required />
            </Campo>
            <Campo id="nm-antig" rotulo="Antiguidade" erro={campos.antiguidade}>
              <Input id="nm-antig" name="antiguidade" type="number" min={1} />
            </Campo>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Campo id="nm-secao" rotulo="Unidade" erro={campos.secao ?? avisoDaLista(secoes)}>
              <EscolherUnidade id="nm-secao" rotulo="Unidade" unidades={doCadastro} todas={todas.data} valor={secaoEscolhida} aoEscolher={setSecao} />
            </Campo>
            <Campo id="nm-desde" rotulo="Lotado desde" erro={campos['lotacao.desde']}>
              <Input id="nm-desde" name="desde" type="date" defaultValue={hoje()} required />
            </Campo>
          </div>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <DialogFooter>
            <Button type="submit" disabled={salvando || !postos.data || !secoes.data || !secaoEscolhida}>Criar</Button>
          </DialogFooter>
        </form>
        {descarte.confirmacao}
      </DialogContent>
    </Dialog>
  );
}
