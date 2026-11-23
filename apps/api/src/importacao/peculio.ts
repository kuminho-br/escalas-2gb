// Importação do Pecúlio (aba PECÚLIO): a origem dos dados do militar (entrega 6.13). O banco é a fonte única; a planilha é o contrato.
// Só a MATRÍCULA é obrigatória. Célula vazia não mexe no dado; célula inválida é ignorada, com o motivo na prévia, e as outras células da linha valem.
// Só quem tem nível de acesso numa unidade acima das seções importa (a rota confere); aqui cada linha confere de novo o de cima da lotação dela.
import { COMPORTAMENTOS, mesParaData, type CelulaIgnorada, type ItemPrevia, type ProblemaImportacao } from 'contratos';
import { CICLO_EQUIPES, normalizar } from 'dominio';
import { mudarPeriodoAberto } from '../cadastros/periodo-aberto.ts';
import { quadroParaOPosto } from '../cadastros/quadros.ts';
import { CADASTRO, siglaDaUnidadeDeCima, temPapelAcima } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import {
  cpfMascarado, lerAntiguidade, lerCep, lerCnh, lerComportamento, lerCpf, lerEmail, lerEquipe, lerJornada, lerNascimento, lerNomeDeGuerra, lerPosto, lerQuadro,
  lerSexo, lerSigla, lerSimNao, lerSituacao, lerTelefone, lerTexto, lerUf, matriculaDe, type Leitura,
} from './peculio-colunas.ts';
import { coluna } from './planilha.ts';
import type { ColunaModelo, Importador } from './tipos.ts';

const ABA = 'PECÚLIO';
const SIM_NAO = ['SIM', 'NÃO'];

// rótulos lidos por planejar e escritos no cabeçalho do modelo, na ordem da ficha: uma lista só
const COLUNAS = {
  mat: { rotulo: 'MATRÍCULA', obrigatoria: true, ajuda: '6 dígitos, hífen e 1 dígito (ex.: 123456-7). Sem o hífen, o sistema corrige e avisa.' },
  posto: { rotulo: 'POSTO/GRAD', obrigatoria: false, ajuda: 'Sigla do posto ou graduação, como na lista abaixo. "SD" vale como "SD BM". Obrigatório para militar novo.' },
  completo: { rotulo: 'NOME COMPLETO', obrigatoria: false, ajuda: 'O nome completo do militar (até 120 caracteres).' },
  guerra: { rotulo: 'NOME DE GUERRA', obrigatoria: false, ajuda: 'Como o militar aparece na escala (o sistema escreve em maiúsculas). Obrigatório para militar novo.' },
  antig: { rotulo: 'ANTIGUIDADE', obrigatoria: false, ajuda: 'Número da antiguidade, de 1 a 99999.' },
  sexo: { rotulo: 'SEXO', obrigatoria: false, ajuda: 'M ou F.', opcoes: ['M', 'F'] },
  nascimento: { rotulo: 'NASCIMENTO', obrigatoria: false, ajuda: 'A data de nascimento, como texto: dd/mm/aaaa (ex.: 15/03/1985) ou só dd/mm (ex.: 15/03). Célula que o Excel transformou em data é ignorada.', texto: true },
  telefone: { rotulo: 'TELEFONE', obrigatoria: false, ajuda: 'Até 20 caracteres (ex.: (81) 99999-0000).', texto: true },
  email: { rotulo: 'E-MAIL', obrigatoria: false, ajuda: 'E-mail institucional, só do domínio @bombeiros.pe.gov.br. Não pode repetir entre militares.' },
  comportamento: { rotulo: 'COMPORTAMENTO', obrigatoria: false, ajuda: 'Um destes: Excepcional, Ótimo, Bom, Insuficiente, Mau.', opcoes: [...COMPORTAMENTOS] },
  boletim: { rotulo: 'BOLETIM DO COMPORTAMENTO', obrigatoria: false, ajuda: 'Boletim em que o comportamento foi publicado (até 60 caracteres).' },
  cpf: { rotulo: 'CPF', obrigatoria: false, ajuda: '11 dígitos, com ou sem pontos e traço (ex.: 529.982.247-25). Não pode repetir entre militares.', texto: true },
  cep: { rotulo: 'CEP', obrigatoria: false, ajuda: '8 dígitos, com ou sem traço (ex.: 50030-000).', texto: true },
  logradouro: { rotulo: 'LOGRADOURO', obrigatoria: false, ajuda: 'Rua, avenida etc. (até 120 caracteres).' },
  numero: { rotulo: 'NÚMERO', obrigatoria: false, ajuda: 'Número do endereço (até 120 caracteres).', texto: true },
  complemento: { rotulo: 'COMPLEMENTO', obrigatoria: false, ajuda: 'Apartamento, bloco etc. (até 120 caracteres).' },
  bairro: { rotulo: 'BAIRRO', obrigatoria: false, ajuda: 'Até 120 caracteres.' },
  cidade: { rotulo: 'CIDADE', obrigatoria: false, ajuda: 'Até 120 caracteres.' },
  uf: { rotulo: 'UF', obrigatoria: false, ajuda: 'Sigla do estado (ex.: PE).', texto: true },
  lotacao: { rotulo: 'LOTAÇÃO', obrigatoria: false, ajuda: 'Sigla da seção do militar, como na lista abaixo. Obrigatória para militar novo. Para quem já existe, a lotação não muda por aqui: use "Alterar situação" na ficha.' },
  quadro: { rotulo: 'QUADRO', obrigatoria: false, ajuda: 'Sigla de um quadro que tenha o posto do militar (lista abaixo). Para quem já existe, vale a partir de hoje.' },
  situacao: { rotulo: 'SITUAÇÃO', obrigatoria: false, ajuda: 'O nome de uma situação do catálogo (lista abaixo). Para quem já existe, vale a partir de hoje.' },
  jornada: { rotulo: 'JORNADA', obrigatoria: false, ajuda: 'PRONTO (turnos de 12h) ou ADM (expediente). Para quem já existe, vale a partir de hoje.', opcoes: ['PRONTO', 'ADM'] },
  equipe: { rotulo: 'EQUIPE', obrigatoria: false, ajuda: 'Equipe do pronto, da seção do militar (ex.: ALFA). Equipe que ainda não existe é criada. No ADM não há equipe.' },
  motorista: { rotulo: 'MOTORISTA', obrigatoria: false, ajuda: 'SIM se o militar está no quadro de motoristas; NÃO se não está.', opcoes: SIM_NAO },
  cnh: { rotulo: 'CNH', obrigatoria: false, ajuda: 'Categorias da carteira, juntas (ex.: AD). Para a escala, só vale com o militar no quadro de motoristas.' },
  vjes: { rotulo: 'VOLUNTÁRIO JES', obrigatoria: false, ajuda: 'SIM se o militar é voluntário JES; NÃO se não é.', opcoes: SIM_NAO },
} satisfies Record<string, ColunaModelo>;
type Chave = keyof typeof COLUNAS;

export const MSG_CPF_DE_OUTRO = 'Este CPF já está cadastrado em outro militar.';
export const MSG_EMAIL_DE_OUTRO = 'Este e-mail já está cadastrado em outro militar.';
export const MSG_SEM_EQUIPE_NO_ADM = 'No expediente não há equipe.';
const MSG_SEM_PERIODO = 'O militar não tem período aberto no rastreio: use "Alterar situação" na ficha.';
const NOME_DO_DADO = { posto: 'posto/graduação', guerra: 'nome de guerra', lotacao: 'lotação' } as const;

/** As colunas do militar que a linha grava, já no nome do banco (só as que vieram com valor válido e mudaram). */
type CamposDoMilitar = Record<string, unknown>;
/** O que muda no rastreio: `equipe` pelo nome (a que não existe é criada na seção). */
type MudancaDoRastreio = { quadroId?: string | null; situacaoId?: string; jornada?: 'pronto' | 'adm'; equipe?: string | null };
type ItemPlano = {
  /** null: militar novo */
  id: string | null;
  matricula: string;
  campos: CamposDoMilitar;
  rastreio: MudancaDoRastreio;
  /** a seção das equipes (a do período aberto; no militar novo, a da LOTAÇÃO) */
  unidadeId: string;
  /** o posto mudou e a linha não trouxe QUADRO: o quadro acompanha o posto, como na ficha */
  quadroPeloPosto: boolean;
};
type Plano = { itens: ItemPlano[]; mes: string };

type Existente = {
  id: string; matricula: string; posto_grad_id: string; posto: string; nome_completo: string | null; nome_guerra: string; antiguidade: number | null; sexo: 'M' | 'F' | null;
  nascimento_dia: number | null; nascimento_mes: number | null; nascimento_ano: number | null; cpf: string | null; cep: string | null; logradouro: string | null;
  numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null; telefone: string | null; email: string | null;
  comportamento: string | null; comportamento_boletim: string | null; motorista: boolean; cnh: string[]; voluntario_jes: boolean;
  /** a lotação de hoje (a do período que cobre o mês; sem ela, a mais recente) */
  unidade_id: string | null; unidade_sigla: string | null;
  /** o dia em que essa lotação começa ('aaaa-mm-dd'): depois de hoje, ela ainda está só marcada */
  unidade_desde: string | null;
  /** o período aberto do rastreio */
  aberto_unidade: string | null; aberto_equipe: string | null; aberto_jornada: 'pronto' | 'adm' | null; aberto_quadro_id: string | null; aberto_quadro: string | null;
  aberto_situacao_id: string | null; aberto_situacao: string | null;
};

const dois = (n: number) => String(n).padStart(2, '0');
const textoNascimento = (n: { dia: number; mes: number; ano?: number | null } | null) => (n ? `${dois(n.dia)}/${dois(n.mes)}${n.ano ? `/${n.ano}` : ''}` : 'vazio');
const ehBissexto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
const simNao = (b: boolean) => (b ? 'sim' : 'não');
const textoCnh = (c: string[]) => (c.length ? [...c].sort().join('') : 'nenhuma');
const NOME_JORNADA = { pronto: 'Pronto', adm: 'Adm' } as const;

async function existentes(tx: Consulta, mes: string): Promise<Map<string, Existente>> {
  const primeiro = mesParaData(mes);
  const { rows } = await tx.query<Existente>(
    `select m.id, m.matricula, m.posto_grad_id, p.sigla as posto, m.nome_completo, m.nome_guerra, m.antiguidade, m.sexo, m.nascimento_dia, m.nascimento_mes, m.nascimento_ano,
            m.cpf, m.cep, m.logradouro, m.numero, m.complemento, m.bairro, m.cidade, m.uf, m.telefone, m.email, m.comportamento, m.comportamento_boletim,
            m.motorista, m.cnh, m.voluntario_jes, l.unidade_id, un.sigla as unidade_sigla, to_char(l.desde, 'YYYY-MM-DD') as unidade_desde,
            a.unidade_id as aberto_unidade, ae.nome as aberto_equipe, a.jornada as aberto_jornada, a.quadro_id as aberto_quadro_id, aq.sigla as aberto_quadro,
            a.situacao_id as aberto_situacao_id, asm.nome as aberto_situacao
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join lateral (
         select r.unidade_id, r.desde from rastreio r where r.militar_id = m.id
          order by (r.desde <= $1::date and (r.ate is null or r.ate >= $1::date)) desc, r.desde desc limit 1
       ) l on true
       left join unidade un on un.id = l.unidade_id
       left join rastreio a on a.militar_id = m.id and a.ate is null
       left join equipe ae on ae.id = a.equipe_id
       left join quadro aq on aq.id = a.quadro_id
       left join situacao_militar asm on asm.id = a.situacao_id`,
    [primeiro],
  );
  return new Map(rows.map((r) => [r.matricula, r]));
}

/** As listas de valores da unidade (postos, lotações, quadros, situações e equipes), para ler as células e para a AJUDA do modelo. */
async function catalogos(tx: Consulta, unidadeId: string) {
  const postos = (await tx.query<{ id: string; sigla: string }>('select id, sigla from posto_grad order by ordem')).rows;
  const unidades = (
    await tx.query<{ id: string; sigla: string }>(
      `select s.id, s.sigla from unidade s join unidade u on u.id = $1 and s.caminho <@ u.caminho
        join tipo_unidade t on t.codigo = s.tipo order by t.nivel, s.sigla`,
      [unidadeId],
    )
  ).rows;
  const quadros = (
    await tx.query<{ id: string; sigla: string; posto_grad_ids: string[] }>(
      'select q.id, q.sigla, array_agg(qp.posto_grad_id) as posto_grad_ids from quadro q join quadro_posto_grad qp on qp.quadro_id = q.id group by q.id, q.sigla order by q.sigla',
    )
  ).rows.map((q) => ({ id: q.id, sigla: q.sigla, postoGradIds: q.posto_grad_ids }));
  const situacoes = (await tx.query<{ id: string; nome: string }>('select id, nome from situacao_militar where ativo order by nome')).rows;
  const equipes = (
    await tx.query<{ unidade_id: string; sigla: string; nome: string; ordem_ciclo: number }>(
      `select e.unidade_id, s.sigla, e.nome, e.ordem_ciclo from equipe e join unidade s on s.id = e.unidade_id join unidade u on u.id = $1 and s.caminho <@ u.caminho
        order by s.sigla, e.ordem_ciclo`,
      [unidadeId],
    )
  ).rows;
  return { postos, unidades, quadros, situacoes, equipes };
}

export const importadorPeculio: Importador<Plano> = {
  abas: [ABA],
  exigeDonoDoPeculio: true,

  modelo: {
    abas: [{ nome: ABA, colunas: Object.values(COLUNAS) }],
    async valores({ tx, unidadeId }) {
      const c = await catalogos(tx, unidadeId);
      const porSecao = new Map<string, string[]>();
      for (const e of c.equipes) porSecao.set(e.sigla, [...(porSecao.get(e.sigla) ?? []), e.nome]);
      return [
        { titulo: 'Como a planilha é lida', itens: ['Só a matrícula é obrigatória. Célula vazia não altera nada. Dado inválido é ignorado e aparece no resumo.'] },
        { titulo: 'Postos e graduações (coluna POSTO/GRAD)', itens: c.postos.map((p) => p.sigla) },
        { titulo: 'Lotações desta importação (coluna LOTAÇÃO)', itens: c.unidades.map((u) => u.sigla) },
        { titulo: 'Quadros (coluna QUADRO)', itens: c.quadros.map((q) => `${q.sigla}: ${c.postos.filter((p) => q.postoGradIds.includes(p.id)).map((p) => p.sigla).join(', ')}`) },
        { titulo: 'Situações (coluna SITUAÇÃO)', itens: c.situacoes.map((s) => s.nome) },
        { titulo: 'Equipes de cada seção (coluna EQUIPE)', itens: porSecao.size ? [...porSecao].map(([s, nomes]) => `${s}: ${nomes.join(', ')}`) : ['Ainda não há equipes: a importação cria as que aparecerem na coluna EQUIPE.'] },
        { titulo: 'Linha de militar novo', itens: ['Precisa de POSTO/GRAD, NOME DE GUERRA e LOTAÇÃO. O sistema cria o militar com lotação na seção da coluna LOTAÇÃO, a partir do mês atual. Sem as colunas JORNADA, EQUIPE, QUADRO e SITUAÇÃO, ele entra no Pronto, sem equipe, com o quadro do posto (quando só um serve) e na situação padrão.'] },
      ];
    },
  },

  async planejar(abas, { tx, unidadeId, hoje, usuarioId }) {
    const aba = abas[ABA]!;
    const c = Object.fromEntries(Object.entries(COLUNAS).map(([k, v]) => [k, coluna(aba, v.rotulo)])) as Record<Chave, number>;
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    const ignoradas: CelulaIgnorada[] = [];
    const mes = hoje.slice(0, 7);
    if (c.mat < 0) {
      problemas.push({ aba: ABA, linha: 1, mensagem: 'Falta a coluna MATRÍCULA.', solucao: 'Baixe o modelo na tela de importação e cole os dados nele.' });
      return { previa: { novos: [], alterados: [], iguais: 0, problemas, avisos, ignoradas }, plano: { itens: [], mes } };
    }

    const cat = await catalogos(tx, unidadeId);
    const raiz = (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]!.sigla;
    const ja = await existentes(tx, mes);
    // e-mails e CPFs já usados, para ignorar a célula antes de o banco recusar a gravação (o e-mail também pode estar no usuário de outro militar)
    const emailsEmUso = new Map((await tx.query<{ email: string; matricula: string }>('select lower(email) as email, matricula from militar where email is not null')).rows.map((r) => [r.email, r.matricula]));
    for (const r of (await tx.query<{ email: string; matricula: string }>('select lower(u.email) as email, m.matricula from usuario u join militar m on m.id = u.militar_id')).rows) {
      if (!emailsEmUso.has(r.email)) emailsEmUso.set(r.email, r.matricula);
    }
    const cpfsEmUso = new Map((await tx.query<{ cpf: string; matricula: string }>('select cpf, matricula from militar where cpf is not null')).rows.map((r) => [r.cpf, r.matricula]));
    const emailsDaPlanilha = new Map<string, string>();
    const cpfsDaPlanilha = new Map<string, string>();
    const papelDeCima = new Map<string, boolean>();
    const donoDe = async (unidade: string) => {
      if (!papelDeCima.has(unidade)) papelDeCima.set(unidade, usuarioId ? await temPapelAcima(tx, usuarioId, unidade, CADASTRO, hoje) : false);
      return papelDeCima.get(unidade)!;
    };
    const siglaDe = async (unidade: string) => (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidade])).rows[0]?.sigla ?? 'outra seção';
    const cima = async (unidade: string) => (await siglaDaUnidadeDeCima(tx, unidade)) ?? 'nível acima';
    // as equipes que a importação vai criar, por seção (só as das linhas que entram)
    const equipesNovas = new Map<string, Set<string>>();
    const temEquipe = (unidade: string, nome: string) =>
      cat.equipes.some((e) => e.unidade_id === unidade && normalizar(e.nome) === normalizar(nome)) || [...(equipesNovas.get(unidade) ?? [])].some((n) => normalizar(n) === normalizar(nome));

    const vistos = new Set<string>();
    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    const itens: ItemPlano[] = [];
    let iguais = 0;

    for (const l of aba.linhas) {
      const texto = (k: Chave) => (c[k] < 0 ? '' : (l.celulas[c[k]] ?? '').trim());
      const bruta = texto('mat');
      if (!bruta) continue;
      const problema = (mensagem: string, solucao: string) => problemas.push({ aba: ABA, linha: l.linha, mensagem, solucao });

      const mat = matriculaDe(bruta);
      if (!mat.valor) {
        problema(`Matrícula inválida: "${bruta}".`, 'Use 6 dígitos, hífen e 1 dígito (ex.: 123456-7).');
        continue;
      }
      const matricula = mat.valor;
      if (mat.corrigida) avisos.push(`Matrícula ${bruta} corrigida para ${matricula} (linha ${l.linha}).`);
      if (vistos.has(matricula)) {
        problema(`Matrícula ${matricula} repetida na planilha.`, 'Deixe uma linha só por militar.');
        continue;
      }
      vistos.add(matricula);
      const e = ja.get(matricula);
      const ignoradasDaLinha: CelulaIgnorada[] = [];
      const ignorar = (k: Chave, motivo: string) => ignoradasDaLinha.push({ linha: l.linha, chave: matricula, coluna: COLUNAS[k].rotulo, motivo });
      /** O valor da célula; a ignorada vai para a lista da prévia, com o motivo. */
      const ler = <T>(k: Chave, leitura: Leitura<T>): T | undefined => {
        if ('valor' in leitura) return leitura.valor;
        if ('motivo' in leitura) ignorar(k, leitura.motivo);
        return undefined;
      };

      const posto = ler('posto', lerPosto(texto('posto'), cat.postos));
      const nomeGuerra = ler('guerra', lerNomeDeGuerra(texto('guerra')));
      const lotacao = ler('lotacao', lerSigla(texto('lotacao'), cat.unidades, `Lotação (${raiz} e as de baixo):`));

      // militar novo: sem posto, nome de guerra ou lotação válidos, não é criado (a prévia diz qual faltou)
      if (!e) {
        const faltam = (['posto', 'guerra', 'lotacao'] as const).filter((k) => ({ posto, guerra: nomeGuerra, lotacao })[k] === undefined);
        if (faltam.length) {
          for (const k of faltam) problema(`Militar novo sem ${NOME_DO_DADO[k]}: não foi criado.`, `Preencha a coluna ${COLUNAS[k].rotulo} com um valor da lista da aba AJUDA.`);
          ignoradas.push(...ignoradasDaLinha);
          continue;
        }
      }

      // dono do bloco: nível de acesso acima da lotação do militar (a atual, se ele já existe; senão a da linha)
      const referencia = e?.unidade_id ?? lotacao?.id ?? null;
      const nomeDaLinha = nomeGuerra ?? e?.nome_guerra ?? matricula;
      if (!referencia) {
        problema(`${nomeDaLinha} (${matricula}) não tem lotação no sistema.`, 'Preencha a LOTAÇÃO na planilha.');
        continue;
      }
      if (!(await donoDe(referencia))) {
        const sigla = e?.unidade_sigla ?? lotacao!.sigla;
        problema(
          e ? `${nomeDaLinha} (${matricula}) ${e.unidade_desde && e.unidade_desde > hoje ? `tem lotação marcada na ${sigla} a partir de ${e.unidade_desde.slice(8, 10)}/${e.unidade_desde.slice(5, 7)}/${e.unidade_desde.slice(0, 4)}` : `está lotado na ${sigla}`}: o Pecúlio dele é de quem tem nível de acesso no ${await cima(referencia)}.` : `Cadastrar militar na ${sigla} é de quem tem nível de acesso no ${await cima(referencia)}.`,
          'Peça a quem tem esse nível de acesso para importar a linha.',
        );
        continue;
      }

      // os dados do militar: só os que vieram e são válidos
      const postoFinal = posto ?? { id: e!.posto_grad_id, sigla: e!.posto };
      const nomeCompleto = ler('completo', lerTexto(texto('completo'), 120));
      const antiguidade = ler('antig', lerAntiguidade(texto('antig')));
      const sexo = ler('sexo', lerSexo(texto('sexo')));
      const nascimento = ler('nascimento', lerNascimento(texto('nascimento'), Boolean(c.nascimento >= 0 && l.datas?.[c.nascimento])));
      const telefone = ler('telefone', lerTelefone(texto('telefone')));
      let email = ler('email', lerEmail(texto('email')));
      let cpf = ler('cpf', lerCpf(texto('cpf')));
      const cep = ler('cep', lerCep(texto('cep')));
      const logradouro = ler('logradouro', lerTexto(texto('logradouro'), 120));
      const numero = ler('numero', lerTexto(texto('numero'), 120));
      const complemento = ler('complemento', lerTexto(texto('complemento'), 120));
      const bairro = ler('bairro', lerTexto(texto('bairro'), 120));
      const cidade = ler('cidade', lerTexto(texto('cidade'), 120));
      const uf = ler('uf', lerUf(texto('uf')));
      const comportamento = ler('comportamento', lerComportamento(texto('comportamento')));
      const boletim = ler('boletim', lerTexto(texto('boletim'), 60));
      const motorista = ler('motorista', lerSimNao(texto('motorista')));
      const voluntarioJes = ler('vjes', lerSimNao(texto('vjes')));
      const cnh = ler('cnh', lerCnh(texto('cnh')));

      // e-mail e CPF são únicos: o de outro militar, ou repetido na planilha, é ignorado (sem dizer de quem é)
      if (email) {
        const dono = emailsDaPlanilha.get(email.toLowerCase()) ?? emailsEmUso.get(email.toLowerCase());
        if (dono && dono !== matricula) {
          ignorar('email', MSG_EMAIL_DE_OUTRO);
          email = undefined;
        }
      }
      if (cpf) {
        const dono = cpfsDaPlanilha.get(cpf) ?? cpfsEmUso.get(cpf);
        if (dono && dono !== matricula) {
          ignorar('cpf', MSG_CPF_DE_OUTRO);
          cpf = undefined;
        }
      }

      // o rastreio: quadro, situação, jornada e equipe (para quem já existe, a partir de hoje, pelo período aberto)
      const semPeriodo = Boolean(e && !e.aberto_unidade);
      const rastreio: MudancaDoRastreio = {};
      const quadro = ler('quadro', lerQuadro(texto('quadro'), cat.quadros, postoFinal.id, postoFinal.sigla));
      const situacao = ler('situacao', lerSituacao(texto('situacao'), cat.situacoes));
      const jornada = ler('jornada', lerJornada(texto('jornada')));
      const equipeTxt = ler('equipe', lerEquipe(texto('equipe')));
      // o período aberto pode ser de outra seção (transferência já marcada): mexer nele pede nível de acesso acima dela, como no "Alterar situação"
      const periodoDeFora = Boolean(e?.aberto_unidade && e.aberto_unidade !== referencia && !(await donoDe(e.aberto_unidade)));
      const motivoDoRastreio = semPeriodo
        ? MSG_SEM_PERIODO
        : periodoDeFora
          ? `O período aberto é da ${cat.unidades.find((u) => u.id === e!.aberto_unidade)?.sigla ?? (await siglaDe(e!.aberto_unidade!))}: muda quem tem nível de acesso no ${await cima(e!.aberto_unidade!)}.`
          : null;
      if (motivoDoRastreio) {
        for (const [k, v] of [['quadro', quadro], ['situacao', situacao], ['jornada', jornada], ['equipe', equipeTxt]] as const) if (v !== undefined) ignorar(k, motivoDoRastreio);
      } else {
        if (quadro) rastreio.quadroId = quadro.id;
        if (situacao) rastreio.situacaoId = situacao.id;
        if (jornada) rastreio.jornada = jornada;
        const jornadaFinal = jornada ?? e?.aberto_jornada ?? 'pronto';
        if (equipeTxt !== undefined) {
          if (jornadaFinal === 'adm') ignorar('equipe', MSG_SEM_EQUIPE_NO_ADM);
          else rastreio.equipe = equipeTxt;
        }
        // passar para o ADM (a JORNADA da própria linha) esvazia a equipe; sem a coluna, a equipe de hoje fica
        if (jornada === 'adm' && e?.aberto_equipe) rastreio.equipe = null;
      }
      const secaoDasEquipes = e?.aberto_unidade ?? lotacao?.id ?? referencia;

      const mudancas: string[] = [];
      const campos: CamposDoMilitar = {};
      const vazio = (v: unknown) => (v == null ? 'vazio' : String(v));
      const comparar = (rotulo: string, colunaDoBanco: string, antes: unknown, depois: unknown, texto: (v: unknown) => string = vazio) => {
        if (depois === undefined || (e && antes === depois)) return;
        campos[colunaDoBanco] = depois;
        if (e) mudancas.push(`${rotulo}: ${texto(antes)} → ${texto(depois)}`);
      };
      if (posto && !(e && posto.id === e.posto_grad_id)) {
        campos.posto_grad_id = posto.id;
        if (e) mudancas.push(`posto: ${e.posto} → ${posto.sigla}`);
      }
      comparar('nome completo', 'nome_completo', e?.nome_completo, nomeCompleto);
      comparar('nome de guerra', 'nome_guerra', e?.nome_guerra, nomeGuerra);
      comparar('antiguidade', 'antiguidade', e?.antiguidade, antiguidade, (v) => (v == null ? 'vazia' : String(v)));
      comparar('sexo', 'sexo', e?.sexo, sexo);
      if (nascimento) {
        const antes = e && e.nascimento_dia !== null && e.nascimento_mes !== null ? { dia: e.nascimento_dia, mes: e.nascimento_mes, ano: e.nascimento_ano } : null;
        // sem o ano na célula, o ano gravado continua, se a data ainda existir nele (29/02 só em ano bissexto)
        const anoGuardado = antes?.ano && !(nascimento.dia === 29 && nascimento.mes === 2 && !ehBissexto(antes.ano)) ? antes.ano : null;
        const depois = { ...nascimento, ano: nascimento.ano ?? anoGuardado };
        if (textoNascimento(antes) !== textoNascimento(depois)) {
          Object.assign(campos, { nascimento_dia: depois.dia, nascimento_mes: depois.mes, nascimento_ano: depois.ano });
          if (e) mudancas.push(`nascimento: ${textoNascimento(antes)} → ${textoNascimento(depois)}`);
        }
      }
      comparar('telefone', 'telefone', e?.telefone, telefone);
      comparar('e-mail', 'email', e?.email, email);
      comparar('comportamento', 'comportamento', e?.comportamento, comportamento);
      comparar('boletim do comportamento', 'comportamento_boletim', e?.comportamento_boletim, boletim);
      comparar('CPF', 'cpf', e?.cpf, cpf, (v) => cpfMascarado(v as string | null) ?? 'vazio');
      comparar('CEP', 'cep', e?.cep, cep);
      comparar('logradouro', 'logradouro', e?.logradouro, logradouro);
      comparar('número', 'numero', e?.numero, numero);
      comparar('complemento', 'complemento', e?.complemento, complemento);
      comparar('bairro', 'bairro', e?.bairro, bairro);
      comparar('cidade', 'cidade', e?.cidade, cidade);
      comparar('UF', 'uf', e?.uf, uf);
      comparar('motorista', 'motorista', e?.motorista, motorista, (v) => simNao(Boolean(v)));
      comparar('voluntário JES', 'voluntario_jes', e?.voluntario_jes, voluntarioJes, (v) => simNao(Boolean(v)));
      if (cnh && !(e && textoCnh(e.cnh) === textoCnh(cnh))) {
        campos.cnh = cnh;
        if (e) mudancas.push(`CNH: ${textoCnh(e.cnh)} → ${textoCnh(cnh)}`);
      }
      if (e) {
        // o rastreio: só o que muda de fato
        if (rastreio.quadroId !== undefined && rastreio.quadroId === e.aberto_quadro_id) delete rastreio.quadroId;
        else if (rastreio.quadroId !== undefined) mudancas.push(`quadro: ${e.aberto_quadro ?? 'sem quadro'} → ${quadro!.sigla}`);
        if (rastreio.situacaoId !== undefined && rastreio.situacaoId === e.aberto_situacao_id) delete rastreio.situacaoId;
        else if (rastreio.situacaoId !== undefined) mudancas.push(`situação: ${e.aberto_situacao} → ${situacao!.nome}`);
        if (rastreio.jornada !== undefined && rastreio.jornada === e.aberto_jornada) delete rastreio.jornada;
        else if (rastreio.jornada !== undefined) mudancas.push(`jornada: ${NOME_JORNADA[e.aberto_jornada!]} → ${NOME_JORNADA[rastreio.jornada]}`);
        if (rastreio.equipe !== undefined && normalizar(rastreio.equipe ?? '') === normalizar(e.aberto_equipe ?? '')) delete rastreio.equipe;
        else if (rastreio.equipe !== undefined) mudancas.push(`equipe: ${e.aberto_equipe ?? 'sem equipe'} → ${rastreio.equipe ?? 'sem equipe'}`);
        if (e.unidade_id && lotacao && e.unidade_id !== lotacao.id) {
          avisos.push(`${nomeDaLinha} (${matricula}): a planilha diz ${lotacao.sigla} e o sistema ${e.unidade_sigla}; a lotação não foi mudada (use "Alterar situação" na ficha).`);
        }
      }
      ignoradas.push(...ignoradasDaLinha);

      if (e && !mudancas.length) {
        iguais++;
        continue;
      }
      // a equipe que ainda não existe na seção é criada (e a prévia avisa)
      if (rastreio.equipe && !temEquipe(secaoDasEquipes, rastreio.equipe)) equipesNovas.set(secaoDasEquipes, new Set([...(equipesNovas.get(secaoDasEquipes) ?? []), rastreio.equipe]));
      if (email) emailsDaPlanilha.set(email.toLowerCase(), matricula);
      if (cpf) cpfsDaPlanilha.set(cpf, matricula);
      const descricao = `${postoFinal.sigla} ${nomeGuerra ?? e?.nome_guerra}`;
      if (e) alterados.push({ chave: matricula, descricao, mudancas });
      else novos.push({ chave: matricula, descricao });
      itens.push({
        id: e?.id ?? null, matricula, campos, rastreio, unidadeId: secaoDasEquipes,
        quadroPeloPosto: Boolean(e && posto && posto.id !== e.posto_grad_id && rastreio.quadroId === undefined),
      });
    }

    for (const [secao, nomes] of equipesNovas) avisos.push(`Equipes novas na ${cat.unidades.find((u) => u.id === secao)?.sigla ?? 'seção'}: ${[...nomes].join(', ')}.`);
    const lotados = [...ja.values()].filter((x) => x.unidade_id && cat.unidades.some((u) => u.id === x.unidade_id) && !vistos.has(x.matricula)).length;
    if (lotados) avisos.push(`${lotados} militares do sistema não estão na planilha (nada foi apagado).`);
    return { previa: { novos, alterados, iguais, problemas, avisos, ignoradas }, plano: { itens, mes } };
  },

  async aplicar(plano, { tx, hoje }) {
    const desde = mesParaData(plano.mes);
    /** A equipe da seção pelo nome; a que não existe é criada, na posição do ciclo quando o nome é dele (ALFA, BRAVO…). */
    const equipeDe = async (unidadeId: string, nome: string | null): Promise<string | null> => {
      if (nome === null) return null;
      const daSecao = (await tx.query<{ id: string; nome: string; ordem_ciclo: number }>('select id, nome, ordem_ciclo from equipe where unidade_id = $1', [unidadeId])).rows;
      const achada = daSecao.find((q) => normalizar(q.nome) === normalizar(nome));
      if (achada) return achada.id;
      const noCiclo = CICLO_EQUIPES.indexOf(normalizar(nome));
      const ordem = noCiclo >= 0 && !daSecao.some((q) => q.ordem_ciclo === noCiclo + 1) ? noCiclo + 1 : Math.max(CICLO_EQUIPES.length, ...daSecao.map((q) => q.ordem_ciclo)) + 1;
      return (await tx.query<{ id: string }>('insert into equipe (unidade_id, nome, ordem_ciclo) values ($1, $2, $3) returning id', [unidadeId, nome, ordem])).rows[0]!.id;
    };
    for (const it of plano.itens) {
      const nomes = Object.keys(it.campos);
      if (!it.id) {
        const id = (await tx.query<{ id: string }>(
          `insert into militar (matricula, ${nomes.join(', ')}) values ($1, ${nomes.map((_, i) => `$${i + 2}`).join(', ')}) returning id`,
          [it.matricula, ...nomes.map((n) => it.campos[n])],
        )).rows[0]!.id;
        // lotação na seção da linha, a partir do mês atual; sem as colunas, Pronto, sem equipe, o quadro do posto (quando só um serve) e a situação padrão
        const quadro = it.rastreio.quadroId !== undefined ? { quadroId: it.rastreio.quadroId } : await quadroParaOPosto(tx, String(it.campos.posto_grad_id), undefined, null);
        const jornada = it.rastreio.jornada ?? 'pronto';
        const equipeId = jornada === 'adm' || it.rastreio.equipe === undefined ? null : await equipeDe(it.unidadeId, it.rastreio.equipe);
        const comSituacao = it.rastreio.situacaoId !== undefined;
        await tx.query(
          `insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, quadro_id${comSituacao ? ', situacao_id' : ''}) values ($1, $2, $3, $4, $5, $6${comSituacao ? ', $7' : ''})`,
          [id, it.unidadeId, equipeId, jornada, desde, 'erro' in quadro ? null : quadro.quadroId, ...(comSituacao ? [it.rastreio.situacaoId] : [])],
        );
        continue;
      }
      if (nomes.length) await tx.query(`update militar set ${nomes.map((n, i) => `${n} = $${i + 2}`).join(', ')} where id = $1`, [it.id, ...nomes.map((n) => it.campos[n])]);
      const mudanca: Parameters<typeof mudarPeriodoAberto>[3] = {};
      if (it.rastreio.quadroId !== undefined) mudanca.quadroId = it.rastreio.quadroId;
      if (it.rastreio.situacaoId !== undefined) mudanca.situacaoId = it.rastreio.situacaoId;
      if (it.rastreio.jornada !== undefined) mudanca.jornada = it.rastreio.jornada;
      if (it.rastreio.equipe !== undefined) mudanca.equipeId = await equipeDe(it.unidadeId, it.rastreio.equipe);
      // o quadro acompanha o posto (mesma regra da ficha), quando a linha não trouxe QUADRO
      if (it.quadroPeloPosto) {
        const aberto = (await tx.query<{ quadro_id: string | null }>('select quadro_id from rastreio where militar_id = $1 and ate is null', [it.id])).rows[0];
        if (aberto) {
          const quadro = await quadroParaOPosto(tx, String(it.campos.posto_grad_id), undefined, aberto.quadro_id);
          if (!('erro' in quadro)) mudanca.quadroId = quadro.quadroId;
        }
      }
      // várias mudanças de uma vez viram um período só, a partir de hoje
      if (Object.keys(mudanca).length) await mudarPeriodoAberto(tx, it.id, hoje, mudanca);
    }
    return plano.itens.length;
  },
};
