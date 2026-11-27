import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Entrega 6.20, Task 1 (N1.5): a guarda de estilo. O site escreve cor, tamanho de letra e raio pelos tokens de `estilo.css`, e não à mão: cor (#rgb, #rrggbb, rgb()),
// tamanho de letra arbitrário (`text-[`) e raio arbitrário (`rounded-[`) em arquivo do site falham aqui. As exceções são só o que não é do sistema de estilo.
const RAIZ = join(__dirname, '..');
const EXCECOES: Record<string, string> = {
  'estilo.css': 'onde os tokens nascem',
  'lib/cores.ts': 'a paleta e o contraste das cores do serviço, que vêm do cadastro',
  'lib/transicao-login/cena.ts': 'a animação do login desenha num canvas, com as cores da cena',
  'componentes/oficiais/CalendarioDosOficiais.tsx': 'a cor padrão do serviço, quando o cadastro não traz a cor',
  // as telas das áreas N3 a N5 ainda têm medidas à mão (letra do menu em 11,5 px, a grade com tamanhos próprios): saem na entrega de cada área
  'componentes/Trilho.tsx': 'o menu (N3): letra do menu de 84 px',
  'componentes/grade/CelulaDaGrade.tsx': 'a Grade geral (N3): marca provisória',
  'componentes/grade/TabelaDaGrade.tsx': 'a Grade geral (N3): tamanhos próprios da tabela',
  'componentes/grade/LegendaDaGrade.tsx': 'a Grade geral (N3)',
};

function arquivos(pasta: string): string[] {
  return readdirSync(pasta).flatMap((n) => {
    const p = join(pasta, n);
    if (statSync(p).isDirectory()) return n === '__testes__' ? [] : arquivos(p);
    return /\.(tsx?|css)$/.test(n) ? [p] : [];
  });
}

const PADROES: [string, RegExp][] = [
  ['cor escrita à mão', /#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b(?![\w-])|\brgba?\(/],
  ['tamanho de letra arbitrário (text-[…])', /\btext-\[/],
  ['raio arbitrário (rounded-[…])', /\brounded-\[/],
];

describe('a guarda de estilo', () => {
  it('nenhum arquivo do site escreve cor, tamanho de letra ou raio à mão (fora das exceções, que dizem o porquê)', () => {
    const achados: string[] = [];
    for (const arquivo of arquivos(RAIZ)) {
      const rel = relative(RAIZ, arquivo).split(sep).join('/');
      if (rel in EXCECOES) continue;
      const linhas = readFileSync(arquivo, 'utf8').split('\n');
      linhas.forEach((l, i) => {
        for (const [nome, re] of PADROES) if (re.test(l)) achados.push(`${rel}:${i + 1}: ${nome}`);
      });
    }
    expect(achados).toEqual([]);
  });

  it('cada exceção existe e tem o motivo escrito (a lista não acumula arquivo que já passou a usar os tokens)', () => {
    const tem = (rel: string) => PADROES.some(([, re]) => re.test(readFileSync(join(RAIZ, rel), 'utf8')));
    for (const [rel, motivo] of Object.entries(EXCECOES)) {
      expect(motivo.length, rel).toBeGreaterThan(5);
      if (rel !== 'estilo.css') expect(tem(rel), `${rel} está na lista de exceções, mas já não escreve nada à mão`).toBe(true);
    }
  });
});
