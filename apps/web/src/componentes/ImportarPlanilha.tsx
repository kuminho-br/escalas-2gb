import { useQuery } from '@tanstack/react-query';
import { LIMITE_DA_IMPORTACAO_MB, MENSAGEM_ARQUIVO_GRANDE, type Previa, type ResultadoImportacao } from 'contratos';
import { Download, FileUp } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { baixarEnvio, enviarArquivo, ErroApi, mensagemDe } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/componentes/ui/dialog';
import { EnvioDeArquivo } from '@/componentes/ui/envio-de-arquivo';
import { hoje } from '@/lib/meses';
import { escolherUnidade, lerUnidadeGuardada } from '@/lib/unidade-de-trabalho';

type Etapa = { tipo: 'escolher' } | { tipo: 'previa'; previa: Previa } | { tipo: 'feito'; gravados: number; comProblema: boolean };
/** A importação teve linha recusada ou célula ignorada: há o que corrigir e enviar de novo. */
// (o problema da planilha inteira, na linha 1, como a coluna que falta, não vai no arquivo: o botão não conta com ele)
const temProblema = (p: Pick<Previa, 'problemas' | 'ignoradas'>) => p.problemas.some((x) => x.linha >= 2) || p.ignoradas.length > 0;

/**
 * O que fazer depois de uma confirmação que falhou: repetir só resolve quando o problema é da conexão ou do sistema; quando o servidor
 * recusou sem dizer o quê, é a planilha que se confere. O que a API disse por conta própria (a 409 das duas gravações ao mesmo tempo) fica.
 */
function mensagemDaConfirmacao(e: unknown): string {
  if (e instanceof ErroApi) {
    if (e.status === 0) return 'Sem conexão com o servidor. Tente de novo em alguns minutos.';
    if (e.status >= 500) return 'O sistema não conseguiu gravar agora. Tente de novo em alguns minutos.';
    if (e.padrao) return 'Confira a planilha pelo modelo e envie de novo.';
  }
  return mensagemDe(e);
}

/** Importar da planilha sandbox: escolher o .xlsx, ver o que vai entrar e importar. */
/** `unidadeId`: a unidade da importação, quando não é a unidade em que as telas trabalham (o módulo Pecúlio importa pelo 2º GB). */
export function ImportarPlanilha({ cadastro, rotulo, aoConcluir, unidadeId, destino }: { cadastro: string; rotulo: string; aoConcluir: () => void; unidadeId?: string; destino?: string }) {
  // a unidade em que a tela trabalha: a mesma conta do `_app` (a escolha vale por aba, então as duas leituras coincidem)
  const { data: eu } = useQuery(consultaEu);
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'escolher' });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const caminho = `/api/unidades/${unidadeId ?? (eu && escolherUnidade(eu, lerUnidadeGuardada())?.id)}/importacao/${cadastro}`;
  // cada vez que o diálogo abre ou fecha começa uma "rodada": a resposta de um envio de uma rodada anterior não mexe na tela da atual
  const rodada = useRef(0);
  // a confirmação grava no servidor mesmo com o diálogo fechado: se ele fechou enquanto ela rodava, reabrir não zera a tela (o resultado, ou o
  // erro, está lá e não dá para mandar uma segunda confirmação por cima)
  const confirmando = useRef(false);
  const fechouConfirmando = useRef(false);

  function abrirOuFechar(v: boolean) {
    if ((!v && confirmando.current) || (v && fechouConfirmando.current)) {
      fechouConfirmando.current = !v;
      setAberto(v);
      return;
    }
    rodada.current += 1;
    setAberto(v);
    // abrir e fechar começam do zero: etapa de escolher o arquivo, sem arquivo, sem erro e sem envio em andamento
    setEtapa({ tipo: 'escolher' });
    setArquivo(null);
    setErro(null);
    setEnviando(false);
  }

  async function chamar(confirmar: boolean) {
    if (!arquivo) return;
    setErro(null);
    // a hospedagem recusa envio acima de 4,5 MB sem dizer o que fazer: a tela avisa antes de enviar
    if (arquivo.size > LIMITE_DA_IMPORTACAO_MB * 1024 * 1024) {
      setErro(MENSAGEM_ARQUIVO_GRANDE);
      return;
    }
    setEnviando(true);
    const minha = rodada.current;
    confirmando.current = confirmar;
    try {
      if (confirmar) {
        const r = await enviarArquivo<ResultadoImportacao>(`${caminho}?confirmar=1`, arquivo);
        // gravou mesmo que o diálogo tenha fechado: a lista por trás precisa atualizar
        aoConcluir();
        if (minha === rodada.current) setEtapa({ tipo: 'feito', gravados: r.gravados, comProblema: temProblema(r) });
      } else {
        const previa = await enviarArquivo<Previa>(caminho, arquivo);
        if (minha === rodada.current) setEtapa({ tipo: 'previa', previa });
      }
    } catch (e) {
      if (minha === rodada.current) setErro(confirmar ? mensagemDaConfirmacao(e) : mensagemDe(e));
    } finally {
      if (confirmar) confirmando.current = false;
      if (minha === rodada.current) setEnviando(false);
    }
  }

  /** A planilha das linhas com problema (6.57): o mesmo arquivo, reenviado com `?erros=1`, volta só com as linhas que a pessoa precisa corrigir. */
  async function baixarLinhasComProblema() {
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    const minha = rodada.current;
    try {
      await baixarEnvio(`${caminho}?erros=1`, arquivo, `${cadastro}-linhas-com-problema-${hoje()}.xlsx`);
    } catch (e) {
      if (minha === rodada.current) setErro(mensagemDe(e));
    } finally {
      if (minha === rodada.current) setEnviando(false);
    }
  }

  function verPrevia(e: FormEvent) {
    e.preventDefault();
    void chamar(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button variant="secundario">
          <FileUp aria-hidden />
          Importar
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar {rotulo} da planilha</DialogTitle>
          <DialogDescription>Nada é gravado antes de você conferir o que vai entrar.</DialogDescription>
          {destino && <p className="text-sm font-medium">{`Unidade da importação: ${destino} e as de baixo.`}</p>}
        </DialogHeader>

        {etapa.tipo === 'escolher' && (
          <form onSubmit={verPrevia} className="grid gap-3">
            <p className="text-sm text-apagado">
              Baixe o modelo, cole os dados nas abas dele e envie o arquivo aqui. A planilha sandbox baixada em .xlsx também serve.
            </p>
            <a
              href={`${caminho}/modelo`}
              download
              className="inline-flex w-fit items-center gap-2 text-sm font-medium text-vinho underline underline-offset-2"
            >
              <Download className="size-4" aria-hidden />
              Baixar modelo
            </a>
            <EnvioDeArquivo id="arquivo-planilha" rotulo="Arquivo da planilha (.xlsx)" accept=".xlsx" arquivo={arquivo} aoEscolher={setArquivo} />
            {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
            <DialogFooter>
              <Button type="submit" disabled={!arquivo || enviando}>
                Ver o que vai entrar
              </Button>
            </DialogFooter>
          </form>
        )}

        {etapa.tipo === 'previa' && <PreviaImportacao previa={etapa.previa} erro={erro} enviando={enviando} aoImportar={() => void chamar(true)} aoBaixarProblemas={() => void baixarLinhasComProblema()} />}

        {etapa.tipo === 'feito' && (
          <div className="grid gap-4">
            <p className="font-medium">{etapa.gravados} registros gravados.</p>
            {etapa.comProblema && <BotaoDasLinhasComProblema enviando={enviando} aoBaixar={() => void baixarLinhasComProblema()} />}
            {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
            <DialogFooter>
              <Button onClick={() => abrirOuFechar(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** "Baixar as linhas com problema": só as linhas recusadas ou com célula ignorada, com o motivo e como corrigir, para corrigir no Excel e enviar de novo. */
function BotaoDasLinhasComProblema({ enviando, aoBaixar }: { enviando: boolean; aoBaixar: () => void }) {
  return (
    <Button type="button" variant="secundario" className="justify-self-start" disabled={enviando} onClick={aoBaixar}>
      <Download aria-hidden />
      Baixar as linhas com problema
    </Button>
  );
}

function PreviaImportacao({ previa, erro, enviando, aoImportar, aoBaixarProblemas }: { previa: Previa; erro: string | null; enviando: boolean; aoImportar: () => void; aoBaixarProblemas: () => void }) {
  const gravar = previa.novos.length + previa.alterados.length;
  return (
    <div className="grid gap-4 text-sm">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['Novos', previa.novos.length],
          ['Alterados', previa.alterados.length],
          ['Já iguais', previa.iguais],
        ].map(([rotulo, n]) => (
          <div key={rotulo} className="rounded-lg border border-linha px-2 py-2">
            <dt className="text-apagado">{rotulo}</dt>
            <dd className="font-cond text-2xl font-semibold">{n}</dd>
          </div>
        ))}
      </dl>

      {previa.problemas.length > 0 && (
        <section>
          <h3 className="font-medium text-alerta">Vão ficar de fora ({previa.problemas.length})</h3>
          <ul className="mt-1 grid gap-1.5">
            {previa.problemas.map((p, i) => (
              <li key={i}>
                Linha {p.linha} da aba {p.aba}: {p.mensagem} <span className="text-apagado">{p.solucao}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {previa.ignoradas.length > 0 && (
        <section aria-labelledby="dados-ignorados">
          <h3 id="dados-ignorados" className="font-medium text-pendencia">Dados ignorados ({previa.ignoradas.length})</h3>
          <p className="text-apagado">Estas células não foram gravadas; o resto de cada linha entra.</p>
          <ul className="mt-1 grid gap-1.5">
            {previa.ignoradas.map((c, i) => (
              <li key={i}>
                Linha {c.linha}, {c.chave}, {c.coluna}: <span className="text-apagado">{c.motivo}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {previa.avisos.length > 0 && (
        <section>
          <h3 className="font-medium">Avisos</h3>
          <ul className="mt-1 grid gap-1 text-apagado">
            {previa.avisos.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
        </section>
      )}

      {previa.novos.length > 0 && (
        <section>
          <h3 className="font-medium">Novos</h3>
          <ul className="mt-1 grid gap-0.5">
            {previa.novos.map((n) => (
              <li key={n.chave}>{n.descricao}</li>
            ))}
          </ul>
        </section>
      )}

      {previa.alterados.length > 0 && (
        <section>
          <h3 className="font-medium">Alterados</h3>
          <ul className="mt-1 grid gap-1">
            {previa.alterados.map((a) => (
              <li key={a.chave}>
                {a.descricao}
                {a.mudancas?.length ? <span className="text-apagado">: {a.mudancas.join('; ')}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      {temProblema(previa) && <BotaoDasLinhasComProblema enviando={enviando} aoBaixar={aoBaixarProblemas} />}
      {erro && <p role="alert" className="text-alerta">{erro}</p>}
      <DialogFooter>
        {gravar === 0 ? (
          <p className="text-apagado">Nada a gravar: o sistema já está igual à planilha.</p>
        ) : (
          <Button onClick={aoImportar} disabled={enviando}>
            Importar {gravar}, pular {previa.problemas.length}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
