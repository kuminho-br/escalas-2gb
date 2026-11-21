import type { Hono } from 'hono';
import { criarApp } from '../src/app.ts';
import { criarAuth, type Auth } from '../src/auth.ts';
import type { Banco } from '../src/banco/banco.ts';
import { hojeRecife } from '../src/datas.ts';
import { criarAdmin } from '../src/usuarios/criar-admin.ts';
import { bancoDeTeste, inserir } from './banco-teste.ts';

export const URL_BASE = 'http://localhost:8787';
const SENHA = 'senha-de-teste-123';

/** `gestorGb`: gestor do 2º GB, o "papel de cima" das seções (dono dos blocos do Pecúlio da ficha). */
export type Quem = 'admin' | 'escalante' | 'gestorGb' | 'semPapel';

export interface ApiDeTeste {
  banco: Banco;
  app: Pick<Hono, 'request'>;
  auth: Auth;
  ids: { raiz: string; gb: string; secao: string };
  usuarios: Record<Quem, string>;
  pedir(quem: Quem, metodo: string, caminho: string, corpo?: unknown): Promise<Response>;
  /** Corpo cru, com o tipo que a pessoa quiser (para entradas malformadas). */
  pedirBruto(quem: Quem, metodo: string, caminho: string, tipo: string, corpo: BodyInit): Promise<Response>;
  fechar(): Promise<void>;
}

/**
 * Militar fictício (D7), com e-mail ou sem, lotado na unidade (jornada adm, a partir do mês de hoje). Não cria usuário: quem testa o
 * acesso gera a senha pela API. Devolve o `militar.id`.
 */
export async function criarMilitar(api: ApiDeTeste, d: { matricula: string; email: string | null; unidadeId: string }): Promise<string> {
  const posto = (await api.banco.query<{ id: string }>("select id from posto_grad where sigla = 'SD BM'")).rows[0]!.id;
  const id = await inserir(api.banco, 'militar', { matricula: d.matricula, posto_grad_id: posto, nome_guerra: `TESTE${d.matricula.slice(3, 6)}`, email: d.email });
  await inserir(api.banco, 'rastreio', { militar_id: id, unidade_id: d.unidadeId, jornada: 'adm', desde: `${hojeRecife().slice(0, 7)}-01` });
  return id;
}

const idDe = async (banco: Banco, sigla: string) =>
  (await banco.query<{ id: string }>('select id from unidade where sigla = $1', [sigla])).rows[0]!.id;

/**
 * API com banco em memória e três usuários fictícios (D7): administrador na raiz,
 * escalante na 1ª SB e um militar comum (sem papel).
 */
export async function montarApi(fabricar?: (dep: { banco: Banco; auth: Auth }) => Pick<Hono, 'request'>): Promise<ApiDeTeste> {
  const banco = await bancoDeTeste();
  const auth = criarAuth({ banco, segredo: 'segredo-de-teste-com-tamanho-suficiente-123', urlBase: URL_BASE });
  const app = fabricar ? fabricar({ banco, auth }) : criarApp({ banco, auth });
  const ids = { raiz: await idDe(banco, 'CBMPE'), gb: await idDe(banco, '2º GB'), secao: await idDe(banco, '1ª SB') };
  const hoje = hojeRecife();

  const novo = (matricula: string, nome: string, email: string) =>
    criarAdmin(banco, { matricula, postoSigla: 'SD BM', nomeGuerra: nome, email, senha: SENHA, hoje });
  const admin = (await novo('990901-1', 'ADMIN', 'admin@exemplo.test')).usuarioId;
  const escalante = (await novo('990902-2', 'ESCALANTE', 'escalante@exemplo.test')).usuarioId;
  await banco.query("update papel_usuario set papel = 'escalante', unidade_id = $2 where usuario_id = $1", [escalante, ids.secao]);
  const gestorGb = (await novo('990908-8', 'GESTORGB', 'gestorgb@exemplo.test')).usuarioId;
  await banco.query("update papel_usuario set papel = 'gestor', unidade_id = $2 where usuario_id = $1", [gestorGb, ids.gb]);
  const semPapel = (await novo('990903-3', 'COMUM', 'comum@exemplo.test')).usuarioId;
  await banco.query('delete from papel_usuario where usuario_id = $1', [semPapel]);

  const cookies: Partial<Record<Quem, string>> = {};
  const emails: Record<Quem, string> = { admin: 'admin@exemplo.test', escalante: 'escalante@exemplo.test', gestorGb: 'gestorgb@exemplo.test', semPapel: 'comum@exemplo.test' };
  for (const quem of Object.keys(emails) as Quem[]) {
    const r = await app.request(`${URL_BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: URL_BASE },
      body: JSON.stringify({ email: emails[quem], password: SENHA }),
    });
    cookies[quem] = r.headers.getSetCookie().map((c) => c.split(';')[0]).join('; ');
  }

  return {
    banco,
    app,
    auth,
    ids,
    usuarios: { admin, escalante, gestorGb, semPapel },
    async pedir(quem, metodo, caminho, corpo) {
      const headers: Record<string, string> = { Cookie: cookies[quem]!, Origin: URL_BASE };
      let body: BodyInit | undefined;
      if (corpo instanceof FormData) body = corpo;
      else if (corpo !== undefined) {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify(corpo);
      }
      return app.request(`${URL_BASE}${caminho}`, { method: metodo, headers, body });
    },
    async pedirBruto(quem, metodo, caminho, tipo, corpo) {
      return app.request(`${URL_BASE}${caminho}`, { method: metodo, headers: { Cookie: cookies[quem]!, Origin: URL_BASE, 'Content-Type': tipo }, body: corpo });
    },
    fechar: () => banco.fechar(),
  };
}
