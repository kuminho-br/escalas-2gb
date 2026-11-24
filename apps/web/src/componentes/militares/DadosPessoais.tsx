import { useQueryClient } from '@tanstack/react-query';
import { Cpf, EdicaoDeEndereco, Nascimento, RgFuncional, UFS, type EdicaoMilitar, type FichaMilitar } from 'contratos';
import { useState } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { atualizarMilitares, editarMilitar } from '@/api/militares';
import { AcoesDoBloco, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Campo } from '@/componentes/Campo';
import { Selecao } from '@/componentes/Selecao';
import { Input } from '@/componentes/ui/input';
import { Label } from '@/componentes/ui/label';
import { mascararCep, mascararCpf } from '@/lib/militares';
import { DonoDoBloco, Secao } from './Secao';

type Valores = {
  dia: string; mes: string; ano: string; cpf: string; rgFuncional: string;
  cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string;
};
const CAMPOS_DO_ENDERECO = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'] as const;

// o bloco só aparece para quem vê os dados restritos (a API manda as três chaves); sem elas, os campos começam vazios
const doServidor = (f: FichaMilitar): Valores => ({
  dia: f.nascimento ? String(f.nascimento.dia) : '',
  mes: f.nascimento ? String(f.nascimento.mes) : '',
  ano: f.nascimento?.ano ? String(f.nascimento.ano) : '',
  cpf: f.cpf ?? '',
  rgFuncional: f.rgFuncional ?? '',
  cep: f.endereco?.cep ?? '', logradouro: f.endereco?.logradouro ?? '', numero: f.endereco?.numero ?? '', complemento: f.endereco?.complemento ?? '',
  bairro: f.endereco?.bairro ?? '', cidade: f.endereco?.cidade ?? '', uf: f.endereco?.uf ?? '',
});
const igual = (a: Valores, b: Valores) => (Object.keys(a) as (keyof Valores)[]).every((k) => a[k].trim() === b[k].trim());

/** Dados pessoais (CPF, nascimento com o ano opcional) e o endereço. Do Pecúlio: sem nível acima da lotação, só leitura. */
export function DadosPessoais({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const peculio = ficha.podeEditar.peculio;
  const servidor = doServidor(ficha);
  const [v, setV] = useState<Valores>(servidor);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  // o último gravado (começa com o que veio do servidor): o que difere dele é alteração pendente
  const [salvo, setSalvo] = useState(servidor);
  const sujo = !igual(v, salvo);
  usePendencia('dados-pessoais', sujo);
  useSincronizar(JSON.stringify(servidor), sujo, () => {
    setV(servidor);
    setSalvo(servidor);
  });
  const mudar = (k: keyof Valores, valor: string) => setV((a) => ({ ...a, [k]: valor }));

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    setCampos({});
    if (!sujo) return;
    const pedido: EdicaoMilitar = {};
    const erros: Record<string, string> = {};
    // dia, mês e ano andam juntos; o ano é opcional. Tudo vazio limpa; o que o contrato recusa aparece no campo, sem ir ao servidor
    if (['dia', 'mes', 'ano'].some((k) => v[k as keyof Valores].trim() !== salvo[k as keyof Valores].trim())) {
      if (v.dia.trim() || v.mes.trim() || v.ano.trim()) {
        // o ano vazio só vai (como null, para limpar) quando havia um gravado
        const ano = v.ano.trim() ? { ano: Number(v.ano) } : salvo.ano.trim() ? { ano: null } : {};
        const lido = Nascimento.safeParse({ dia: Number(v.dia), mes: Number(v.mes), ...ano });
        if (lido.success) pedido.nascimento = lido.data;
        else erros.nascimento = lido.error.issues[0]!.message;
      } else pedido.nascimento = null;
    }
    if (v.cpf.trim() !== salvo.cpf.trim()) {
      if (!v.cpf.trim()) pedido.cpf = null;
      else {
        const lido = Cpf.safeParse(v.cpf);
        if (lido.success) pedido.cpf = lido.data;
        else erros.cpf = lido.error.issues[0]!.message;
      }
    }
    if (v.rgFuncional !== salvo.rgFuncional) {
      if (!v.rgFuncional) pedido.rgFuncional = null;
      else {
        const lido = RgFuncional.safeParse(v.rgFuncional);
        if (lido.success) pedido.rgFuncional = lido.data;
        else erros.rgFuncional = lido.error.issues[0]!.message;
      }
    }
    const endereco: Record<string, string | null> = {};
    for (const k of CAMPOS_DO_ENDERECO) if (v[k].trim() !== salvo[k].trim()) endereco[k] = v[k].trim() || null;
    if (Object.keys(endereco).length) {
      const lido = EdicaoDeEndereco.safeParse(endereco);
      if (lido.success) pedido.endereco = lido.data;
      else for (const i of lido.error.issues) erros[i.path.join('.') || 'endereco'] = i.message;
    }
    if (Object.keys(erros).length) {
      setCampos(erros);
      return;
    }
    try {
      await editarMilitar(ficha.id, pedido);
      // o CPF e o CEP ficam no estado só com os dígitos (a máscara é da tela): o enviado vira o novo "salvo"
      setSalvo(v);
      atualizarMilitares(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      setCampos(camposDe(err));
      setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }
  const erroDoNascimento = campos.nascimento ?? campos['nascimento.dia'] ?? campos['nascimento.mes'] ?? campos['nascimento.ano'];
  const doEndereco = (k: string) => campos[`endereco.${k}`] ?? campos[k];

  return (
    <Secao titulo="Dados pessoais">
      {!peculio && <DonoDoBloco unidadeDeCima={ficha.podeEditar.unidadeDeCima} />}
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="grid content-start gap-3">
            <Campo id="dp-cpf" rotulo="CPF" erro={campos.cpf}>
              <Input id="dp-cpf" inputMode="numeric" value={mascararCpf(v.cpf)} disabled={!peculio} onChange={(e) => mudar('cpf', e.target.value.replace(/\D/g, '').slice(0, 11))} />
            </Campo>
            <Campo id="dp-rg-funcional" rotulo="RG funcional" ajuda="Registro geral do militar nos órgãos estaduais de segurança pública." erro={campos.rgFuncional}>
              <Input id="dp-rg-funcional" value={v.rgFuncional} maxLength={20} disabled={!peculio} onChange={(e) => mudar('rgFuncional', e.target.value)} />
            </Campo>
          </div>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium">Nascimento (o ano é opcional)</legend>
            <div className="grid grid-cols-3 gap-3 sm:max-w-sm">
              <div className="grid gap-1.5">
                <Label htmlFor="dp-dia">Dia</Label>
                <Input id="dp-dia" type="number" min={1} max={31} value={v.dia} disabled={!peculio} aria-invalid={erroDoNascimento ? true : undefined} aria-describedby={erroDoNascimento ? 'dp-erro' : undefined} onChange={(e) => mudar('dia', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dp-mes">Mês</Label>
                <Input id="dp-mes" type="number" min={1} max={12} value={v.mes} disabled={!peculio} aria-invalid={erroDoNascimento ? true : undefined} aria-describedby={erroDoNascimento ? 'dp-erro' : undefined} onChange={(e) => mudar('mes', e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="dp-ano">Ano</Label>
                <Input id="dp-ano" type="number" min={1900} max={2100} value={v.ano} disabled={!peculio} aria-invalid={erroDoNascimento ? true : undefined} aria-describedby={erroDoNascimento ? 'dp-erro' : undefined} onChange={(e) => mudar('ano', e.target.value)} />
              </div>
            </div>
            {erroDoNascimento && <p id="dp-erro" className="text-xs text-alerta">{erroDoNascimento}</p>}
          </fieldset>
        </div>
        <fieldset className="grid gap-3">
          <legend className="mb-1.5 text-sm font-medium">Endereço</legend>
          <div className="grid gap-3 sm:grid-cols-[9rem_1fr_6rem]">
            <Campo id="dp-cep" rotulo="CEP" erro={doEndereco('cep')}>
              <Input id="dp-cep" inputMode="numeric" value={mascararCep(v.cep)} disabled={!peculio} onChange={(e) => mudar('cep', e.target.value.replace(/\D/g, '').slice(0, 8))} />
            </Campo>
            <Campo id="dp-logradouro" rotulo="Logradouro" erro={doEndereco('logradouro')}>
              <Input id="dp-logradouro" value={v.logradouro} disabled={!peculio} onChange={(e) => mudar('logradouro', e.target.value)} />
            </Campo>
            <Campo id="dp-numero" rotulo="Número" erro={doEndereco('numero')}>
              <Input id="dp-numero" value={v.numero} disabled={!peculio} onChange={(e) => mudar('numero', e.target.value)} />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo id="dp-complemento" rotulo="Complemento" erro={doEndereco('complemento')}>
              <Input id="dp-complemento" value={v.complemento} disabled={!peculio} onChange={(e) => mudar('complemento', e.target.value)} />
            </Campo>
            <Campo id="dp-bairro" rotulo="Bairro" erro={doEndereco('bairro')}>
              <Input id="dp-bairro" value={v.bairro} disabled={!peculio} onChange={(e) => mudar('bairro', e.target.value)} />
            </Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
            <Campo id="dp-cidade" rotulo="Cidade" erro={doEndereco('cidade')}>
              <Input id="dp-cidade" value={v.cidade} disabled={!peculio} onChange={(e) => mudar('cidade', e.target.value)} />
            </Campo>
            <Campo id="dp-uf" rotulo="UF" erro={doEndereco('uf')}>
              <Selecao id="dp-uf" value={v.uf} disabled={!peculio} onChange={(e) => mudar('uf', e.target.value)}>
                <option value="">—</option>
                {UFS.map((u) => <option key={u} value={u}>{u}</option>)}
              </Selecao>
            </Campo>
          </div>
        </fieldset>
        <AcoesDoBloco salvando={salvando} sujo={sujo} desabilitado={!peculio} aviso={aviso} rotulo="Salvar dados pessoais" />
      </form>
    </Secao>
  );
}
