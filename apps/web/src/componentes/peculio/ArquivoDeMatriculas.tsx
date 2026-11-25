import { FileText, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/componentes/ui/button';
import { lerMatriculas } from '@/lib/matriculas-do-arquivo';

/** O arquivo traz no máximo isto; mais que isso, a pessoa divide em dois. */
export const MAXIMO_DE_MATRICULAS = 2000;

/**
 * "Por arquivo de matrículas" (6.51): `.txt` ou `.csv`, uma matrícula por linha na primeira coluna (cabeçalho opcional). O arquivo é lido no navegador e as matrículas
 * entram na busca no "Buscar"; nada é enviado antes. `aoLer` recebe as matrículas (vazio quando o arquivo sai ou não serve).
 */
export function ArquivoDeMatriculas({ matriculas, aoLer }: { matriculas: string[]; aoLer: (matriculas: string[]) => void }) {
  const [erro, setErro] = useState<string | null>(null);
  const [chave, setChave] = useState(0);
  const leitor = useRef<FileReader | null>(null);
  const escolher = (arquivo: File | undefined) => {
    setErro(null);
    if (!arquivo) return aoLer([]);
    const r = new FileReader();
    leitor.current = r;
    r.onload = () => {
      const lidas = lerMatriculas(String(r.result ?? ''));
      if (lidas.length === 0) { setErro('Nenhuma matrícula encontrada no arquivo.'); return aoLer([]); }
      if (lidas.length > MAXIMO_DE_MATRICULAS) { setErro('O arquivo tem mais de 2.000 matrículas. Divida em dois.'); return aoLer([]); }
      aoLer(lidas);
    };
    r.onerror = () => { setErro('Não deu para ler o arquivo. Tente de novo.'); aoLer([]); };
    r.readAsText(arquivo);
  };
  const tirar = () => { setErro(null); setChave((n) => n + 1); aoLer([]); };
  return (
    <div className="grid gap-2 rounded-xl border border-linha bg-superficie p-3">
      <p className="text-apoio text-apagado">Um arquivo .txt ou .csv com uma matrícula por linha (na primeira coluna; o cabeçalho é opcional).</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="grid gap-1 text-corpo">
          <span className="sr-only">Arquivo de matrículas</span>
          <input key={chave} type="file" aria-label="Arquivo de matrículas" accept=".txt,.csv,text/plain,text/csv" onChange={(e) => escolher(e.target.files?.[0])} className="text-corpo file:mr-3 file:rounded-controle file:border file:border-encaixe file:bg-superficie file:px-3 file:py-1.5 file:text-corpo hover:file:border-tinta" />
        </label>
        {matriculas.length > 0 && (
          <>
            <span className="flex items-center gap-1.5 text-corpo"><FileText className="size-4 text-apagado" aria-hidden />{matriculas.length === 1 ? '1 matrícula lida' : `${matriculas.length} matrículas lidas`}</span>
            <Button type="button" variant="discreto" onClick={tirar}><X aria-hidden />Tirar o arquivo</Button>
          </>
        )}
      </div>
      {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
    </div>
  );
}
