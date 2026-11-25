import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, type EscalaDoMes } from 'contratos';
import { useEffect, useRef, useState } from 'react';
import { foiCancelado, mensagemDe } from '@/api/cliente';
import { consultaRegistroDoPasado, lancarPrevia, publicarEscala, republicarEscala } from '@/api/escala-do-mes';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Etiqueta } from '@/componentes/ui/etiqueta';
import { diaEMesBr } from '@/lib/meses';
import { BotaoDasAlteracoesNoPassado, ListaDasAlteracoesNoPassado } from './AlteracoesNoPassado';

type Passagem = 'previa' | 'publicar' | 'republicar';
const NOMES = { rascunho: 'Rascunho', previa: 'Prévia', publicada: 'Publicada', retificada: 'Retificada', remessada: 'Remessada' } as const;

/** A linha de apoio de cada estado (textos fixos da 7.4); em retificação ela diz isso, e, para quem não publica, quem publica. */
function apoioDe(e: EscalaDoMes['estado']): string {
  const em = e.em ? diaEMesBr(e.em) : '';
  if (e.emRetificacao) return 'Em retificação. O gestor republica quando terminar.';
  switch (e.estado) {
    case 'rascunho': return 'Só quem monta esta escala a vê.';
    case 'previa': return `Prévia lançada em ${em}${e.por ? ` por ${e.por}` : ''}. A sua unidade e as de baixo veem. Pode mudar até o dia do serviço.`;
    case 'publicada': return `Publicada em ${em}. Toda a corporação vê. Qualquer mudança agora é uma retificação.`;
    case 'retificada': return `Republicada em ${em}.`;
    case 'remessada': return `Remessada em ${em}. Só o administrador altera.`;
  }
}

/**
 * O estado da escala no mês e as passagens (7.4): o nome do estado com a etiqueta "Escala em retificação" quando é o caso, a linha de apoio, e os botões "Lançar prévia" (rascunho),
 * "Publicar" (rascunho ou prévia, só quem publica) e "Republicar" (em retificação, só quem publica). São botões secundários e nunca travam por vaga vazia: o escalante nunca é impedido de
 * fechar a escala. Numa unidade só de consulta, só o estado aparece. Depois da primeira mudança numa escala publicada, um aviso curto (sem confirmação antes).
 */
export function EstadoDaEscala({ escala, soConsulta }: { escala: EscalaDoMes; soConsulta: boolean }) {
  const queryClient = useQueryClient();
  const { estado, podePublicar } = escala;
  const [confirmando, setConfirmando] = useState<Passagem | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [registroAberto, setRegistroAberto] = useState(false);
  const [aviso, setAviso] = useState(false);
  const trava = useRef(false);
  // as alterações no passado: sem nenhuma (ou sem permissão para ler o registro), nada aparece
  const registro = useQuery(consultaRegistroDoPasado(escala.escalaId, escala.mes));
  const alteracoes = registro.data ?? [];
  const antes = useRef<{ chave: string; emRetificacao: boolean } | null>(null);
  const chave = `${escala.escalaId}|${escala.mes}`;

  // o aviso da primeira mudança: a etiqueta acende sem a pessoa recarregar a página (a resposta da mudança traz o estado novo); abrir a escala já em retificação não avisa
  useEffect(() => {
    const a = antes.current;
    if (!estado.emRetificacao || (a && a.chave !== chave)) setAviso(false);
    else if (a && a.chave === chave && !a.emRetificacao) setAviso(true);
    antes.current = { chave, emRetificacao: estado.emRetificacao };
  }, [chave, estado.emRetificacao]);
  // outra escala ou outro mês: o que era da anterior (o erro, o painel do registro) não vale
  useEffect(() => {
    setErro(null);
    setRegistroAberto(false);
    setConfirmando(null);
  }, [chave]);

  const podeLancar = !soConsulta && estado.estado === 'rascunho';
  const podePublicarAgora = !soConsulta && podePublicar && (estado.estado === 'rascunho' || estado.estado === 'previa');
  const podeRepublicar = !soConsulta && podePublicar && estado.emRetificacao;
  const mes = mesPorExtenso(escala.mes);
  const textos: Record<Passagem, { botao: string; pergunta: string }> = {
    previa: { botao: 'Lançar prévia', pergunta: `Lançar a prévia de ${escala.nome}, ${mes}? A sua unidade e as de baixo passam a ver esta escala. Você continua podendo alterar.` },
    publicar: { botao: 'Publicar', pergunta: `Publicar ${escala.nome}, ${mes}? Toda a corporação passa a ver esta escala. Daqui em diante, qualquer mudança é uma retificação.` },
    republicar: { botao: 'Republicar', pergunta: `Republicar ${escala.nome}, ${mes}? A corporação passa a ver a escala corrigida, sem a marca de retificação.` },
  };

  const passar = async () => {
    if (!confirmando || trava.current) return;
    trava.current = true;
    setOcupado(true);
    setErro(null);
    const qual = confirmando;
    try {
      await (qual === 'previa' ? lancarPrevia : qual === 'publicar' ? publicarEscala : republicarEscala)(queryClient, escala.escalaId, escala.mes);
      setConfirmando(null);
    } catch (e) {
      setConfirmando(null);
      if (!foiCancelado(e)) setErro(mensagemDe(e));
    } finally {
      trava.current = false;
      setOcupado(false);
    }
  };

  return (
    <section aria-label="Estado da escala" className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-linha bg-superficie px-4 py-3">
      <span className="font-cond text-lg font-semibold">{NOMES[estado.estado]}</span>
      {estado.emRetificacao && <Etiqueta tipo="falta">Escala em retificação</Etiqueta>}
      <p className="min-w-0 basis-full text-apoio text-apagado sm:basis-auto sm:flex-1">
        {apoioDe(estado)}
        {estado.emRetificacao && !podePublicar && <> <span>Quem publica é o gestor da unidade.</span></>}
      </p>
      <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
        {podeLancar && <Button type="button" variant="secundario" size="sm" onClick={() => setConfirmando('previa')}>Lançar prévia</Button>}
        {podePublicarAgora && <Button type="button" variant="secundario" size="sm" onClick={() => setConfirmando('publicar')}>Publicar</Button>}
        {podeRepublicar && <Button type="button" variant="secundario" size="sm" onClick={() => setConfirmando('republicar')}>Republicar</Button>}
        {alteracoes.length > 0 && <BotaoDasAlteracoesNoPassado total={alteracoes.length} aberto={registroAberto} aoAlternar={() => setRegistroAberto((a) => !a)} />}
      </div>
      {registroAberto && alteracoes.length > 0 && <ListaDasAlteracoesNoPassado linhas={alteracoes} />}
      {aviso && <p role="status" className="basis-full text-apoio text-pendencia">Esta escala está publicada. Ela ficou em retificação até o gestor republicar.</p>}
      {erro && <p role="alert" className="basis-full text-sm text-alerta">{erro}</p>}
      <Dialog open={confirmando !== null} onOpenChange={(o) => { if (!o && !ocupado) setConfirmando(null); }}>
        <DialogContent showCloseButton={false}>
          {confirmando && (
            <>
              <DialogHeader>
                <DialogTitle>{textos[confirmando].botao}</DialogTitle>
                <DialogDescription>{textos[confirmando].pergunta}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="secundario" disabled={ocupado} onClick={() => setConfirmando(null)}>Cancelar</Button>
                <Button type="button" disabled={ocupado} onClick={() => void passar()}>{textos[confirmando].botao}</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
