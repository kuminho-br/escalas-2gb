import { describe, expect, it } from 'vitest';
import { preencherVagas } from '../src/preencher-vagas.ts';

// Regra só do sistema novo (entrega 3.1): na vez de cada vaga entra o mais antigo que ainda não foi usado e tem a CNH exigida.
// `vagas` chega na ordem de preenchimento; `candidatos`, do mais antigo para o mais novo.
const vaga = (chave: string, cnhExigida: string | null = null) => ({ chave, cnhExigida });
const cand = (id: string, cnh: string[] = []) => ({ id, cnh });

describe('preencherVagas: a ordem e a antiguidade', () => {
  it('menos candidatos que vagas: o mais antigo fica com a 1ª vaga e sobram vazias as últimas da ordem', () => {
    const r = preencherVagas([vaga('v1'), vaga('v2'), vaga('v3')], [cand('a'), cand('b')]);
    expect(r.atribuicoes).toEqual([{ chave: 'v1', id: 'a' }, { chave: 'v2', id: 'b' }]);
    expect(r.vazias).toEqual(['v3']);
    expect(r.semVaga).toEqual([]);
  });

  it('mais candidatos que vagas: os mais novos ficam sem vaga, na ordem de antiguidade', () => {
    const r = preencherVagas([vaga('v1'), vaga('v2')], [cand('a'), cand('b'), cand('c'), cand('d')]);
    expect(r.atribuicoes.map((x) => x.id)).toEqual(['a', 'b']);
    expect(r.semVaga).toEqual(['c', 'd']);
    expect(r.vazias).toEqual([]);
  });

  it('sem vagas, todos ficam sem vaga; sem candidatos, todas as vagas ficam vazias', () => {
    expect(preencherVagas([], [cand('a'), cand('b')])).toEqual({ atribuicoes: [], semVaga: ['a', 'b'], vazias: [] });
    expect(preencherVagas([vaga('v1'), vaga('v2')], [])).toEqual({ atribuicoes: [], semVaga: [], vazias: ['v1', 'v2'] });
  });
});

describe('preencherVagas: a CNH da vaga (hierarquia do CTB)', () => {
  it('o mais antigo sem a CNH é pulado nessa vaga e vai para a vaga seguinte', () => {
    const r = preencherVagas([vaga('motorista', 'D'), vaga('combatente')], [cand('antigo', ['B']), cand('moderno', ['E'])]);
    expect(r.atribuicoes).toEqual([{ chave: 'motorista', id: 'moderno' }, { chave: 'combatente', id: 'antigo' }]);
  });

  it('a categoria A é isolada: quem tem E não serve para a vaga que exige A', () => {
    const r = preencherVagas([vaga('moto', 'A')], [cand('a', ['E'])]);
    expect(r.atribuicoes).toEqual([]);
    expect(r.vazias).toEqual(['moto']);
    expect(r.semVaga).toEqual(['a']);
  });

  it('um candidato ocupa no máximo uma vaga, mesmo servindo para várias', () => {
    const r = preencherVagas([vaga('m1', 'D'), vaga('m2', 'D')], [cand('so', ['E'])]);
    expect(r.atribuicoes).toEqual([{ chave: 'm1', id: 'so' }]);
    expect(r.vazias).toEqual(['m2']);
  });
});
