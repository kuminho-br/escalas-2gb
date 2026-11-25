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
  // os endereços antigos da consulta redirecionam para a pesquisa do Pecúlio Geral
  consulta: 'Pesquisar militares',
};

/** O endereço de cada item do menu, sem a barra do começo, e o nome dele: 'grade' → 'Grade geral', 'peculio/pesquisar' → 'Pesquisar militares'. */
const DO_MENU = new Map<string, string>(
  MODULOS.flatMap((m) => [...m.itens.flat(), ...(m.pe ?? []), ...(m.rota && m.itens.length === 0 ? [{ nome: m.nome, para: m.rota }] : [])])
    .filter((i): i is typeof i & { para: string } => typeof i.para === 'string')
    .map((i) => [i.para.slice(1), i.nome]),
);

export function tituloDaAba(caminho: string): string {
  const partes = caminho.split('/').filter(Boolean);
  const primeiro = (partes[0] ?? '').toLowerCase();
  if (!primeiro) return NOME_DO_SISTEMA;
  // a ficha de um militar (/militares/:id, /peculio/militar/:id) leva "Militar", e não o nome dele
  const daFicha = (primeiro === 'militares' && partes.length > 1) || (primeiro === 'peculio' && (partes[1] ?? '').toLowerCase() === 'militar');
  // o item do menu pelos dois primeiros trechos ('peculio/pesquisar') e, sem ele, pelo primeiro ('grade')
  const doMenu = DO_MENU.get(partes.slice(0, 2).join('/').toLowerCase()) ?? DO_MENU.get(primeiro);
  const nome = daFicha ? 'Militar' : (FORA_DO_MENU[primeiro] ?? doMenu);
  return nome ? `${nome} · ${NOME_DO_SISTEMA}` : NOME_DO_SISTEMA;
}
