// As rotas de negócio do sistema, montadas num lugar só: o real as monta em `/api` sobre o banco real e o Laboratório (6.59) em `/api/lab` sobre o espelho,
// as duas vezes pela mesma lista. Quem entra de um lado entra do outro, e a rota nova nasce nos dois.
import type { Hono } from 'hono';
import type { Auth } from './auth.ts';
import type { Banco } from './banco/banco.ts';
import { rotasConfiguracoes } from './cadastros/configuracoes.ts';
import { rotasCotas } from './cadastros/cotas.ts';
import { rotasEstrutura } from './cadastros/estrutura.ts';
import { rotasTiposDeUnidade } from './cadastros/tipos-de-unidade.ts';
import { rotasExternos } from './cadastros/externos.ts';
import { rotasEquipes } from './cadastros/equipes.ts';
import { rotasFeriados } from './cadastros/feriados.ts';
import { rotasFuncoesDoMilitar } from './cadastros/funcoes-do-militar.ts';
import { rotasGuarnicoes } from './cadastros/guarnicoes.ts';
import { rotasEscalas } from './cadastros/escalas.ts';
import { rotasDoLote } from './cadastros/lote.ts';
import { rotasMilitares } from './cadastros/militares.ts';
import { rotasServicos } from './cadastros/servicos.ts';
import { rotasSituacoes } from './cadastros/situacoes.ts';
import { IMPORTADORES } from './importacao/registro.ts';
import { rotasImportacao } from './importacao/rotas.ts';
import { rotasEfetivo } from './efetivo/rotas.ts';
import { rotasOficiais } from './oficiais/rotas.ts';
import { rotasEscalaDoMes } from './escala/rotas.ts';
import { rotasGrade } from './grade/rotas.ts';
import { rotasAvisos } from './avisos/rotas.ts';
import { rotasVisualizacao } from './escala/visualizacao-rotas.ts';
import { rotasVoluntariado } from './voluntariado/rotas.ts';
import { rotasVisao } from './visao/rotas.ts';
import { rotasAcesso } from './usuarios/rotas.ts';

export interface OpcoesDasRotas {
  agora?: () => Date;
  limiteDeBuscas?: number;
  /** As rotas das contas de usuário reais (dar nível, senha provisória, desativar): só o real. O Laboratório não as tem (404). */
  comContas: boolean;
}

/** Monta as rotas de negócio em `/api` da aplicação dada (a do real) ou em qualquer app que a pessoa dê: o prefixo vem de quem monta. */
export function montarRotasDoSistema(app: Hono, comAuth: { banco: Banco; auth: Auth }, opcoes: OpcoesDasRotas, prefixo = '/api'): void {
  app.route(prefixo, rotasConfiguracoes(comAuth));
  app.route(prefixo, rotasGuarnicoes(comAuth));
  app.route(prefixo, rotasMilitares(comAuth));
  app.route(prefixo, rotasDoLote(comAuth));
  if (opcoes.comContas) app.route(prefixo, rotasAcesso(comAuth));
  app.route(prefixo, rotasServicos(comAuth));
  app.route(prefixo, rotasSituacoes(comAuth));
  app.route(prefixo, rotasFuncoesDoMilitar(comAuth));
  app.route(prefixo, rotasCotas(comAuth));
  app.route(prefixo, rotasFeriados(comAuth));
  app.route(prefixo, rotasEquipes(comAuth));
  app.route(prefixo, rotasExternos(comAuth));
  app.route(prefixo, rotasEstrutura(comAuth));
  app.route(prefixo, rotasTiposDeUnidade(comAuth));
  app.route(prefixo, rotasEscalas(comAuth));
  app.route(prefixo, rotasEscalaDoMes(comAuth));
  app.route(prefixo, rotasVisualizacao({ ...comAuth, agora: opcoes.agora }));
  app.route(prefixo, rotasAvisos({ ...comAuth, agora: opcoes.agora }));
  app.route(prefixo, rotasEfetivo(comAuth));
  app.route(prefixo, rotasGrade(comAuth));
  app.route(prefixo, rotasOficiais(comAuth));
  app.route(prefixo, rotasVoluntariado(comAuth));
  app.route(prefixo, rotasVisao({ ...comAuth, limiteDeBuscas: opcoes.limiteDeBuscas }));
  app.route(prefixo, rotasImportacao(comAuth, IMPORTADORES));
}
