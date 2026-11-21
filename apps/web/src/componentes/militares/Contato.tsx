import { useQueryClient } from '@tanstack/react-query';
import { EmailInstitucional, Telefone, type EdicaoMilitar, type FichaMilitar } from 'contratos';
import { useState } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { atualizarMilitares, editarMilitar } from '@/api/militares';
import { Campo } from '@/componentes/Campo';
import { AcoesDoBloco, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { DonoDoBloco, Secao } from './Secao';

/** Contato: telefone e e-mail institucional (só @bombeiros.pe.gov.br). Do Pecúlio: sem papel acima da lotação, só leitura. */
export function Contato({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const peculio = ficha.podeEditar.peculio;
  const doServidor = { telefone: ficha.telefone ?? '', email: ficha.email ?? '' };
  const [telefone, setTelefone] = useState(doServidor.telefone);
  const [email, setEmail] = useState(doServidor.email);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [salvo, setSalvo] = useState(doServidor);
  const sujo = telefone.trim() !== salvo.telefone || email.trim() !== salvo.email;
  usePendencia('contato', sujo);
  useSincronizar(JSON.stringify(doServidor), sujo, () => {
    setTelefone(doServidor.telefone);
    setEmail(doServidor.email);
    setSalvo(doServidor);
  });

  const { salvando, travar } = useTrava();
  const salvar = travar(gravar);
  async function gravar() {
    setAviso(null);
    setCampos({});
    if (!sujo) return;
    // só o que mudou; vazio limpa (null). O que o contrato recusa aparece no campo, sem ir ao servidor
    const alteracoes: EdicaoMilitar = {};
    const erros: Record<string, string> = {};
    if (telefone.trim() !== salvo.telefone) {
      const lido = telefone.trim() ? Telefone.safeParse(telefone) : null;
      if (lido && !lido.success) erros.telefone = lido.error.issues[0]!.message;
      else alteracoes.telefone = lido?.success ? lido.data : null;
    }
    if (email.trim() !== salvo.email) {
      const lido = email.trim() ? EmailInstitucional.safeParse(email) : null;
      if (lido && !lido.success) erros.email = lido.error.issues[0]!.message;
      else alteracoes.email = lido?.success ? lido.data : null;
    }
    if (Object.keys(erros).length) {
      setCampos(erros);
      return;
    }
    try {
      await editarMilitar(ficha.id, alteracoes);
      setSalvo({ telefone: telefone.trim(), email: email.trim() });
      atualizarMilitares(queryClient, ficha.id);
      setAviso({ erro: false, texto: 'Alterações salvas.' });
    } catch (err) {
      const doCampo = camposDe(err);
      setCampos(doCampo);
      // o 409 do e-mail repetido já está escrito embaixo do campo: não repete no alto do bloco
      if (!Object.values(doCampo).includes(mensagemDe(err))) setAviso({ erro: true, texto: mensagemDe(err) });
    }
  }

  return (
    <Secao titulo="Contato">
      {!peculio && <DonoDoBloco unidadeDeCima={ficha.podeEditar.unidadeDeCima} />}
      <form onSubmit={(e) => { e.preventDefault(); void salvar(); }} className="grid gap-3">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Campo id="ct-telefone" rotulo="Telefone" erro={campos.telefone}>
            <Input id="ct-telefone" type="tel" value={telefone} disabled={!peculio} onChange={(e) => setTelefone(e.target.value)} />
          </Campo>
          <Campo id="ct-email" rotulo="E-mail institucional" erro={campos.email}>
            <Input id="ct-email" type="email" placeholder="nome@bombeiros.pe.gov.br" value={email} disabled={!peculio} onChange={(e) => setEmail(e.target.value)} />
          </Campo>
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} desabilitado={!peculio} aviso={aviso} rotulo="Salvar contato" />
      </form>
    </Secao>
  );
}
