import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

// Entrega 6.53, Task 3: "ADM" (nunca "Adm") em todo texto mostrado, como o teste da 6.46 faz para o site. A varredura olha a API e o domínio (as mensagens e os rótulos que a tela mostra). Os comentários
// do código podem dizer "Adm". Os nomes de coluna e os valores aceitos na planilha de importação são contrato e não entram aqui (a planilha não usa "Adm" em coluna nenhuma).
const RAIZES = [join(__dirname, '..', 'src'), join(__dirname, '..', '..', '..', 'pacotes', 'dominio', 'src')];
const arquivos = (pasta: string): string[] => readdirSync(pasta).flatMap((n) => {
  const p = join(pasta, n);
  if (statSync(p).isDirectory()) return arquivos(p);
  return /\.tsx?$/.test(n) ? [p] : [];
});

/**
 * Os textos que o domínio herdou do protótipo e que os casos gravados (casos/) comparam letra por letra: mudar a grafia pede mudar o protótipo e gravar os casos de novo. O sistema novo não os mostra
 * (o parâmetro ADM_CUMPRE_CARGA não existe mais, e os motivos da distribuição de cotas do protótipo não saem em nenhuma rota).
 */
const GRAVADOS_NOS_CASOS = [/ADM_CUMPRE_CARGA/, /NÃO: o Adm só cumpre os saldos/, /expediente: 'choca com o expediente do Adm'/, /Saldo só para militar do Adm \(RN-03\)/];

describe('"ADM" em todo texto mostrado (6.53)', () => {
  it('nenhum arquivo da API nem do domínio escreve "Adm" num texto (só em comentário)', () => {
    const achados: string[] = [];
    for (const raiz of RAIZES) {
      for (const a of arquivos(raiz)) {
        readFileSync(a, 'utf8').split('\n').forEach((linha, i) => {
          const semComentario = linha.replace(/\/\/.*$/, '').replace(/^\s*\/?\*.*$/, '');
          if (/\bAdm\b/.test(semComentario) && !GRAVADOS_NOS_CASOS.some((r) => r.test(linha))) achados.push(`${relative(join(raiz, '..', '..', '..'), a).split(sep).join('/')}:${i + 1}: ${linha.trim().slice(0, 110)}`);
        });
      }
    }
    expect(achados).toEqual([]);
  });
});
