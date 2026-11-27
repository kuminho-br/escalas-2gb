import { FRASE_DO_PEDIDO, MSG_ENVIO_FORA_DO_AR, MSG_MUITOS_PEDIDOS } from 'contratos';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { resumir } from '../src/acesso-por-email/codigo.ts';
import type { EmailParaEnviar, EnviarEmail } from '../src/acesso-por-email/enviar-email.ts';
import { criarApp } from '../src/app.ts';
import { hojeRecife, somarDias } from '../src/datas.ts';
import { criarMilitar, montarApi, URL_BASE, type ApiDeTeste } from './apoio-api.ts';

// Dados fictícios (D7): e-mails do domínio institucional, de militares inventados. Nenhum teste chama o Brevo: o envio é falso.
const SEGREDO = 'segredo-de-teste-com-tamanho-suficiente-123';
const DOMINIO = 'bombeiros.pe.gov.br';

let api: ApiDeTeste;
let foraDoAr: ApiDeTeste;
let relogio = new Date();
let envio: EnviarEmail;
const enviados: EmailParaEnviar[] = [];
let n = 0;
const novoEmail = () => `fulano${++n}@${DOMINIO}`;
let ip = 0;
const novaOrigem = () => `203.0.113.${++ip}`;

beforeAll(async () => {
  api = await montarApi(({ banco, auth }) => criarApp({ banco, auth, segredo: SEGREDO, enviarEmail: (m) => envio(m), agora: () => relogio, limiteDeBuscas: Infinity }));
  foraDoAr = await montarApi(({ banco, auth }) => criarApp({ banco, auth, segredo: SEGREDO, enviarEmail: null, limiteDeBuscas: Infinity }));
});
afterAll(async () => {
  await api.fechar();
  await foraDoAr.fechar();
});
afterEach(() => {
  relogio = new Date();
  envio = async (m) => {
    enviados.push(m);
  };
  vi.restoreAllMocks();
});
envio = async (m) => {
  enviados.push(m);
};

const pedirCodigo = (alvo: ApiDeTeste, email: string, origem?: string) =>
  alvo.app.request(`${URL_BASE}/api/acesso/codigo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: URL_BASE, ...(origem ? { 'x-forwarded-for': `${origem}, 10.0.0.1` } : {}) },
    body: JSON.stringify({ email }),
  });
const para = (email: string) => enviados.filter((m) => m.para === email);
const esperar = async (cond: () => Promise<boolean> | boolean) => {
  for (let i = 0; i < 100; i++) {
    if (await cond()) return;
    await new Promise((r) => setTimeout(r, 20));
  }
  throw new Error('a condição não veio');
};
const pedidosDe = async (email: string) =>
  (await api.banco.query<{ situacao: string; militar_id: string | null }>('select situacao, militar_id from pedido_de_codigo where email_resumo = $1 order by criado_em', [resumir(email, SEGREDO)])).rows;
/** Um militar fictício com e-mail, no estado de acesso pedido. */
async function militarCom(estado: 'sem-acesso' | 'provisoria' | 'ativo' | 'desativado', email = novoEmail()) {
  const id = await criarMilitar(api, { matricula: `99${String(7000 + ++n).padStart(4, '0')}-1`, email, unidadeId: api.ids.secao });
  if (estado !== 'sem-acesso') {
    expect((await api.pedir('admin', 'POST', `/api/militares/${id}/senha-provisoria`)).status).toBe(201);
    if (estado === 'ativo' || estado === 'desativado') await api.banco.query('update usuario set senha_provisoria_ate = null where militar_id = $1', [id]);
    if (estado === 'desativado') await api.banco.query('update usuario set ativo = false where militar_id = $1', [id]);
  }
  return { id, email };
}

describe('pedir o código', () => {
  it.each(['sem-acesso', 'provisoria', 'ativo'] as const)('militar com acesso "%s": 202, o código vai para o e-mail da ficha e o pedido fica enviado', async (estado) => {
    const { id, email } = await militarCom(estado);
    const r = await pedirCodigo(api, email, novaOrigem());
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ mensagem: FRASE_DO_PEDIDO });
    await esperar(() => para(email).length === 1);
    expect(para(email)[0]!.texto).toMatch(/^Seu código é \d{6}\. /);
    expect(await pedidosDe(email)).toEqual([{ situacao: 'enviado', militar_id: id }]);
  });

  it('e-mail que não existe, ou de acesso desativado: a mesma resposta, byte a byte, sem e-mail, e o pedido fica nao_enviado', async () => {
    const { id, email } = await militarCom('ativo');
    const existente = await pedirCodigo(api, email, novaOrigem());
    const inexistente = novoEmail();
    const desativado = (await militarCom('desativado')).email;
    const semFicha = await pedirCodigo(api, inexistente, novaOrigem());
    const comAcessoDesativado = await pedirCodigo(api, desativado, novaOrigem());
    expect([existente.status, semFicha.status, comAcessoDesativado.status]).toEqual([202, 202, 202]);
    const corpo = await existente.text();
    expect(await semFicha.text()).toBe(corpo);
    expect(await comAcessoDesativado.text()).toBe(corpo);
    expect(existente.headers.get('content-type')).toBe(semFicha.headers.get('content-type'));
    await new Promise((r) => setTimeout(r, 30));
    expect(para(inexistente)).toHaveLength(0);
    expect(para(desativado)).toHaveLength(0);
    expect(await pedidosDe(inexistente)).toEqual([{ situacao: 'nao_enviado', militar_id: null }]);
    expect(await pedidosDe(desativado)).toEqual([{ situacao: 'nao_enviado', militar_id: null }]);
    expect(id).toBeTruthy();
  });

  it('o e-mail pessoal (6.18) digitado não recebe nada', async () => {
    const { id } = await militarCom('ativo');
    const pessoal = `pessoal${++n}@exemplo.test`;
    await api.banco.query('update militar set email_pessoal = $2 where id = $1', [id, pessoal]);
    const r = await pedirCodigo(api, pessoal, novaOrigem());
    expect(r.status).toBe(202);
    await new Promise((r) => setTimeout(r, 30));
    expect(para(pessoal)).toHaveLength(0);
    expect(await pedidosDe(pessoal)).toEqual([{ situacao: 'nao_enviado', militar_id: null }]);
  });

  it('maiúsculas e espaços no e-mail digitado acham a ficha', async () => {
    const { email } = await militarCom('ativo');
    const r = await pedirCodigo(api, `  ${email.toUpperCase()} `, novaOrigem());
    expect(r.status).toBe(202);
    await esperar(() => para(email).length === 1);
  });

  it('e-mail malformado: 400 com o campo', async () => {
    const r = await pedirCodigo(api, 'isto-nao-e-email', novaOrigem());
    expect(r.status).toBe(400);
    expect(((await r.json()) as { campos: Record<string, string> }).campos.email).toBe('Digite o e-mail institucional completo.');
  });

  it('guarda só o resumo do código (e do e-mail): o código em claro não está em lugar nenhum do banco', async () => {
    const { email } = await militarCom('ativo');
    await pedirCodigo(api, email, novaOrigem());
    await esperar(() => para(email).length === 1);
    const codigo = /\d{6}/.exec(para(email)[0]!.texto)![0];
    const resumo = (await api.banco.query<{ codigo_resumo: string }>('select codigo_resumo from codigo_de_acesso where militar_id = (select id from militar where lower(email) = $1)', [email])).rows[0]!.codigo_resumo;
    expect(resumo).toBe(resumir(codigo, SEGREDO));
    expect(resumo).not.toContain(codigo);
    const auditoria = JSON.stringify((await api.banco.query('select * from auditoria')).rows);
    expect(auditoria).not.toContain(codigo);
    expect(auditoria).not.toContain(resumo);
    expect(auditoria).toContain(resumir(email, SEGREDO));
  });

  it('nada do código nem do resumo dele sai nos console.*', async () => {
    const espioes = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) => vi.spyOn(console, m).mockImplementation(() => undefined));
    const { email } = await militarCom('ativo');
    envio = async () => {
      throw new Error('falha de envio');
    };
    await pedirCodigo(api, email, novaOrigem());
    await esperar(async () => (await pedidosDe(email))[0]?.situacao === 'falhou');
    const saida = JSON.stringify(espioes.flatMap((e) => e.mock.calls));
    expect(saida).not.toMatch(/\d{6}/);
    expect(saida).not.toContain(email);
  });

  it('um pedido novo substitui o código vivo do militar', async () => {
    const { id, email } = await militarCom('ativo');
    await pedirCodigo(api, email, novaOrigem());
    await esperar(() => para(email).length === 1);
    const primeiro = (await api.banco.query<{ codigo_resumo: string }>('select codigo_resumo from codigo_de_acesso where militar_id = $1', [id])).rows[0]!.codigo_resumo;
    await pedirCodigo(api, email, novaOrigem());
    await esperar(() => para(email).length === 2);
    const vivos = (await api.banco.query<{ codigo_resumo: string; tentativas: number }>('select codigo_resumo, tentativas from codigo_de_acesso where militar_id = $1', [id])).rows;
    expect(vivos).toHaveLength(1);
    expect(vivos[0]!.codigo_resumo).not.toBe(primeiro);
    expect(vivos[0]!.codigo_resumo).toBe(resumir(/\d{6}/.exec(para(email)[1]!.texto)![0], SEGREDO));
  });

  it('o código vale 15 minutos a partir do pedido', async () => {
    const { id, email } = await militarCom('ativo');
    relogio = new Date('2026-12-02T15:00:00Z');
    await pedirCodigo(api, email, novaOrigem());
    await esperar(() => para(email).length === 1);
    const ate = (await api.banco.query<{ vale_ate: Date }>('select vale_ate from codigo_de_acesso where militar_id = $1', [id])).rows[0]!.vale_ate;
    expect(new Date(ate).toISOString()).toBe('2026-12-02T15:15:00.000Z');
  });
});

describe('os limites', () => {
  it('quarto pedido na hora para o mesmo endereço: 429, e a caixa recebe só 3 e-mails', async () => {
    const { email } = await militarCom('ativo');
    for (let i = 0; i < 3; i++) expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(202);
    const quarto = await pedirCodigo(api, email, novaOrigem());
    expect(quarto.status).toBe(429);
    expect(await quarto.json()).toEqual({ erro: MSG_MUITOS_PEDIDOS });
    await esperar(() => para(email).length === 3);
    await new Promise((r) => setTimeout(r, 30));
    expect(para(email)).toHaveLength(3);
  });

  it('passada a hora, o endereço pode pedir de novo', async () => {
    const email = novoEmail();
    relogio = new Date('2026-12-02T10:00:00Z');
    for (let i = 0; i < 3; i++) await pedirCodigo(api, email, novaOrigem());
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(429);
    relogio = new Date('2026-12-02T11:01:00Z');
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(202);
  });

  it('sétimo pedido em 24 horas: 429, mesmo com a hora livre', async () => {
    const email = novoEmail();
    const resumo = resumir(email, SEGREDO);
    for (const horas of [2, 3, 4, 5, 6, 7]) {
      await api.banco.query("insert into pedido_de_codigo (email_resumo, situacao, criado_em) values ($1, 'nao_enviado', $2)", [resumo, new Date(relogio.getTime() - horas * 3_600_000)]);
    }
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(429);
    // 24 horas depois do mais velho, sobra espaço
    relogio = new Date(relogio.getTime() + 18 * 3_600_000);
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(202);
  });

  it('décimo primeiro pedido da mesma origem na hora: 429, para qualquer endereço', async () => {
    const origem = novaOrigem();
    for (let i = 0; i < 10; i++) expect((await pedirCodigo(api, novoEmail(), origem)).status).toBe(202);
    expect((await pedirCodigo(api, novoEmail(), origem)).status).toBe(429);
    // outra origem não é afetada
    expect((await pedirCodigo(api, novoEmail(), novaOrigem())).status).toBe(202);
  });

  it('a origem só fica guardada como resumo, nunca em claro', async () => {
    const origem = novaOrigem();
    await pedirCodigo(api, novoEmail(), origem);
    const linhas = JSON.stringify((await api.banco.query('select * from pedido_de_codigo where origem_resumo = $1', [resumir(origem, SEGREDO)])).rows);
    expect(linhas).toContain(resumir(origem, SEGREDO));
    expect(JSON.stringify((await api.banco.query('select * from auditoria')).rows)).not.toContain(origem);
  });

  it('os limites contam também para o endereço que não existe', async () => {
    const email = novoEmail();
    for (let i = 0; i < 3; i++) expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(202);
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(429);
    expect(para(email)).toHaveLength(0);
  });
});

describe('o envio fora do ar', () => {
  it('sem enviarEmail: 503 para endereço cadastrado e para o que não existe, com a mesma frase', async () => {
    const posto = (await foraDoAr.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const email = novoEmail();
    await foraDoAr.banco.query("insert into militar (matricula, posto_grad_id, nome_guerra, email) values ('997801-1', $1, 'FORA', $2)", [posto, email]);
    const cadastrado = await pedirCodigo(foraDoAr, email, novaOrigem());
    const inexistente = await pedirCodigo(foraDoAr, novoEmail(), novaOrigem());
    expect([cadastrado.status, inexistente.status]).toEqual([503, 503]);
    expect(await cadastrado.json()).toEqual({ erro: MSG_ENVIO_FORA_DO_AR });
    expect(await inexistente.json()).toEqual({ erro: MSG_ENVIO_FORA_DO_AR });
    expect((await foraDoAr.banco.query('select 1 from pedido_de_codigo')).rows).toHaveLength(0);
  });

  it('com 280 envios no dia: 503 até a meia-noite de Recife; no dia seguinte, volta', async () => {
    const { email } = await militarCom('ativo');
    relogio = new Date('2026-12-10T18:00:00Z');
    const hoje = hojeRecife(relogio);
    const base = new Date('2026-12-10T12:00:00Z');
    await api.banco.query(
      `insert into pedido_de_codigo (email_resumo, situacao, criado_em, concluido_em)
       select 'cota' || g, case when g % 2 = 0 then 'enviado' else 'concluido' end, $1::timestamptz, case when g % 2 = 0 then null else $1::timestamptz end from generate_series(1, 280) g`,
      [base],
    );
    const r = await pedirCodigo(api, email, novaOrigem());
    expect(r.status).toBe(503);
    expect(await r.json()).toEqual({ erro: MSG_ENVIO_FORA_DO_AR });
    // 02h59 de 11/12 em Recife ainda é o dia 10 (UTC-3); 03h00 UTC já é o dia 11
    relogio = new Date('2026-12-11T02:59:00Z');
    expect(hojeRecife(relogio)).toBe(hoje);
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(503);
    relogio = new Date('2026-12-11T03:00:00Z');
    expect(hojeRecife(relogio)).toBe(somarDias(hoje, 1));
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(202);
  });

  it('279 envios no dia ainda deixam enviar; o que falhou não conta na cota', async () => {
    const { email } = await militarCom('ativo');
    relogio = new Date('2026-12-12T15:00:00Z');
    await api.banco.query("insert into pedido_de_codigo (email_resumo, situacao, criado_em) select 'cota2' || g, 'enviado', $1 from generate_series(1, 279) g", [new Date('2026-12-12T12:00:00Z')]);
    await api.banco.query("insert into pedido_de_codigo (email_resumo, situacao, criado_em) select 'falha' || g, 'falhou', $1 from generate_series(1, 50) g", [new Date('2026-12-12T12:00:00Z')]);
    expect((await pedirCodigo(api, email, novaOrigem())).status).toBe(202);
  });
});

describe('o envio que falha', () => {
  it('só para um endereço (o Brevo recusa a caixa): a mesma frase de sempre, e o pedido fica falhou, sem código vivo', async () => {
    const { id, email } = await militarCom('ativo');
    envio = async () => {
      throw new Error('Brevo: resposta 400.');
    };
    const r = await pedirCodigo(api, email, novaOrigem());
    expect(r.status).toBe(202);
    expect(await r.json()).toEqual({ mensagem: FRASE_DO_PEDIDO });
    await esperar(async () => (await pedidosDe(email))[0]?.situacao === 'falhou');
    expect((await api.banco.query('select 1 from codigo_de_acesso where militar_id = $1', [id])).rows).toHaveLength(0);
  });

  it('o log do envio que falha diz o status do Brevo, sem a chave, o código nem o endereço', async () => {
    const erros = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { email } = await militarCom('ativo');
    envio = async () => {
      throw new Error('Brevo: resposta 401.');
    };
    await pedirCodigo(api, email, novaOrigem());
    await esperar(async () => (await pedidosDe(email))[0]?.situacao === 'falhou');
    const saida = JSON.stringify(erros.mock.calls);
    expect(saida).toContain('Brevo: resposta 401.');
    expect(saida).not.toMatch(/\d{6}/);
    expect(saida).not.toContain(email);
  });

  it('a resposta não espera o envio: com o envio lento, ela volta antes dele terminar', async () => {
    const { email } = await militarCom('ativo');
    let terminou = false;
    envio = async () => {
      await new Promise((r) => setTimeout(r, 300));
      terminou = true;
    };
    const r = await pedirCodigo(api, email, novaOrigem());
    expect(r.status).toBe(202);
    expect(terminou).toBe(false);
    await esperar(() => terminou);
  });
});
