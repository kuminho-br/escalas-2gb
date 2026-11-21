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
  Network,
  PieChart,
  Settings,
  Sun,
  UserRound,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { ehMilitarComum, type Eu, type EuDaApi } from '@/api/eu';

export type Item = { nome: string; icone: LucideIcon; para?: LinkProps['to'] };
export type IdModulo = 'escalas' | 'peculio' | 'visualizacao' | 'minha-ficha';

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

export const MODULOS: Modulo[] = [
  {
    id: 'escalas',
    nome: 'Confecção de escalas',
    descricao: 'Grade geral, escala do mês, voluntariado e o cadastro da seção.',
    rota: '/grade',
    icone: LayoutGrid,
    ve: temPapel,
    itens: [
      [
        { nome: 'Grade geral', icone: LayoutGrid, para: '/grade' },
        { nome: 'Escala do mês', icone: ListTree, para: '/escala-do-mes' },
        { nome: 'Efetivo por dia', icone: Sun, para: '/efetivo-por-dia' },
      ],
      [
        { nome: 'Voluntariado', icone: CalendarCheck, para: '/voluntariado' },
        { nome: 'Cotas', icone: PieChart, para: '/cotas' },
      ],
      [
        { nome: 'Militares', icone: Users, para: '/militares' },
        { nome: 'Turnos', icone: Clock, para: '/servicos' },
        { nome: 'Escalas', icone: FileText, para: '/escalas' },
        { nome: 'Feriados', icone: CalendarDays, para: '/feriados' },
      ],
    ],
    pe: [
      { nome: 'Configurações', icone: Settings, para: '/configuracoes' },
      { nome: 'Estrutura', icone: Network },
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
  { id: 'visualizacao', nome: 'Visualização de escalas', descricao: 'Ver a escala publicada do mês.', rota: null, icone: Eye, ve: () => true, itens: [] },
  { id: 'minha-ficha', nome: 'Minha ficha', descricao: 'Seus dados e o seu telefone.', rota: '/minha-ficha', icone: UserRound, ve: () => true, itens: [] },
];

const porId = (id: IdModulo) => MODULOS.find((m) => m.id === id)!;
/** O primeiro trecho do endereço de cada tela e o módulo dela (as fichas em /militares dependem da origem). */
const DO_PECULIO = new Set(['peculio']);
const DA_CONFECCAO = new Set(['grade', 'escala-do-mes', 'efetivo-por-dia', 'efetivo-do-dia', 'voluntariado', 'cotas', 'servicos', 'escalas', 'guarnicoes', 'feriados', 'configuracoes', 'militares']);

/**
 * O módulo a que o endereço pertence; null na tela inicial e em endereços que não existem. A ficha aberta pelo Pecúlio (`?de=peculio`) é do
 * Pecúlio; aberta por qualquer outro caminho, da Confecção.
 */
export function moduloDoEndereco(caminho: string, busca: Record<string, unknown>): Modulo | null {
  const primeiro = caminho.split('/')[1] ?? '';
  if (primeiro === 'minha-ficha') return porId('minha-ficha');
  if (primeiro === 'militares' && busca.de === 'peculio') return porId('peculio');
  if (DO_PECULIO.has(primeiro)) return porId('peculio');
  if (DA_CONFECCAO.has(primeiro)) return porId('escalas');
  return null;
}
