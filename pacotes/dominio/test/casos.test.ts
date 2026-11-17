// Reproduz os casos gravados do protótipo (casos/<funcao_>.json) contra o motor em TypeScript.
// funcao_ do protótipo = export funcao de src/index.ts.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as dominio from '../src/index.ts';

const pastaCasos = join(import.meta.dirname, '..', '..', '..', 'casos');
const catalogo = JSON.parse(readFileSync(join(pastaCasos, 'catalogo.json'), 'utf8')) as Record<string, string[]>;

type Caso = { teste: string; entrada: unknown[]; saida?: unknown; erro?: string };
const exportado = (funcao: string) => (dominio as Record<string, unknown>)[funcao.replace(/_$/, '')];

const pendentes: string[] = [];
for (const [modulo, funcoes] of Object.entries(catalogo)) {
  describe(modulo, () => {
    for (const funcao of funcoes) {
      const fn = exportado(funcao);
      if (typeof fn !== 'function') {
        pendentes.push(funcao);
        it.todo(funcao);
        continue;
      }
      const { casos } = JSON.parse(readFileSync(join(pastaCasos, `${funcao}.json`), 'utf8')) as { casos: Caso[] };
      if (!casos.length) {
        it.skip(`${funcao}: sem casos gravados (tem teste próprio)`);
        continue;
      }
      describe(funcao, () => {
        casos.forEach((caso, n) => {
          it(`${caso.teste} #${n}`, () => {
            const entrada = structuredClone(caso.entrada);
            if (caso.erro !== undefined) {
              expect(() => fn(...entrada)).toThrow(caso.erro);
              return;
            }
            const saida = fn(...entrada);
            expect(saida === undefined ? undefined : JSON.parse(JSON.stringify(saida))).toStrictEqual(caso.saida);
          });
        });
      });
    }
  });
}

it('toda função do catálogo tem port', () => {
  expect(pendentes).toEqual([]);
});
