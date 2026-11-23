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

export type Item = { nome: string; icone: LucideIcon; para?: LinkProps['to']; /** O item só aparece para quem passa neste teste (sem ele, todos veem). */ ve?: (eu: Eu | EuDaApi) => boolean };
export type IdModulo = 'escalas' | 'peculio' | 'consulta' | 'visualizacao' | 'minha-ficha' | 'configuracoes' | 'estrutura';

/**
 * Um módulo do sistema: o cartão da tela inicial e o trilho de dentro dele. `itens` são os blocos do trilho (vazio = sem trilho) e `pe` os itens
 * de baixo (configurações, ajuda). `rota` null = ainda não existe (o cartão mostra "Em breve").
 */
export interface Modulo {
  id: IdModulo;
  nome: string;
  descricao: string;
  rota: LinkProps['to'] | null;
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
    descricao: 'Grade geral, escala do mês, voluntariado e o cadastro da seção.',
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
  {
    id: 'peculio',
    nome: 'Pecúlio do 2º GB',
    descricao: 'Dados de contato, aniversariantes e pendências do cadastro.',
    rota: '/peculio',
    icone: Contact,
    ve: temPapel,
    itens: [[{ nome: 'Pecúlio', icone: Contact, para: '/peculio' }]],
  },
  // a árvore de unidades (entrega 6.26): quem tem nível de acesso a vê; só quem tem poder sobre ela a edita (cada unidade diz o que a pessoa pode fazer)
  { id: 'estrutura', nome: 'Estrutura', descricao: 'A árvore de unidades: criar, renomear, mover e extinguir.', rota: '/estrutura', icone: Network, ve: temPapel, itens: [] },
  // todo militar com conta busca qualquer militar da corporação e vê só o que a borda das camadas de visão libera (entrega 6.11)
  { id: 'consulta', nome: 'Consulta de militares', descricao: 'Buscar um militar da corporação e ver o que você pode ver dele.', rota: '/consulta', icone: Search, ve: () => true, itens: [] },
  { id: 'visualizacao', nome: 'Visualização de escalas', descricao: 'Ver a escala publicada do mês.', rota: null, icone: Eye, ve: () => true, itens: [] },
  { id: 'minha-ficha', nome: 'Minha ficha', descricao: 'Seus dados e o seu telefone.', rota: '/minha-ficha', icone: UserRound, ve: () => true, itens: [] },
  // o painel das configurações gerais (entrega 6.26): todos abrem, e cada seção só aparece para quem a vê; as configurações da escala ficam no módulo de escalas
  { id: 'configuracoes', nome: 'Configurações', descricao: 'Suas preferências e as configurações gerais do sistema.', rota: '/configuracoes', icone: Settings, ve: () => true, itens: [] },
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
  if (primeiro === 'consulta') return porId('consulta');
  if (primeiro === 'estrutura') return porId('estrutura');
  // o modelo de guarnição abre de dentro das configurações da escala (o endereço antigo /configuracoes/modelos-de-guarnicao/:id continua valendo)
  if (primeiro === 'configuracoes') return (caminho.split('/')[2] ?? '').toLowerCase() === 'modelos-de-guarnicao' ? porId('escalas') : porId('configuracoes');
  if (primeiro === 'militares' && busca.de === 'peculio') return porId('peculio');
  if (DO_PECULIO.has(primeiro)) return porId('peculio');
  if (DA_CONFECCAO.has(primeiro)) return porId('escalas');
  return null;
}
