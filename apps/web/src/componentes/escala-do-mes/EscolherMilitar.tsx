import { useQuery, useQueryClient } from '@tanstack/react-query';
import { mesPorExtenso, textoFaixa, textoHora, type Candidato, type CandidatoEmChoque } from 'contratos';
import { useState } from 'react';
import { mensagemDe } from '@/api/cliente';
import { acumular, consultaCandidatos, desfazerResolucao, escalar, escalarResolvendoChoque } from '@/api/escala-do-mes';
import { useTrava } from '@/componentes/AlteracoesPendentes';
import { CotaDeSaldo } from '@/componentes/CotaDeSaldo';
import { Placa } from '@/componentes/Placa';
import { useAviso } from '@/componentes/resposta/useAviso';
import { useConfirmar } from '@/componentes/resposta/useConfirmar';
import { Selecao } from '@/componentes/Selecao';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/componentes/ui/dialog';
import { Input } from '@/componentes/ui/input';
import { frasesDeFora } from '@/lib/escala';
import type { VagaDaTela } from './CardDaGuarnicao';
import { Espera } from '@/componentes/resposta/Espera';

/** "Escolher militar": só quem pode ocupar a vaga (CNH, choque, afastamento, voluntariado, lotação) e, no rodapé, quantos ficaram de fora e por quê. */
export function EscolherMilitar({ escalaId, vaga, aoFechar }: { escalaId: string; vaga: VagaDaTela; /** `escolheu`: fechou porque escalou (ou acumulou) alguém; sem ele, a pessoa desistiu. */ aoFechar: (escolheu?: boolean) => void }) {
  const queryClient = useQueryClient();
  const avisar = useAviso();
  const confirmar = useConfirmar();
  const mes = vaga.data.slice(0, 7);
  const candidatos = useQuery(consultaCandidatos(escalaId, mes, { data: vaga.data, inicio: vaga.inicio, fim: vaga.fim, guarnicaoId: vaga.guarnicaoId, funcaoId: vaga.funcaoId }));
  const [busca, setBusca] = useState('');
  const [mostrandoSemVoluntariado, setMostrandoSemVoluntariado] = useState(false);
  const [turnoDe, setTurnoDe] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const { salvando, travar } = useTrava();
  const dia = Number(vaga.data.slice(8));

  const escolher = travar(async (militarId: string, turnoId: string) => {
    setErro(null);
    try {
      await escalar(queryClient, escalaId, { militarId, data: vaga.data, turnoId, guarnicaoId: vaga.guarnicaoId, funcaoId: vaga.funcaoId });
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  /** "Tirar de lá e escalar aqui" (ou "do expediente"): confirma com a frase fixa, escala resolvendo o choque numa transação só e avisa com "Desfazer". */
  const resolver = travar(async (c: CandidatoEmChoque, s: CandidatoEmChoque['servicos'][number]) => {
    setErro(null);
    const quem = `${c.posto} ${c.nomeGuerra}`;
    const dd = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`;
    const ch = s.choque;
    const pergunta = ch.tipo === 'alocacao'
      ? `${quem} está em ${ch.servico}, ${dd(ch.data)} das ${textoHora(ch.inicio)} às ${textoHora(ch.fim)} (${ch.escala}). Tirar de lá e escalar aqui?`
      : `${quem} está de expediente em ${dd(ch.data)}. Tirar do expediente e escalar em ${s.nome}?`;
    if (!(await confirmar({ titulo: pergunta, verbo: 'Tirar e escalar' }))) return;
    try {
      const { desfazer } = await escalarResolvendoChoque(queryClient, escalaId, {
        militarId: c.militarId, data: vaga.data, turnoId: s.turnoId, guarnicaoId: vaga.guarnicaoId, funcaoId: vaga.funcaoId,
        resolverChoque: ch.tipo === 'alocacao' ? { alocacaoId: ch.alocacaoId } : { expediente: true },
      });
      avisar({
        texto: ch.tipo === 'alocacao' ? `${quem} saiu de ${ch.servico} e foi escalado aqui.` : `${quem} saiu do expediente e foi escalado em ${s.nome}.`,
        desfazer: async () => void (await desfazerResolucao(queryClient, desfazer)),
      });
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  const acumulando = travar(async (alocacaoId: string) => {
    setErro(null);
    try {
      await acumular(queryClient, alocacaoId, { guarnicaoId: vaga.guarnicaoId, funcaoId: vaga.funcaoId });
      aoFechar(true);
    } catch (e) {
      setErro(mensagemDe(e));
    }
  });

  const texto = busca.trim().toLowerCase();
  const combina = (c: { nomeGuerra: string; matricula: string }) => !texto || c.nomeGuerra.toLowerCase().includes(texto) || c.matricula.includes(texto);
  const aptos = (candidatos.data?.aptos ?? []).filter(combina);
  const semVoluntariado = (candidatos.data?.semVoluntariado ?? []).filter(combina);
  const paraAcumular = (candidatos.data?.acumular ?? []).filter(combina);
  const emChoque = (candidatos.data?.emChoque ?? []).filter(combina);

  /** Uma linha da lista (apto ou de quem só não marcou voluntariado): o botão de escolher e, havendo mais de um serviço, a troca de serviço. */
  const itemDe = (c: Candidato) => {
    const turnoId = turnoDe[c.militarId] ?? c.servicos[0]!.turnoId;
    return (
      <li key={c.militarId} className="flex items-center gap-2">
        <button
          type="button"
          disabled={salvando}
          onClick={() => void escolher(c.militarId, turnoId)}
          className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 rounded-md border border-linha px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
        >
          <span className="text-xs text-apagado">{c.posto}</span>
          <span className="font-cond text-base font-semibold">{c.nomeGuerra}</span>
          <span className="flex items-center gap-1.5 text-xs text-apagado">
            {c.saldos && <CotaDeSaldo feitos={c.saldos.feitos} total={c.saldos.total} />}
            {c.matricula}
          </span>
          <span className="text-xs text-apagado">{c.equipe ?? 'Adm'}</span>
        </button>
        {c.servicos.length > 1 && (
          <Selecao aria-label={`Serviço de ${c.nomeGuerra}`} value={turnoId} onChange={(e) => setTurnoDe({ ...turnoDe, [c.militarId]: e.target.value })} className="w-28">
            {c.servicos.map((s) => <option key={s.turnoId} value={s.turnoId}>{s.nome}</option>)}
          </Selecao>
        )}
      </li>
    );
  };

  return (
    <Dialog open onOpenChange={(v) => !v && aoFechar(false)}>
      {/* no celular (toque) o foco não vai para a busca: o teclado cobriria a lista, e só aparece quando a pessoa toca na caixa */}
      <DialogContent
        className="max-h-[85dvh] overflow-y-auto sm:max-w-lg"
        onOpenAutoFocus={(e) => {
          if (typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches) {
            e.preventDefault();
            (e.currentTarget as HTMLElement).focus();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Escolher militar</DialogTitle>
          <DialogDescription>
            Dia {dia} de {mesPorExtenso(mes)}, {textoFaixa(vaga.inicio, vaga.fim)}: {vaga.funcao}
            {vaga.cnhExigida ? ` (CNH ${vaga.cnhExigida})` : ''} na {vaga.guarnicao}.
          </DialogDescription>
        </DialogHeader>
        <Input aria-label="Buscar por nome ou matrícula" placeholder="Buscar por nome ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
        {candidatos.isPending && <Espera />}
        {candidatos.error && <p role="alert" className="text-alerta">{mensagemDe(candidatos.error)}</p>}
        {candidatos.data && (
          <>
            {candidatos.data.aptos.length === 0 && candidatos.data.acumular.length === 0 ? (
              <p className="text-apagado">Ninguém pode ocupar esta vaga agora.</p>
            ) : candidatos.data.aptos.length > 0 && (
              <ul className="grid max-h-80 gap-1.5 overflow-y-auto">
                {aptos.map(itemDe)}
              </ul>
            )}
            {emChoque.length > 0 && (
              <section aria-labelledby="em-choque-titulo" className="grid gap-1.5">
                <h3 id="em-choque-titulo" className="text-sm font-medium">Em choque com esta vaga</h3>
                <ul className="grid max-h-80 gap-2 overflow-y-auto">{emChoque.map((c) => <ItemEmChoque key={c.militarId} c={c} dataDaVaga={vaga.data} salvando={salvando} aoResolver={(s) => void resolver(c, s)} />)}</ul>
              </section>
            )}
            {paraAcumular.length > 0 && (
              <section aria-labelledby="acumular-titulo" className="grid gap-1.5">
                <h3 id="acumular-titulo" className="text-sm font-medium">Acumular com quem já está na faixa</h3>
                <ul className="grid max-h-60 gap-1.5 overflow-y-auto">
                  {paraAcumular.map((c) => (
                    <li key={c.alocacaoId}>
                      <button
                        type="button"
                        disabled={salvando}
                        onClick={() => void acumulando(c.alocacaoId)}
                        className="flex w-full min-w-0 flex-wrap items-baseline gap-x-2 rounded-md border border-linha px-3 py-2 text-left hover:bg-accent disabled:opacity-60"
                      >
                        <span className="text-xs text-apagado">{c.posto}</span>
                        <span className="font-cond text-base font-semibold">{c.nomeGuerra}</span>
                        <span className="text-xs text-apagado">{c.matricula}</span>
                        <span className="text-xs text-apagado">hoje em {c.vaga}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {candidatos.data.fora.length > 0 && (
              <p className="text-xs text-apagado">
                Ficaram de fora: {frasesDeFora(candidatos.data.fora)}
                {candidatos.data.semVoluntariado.length > 0 && (
                  <button type="button" onClick={() => setMostrandoSemVoluntariado((v) => !v)} className="ml-2 rounded text-xs font-medium text-vinho underline underline-offset-2">
                    {mostrandoSemVoluntariado ? 'Esconder' : 'Mostrar'}
                  </button>
                )}
              </p>
            )}
            {mostrandoSemVoluntariado && semVoluntariado.length > 0 && (
              <section aria-labelledby="sem-voluntariado-titulo" className="grid gap-1.5">
                <h3 id="sem-voluntariado-titulo" className="text-sm font-medium">Sem voluntariado neste horário</h3>
                <ul className="grid max-h-60 gap-1.5 overflow-y-auto">{semVoluntariado.map(itemDe)}</ul>
              </section>
            )}
          </>
        )}
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
      </DialogContent>
    </Dialog>
  );
}

/** Quem só não pode porque choca: a placa com a frase do que choca e, quando dá para resolver, o botão de tirar de lá e escalar aqui. */
function ItemEmChoque({ c, dataDaVaga, salvando, aoResolver }: { c: CandidatoEmChoque; dataDaVaga: string; salvando: boolean; aoResolver: (s: CandidatoEmChoque['servicos'][number]) => void }) {
  // o serviço que mostra: o primeiro que dá para resolver (o Saldo, para o Adm no expediente); senão, o primeiro
  const s = c.servicos.find((x) => x.choque.podeResolver) ?? c.servicos[0]!;
  const ch = s.choque;
  const frase = ch.tipo === 'expediente'
    ? 'De expediente neste dia.'
    : `Já está em ${ch.servico} das ${textoHora(ch.inicio)} às ${textoHora(ch.fim)}${ch.data === dataDaVaga ? '' : ` do dia ${ch.data.slice(8)}/${ch.data.slice(5, 7)}`} (${ch.escala}, ${ch.unidadeSigla}).`;
  const botao = ch.tipo === 'alocacao' ? `Tirar de ${ch.servico} e escalar aqui` : 'Tirar do expediente e escalar aqui';
  return (
    <li className="grid gap-1.5">
      <Placa
        patente={c.posto} nome={c.nomeGuerra} matricula={c.matricula} estado="choque" choque={frase}
        antesDaMatricula={c.saldos ? <CotaDeSaldo feitos={c.saldos.feitos} total={c.saldos.total} /> : undefined}
      />
      {ch.podeResolver && (
        <Button type="button" variant="secundario" size="sm" disabled={salvando} aria-label={`${botao}: ${c.posto} ${c.nomeGuerra}`} onClick={() => aoResolver(s)} className="justify-self-start">
          {botao}
        </Button>
      )}
    </li>
  );
}
