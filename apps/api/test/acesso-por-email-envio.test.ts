import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aposResponder, enviarPeloBrevo, escolherEnvio } from '../src/acesso-por-email/enviar-email.ts';
import { mensagemDoCodigo, resumir, sortearCodigo } from '../src/acesso-por-email/codigo.ts';
import { PASTA_MIGRACOES } from '../src/banco/migrar.ts';
import { bancoDeTeste } from './banco-teste.ts';

// Dados fictícios (D7). Nenhum teste chama o Brevo: o `fetch` é falso.
afterEach(() => vi.restoreAllMocks());

describe('as tabelas do código de acesso (0051)', () => {
  it('a migração vale em qualquer schema: sem "public." no texto', () => {
    const sql = readFileSync(join(PASTA_MIGRACOES, '0051_codigo_de_acesso.sql'), 'utf8');
    expect(sql).not.toMatch(/public\./i);
  });

  it('o gatilho de auditoria está em pedido_de_codigo e não está em codigo_de_acesso', async () => {
    const banco = await bancoDeTeste();
    const gatilhos = async (tabela: string) =>
      (await banco.query<{ n: number }>("select count(*)::int as n from pg_trigger where tgrelid = $1::regclass and tgname = 'auditoria_registro'", [tabela])).rows[0]!.n;
    expect(await gatilhos('pedido_de_codigo')).toBe(1);
    expect(await gatilhos('codigo_de_acesso')).toBe(0);
    await banco.fechar();
  });

  it('um militar tem um só código vivo: o pedido novo substitui, e a situação do pedido só aceita os quatro valores', async () => {
    const banco = await bancoDeTeste();
    const posto = (await banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD'")).rows[0]!.id;
    const militar = (await banco.query<{ id: string }>("insert into militar (matricula, posto_grad_id, nome_guerra) values ('997301-1', $1, 'CODIGO') returning id", [posto])).rows[0]!.id;
    const pedido = async (situacao: string) =>
      (await banco.query<{ id: string }>("insert into pedido_de_codigo (email_resumo, situacao) values ('x', $1) returning id", [situacao])).rows[0]!.id;
    const p = await pedido('enviado');
    await banco.query("insert into codigo_de_acesso (militar_id, pedido_id, codigo_resumo, vale_ate) values ($1, $2, 'a', now())", [militar, p]);
    await expect(banco.query("insert into codigo_de_acesso (militar_id, pedido_id, codigo_resumo, vale_ate) values ($1, $2, 'b', now())", [militar, p])).rejects.toThrow();
    await expect(pedido('qualquer')).rejects.toThrow();
    await banco.fechar();
  });
});

describe('sortearCodigo', () => {
  it('dá sempre 6 dígitos', () => {
    for (let i = 0; i < 300; i++) expect(sortearCodigo()).toMatch(/^\d{6}$/);
  });

  it('guarda os zeros à esquerda', () => {
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(((a: Uint32Array) => {
      a[0] = 5;
      return a;
    }) as typeof crypto.getRandomValues);
    expect(sortearCodigo()).toBe('000005');
  });

  it('descarta o sorteio que cairia no resto da divisão (sem viés)', () => {
    const sorteios = [4_294_967_295, 7];
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(((a: Uint32Array) => {
      a[0] = sorteios.shift()!;
      return a;
    }) as typeof crypto.getRandomValues);
    expect(sortearCodigo()).toBe('000007');
  });

  it('usa os dez dígitos em todas as casas', () => {
    const vistos = Array.from({ length: 6 }, () => new Set<string>());
    for (let i = 0; i < 600; i++) [...sortearCodigo()].forEach((d, k) => vistos[k]!.add(d));
    for (const v of vistos) expect(v.size).toBe(10);
  });
});

describe('resumir', () => {
  it('é estável e muda com o valor e com o segredo', () => {
    expect(resumir('123456', 'segredo')).toBe(resumir('123456', 'segredo'));
    expect(resumir('123456', 'segredo')).toMatch(/^[0-9a-f]{64}$/);
    expect(resumir('123456', 'segredo')).not.toBe(resumir('123457', 'segredo'));
    expect(resumir('123456', 'segredo')).not.toBe(resumir('123456', 'outro-segredo'));
  });
});

describe('mensagemDoCodigo', () => {
  it('tem o assunto e o texto fixos, sem link nem imagem', () => {
    const m = mensagemDoCodigo('048213');
    expect(m.assunto).toBe('Seu código de acesso ao Sistema de Gestão - 2º GB');
    expect(m.texto).toBe('Seu código é 048213. Ele vale por 15 minutos e serve uma vez. Se você não pediu este código, ignore este e-mail: sua senha não muda.');
    expect(m.html).toContain('048213');
    for (const parte of [m.texto, m.html]) expect(parte).not.toMatch(/https?:|<a |<img/i);
  });
});

describe('enviarPeloBrevo', () => {
  const mensagem = { para: 'fulano@exemplo.test', assunto: 'Assunto', texto: 'Texto 048213', html: '<p>Texto 048213</p>' };

  it('faz o POST na API do Brevo, com a chave no cabeçalho api-key e o corpo certo', async () => {
    const fetchFalso = vi.fn(async () => new Response('{"messageId":"x"}', { status: 201 }));
    await enviarPeloBrevo({ chave: 'chave-falsa-de-teste', remetente: 'sistema@exemplo.test', fetch: fetchFalso as unknown as typeof fetch })(mensagem);
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, init] = fetchFalso.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['api-key']).toBe('chave-falsa-de-teste');
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(init.body as string)).toEqual({
      sender: { name: 'Sistema de Gestão - 2º GB', email: 'sistema@exemplo.test' },
      to: [{ email: 'fulano@exemplo.test' }],
      subject: 'Assunto',
      textContent: 'Texto 048213',
      htmlContent: '<p>Texto 048213</p>',
    });
  });

  it('numa resposta fora de 2xx, lança sem a chave, sem o código e sem o corpo do pedido', async () => {
    const fetchFalso = vi.fn(async () => new Response('{"code":"invalid_parameter","message":"recusado 048213 chave-falsa-de-teste"}', { status: 400 }));
    const erro = await enviarPeloBrevo({ chave: 'chave-falsa-de-teste', remetente: 'sistema@exemplo.test', fetch: fetchFalso as unknown as typeof fetch })(mensagem).catch((e: unknown) => e as Error);
    expect(erro).toBeInstanceOf(Error);
    const texto = `${(erro as Error).message} ${(erro as Error).stack ?? ''}`;
    expect(texto).toContain('400');
    for (const proibido of ['chave-falsa-de-teste', '048213', 'fulano@exemplo.test']) expect(texto).not.toContain(proibido);
  });

  it('se o fetch falha (rede), o erro também não leva a chave nem o código', async () => {
    const fetchFalso = vi.fn(async () => {
      throw new Error('rede caiu: chave-falsa-de-teste 048213');
    });
    const erro = await enviarPeloBrevo({ chave: 'chave-falsa-de-teste', remetente: 'sistema@exemplo.test', fetch: fetchFalso as unknown as typeof fetch })(mensagem).catch((e: unknown) => e as Error);
    expect(erro).toBeInstanceOf(Error);
    for (const proibido of ['chave-falsa-de-teste', '048213']) expect((erro as Error).message).not.toContain(proibido);
  });
});

describe('aposResponder', () => {
  it('fora da Vercel, deixa a promessa correr e trata o erro sem derrubar o processo', async () => {
    const erros = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let correu = false;
    aposResponder(Promise.resolve().then(() => (correu = true) && undefined));
    aposResponder(Promise.reject(new Error('falhou')));
    await new Promise((r) => setTimeout(r, 10));
    expect(correu).toBe(true);
    expect(erros).not.toHaveBeenCalledWith(expect.stringContaining('chave'));
  });
});

describe('escolherEnvio (servidor local)', () => {
  it('sem ENVIO_DE_TESTE, o envio fica fora do ar (null)', () => {
    expect(escolherEnvio({})).toBeNull();
    expect(escolherEnvio({ DATABASE_URL: 'postgres://x' })).toBeNull();
  });

  it('com ENVIO_DE_TESTE=terminal e o banco local, escreve no terminal', () => {
    expect(typeof escolherEnvio({ ENVIO_DE_TESTE: 'terminal' })).toBe('function');
  });

  it('recusa ENVIO_DE_TESTE=terminal com DATABASE_URL: o código de um militar real sairia no terminal', () => {
    expect(() => escolherEnvio({ ENVIO_DE_TESTE: 'terminal', DATABASE_URL: 'postgres://x' })).toThrow(/ENVIO_DE_TESTE/);
  });
});
