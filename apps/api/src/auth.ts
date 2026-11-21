import { betterAuth } from 'better-auth';
import { APIError } from 'better-auth/api';
import type { Banco } from './banco/banco.ts';
import { MSG_SENHA_VENCIDA } from './usuarios/mensagens.ts';

/** Login por e-mail e senha (D3), com as tabelas do esquema em português. Sem cadastro aberto. */
export function criarAuth(cfg: { banco: Banco; segredo: string; urlBase: string }) {
  const { banco } = cfg;
  return betterAuth({
    secret: cfg.segredo,
    baseURL: cfg.urlBase,
    basePath: '/api/auth',
    trustedOrigins: [cfg.urlBase],
    database: { dialect: banco.dialeto, type: 'postgres' },
    emailAndPassword: { enabled: true, disableSignUp: true, minPasswordLength: 10 },
    advanced: { database: { generateId: 'uuid' } },
    user: {
      modelName: 'usuario',
      fields: {
        name: 'nome',
        email: 'email',
        emailVerified: 'email_verificado',
        image: 'imagem',
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      },
      additionalFields: {
        militarId: { type: 'string', fieldName: 'militar_id', required: true, input: false },
        ativo: { type: 'boolean', fieldName: 'ativo', required: false, input: false, defaultValue: true },
      },
    },
    session: {
      modelName: 'sessao',
      fields: {
        userId: 'usuario_id',
        token: 'token',
        expiresAt: 'expira_em',
        ipAddress: 'ip',
        userAgent: 'agente',
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      },
    },
    account: {
      modelName: 'conta',
      fields: {
        userId: 'usuario_id',
        accountId: 'conta_id',
        providerId: 'provedor_id',
        password: 'senha',
        accessToken: 'token_acesso',
        refreshToken: 'token_renovacao',
        idToken: 'token_id',
        accessTokenExpiresAt: 'expira_token_acesso',
        refreshTokenExpiresAt: 'expira_token_renovacao',
        scope: 'escopo',
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      },
    },
    verification: {
      modelName: 'verificacao',
      fields: {
        identifier: 'identificador',
        value: 'valor',
        expiresAt: 'expira_em',
        createdAt: 'criado_em',
        updatedAt: 'atualizado_em',
      },
    },
    databaseHooks: {
      session: {
        create: {
          // usuário desativado não recebe sessão; senha provisória vencida também não, e a resposta diz que venceu
          // (e não "e-mail ou senha incorretos"), para a pessoa saber que precisa pedir outra
          before: async (sessao) => {
            const { rows } = await banco.query<{ ativo: boolean; vencida: boolean }>(
              'select ativo, coalesce(senha_provisoria_ate < now(), false) as vencida from usuario where id = $1',
              [sessao.userId],
            );
            if (!rows[0]?.ativo) return false;
            if (rows[0].vencida) throw new APIError('FORBIDDEN', { message: MSG_SENHA_VENCIDA });
            return undefined;
          },
        },
      },
    },
  });
}

export type Auth = ReturnType<typeof criarAuth>;
