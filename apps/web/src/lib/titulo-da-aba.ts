// O título da aba do navegador: "{tela} · Sistema de Gestão - 2º GB". O nome da tela é o do menu; na ficha, "Militar"; no login, "Entrar";
// na tela inicial, só o nome do sistema. Nenhum nome de militar vai para o título (ele fica no histórico do navegador e nos favoritos).
import { MODULOS } from './modulos';

export const NOME_DO_SISTEMA = 'Sistema de Gestão - 2º GB';

/** As telas que não estão no menu (ou que têm um nome próprio na aba). */
const FORA_DO_MENU: Record<string, string> = {
  entrar: 'Entrar',
  'criar-senha': 'Criar senha',
  'sem-lotacao': 'Sem lotação',
  'efetivo-do-dia': 'Efetivo do dia',
  guarnicoes: 'Guarnições',
};

/** O primeiro trecho de cada endereço do menu e o nome dele: '/grade' → 'Grade geral'. */
const DO_MENU = new Map<string, string>(
  MODULOS.flatMap((m) => [...m.itens.flat(), ...(m.pe ?? []), ...(m.rota && m.itens.length === 0 ? [{ nome: m.nome, para: m.rota }] : [])])
    .filter((i): i is typeof i & { para: string } => typeof i.para === 'string')
    .map((i) => [i.para.split('/')[1]!, i.nome]),
);

export function tituloDaAba(caminho: string): string {
  const partes = caminho.split('/').filter(Boolean);
  const primeiro = (partes[0] ?? '').toLowerCase();
  if (!primeiro) return NOME_DO_SISTEMA;
  // a ficha de um militar (/militares/:id) leva "Militar", e não o nome dele
  const nome = primeiro === 'militares' && partes.length > 1 ? 'Militar' : (FORA_DO_MENU[primeiro] ?? DO_MENU.get(primeiro));
  return nome ? `${nome} · ${NOME_DO_SISTEMA}` : NOME_DO_SISTEMA;
}
