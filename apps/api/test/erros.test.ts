import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { respostaDoErroDoBanco } from '../src/erros.ts';

// só o `json` do Hono importa aqui
const contexto = { json: (corpo: unknown, status: number) => new Response(JSON.stringify(corpo), { status }) } as unknown as Context;
const erro = (code: string, message: string) => Object.assign(new Error(message), { code });
const resposta = async (e: unknown, mensagens?: Record<string, string>) => {
  const r = respostaDoErroDoBanco(contexto, e, mensagens);
  return { status: r.status, corpo: await r.json() };
};

describe('mensagens dos erros do banco', () => {
  it('referência que não existe ao criar pede para recarregar', async () => {
    const r = await resposta(erro('23503', 'insert or update on table "cota" violates foreign key constraint "cota_servico_id_fkey"'));
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe('Um dos cadastros escolhidos não existe mais. Recarregue a tela e escolha de novo.');
  });

  it('referência que não existe ao alterar também pede para recarregar', async () => {
    const r = await resposta(erro('23503', 'insert or update on table "rastreio" violates foreign key constraint "x"'));
    expect(r.corpo.erro).toContain('Recarregue a tela');
  });

  it('remover algo em uso diz que está em uso', async () => {
    const r = await resposta(erro('23503', 'update or delete on table "servico" violates foreign key constraint "x" on table "cota"'));
    expect(r.status).toBe(409);
    expect(r.corpo.erro).toBe('Não dá para remover: o cadastro já está em uso.');
  });

  it('o texto próprio da rota continua valendo', async () => {
    const r = await resposta(erro('23503', 'insert or update on table "militar" violates foreign key constraint "x"'), { '23503': 'Posto, unidade ou equipe não encontrado.' });
    expect(r.corpo.erro).toBe('Posto, unidade ou equipe não encontrado.');
  });

  it('os outros códigos continuam como eram', async () => {
    expect((await resposta(erro('23505', 'duplicate key'))).corpo.erro).toBe('Já existe um cadastro com esse nome.');
    expect((await resposta(erro('23P01', 'x'))).corpo.erro).toBe('As datas se sobrepõem a outro período já cadastrado.');
    expect((await resposta(erro('P0001', 'Cota só existe para serviço PJES ou diária'))).corpo.erro).toBe('Cota só existe para serviço PJES ou diária');
  });

  it('erro desconhecido é relançado', () => {
    expect(() => respostaDoErroDoBanco(contexto, erro('XX000', 'x'))).toThrow();
  });
});
