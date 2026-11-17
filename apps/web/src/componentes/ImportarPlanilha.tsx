import { useQuery } from '@tanstack/react-query';
import type { Previa, ResultadoImportacao } from 'contratos';
import { Download, FileUp } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { enviarArquivo, mensagemDe } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { Button } from '@/componentes/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/componentes/ui/dialog';
import { Label } from '@/componentes/ui/label';

type Etapa = { tipo: 'escolher' } | { tipo: 'previa'; previa: Previa } | { tipo: 'feito'; gravados: number };

/** Importar da planilha sandbox: escolher o .xlsx, ver o que vai entrar e importar. */
export function ImportarPlanilha({ cadastro, rotulo, aoConcluir }: { cadastro: string; rotulo: string; aoConcluir: () => void }) {
  const { data: eu } = useQuery(consultaEu);
  const [aberto, setAberto] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'escolher' });
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const caminho = `/api/unidades/${eu?.unidade.id}/importacao/${cadastro}`;

  function abrirOuFechar(v: boolean) {
    setAberto(v);
    if (!v) {
      setEtapa({ tipo: 'escolher' });
      setArquivo(null);
      setErro(null);
    }
  }

  async function chamar(confirmar: boolean) {
    if (!arquivo) return;
    setErro(null);
    setEnviando(true);
    try {
      if (confirmar) {
        const r = await enviarArquivo<ResultadoImportacao>(`${caminho}?confirmar=1`, arquivo);
        setEtapa({ tipo: 'feito', gravados: r.gravados });
        aoConcluir();
      } else {
        setEtapa({ tipo: 'previa', previa: await enviarArquivo<Previa>(caminho, arquivo) });
      }
    } catch (e) {
      setErro(mensagemDe(e));
    } finally {
      setEnviando(false);
    }
  }

  function verPrevia(e: FormEvent) {
    e.preventDefault();
    void chamar(false);
  }

  return (
    <Dialog open={aberto} onOpenChange={abrirOuFechar}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <FileUp aria-hidden />
          Importar da planilha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar {rotulo} da planilha</DialogTitle>
          <DialogDescription>Nada é gravado antes de você conferir o que vai entrar.</DialogDescription>
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
            <div className="grid gap-1.5">
              <Label htmlFor="arquivo-planilha">Arquivo da planilha (.xlsx)</Label>
              <input
                id="arquivo-planilha"
                type="file"
                accept=".xlsx"
                onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                className="text-sm file:mr-3 file:rounded-md file:border file:border-linha file:bg-superficie file:px-3 file:py-1.5"
              />
            </div>
            {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
            <DialogFooter>
              <Button type="submit" disabled={!arquivo || enviando}>
                Ver o que vai entrar
              </Button>
            </DialogFooter>
          </form>
        )}

        {etapa.tipo === 'previa' && <PreviaImportacao previa={etapa.previa} erro={erro} enviando={enviando} aoImportar={() => void chamar(true)} />}

        {etapa.tipo === 'feito' && (
          <div className="grid gap-4">
            <p className="font-medium">{etapa.gravados} registros gravados.</p>
            <DialogFooter>
              <Button onClick={() => abrirOuFechar(false)}>Fechar</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviaImportacao({ previa, erro, enviando, aoImportar }: { previa: Previa; erro: string | null; enviando: boolean; aoImportar: () => void }) {
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
