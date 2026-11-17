// Regras puras das guarnições: o que mudou entre duas versões e qual versão vale num mês.
import type { VersaoSalva } from 'contratos';
import { normalizar } from 'dominio';

const ou = (v: string | number | null, vazio: string) => (v === null || v === '' ? vazio : String(v));

/** Diferenças campo a campo, em português; com `antes` nulo a versão é só 'nova'. */
export function diferencasDeVersao(antes: VersaoSalva | null, depois: VersaoSalva): string[] {
  if (!antes) return ['nova'];
  const d: string[] = [];
  if (ou(antes.viatura, '') !== ou(depois.viatura, '')) d.push(`viatura: ${ou(antes.viatura, 'sem viatura')} → ${ou(depois.viatura, 'sem viatura')}`);
  if (ou(antes.tipoViatura, '') !== ou(depois.tipoViatura, '')) d.push(`tipo: ${ou(antes.tipoViatura, 'sem tipo')} → ${ou(depois.tipoViatura, 'sem tipo')}`);
  if (antes.prioridade !== depois.prioridade) d.push(`prioridade: ${ou(antes.prioridade, 'sem prioridade')} → ${ou(depois.prioridade, 'sem prioridade')}`);
  if (antes.ativa !== depois.ativa) d.push(`ativa: ${antes.ativa ? 'sim' : 'não'} → ${depois.ativa ? 'sim' : 'não'}`);

  const anteriores = new Map(antes.composicao.map((c) => [normalizar(c.funcao), c]));
  const presentes = new Set<string>();
  for (const c of depois.composicao) {
    const k = normalizar(c.funcao);
    presentes.add(k);
    const a = anteriores.get(k);
    if (!a) {
      d.push(`${c.funcao}: incluída`);
      continue;
    }
    if (a.minimo !== c.minimo) d.push(`${c.funcao}: mínimo ${a.minimo} → ${c.minimo}`);
    if (a.maximo !== c.maximo) d.push(`${c.funcao}: máximo ${a.maximo} → ${c.maximo}`);
    if (ou(a.cnhExigida, '') !== ou(c.cnhExigida, '')) d.push(`${c.funcao}: CNH ${ou(a.cnhExigida, 'nenhuma')} → ${ou(c.cnhExigida, 'nenhuma')}`);
  }
  for (const a of antes.composicao) if (!presentes.has(normalizar(a.funcao))) d.push(`${a.funcao}: retirada`);
  return d;
}

/** A versão de maior vigência até o mês (aaaa-mm); null se nenhuma começou ainda. */
export function versaoNoMes<T extends { vigencia: string }>(versoes: T[], mes: string): T | null {
  let melhor: T | null = null;
  for (const v of versoes) if (v.vigencia <= mes && (!melhor || v.vigencia > melhor.vigencia)) melhor = v;
  return melhor;
}

/** Menor vigência a partir da qual todas as versões estão inativas; null se a mais recente está ativa. */
export function desativadaAPartirDe(versoes: { vigencia: string; ativa: boolean }[]): string | null {
  const ordem = [...versoes].sort((a, b) => (a.vigencia < b.vigencia ? -1 : 1));
  let desde: string | null = null;
  for (let i = ordem.length - 1; i >= 0 && !ordem[i]!.ativa; i--) desde = ordem[i]!.vigencia;
  return desde;
}
