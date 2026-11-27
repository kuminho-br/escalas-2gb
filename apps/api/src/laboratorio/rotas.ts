// As rotas do Laboratório no REAL (6.59): escolher o perfil de teste, ver o perfil em uso e sair. Só quem tem conta (a mesma regra de acesso do site).
// O sistema inteiro sobre o espelho vive em `/api/lab/*` (`rotas-lab.ts`).
import { Data, EscolherPerfil, MudarFerramenta, NovaFerramenta, NovoRetorno } from 'contratos';
import { Hono } from 'hono';
import { exigirAdministradorRaiz, exigirSessao, type AmbienteApi } from '../acesso.ts';
import type { Auth } from '../auth.ts';
import { comUsuario, type Banco } from '../banco/banco.ts';
import { hojeRecife } from '../datas.ts';
import { lerCorpo } from '../erros.ts';
import { criarFerramenta, listarFerramentas, mudarFerramenta, umaFerramenta } from './ferramentas.ts';
import { recomecarEspelho } from './recomecar.ts';
import { gravarRetorno, listarRetornos } from './retornos.ts';
import { EM_MANUTENCAO, PERFIL_NAO_ENCONTRADO, entrarNoLaboratorio, espelhoExiste, listarPerfis, perfilDoLaboratorio, sairDoLaboratorio } from './sessao.ts';

const NAO_ACHOU_A_FERRAMENTA = 'Ferramenta não encontrada.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // recomeçar: o espelho volta ao estado da carga de teste. Só o administrador DA CONTA REAL (o perfil de administrador de teste não vale aqui)
  r.post('/laboratorio/recomecar', async (c) => {
    const negado = await exigirAdministradorRaiz(c, 'Só o administrador do sistema recomeça o Laboratório.');
    if (negado) return negado;
    return c.json(await recomecarEspelho(dep.banco, `${hojeRecife().slice(0, 7)}-01`));
  });

  // as ferramentas em teste e o retorno (6.60): do REAL, com a conta real. Ler a lista é de toda conta (o administrador a usa fora do Laboratório, para cadastrar);
  // deixar o retorno exige a sessão no Laboratório; cadastrar, mudar e ler os retornos é do administrador da conta real (o perfil de administrador de teste não vale).
  const SO_ADMIN = 'Só o administrador do sistema cuida das ferramentas em teste.';
  r.get('/laboratorio/ferramentas', async (c) => c.json(await listarFerramentas(dep.banco)));
  r.post('/laboratorio/ferramentas', async (c) => {
    const negado = await exigirAdministradorRaiz(c, SO_ADMIN);
    if (negado) return negado;
    const corpo = await lerCorpo(c, NovaFerramenta);
    if (!corpo.ok) return corpo.resposta;
    return c.json(await comUsuario(dep.banco, c.get('usuarioId'), (tx) => criarFerramenta(tx, corpo.dados)), 201);
  });
  r.patch('/laboratorio/ferramentas/:id', async (c) => {
    const negado = await exigirAdministradorRaiz(c, SO_ADMIN);
    if (negado) return negado;
    const corpo = await lerCorpo(c, MudarFerramenta);
    if (!corpo.ok) return corpo.resposta;
    const id = c.req.param('id');
    if (!UUID.test(id)) return c.json({ erro: NAO_ACHOU_A_FERRAMENTA }, 404);
    const mudada = await comUsuario(dep.banco, c.get('usuarioId'), (tx) => mudarFerramenta(tx, id, corpo.dados));
    return mudada ? c.json(mudada) : c.json({ erro: NAO_ACHOU_A_FERRAMENTA }, 404);
  });
  r.post('/laboratorio/retornos', async (c) => {
    const corpo = await lerCorpo(c, NovoRetorno);
    if (!corpo.ok) return corpo.resposta;
    const usuarioId = c.get('usuarioId');
    const perfil = await perfilDoLaboratorio(dep.banco, usuarioId);
    if (!perfil) return c.json({ erro: 'Entre no Laboratório para deixar um retorno.' }, 409);
    const ferramenta = await umaFerramenta(dep.banco, corpo.dados.ferramentaId);
    if (!ferramenta) return c.json({ erro: NAO_ACHOU_A_FERRAMENTA }, 404);
    if (ferramenta.situacao !== 'em_teste') return c.json({ erro: 'Esta ferramenta não está mais em teste.' }, 400);
    await gravarRetorno(dep.banco, { ...corpo.dados, usuarioId, perfilDeTeste: perfil.nome });
    return c.json({ ok: true }, 201);
  });
  r.get('/laboratorio/retornos', async (c) => {
    const negado = await exigirAdministradorRaiz(c, SO_ADMIN);
    if (negado) return negado;
    const ferramenta = c.req.query('ferramenta') || undefined;
    const de = c.req.query('de') || undefined;
    const ate = c.req.query('ate') || undefined;
    if ((ferramenta && !UUID.test(ferramenta)) || (de && !Data.safeParse(de).success) || (ate && !Data.safeParse(ate).success)) {
      return c.json({ erro: 'Confira o filtro: use a ferramenta da lista e datas no formato aaaa-mm-dd.' }, 400);
    }
    return c.json(await listarRetornos(dep.banco, { ferramenta, de, ate }));
  });
  return r;
}
