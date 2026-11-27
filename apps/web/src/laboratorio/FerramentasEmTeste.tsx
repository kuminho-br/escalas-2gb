import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { consultaFerramentas, type FerramentaDeTeste } from '@/api/laboratorio';
import { mensagemDe } from '@/api/cliente';
import { Espera } from '@/componentes/resposta/Espera';
import { Button } from '@/componentes/ui/button';
import { DeixarRetorno } from './DeixarRetorno';

const SITUACAO: Record<FerramentaDeTeste['situacao'], string> = { em_teste: 'Em teste', encerrada: 'Encerrada', virou_modulo: 'Virou módulo' };

/**
 * A lista das ferramentas em teste, na tela inicial do Laboratório (6.60): o nome, "O que testar", um atalho para a ferramenta (se tem caminho) e "Deixar retorno".
 * As que acabaram (encerradas e as que viraram módulo) ficam abaixo, apagadas, só para consulta.
 */
export function FerramentasEmTeste() {
  const ferramentas = useQuery(consultaFerramentas());
  const [retornando, setRetornando] = useState<string | null>(null);
  const todas = ferramentas.data ?? [];
  const emTeste = todas.filter((f) => f.situacao === 'em_teste');
  const acabadas = todas.filter((f) => f.situacao !== 'em_teste');

  return (
    <section aria-labelledby="ferramentas-em-teste" className="pb-8 md:pb-10">
      <h2 id="ferramentas-em-teste" className="font-cond text-bloco font-semibold">Ferramentas em teste</h2>
      {ferramentas.isPending && <Espera className="mt-2" />}
      {ferramentas.isError && <p role="alert" className="mt-2 text-corpo text-alerta">{mensagemDe(ferramentas.error)}</p>}
      {ferramentas.data && emTeste.length === 0 && <p className="mt-2 text-corpo text-apagado">Nenhuma ferramenta em teste agora.</p>}
      <ul className="mt-3 grid gap-2">
        {[...emTeste, ...acabadas].map((f) => {
          const ativa = f.situacao === 'em_teste';
          return (
            <li key={f.id} data-situacao={f.situacao} className={`grid gap-2 rounded-controle border border-linha bg-superficie p-3 md:p-4 ${ativa ? '' : 'text-apagado'}`}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <b className="font-cond text-nome leading-6 font-semibold">{f.nome}</b>
                <span className={`rounded-controle border px-1.5 text-apoio ${ativa ? 'border-laboratorio text-laboratorio' : 'border-linha'}`}>{SITUACAO[f.situacao]}</span>
              </div>
              <p className="text-corpo"><span className="font-medium">O que testar: </span>{f.oQueTestar}</p>
              {ativa && (
                <div className="flex flex-wrap gap-2">
                  {f.caminho && (
                    <Button asChild variant="secundario">
                      <Link to={f.caminho as never}>Abrir {f.nome}</Link>
                    </Button>
                  )}
                  <Button type="button" onClick={() => setRetornando(f.id)}>Deixar retorno</Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {retornando && <DeixarRetorno ferramentas={emTeste} ferramentaInicial={retornando} aoFechar={() => setRetornando(null)} />}
    </section>
  );
}
