// Importação do Pecúlio (aba PECÚLIO): os dados do militar que são da seção de pessoal. O banco é a fonte única; a planilha é o contrato.
// Só quem tem papel numa unidade acima das seções importa (a rota confere); aqui cada linha confere de novo o papel de cima da lotação dela.
import { Antiguidade, Cep, COMPORTAMENTOS, Cpf, EmailInstitucional, MSG_CEP, MSG_CPF, MSG_UF, mesParaData, Nascimento, Telefone, Uf, type ItemPrevia, type ProblemaImportacao } from 'contratos';
import { normalizar } from 'dominio';
import { mudarPeriodoAberto } from '../cadastros/periodo-aberto.ts';
import { quadroParaOPosto } from '../cadastros/quadros.ts';
import { CADASTRO, temPapelAcima } from '../acesso.ts';
import type { Consulta } from '../banco/banco.ts';
import { matriculaDe } from './dados-da-escala.ts';
import { coluna } from './planilha.ts';
import type { ColunaModelo, Importador } from './tipos.ts';

const ABA = 'PECÚLIO';

// rótulos lidos por planejar e escritos no cabeçalho do modelo, na ordem da ficha: uma lista só
const COLUNAS = {
  mat: { rotulo: 'MATRÍCULA', obrigatoria: true, ajuda: '6 dígitos, hífen e 1 dígito (ex.: 123456-7). Sem o hífen, o sistema corrige e avisa.' },
  posto: { rotulo: 'POSTO/GRAD', obrigatoria: true, ajuda: 'Sigla do posto ou graduação, como na lista abaixo. "SD" vale como "SD BM".' },
  completo: { rotulo: 'NOME COMPLETO', obrigatoria: true, ajuda: 'O nome completo do militar.' },
  guerra: { rotulo: 'NOME DE GUERRA', obrigatoria: true, ajuda: 'Como o militar aparece na escala (o sistema escreve em maiúsculas).' },
  antig: { rotulo: 'ANTIGUIDADE', obrigatoria: false, ajuda: 'Número da antiguidade, de 1 a 99999. Vazio = sem antiguidade.' },
  sexo: { rotulo: 'SEXO', obrigatoria: false, ajuda: 'M ou F. Vazio = sem informação.', opcoes: ['M', 'F'] },
  nascimento: { rotulo: 'NASCIMENTO', obrigatoria: false, ajuda: 'A data de nascimento, no formato dd/mm/aaaa (ex.: 15/03/1985) ou só dd/mm (ex.: 15/03). O dia precisa existir no mês (29/02 só em ano bissexto, quando há o ano).', texto: true },
  telefone: { rotulo: 'TELEFONE', obrigatoria: false, ajuda: 'Até 20 caracteres (ex.: (81) 99999-0000).', texto: true },
  email: { rotulo: 'E-MAIL', obrigatoria: false, ajuda: 'E-mail institucional, só do domínio @bombeiros.pe.gov.br. Não pode repetir entre militares.' },
  comportamento: { rotulo: 'COMPORTAMENTO', obrigatoria: false, ajuda: 'Um destes: Excepcional, Ótimo, Bom, Insuficiente, Mau. Vazio = sem informação.', opcoes: [...COMPORTAMENTOS] },
  boletim: { rotulo: 'BOLETIM DO COMPORTAMENTO', obrigatoria: false, ajuda: 'Boletim em que o comportamento foi publicado (até 60 caracteres).' },
  cpf: { rotulo: 'CPF', obrigatoria: false, ajuda: '11 dígitos, com ou sem pontos e traço (ex.: 529.982.247-25). Não pode repetir entre militares. Vazio = sem informação.', texto: true },
  cep: { rotulo: 'CEP', obrigatoria: false, ajuda: '8 dígitos, com ou sem traço (ex.: 50030-000).', texto: true },
  logradouro: { rotulo: 'LOGRADOURO', obrigatoria: false, ajuda: 'Rua, avenida etc. (até 120 caracteres).' },
  numero: { rotulo: 'NÚMERO', obrigatoria: false, ajuda: 'Número do endereço (até 120 caracteres).', texto: true },
  complemento: { rotulo: 'COMPLEMENTO', obrigatoria: false, ajuda: 'Apartamento, bloco etc. (até 120 caracteres).' },
  bairro: { rotulo: 'BAIRRO', obrigatoria: false, ajuda: 'Até 120 caracteres.' },
  cidade: { rotulo: 'CIDADE', obrigatoria: false, ajuda: 'Até 120 caracteres.' },
  uf: { rotulo: 'UF', obrigatoria: false, ajuda: 'Sigla do estado (ex.: PE).', texto: true },
  lotacao: { rotulo: 'LOTAÇÃO', obrigatoria: true, ajuda: 'Sigla da seção do militar, como na lista abaixo. Para quem já existe, a lotação não muda por aqui: use "Alterar situação" na ficha.' },
} satisfies Record<string, ColunaModelo>;

type Dados = {
  matricula: string;
  postoId: string;
  posto: string;
  nomeCompleto: string;
  nomeGuerra: string;
  antiguidade: number | null;
  sexo: 'M' | 'F' | null;
  nascimento: { dia: number; mes: number; ano: number | null } | null;
  telefone: string | null;
  email: string | null;
  comportamento: string | null;
  boletim: string | null;
  cpf: string | null;
  endereco: { cep: string | null; logradouro: string | null; numero: string | null; complemento: string | null; bairro: string | null; cidade: string | null; uf: string | null };
};
type ItemPlano = { id: string | null; dados: Dados; unidadeId: string };
type Plano = { itens: ItemPlano[]; mes: string };

type Existente = {
  id: string;
  matricula: string;
  posto_grad_id: string;
  posto: string;
  nome_completo: string | null;
  nome_guerra: string;
  antiguidade: number | null;
  sexo: 'M' | 'F' | null;
  nascimento_dia: number | null;
  nascimento_mes: number | null;
  nascimento_ano: number | null;
  cpf: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  telefone: string | null;
  email: string | null;
  comportamento: string | null;
  comportamento_boletim: string | null;
  unidade_id: string | null;
  unidade_sigla: string | null;
};

const dois = (n: number) => String(n).padStart(2, '0');
const textoNascimento = (n: { dia: number; mes: number; ano?: number | null } | null) => (n ? `${dois(n.dia)}/${dois(n.mes)}${n.ano ? `/${n.ano}` : ''}` : 'vazio');
const maskCpf = (c: string | null) => (c ? `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}` : null);

/** Os militares do sistema, com a lotação de hoje (a do período que cobre o mês; sem ela, a mais recente). */
async function existentes(tx: Consulta, mes: string): Promise<Map<string, Existente>> {
  const primeiro = mesParaData(mes);
  const { rows } = await tx.query<Existente>(
    `select m.id, m.matricula, m.posto_grad_id, p.sigla as posto, m.nome_completo, m.nome_guerra, m.antiguidade, m.sexo, m.nascimento_dia, m.nascimento_mes, m.nascimento_ano,
            m.cpf, m.cep, m.logradouro, m.numero, m.complemento, m.bairro, m.cidade, m.uf, m.telefone, m.email, m.comportamento, m.comportamento_boletim, l.unidade_id, un.sigla as unidade_sigla
       from militar m
       join posto_grad p on p.id = m.posto_grad_id
       left join lateral (
         select r.unidade_id from rastreio r where r.militar_id = m.id
          order by (r.desde <= $1::date and (r.ate is null or r.ate >= $1::date)) desc, r.desde desc limit 1
       ) l on true
       left join unidade un on un.id = l.unidade_id`,
    [primeiro],
  );
  return new Map(rows.map((r) => [r.matricula, r]));
}

export const importadorPeculio: Importador<Plano> = {
  abas: [ABA],
  exigeDonoDoPeculio: true,

  modelo: {
    abas: [{ nome: ABA, colunas: Object.values(COLUNAS) }],
    async valores({ tx, unidadeId }) {
      const postos = (await tx.query<{ sigla: string }>('select sigla from posto_grad order by ordem')).rows;
      const unidades = (
        await tx.query<{ sigla: string }>(
          `select s.sigla from unidade s join unidade u on u.id = $1 and s.caminho <@ u.caminho
            join tipo_unidade t on t.codigo = s.tipo order by t.nivel, s.sigla`,
          [unidadeId],
        )
      ).rows;
      return [
        { titulo: 'Postos e graduações (coluna POSTO/GRAD)', itens: postos.map((p) => p.sigla) },
        { titulo: 'Lotações desta importação (coluna LOTAÇÃO)', itens: unidades.map((u) => u.sigla) },
        { titulo: 'Linha de militar novo', itens: ['O sistema cria o militar com lotação na seção da coluna LOTAÇÃO, a partir do mês atual, jornada Pronto e sem equipe. A equipe e a jornada ficam com o escalante da seção.'] },
      ];
    },
  },

  async planejar(abas, { tx, unidadeId, hoje, usuarioId }) {
    const aba = abas[ABA]!;
    const c = Object.fromEntries(Object.entries(COLUNAS).map(([k, v]) => [k, coluna(aba, v.rotulo)])) as Record<keyof typeof COLUNAS, number>;
    const problemas: ProblemaImportacao[] = [];
    const avisos: string[] = [];
    const mes = hoje.slice(0, 7);
    const vazio = { previa: { novos: [], alterados: [], iguais: 0, problemas, avisos }, plano: { itens: [], mes } };
    // as colunas do modelo: com uma ausente, "vazio limpa o campo" apagaria o dado de todo militar que já existe
    const faltam = (Object.keys(COLUNAS) as (keyof typeof COLUNAS)[]).filter((k) => c[k] < 0);
    if (faltam.length) {
      problemas.push({ aba: ABA, linha: 1, mensagem: `Faltam as colunas ${faltam.map((k) => COLUNAS[k].rotulo).join(', ')}.`, solucao: 'Baixe o modelo na tela de importação e cole os dados nele.' });
      return vazio;
    }

    const postos = (await tx.query<{ id: string; sigla: string }>('select id, sigla from posto_grad order by ordem')).rows;
    const postoPorChave = new Map(postos.map((p) => [normalizar(p.sigla), p]));
    // as lotações possíveis: a unidade da importação e as de baixo, pela sigla
    const unidades = (await tx.query<{ id: string; sigla: string }>('select s.id, s.sigla from unidade s join unidade u on u.id = $1 and s.caminho <@ u.caminho', [unidadeId])).rows;
    const unidadePorChave = new Map(unidades.map((u) => [normalizar(u.sigla), u]));
    const raiz = (await tx.query<{ sigla: string }>('select sigla from unidade where id = $1', [unidadeId])).rows[0]!.sigla;
    const ja = await existentes(tx, mes);
    // e-mails já usados (sem distinção de maiúsculas), para avisar antes do banco recusar
    const emailsEmUso = new Map(
      (await tx.query<{ email: string; matricula: string; nome_guerra: string }>('select lower(email) as email, matricula, nome_guerra from militar where email is not null')).rows.map((r) => [r.email, r]),
    );
    const cpfsEmUso = new Map(
      (await tx.query<{ cpf: string; matricula: string; nome_guerra: string }>('select cpf, matricula, nome_guerra from militar where cpf is not null')).rows.map((r) => [r.cpf, r]),
    );
    const cpfsDaPlanilha = new Map<string, { matricula: string; nome_guerra: string }>();
    // o e-mail também pode estar guardado no usuário de outro militar (acesso desativado, administrador de instalação); e quem tem acesso ativo não fica sem e-mail
    for (const r of (await tx.query<{ email: string; matricula: string; nome_guerra: string }>('select lower(u.email) as email, m.matricula, m.nome_guerra from usuario u join militar m on m.id = u.militar_id')).rows) {
      if (!emailsEmUso.has(r.email)) emailsEmUso.set(r.email, r);
    }
    const comAcessoAtivo = new Set((await tx.query<{ matricula: string }>('select m.matricula from usuario u join militar m on m.id = u.militar_id where u.ativo')).rows.map((r) => r.matricula));
    const papelDeCima = new Map<string, boolean>();
    const donoDe = async (unidade: string) => {
      if (!papelDeCima.has(unidade)) papelDeCima.set(unidade, usuarioId ? await temPapelAcima(tx, usuarioId, unidade, CADASTRO, hoje) : false);
      return papelDeCima.get(unidade)!;
    };
    const cima = async (unidade: string) => (await tx.query<{ sigla: string }>('select m.sigla from unidade u join unidade m on m.id = u.mae_id where u.id = $1', [unidade])).rows[0]?.sigla ?? 'nível acima';

    const pega = (cel: string[], i: number) => (i < 0 ? '' : (cel[i] ?? '').trim());
    const vistos = new Set<string>();
    const emailsDaPlanilha = new Map<string, string>();
    const novos: ItemPrevia[] = [];
    const alterados: ItemPrevia[] = [];
    const itens: ItemPlano[] = [];
    let iguais = 0;

    for (const l of aba.linhas) {
      const cel = l.celulas;
      const bruta = pega(cel, c.mat);
      if (!bruta) continue;
      const problema = (mensagem: string, solucao: string) => problemas.push({ aba: ABA, linha: l.linha, mensagem, solucao });

      const mat = matriculaDe(bruta);
      if (!mat.valor) {
        problema(`Matrícula inválida: "${bruta}".`, 'Use 6 dígitos, hífen e 1 dígito (ex.: 123456-7).');
        continue;
      }
      if (mat.corrigida) avisos.push(`Matrícula ${bruta} corrigida para ${mat.valor} (linha ${l.linha}).`);
      if (vistos.has(mat.valor)) {
        problema(`Matrícula ${mat.valor} repetida na planilha.`, 'Deixe uma linha só por militar.');
        continue;
      }
      vistos.add(mat.valor);

      const postoTxt = pega(cel, c.posto);
      const posto = postoPorChave.get(normalizar(postoTxt)) ?? postoPorChave.get(`${normalizar(postoTxt)}BM`);
      if (!posto) {
        problema(`Posto "${postoTxt}" não existe.`, `Use uma destas siglas: ${postos.map((p) => p.sigla).join(', ')}.`);
        continue;
      }
      const nomeCompleto = pega(cel, c.completo);
      if (!nomeCompleto) {
        problema('Nome completo vazio.', 'Preencha o NOME COMPLETO na planilha.');
        continue;
      }
      if (nomeCompleto.length > 120) {
        problema('Nome completo com mais de 120 caracteres.', 'Use no máximo 120 caracteres.');
        continue;
      }
      const nomeGuerra = pega(cel, c.guerra).toUpperCase();
      if (!nomeGuerra) {
        problema('Nome de guerra vazio.', 'Preencha o NOME DE GUERRA na planilha.');
        continue;
      }
      const lotacaoTxt = pega(cel, c.lotacao);
      const lotacao = unidadePorChave.get(normalizar(lotacaoTxt));
      if (!lotacao) {
        problema(`Lotação "${lotacaoTxt}" não é desta importação (${raiz} e as de baixo).`, `Use uma destas siglas: ${unidades.map((u) => u.sigla).join(', ')}.`);
        continue;
      }

      const sexoTxt = normalizar(pega(cel, c.sexo));
      if (sexoTxt && sexoTxt !== 'M' && sexoTxt !== 'F') {
        problema(`Sexo "${pega(cel, c.sexo)}" inválido.`, 'Use M ou F (ou deixe vazio).');
        continue;
      }
      const sexo = sexoTxt === 'M' || sexoTxt === 'F' ? sexoTxt : null;

      let nascimento: Dados['nascimento'] = null;
      const nascTxt = pega(cel, c.nascimento);
      if (nascTxt) {
        // dd/mm/aaaa (o ano é guardado) ou só dd/mm
        const m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/.exec(nascTxt);
        const lido = m ? Nascimento.safeParse({ dia: Number(m[1]), mes: Number(m[2]), ano: m[3] ? Number(m[3]) : null }) : null;
        if (!lido?.success) {
          problema(`Nascimento "${nascTxt}" inválido.`, 'Use dd/mm/aaaa ou dd/mm, de um dia que exista (ex.: 15/03/1985 ou 15/03).');
          continue;
        }
        nascimento = { dia: lido.data.dia, mes: lido.data.mes, ano: lido.data.ano ?? null };
      }

      const cpfTxt = pega(cel, c.cpf);
      let cpf: string | null = null;
      if (cpfTxt) {
        const lido = Cpf.safeParse(cpfTxt);
        if (!lido.success) {
          problema(MSG_CPF, 'Confira os 11 dígitos (ou deixe vazio).');
          continue;
        }
        cpf = lido.data;
      }
      const cepTxt = pega(cel, c.cep);
      let cep: string | null = null;
      if (cepTxt) {
        const lido = Cep.safeParse(cepTxt);
        if (!lido.success) {
          problema(MSG_CEP, 'Use 8 dígitos, com ou sem traço (ou deixe vazio).');
          continue;
        }
        cep = lido.data;
      }
      const ufTxt = pega(cel, c.uf);
      let uf: string | null = null;
      if (ufTxt) {
        const lido = Uf.safeParse(ufTxt);
        if (!lido.success) {
          problema(MSG_UF, 'Use uma das 27 siglas (ou deixe vazio).');
          continue;
        }
        uf = lido.data;
      }
      const textoDoEndereco = (rotulo: string, valor: string): string | null | false => {
        if (valor.length > 120) {
          problema(`${rotulo} com mais de 120 caracteres.`, 'Use no máximo 120 caracteres.');
          return false;
        }
        return valor || null;
      };
      const logradouro = textoDoEndereco('Logradouro', pega(cel, c.logradouro));
      const numero = textoDoEndereco('Número', pega(cel, c.numero));
      const complemento = textoDoEndereco('Complemento', pega(cel, c.complemento));
      const bairro = textoDoEndereco('Bairro', pega(cel, c.bairro));
      const cidade = textoDoEndereco('Cidade', pega(cel, c.cidade));
      if ([logradouro, numero, complemento, bairro, cidade].includes(false)) continue;

      const emailTxt = pega(cel, c.email);
      let email: string | null = null;
      if (emailTxt) {
        const lido = EmailInstitucional.safeParse(emailTxt);
        if (!lido.success) {
          problema(`E-mail "${emailTxt}" fora do domínio institucional.`, lido.error.issues[0]!.message);
          continue;
        }
        email = lido.data;
      }
      const telefoneTxt = pega(cel, c.telefone);
      let telefone: string | null = null;
      if (telefoneTxt) {
        const lido = Telefone.safeParse(telefoneTxt);
        if (!lido.success) {
          problema(`Telefone "${telefoneTxt}" inválido.`, lido.error.issues[0]!.message);
          continue;
        }
        telefone = lido.data;
      }
      const comportamentoTxt = pega(cel, c.comportamento);
      let comportamento: string | null = null;
      if (comportamentoTxt) {
        comportamento = COMPORTAMENTOS.find((x) => normalizar(x) === normalizar(comportamentoTxt)) ?? null;
        if (!comportamento) {
          problema(`Comportamento "${comportamentoTxt}" não existe.`, `Use um destes: ${COMPORTAMENTOS.join(', ')}.`);
          continue;
        }
      }
      const boletimTxt = pega(cel, c.boletim);
      if (boletimTxt.length > 60) {
        problema('Boletim do comportamento com mais de 60 caracteres.', 'Use no máximo 60 caracteres.');
        continue;
      }
      const antigTxt = pega(cel, c.antig);
      let antiguidade: number | null = null;
      if (antigTxt) {
        if (!/^\d+$/.test(antigTxt) || !Antiguidade.safeParse(Number(antigTxt)).success) {
          problema(`Antiguidade "${antigTxt}" inválida.`, 'Use um número inteiro de 1 a 99999 (ou deixe vazio).');
          continue;
        }
        antiguidade = Number(antigTxt);
      }

      const e = ja.get(mat.valor);
      if (!email && e?.email && comAcessoAtivo.has(mat.valor)) {
        problema(`${nomeGuerra} (${mat.valor}) tem acesso ao sistema e a planilha está sem e-mail.`, 'Preencha o e-mail na planilha, ou desative o acesso dele na ficha antes de apagar o e-mail.');
        continue;
      }
      // o e-mail é único: de outro militar ou repetido na própria planilha é problema, não erro do banco na gravação
      if (email) {
        const chave = email.toLowerCase();
        const dono = emailsEmUso.get(chave);
        if (emailsDaPlanilha.has(chave)) {
          problema(`E-mail repetido na planilha: ${email}.`, 'Cada militar tem o seu e-mail institucional.');
          continue;
        }
        if (dono && dono.matricula !== mat.valor) {
          problema(`E-mail ${email} já é de ${dono.nome_guerra} (${dono.matricula}).`, 'Corrija o e-mail na planilha ou o do outro militar na ficha.');
          continue;
        }
      }

      // o CPF é único: de outro militar ou repetido na própria planilha é problema, não erro do banco na gravação
      if (cpf) {
        const dono = cpfsEmUso.get(cpf);
        const naPlanilha = cpfsDaPlanilha.get(cpf);
        const de = naPlanilha && naPlanilha.matricula !== mat.valor ? naPlanilha : dono && dono.matricula !== mat.valor ? dono : null;
        if (de) {
          problema(`Este CPF já é de ${de.nome_guerra}.`, 'Corrija o CPF na planilha ou o do outro militar na ficha.');
          continue;
        }
      }

      // dono do bloco: papel acima da lotação do militar (a atual, se ele já existe; senão a da linha)
      const referencia = e?.unidade_id ?? lotacao.id;
      if (!(await donoDe(referencia))) {
        const sigla = e?.unidade_sigla ?? lotacao.sigla;
        problema(
          e ? `${nomeGuerra} (${mat.valor}) está lotado na ${sigla}: o Pecúlio dele é de quem tem papel no ${await cima(referencia)}.` : `Cadastrar militar na ${sigla} é de quem tem papel no ${await cima(referencia)}.`,
          'Peça a quem tem esse papel para importar a linha.',
        );
        continue;
      }
      if (email) emailsDaPlanilha.set(email.toLowerCase(), mat.valor);
      if (cpf) cpfsDaPlanilha.set(cpf, { matricula: mat.valor, nome_guerra: nomeGuerra });

      const dados: Dados = {
        matricula: mat.valor, postoId: posto.id, posto: posto.sigla, nomeCompleto, nomeGuerra, antiguidade, sexo, nascimento, telefone, email, comportamento, boletim: boletimTxt || null,
        cpf, endereco: { cep, logradouro: logradouro as string | null, numero: numero as string | null, complemento: complemento as string | null, bairro: bairro as string | null, cidade: cidade as string | null, uf },
      };
      const descricao = `${posto.sigla} ${nomeGuerra}`;
      if (!e) {
        novos.push({ chave: mat.valor, descricao });
        itens.push({ id: null, dados, unidadeId: lotacao.id });
        continue;
      }
      // quem já existe: só os campos do Pecúlio; a lotação diferente é aviso (mudar a lotação pede o "a partir de": "Alterar situação")
      if (e.unidade_id && e.unidade_id !== lotacao.id) {
        avisos.push(`${nomeGuerra} (${mat.valor}): a planilha diz ${lotacao.sigla} e o sistema ${e.unidade_sigla}; a lotação não foi mudada (use "Alterar situação" na ficha).`);
      }
      const vazioDe = (v: unknown, feminino = false) => (v == null ? (feminino ? 'vazia' : 'vazio') : String(v));
      const mudancas: string[] = [];
      if (e.posto_grad_id !== posto.id) mudancas.push(`posto: ${e.posto} → ${posto.sigla}`);
      if ((e.nome_completo ?? '') !== nomeCompleto) mudancas.push(`nome completo: ${vazioDe(e.nome_completo)} → ${nomeCompleto}`);
      if (e.nome_guerra !== nomeGuerra) mudancas.push(`nome de guerra: ${e.nome_guerra} → ${nomeGuerra}`);
      if (e.antiguidade !== antiguidade) mudancas.push(`antiguidade: ${vazioDe(e.antiguidade, true)} → ${vazioDe(antiguidade, true)}`);
      if (e.sexo !== sexo) mudancas.push(`sexo: ${vazioDe(e.sexo)} → ${vazioDe(sexo)}`);
      const antes = e.nascimento_dia !== null && e.nascimento_mes !== null ? { dia: e.nascimento_dia, mes: e.nascimento_mes, ano: e.nascimento_ano } : null;
      if (textoNascimento(antes) !== textoNascimento(nascimento)) mudancas.push(`nascimento: ${textoNascimento(antes)} → ${textoNascimento(nascimento)}`);
      if (e.cpf !== cpf) mudancas.push(`CPF: ${vazioDe(maskCpf(e.cpf))} → ${vazioDe(maskCpf(cpf))}`);
      for (const [rotulo, antesV, depoisV] of [
        ['CEP', e.cep, dados.endereco.cep], ['logradouro', e.logradouro, dados.endereco.logradouro], ['número', e.numero, dados.endereco.numero],
        ['complemento', e.complemento, dados.endereco.complemento], ['bairro', e.bairro, dados.endereco.bairro], ['cidade', e.cidade, dados.endereco.cidade], ['UF', e.uf, dados.endereco.uf],
      ] as const) {
        if (antesV !== depoisV) mudancas.push(`${rotulo}: ${vazioDe(antesV)} → ${vazioDe(depoisV)}`);
      }
      if (e.telefone !== telefone) mudancas.push(`telefone: ${vazioDe(e.telefone)} → ${vazioDe(telefone)}`);
      if (e.email !== email) mudancas.push(`e-mail: ${vazioDe(e.email)} → ${vazioDe(email)}`);
      if (e.comportamento !== comportamento) mudancas.push(`comportamento: ${vazioDe(e.comportamento)} → ${vazioDe(comportamento)}`);
      if (e.comportamento_boletim !== dados.boletim) mudancas.push(`boletim do comportamento: ${vazioDe(e.comportamento_boletim)} → ${vazioDe(dados.boletim)}`);
      if (!mudancas.length) {
        iguais++;
        continue;
      }
      alterados.push({ chave: mat.valor, descricao, mudancas });
      itens.push({ id: e.id, dados, unidadeId: lotacao.id });
    }

    const lotados = [...ja.values()].filter((e) => e.unidade_id && unidadePorChave.has(normalizar(e.unidade_sigla ?? '')) && !vistos.has(e.matricula)).length;
    if (lotados) avisos.push(`${lotados} militares do sistema não estão na planilha (nada foi apagado).`);
    return { previa: { novos, alterados, iguais, problemas, avisos }, plano: { itens, mes } };
  },

  async aplicar(plano, { tx, hoje }) {
    const desde = mesParaData(plano.mes);
    for (const it of plano.itens) {
      const d = it.dados;
      const e = d.endereco;
      const valores = [
        d.postoId, d.nomeCompleto, d.nomeGuerra, d.antiguidade, d.sexo, d.nascimento?.dia ?? null, d.nascimento?.mes ?? null, d.nascimento?.ano ?? null, d.telefone, d.email, d.comportamento, d.boletim,
        d.cpf, e.cep, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf,
      ];
      if (!it.id) {
        // o quadro vale por período: o do posto, quando ele só existe em um (senão, sem quadro, com a pendência "Sem quadro")
        const quadro = await quadroParaOPosto(tx, d.postoId, undefined, null);
        const id = (await tx.query<{ id: string }>(
          `insert into militar (matricula, posto_grad_id, nome_completo, nome_guerra, antiguidade, sexo, nascimento_dia, nascimento_mes, nascimento_ano, telefone, email, comportamento, comportamento_boletim,
                                cpf, cep, logradouro, numero, complemento, bairro, cidade, uf)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21) returning id`,
          [d.matricula, ...valores],
        )).rows[0]!.id;
        // lotação na seção da linha, a partir do mês atual, Pronto e sem equipe (equipe e jornada ficam com o escalante); situação "Ativa" por padrão
        await tx.query("insert into rastreio (militar_id, unidade_id, equipe_id, jornada, desde, quadro_id) values ($1, $2, null, 'pronto', $3, $4)", [
          id, it.unidadeId, desde, 'erro' in quadro ? null : quadro.quadroId,
        ]);
        continue;
      }
      const antes = (await tx.query<{ posto_grad_id: string }>('select posto_grad_id from militar where id = $1', [it.id])).rows[0]!.posto_grad_id;
      await tx.query(
        `update militar set posto_grad_id = $2, nome_completo = $3, nome_guerra = $4, antiguidade = $5, sexo = $6, nascimento_dia = $7, nascimento_mes = $8, nascimento_ano = $9,
                telefone = $10, email = $11, comportamento = $12, comportamento_boletim = $13,
                cpf = $14, cep = $15, logradouro = $16, numero = $17, complemento = $18, bairro = $19, cidade = $20, uf = $21 where id = $1`,
        [it.id, ...valores],
      );
      // o quadro acompanha o posto (mesma regra da ficha): trocar o posto leva o período aberto ao quadro que serve
      if (antes !== d.postoId) {
        const aberto = (await tx.query<{ quadro_id: string | null }>('select quadro_id from rastreio where militar_id = $1 and ate is null', [it.id])).rows[0];
        if (aberto) {
          const quadro = await quadroParaOPosto(tx, d.postoId, undefined, aberto.quadro_id);
          if (!('erro' in quadro)) await mudarPeriodoAberto(tx, it.id, hoje, { quadroId: quadro.quadroId });
        }
      }
    }
    return plano.itens.length;
  },
};
