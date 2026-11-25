import type { LinkProps } from '@tanstack/react-router';
import {
  CalendarCheck,
  CalendarDays,
  CircleHelp,
  Clock,
  Contact,
  Eye,
  FileText,
  History,
  LayoutGrid,
  ListTree,
  Medal,
  Network,
  PieChart,
  Search,
  Settings,
  Sun,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ehGestorNaUnidade, ehMilitarComum, type Eu, type EuDaApi } from '@/api/eu';
import { mesPorExtenso } from '@/lib/saudacao';

/** O nome do mês de um 'aaaa-mm' ('2026-12' -> 'dezembro'). */
const nomeDoMes = (mes: string) => mesPorExtenso(new Date(`${mes}-15T12:00:00Z`));

export type Item = { nome: string; icone: LucideIcon; para?: LinkProps['to']; /** O item só aparece para quem passa neste teste (sem ele, todos veem). */ ve?: (eu: Eu | EuDaApi) => boolean };
export type IdModulo = 'escalas' | 'peculio' | 'visualizacao' | 'minha-ficha' | 'configuracoes' | 'estrutura';

/**
 * Um módulo do sistema: o atalho da tela inicial e o trilho de dentro dele. `itens` são os blocos do trilho (vazio = sem trilho) e `pe` os itens
 * de baixo (configurações, ajuda). `rota` null = ainda não existe (o atalho não é link, e a situação diz quando chega).
 */
export interface Modulo {
  id: IdModulo;
  nome: string;
  /** A linha de situação do atalho (6.42), montada só com o que a tela já sabe: a unidade de trabalho e o dia de hoje. Sem consulta nova. */
  situacao(eu: Eu, agora: Date): string;
  rota: LinkProps['to'] | null;
  /** Para onde o atalho leva esta pessoa, quando não é a `rota` de todos (o Pecúlio leva quem não tem nível de acesso direto à Consulta). */
  rotaDe?(eu: Eu | EuDaApi): LinkProps['to'];
  icone: LucideIcon;
  ve(eu: Eu | EuDaApi): boolean;
  itens: Item[][];
  pe?: Item[];
}

const temPapel = (eu: Eu | EuDaApi) => !ehMilitarComum(eu);
/** A pessoa está numa unidade só de consulta (só o `Eu` das telas sabe disso). */
const soConsulta = (eu: Eu | EuDaApi) => 'soConsulta' in eu && eu.soConsulta;
/** Os itens do trilho que não existem numa unidade só de consulta: tudo o que altera ou cadastra. */
const foraDaConsulta = (eu: Eu | EuDaApi) => !soConsulta(eu);
/** As telas de escala que abrem numa unidade só de consulta (a Confecção só lê nelas); o primeiro trecho do endereço de cada uma. */
export const TELAS_DE_LEITURA = new Set(['grade', 'escala-do-mes', 'efetivo-por-dia', 'efetivo-do-dia', 'voluntariado', 'cotas']);

export const MODULOS: Modulo[] = [
  {
    id: 'escalas',
    nome: 'Confecção de escalas',
    // a unidade não entra na frase: já está no Topo, e o artigo erraria o gênero ("da 2º GB")
    situacao: (eu, agora) => `Escalas de ${mesPorExtenso(agora)}${eu.soConsulta ? ', só para ver' : ''}`,
    rota: '/grade',
    icone: LayoutGrid,
    // quem não tem nível de acesso mas vê a escala em montagem de alguma unidade (as camadas de visão) também a abre, só para consulta
    ve: (eu) => temPapel(eu) || eu.unidadesSoConsulta.length > 0,
    itens: [
      [
        { nome: 'Grade geral', icone: LayoutGrid, para: '/grade' },
        { nome: 'Escala do mês', icone: ListTree, para: '/escala-do-mes' },
        { nome: 'Efetivo por dia', icone: Sun, para: '/efetivo-por-dia' },
        { nome: 'Oficiais', icone: Medal, para: '/oficiais', ve: (eu) => 'unidade' in eu && ehGestorNaUnidade(eu) && foraDaConsulta(eu) },
      ],
      [
        { nome: 'Voluntariado', icone: CalendarCheck, para: '/voluntariado' },
        { nome: 'Cotas', icone: PieChart, para: '/cotas' },
      ],
      [
        { nome: 'Militares', icone: Users, para: '/militares', ve: foraDaConsulta },
        { nome: 'Turnos', icone: Clock, para: '/servicos', ve: foraDaConsulta },
        { nome: 'Escalas', icone: FileText, para: '/escalas', ve: foraDaConsulta },
        { nome: 'Feriados', icone: CalendarDays, para: '/feriados', ve: foraDaConsulta },
      ],
    ],
    pe: [
      { nome: 'Configurações da escala', icone: Settings, para: '/configuracoes-da-escala' },
      { nome: 'Histórico', icone: History },
      { nome: 'Ajuda', icone: CircleHelp },
    ],
  },
  // o Pecúlio é do militar com conta, e a Consulta de militares é uma tela dele (entrega 6.26): quem não tem nível de acesso entra direto na Consulta e vê só ela
  // no trilho; quem tem nível vê a lista do Pecúlio e a Consulta
  {
    id: 'peculio',
    nome: 'Pecúlio',
    situacao: (eu) => (temPapel(eu) ? 'Contatos e cadastros' : 'Consulta de militares'),
    rota: '/peculio',
    rotaDe: (eu) => (temPapel(eu) ? '/peculio' : '/consulta'),
    icone: Contact,
    ve: () => true,
    itens: [[
      { nome: 'Pecúlio', icone: Contact, para: '/peculio', ve: temPapel },
      { nome: 'Consulta de militares', icone: Search, para: '/consulta' },
    ]],
  },
  // a árvore de unidades (entrega 6.26): quem tem nível de acesso a vê; só quem tem poder sobre ela a edita (cada unidade diz o que a pessoa pode fazer)
  { id: 'estrutura', nome: 'Estrutura', situacao: () => 'A árvore de unidades', rota: '/estrutura', icone: Network, ve: temPapel, itens: [] },
  // a Visualização é de todos (a fase 7): o militar vê o que é dele, sem entrar no módulo de escalas. Por ora, só o próprio voluntariado
  {
    id: 'visualizacao',
    nome: 'Visualização de escalas',
    situacao: (eu) => {
      const aberta = eu.coletasAbertas?.[0];
      return aberta ? `O voluntariado de ${nomeDoMes(aberta)} está aberto` : 'Seu voluntariado';
    },
    rota: '/meu-voluntariado',
    icone: Eye,
    ve: () => true,
    itens: [[{ nome: 'Meu voluntariado', icone: CalendarCheck, para: '/meu-voluntariado', ve: (eu) => Boolean(eu.militar) }]],
  },
  { id: 'minha-ficha', nome: 'Minha ficha', situacao: () => 'Seus dados e o seu telefone', rota: '/minha-ficha', icone: UserRound, ve: () => true, itens: [] },
  // o painel das configurações gerais (entrega 6.26): todos abrem, e cada seção só aparece para quem a vê; as configurações da escala ficam no módulo de escalas
  { id: 'configuracoes', nome: 'Configurações', situacao: () => 'Suas preferências', rota: '/configuracoes', icone: Settings, ve: () => true, itens: [] },
];

const porId = (id: IdModulo) => MODULOS.find((m) => m.id === id)!;
/** O primeiro trecho do endereço de cada tela e o módulo dela (as fichas em /militares dependem da origem). */
const DO_PECULIO = new Set(['peculio']);
const DA_CONFECCAO = new Set(['grade', 'escala-do-mes', 'efetivo-por-dia', 'efetivo-do-dia', 'oficiais', 'voluntariado', 'cotas', 'servicos', 'escalas', 'guarnicoes', 'feriados', 'configuracoes-da-escala', 'militares']);

/**
 * O módulo a que o endereço pertence; null na tela inicial e em endereços que não existem. A ficha aberta pelo Pecúlio (`?de=peculio`) é do
 * Pecúlio; aberta por qualquer outro caminho, da Confecção.
 */
export function moduloDoEndereco(caminho: string, busca: Record<string, unknown>): Modulo | null {
  // o roteador casa os endereços sem diferenciar maiúsculas: /Militares abre a mesma tela, e a barreira tem de pegar também
  const primeiro = (caminho.split('/')[1] ?? '').toLowerCase();
  if (primeiro === 'minha-ficha') return porId('minha-ficha');
  // a Consulta de militares (e a ficha de consulta) é uma tela do Pecúlio; o endereço antigo continua valendo
  if (primeiro === 'consulta') return porId('peculio');
  if (primeiro === 'estrutura') return porId('estrutura');
  if (primeiro === 'meu-voluntariado') return porId('visualizacao');
  // o modelo de guarnição abre de dentro das configurações da escala (o endereço antigo /configuracoes/modelos-de-guarnicao/:id continua valendo)
  if (primeiro === 'configuracoes') return (caminho.split('/')[2] ?? '').toLowerCase() === 'modelos-de-guarnicao' ? porId('escalas') : porId('configuracoes');
  if (primeiro === 'militares' && busca.de === 'peculio') return porId('peculio');
  if (DO_PECULIO.has(primeiro)) return porId('peculio');
  if (DA_CONFECCAO.has(primeiro)) return porId('escalas');
  return null;
}
