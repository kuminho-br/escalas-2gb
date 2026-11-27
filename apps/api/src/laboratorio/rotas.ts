// As rotas do Laboratório no REAL (6.59): escolher o perfil de teste, ver o perfil em uso e sair. Só quem tem conta (a mesma regra de acesso do site).
// O sistema inteiro sobre o espelho vive em `/api/lab/*` (`rotas-lab.ts`).
import { EscolherPerfil } from 'contratos';
import { Hono } from 'hono';
import { exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import type { Banco } from '../banco/banco.ts';
import { lerCorpo } from '../erros.ts';
import { EM_MANUTENCAO, PERFIL_NAO_ENCONTRADO, entrarNoLaboratorio, espelhoExiste, listarPerfis, perfilDoLaboratorio, sairDoLaboratorio } from './sessao.ts';

export function rotasDoLaboratorio(dep: { banco: Banco; auth: Auth }): Hono<AmbienteApi> {
  const r = new Hono<AmbienteApi>();
  r.use('/laboratorio/*', exigirSessao(dep.banco, dep.auth));
  // o espelho ainda não foi criado neste banco (migração pendente do lado dele): o real segue normal, o Laboratório avisa
  r.use('/laboratorio/*', async (c, next) => ((await espelhoExiste(dep.banco)) ? next() : c.json({ erro: EM_MANUTENCAO }, 503)));

  r.get('/laboratorio/perfis', async (c) => c.json(await listarPerfis(dep.banco)));
  r.get('/laboratorio/eu', async (c) => c.json(await perfilDoLaboratorio(dep.banco, c.get('usuarioId'))));
  r.put('/laboratorio/perfil', async (c) => {
    const corpo = await lerCorpo(c, EscolherPerfil);
    if (!corpo.ok) return corpo.resposta;
    const entrou = await entrarNoLaboratorio(dep.banco, c.get('usuarioId'), corpo.dados.perfilId);
    return entrou ? c.json(entrou) : c.json({ erro: PERFIL_NAO_ENCONTRADO }, 400);
  });
  r.delete('/laboratorio/perfil', async (c) => {
    await sairDoLaboratorio(dep.banco, c.get('usuarioId'));
    return c.json({ ok: true });
  });
  return r;
}
