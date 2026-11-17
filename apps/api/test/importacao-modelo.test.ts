import ExcelJS from 'exceljs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hojeRecife } from '../src/datas.ts';
import { coluna, lerPlanilha } from '../src/importacao/planilha.ts';
import { IMPORTADORES } from '../src/importacao/registro.ts';
import { inserir } from './banco-teste.ts';
import { montarApi, type ApiDeTeste } from './apoio-api.ts';
import { formulario, planilha } from './planilha-teste.ts';

let api: ApiDeTeste;
const caminhoModelo = (cadastro: string) => `/api/unidades/${api.ids.secao}/importacao/${cadastro}/modelo`;
const baixar = async (cadastro: string, quem: 'admin' | 'escalante' = 'admin') => {
  const r = await api.pedir(quem, 'GET', caminhoModelo(cadastro));
  expect(r.status).toBe(200);
  return r.arrayBuffer();
};
const textoDaAjuda = (wb: ExcelJS.Workbook) => {
  const partes: string[] = [];
  wb.getWorksheet('AJUDA')!.eachRow((row) => row.eachCell((c) => partes.push(String(c.text))));
  return partes.join('\n');
};

beforeAll(async () => {
  api = await montarApi();
});
afterAll(async () => {
  await api.fechar();
});

describe('modelo de planilha de cada importador', () => {
  for (const [cadastro, imp] of Object.entries(IMPORTADORES)) {
    describe(cadastro, () => {
      it('o modelo tem as abas do importador e a AJUDA por último', async () => {
        expect(imp.modelo.abas.map((a) => a.nome)).toEqual(imp.abas);
        const abas = Object.keys(await lerPlanilha(await baixar(cadastro)));
        expect(abas).toEqual([...imp.abas, 'AJUDA']);
      });

      it('o cabeçalho do modelo é achado pela leitura, coluna a coluna', async () => {
        const lidas = await lerPlanilha(await baixar(cadastro));
        for (const aba of imp.modelo.abas) {
          aba.colunas.forEach((col, i) => {
            expect(coluna(lidas[aba.nome]!, col.rotulo), `${aba.nome} › ${col.rotulo}`).toBe(i);
          });
        }
      });

      it('o modelo não traz linha de dados', async () => {
        const lidas = await lerPlanilha(await baixar(cadastro));
        for (const aba of imp.abas) expect(lidas[aba]!.linhas).toEqual([]);
      });

      it('importar o modelo vazio não grava nem dá problema', async () => {
        const lidas = await lerPlanilha(await baixar(cadastro));
        const { previa } = await api.banco.transacao((tx) => imp.planejar(lidas, { tx, unidadeId: api.ids.secao, hoje: hojeRecife() }));
        expect(previa).toMatchObject({ novos: [], alterados: [], problemas: [] });
      });
    });
  }

  it('a AJUDA de militares traz os postos, a seção e as equipes da unidade', async () => {
    await inserir(api.banco, 'equipe', { unidade_id: api.ids.secao, nome: 'Alfa', ordem_ciclo: 1 });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await baixar('militares'));
    const ajuda = textoDaAjuda(wb);
    expect(ajuda).toContain('SD BM');
    expect(ajuda).toContain('1ª SB');
    expect(ajuda).toContain('Alfa');
    expect(ajuda).toContain('MATRÍCULA');
  });

  it('a AJUDA de configurações lista as chaves que o sistema usa', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await baixar('configuracoes'));
    expect(textoDaAjuda(wb)).toContain('CARGA_MENSAL_HORAS');
  });

  it('JORNADA tem lista de opções', async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await baixar('militares'));
    const ws = wb.getWorksheet('MILITARES')!;
    const col = IMPORTADORES.militares!.modelo.abas[0]!.colunas.findIndex((c) => c.rotulo === 'JORNADA') + 1;
    expect(ws.getCell(2, col).dataValidation).toMatchObject({ type: 'list', formulae: ['"PRONTO,ADM"'] });
  });
});

describe('rota do modelo', () => {
  it('entrega o .xlsx com o nome do cadastro', async () => {
    const r = await api.pedir('escalante', 'GET', caminhoModelo('militares'));
    expect(r.status).toBe(200);
    expect(r.headers.get('content-type')).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(r.headers.get('content-disposition')).toBe('attachment; filename="modelo-militares.xlsx"');
  });

  it('modelo de configurações é 403 para escalante e 200 para quem escreve parâmetros', async () => {
    expect((await api.pedir('escalante', 'GET', caminhoModelo('configuracoes'))).status).toBe(403);
    expect((await api.pedir('admin', 'GET', caminhoModelo('configuracoes'))).status).toBe(200);
  });

  it('sem papel é 403', async () => {
    expect((await api.pedir('semPapel', 'GET', caminhoModelo('militares'))).status).toBe(403);
  });

  it('cadastro desconhecido é 404', async () => {
    expect((await api.pedir('escalante', 'GET', caminhoModelo('nao-existe'))).status).toBe(404);
  });
});

describe('mensagens da importação', () => {
  const enviar = async (arquivo: ArrayBuffer) => {
    const r = await api.pedir('escalante', 'POST', `/api/unidades/${api.ids.secao}/importacao/militares`, formulario(arquivo));
    expect(r.status).toBe(400);
    return (await r.json()).erro as string;
  };

  it('aba que falta sugere o modelo', async () => {
    const erro = await enviar(await planilha({ OUTRA: [['X']] }));
    expect(erro).toBe('A planilha não tem a aba "MILITARES". Baixe o modelo na tela de importação e cole os dados nele, ou confira o nome da aba.');
  });

  it('arquivo ilegível sugere colar só as abas no modelo', async () => {
    const erro = await enviar(new TextEncoder().encode('isto não é um xlsx').buffer as ArrayBuffer);
    expect(erro).toBe(
      'Não foi possível ler o arquivo. Se ele veio da sandbox inteira, o Google Planilhas pode ter exportado com defeito: baixe o modelo e cole só as abas nele.',
    );
  });
});
