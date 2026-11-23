import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Entrega 6.25, Task 3: a árvore é genérica. Nenhuma regra do sistema compara o tipo da unidade com um valor fixo ("seção", "divisão"…): o tipo
// só é lido para mostrar o nome. A guarda vale para o código de produção de todos os pacotes (os testes e os dados de exemplo podem citar tipos).
const RAIZ = fileURLToPath(new URL('../../..', import.meta.url));
const TIPOS_FIXOS = /'(secao|divisao|grupamento|corporacao|diretoria_geral|diretoria_integrada)'/;
const NIVEL_ANTIGO = /chefe_divisao|chefeDivisao|chefe de divisão/i;

function fontes(pasta: string): string[] {
  return readdirSync(pasta).flatMap((nome) => {
    const caminho = join(pasta, nome);
    if (nome === 'node_modules' || nome === '__testes__' || nome === 'test') return [];
    if (statSync(caminho).isDirectory()) return fontes(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

const pastasDeCodigo = ['apps', 'pacotes'].flatMap((g) => readdirSync(join(RAIZ, g)).map((p) => join(RAIZ, g, p, 'src')).filter((p) => { try { return statSync(p).isDirectory(); } catch { return false; } }));
const arquivos = pastasDeCodigo.flatMap(fontes);

describe('nada preso ao tipo da unidade', () => {
  it('a busca percorre o código de produção', () => {
    expect(arquivos.length).toBeGreaterThan(100);
    expect(arquivos.some((a) => a.endsWith('estrutura.ts'))).toBe(true);
  });

  it('nenhuma linha compara o tipo da unidade com um tipo fixo', () => {
    const achados = arquivos.flatMap((arquivo) =>
      readFileSync(arquivo, 'utf8').split('\n').flatMap((linha, i) => (/\btipo\b/.test(linha) && TIPOS_FIXOS.test(linha) ? [`${relative(RAIZ, arquivo)}:${i + 1}: ${linha.trim()}`] : [])),
    );
    expect(achados).toEqual([]);
  });

  it('o nível antigo "chefe de divisão" não existe mais no código', () => {
    const achados = arquivos.flatMap((arquivo) =>
      readFileSync(arquivo, 'utf8').split('\n').flatMap((linha, i) => (NIVEL_ANTIGO.test(linha) ? [`${relative(RAIZ, arquivo)}:${i + 1}: ${linha.trim()}`] : [])),
    );
    expect(achados).toEqual([]);
  });
});
