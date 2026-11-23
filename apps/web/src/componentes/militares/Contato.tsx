import { useQueryClient } from '@tanstack/react-query';
import { EmailInstitucional, EmailPessoal, Telefone, type EdicaoMilitar, type FichaMilitar } from 'contratos';
import { useState } from 'react';
import { camposDe, mensagemDe } from '@/api/cliente';
import { atualizarMilitares, editarMilitar } from '@/api/militares';
import { Campo } from '@/componentes/Campo';
import { CampoDeEmailInstitucional, CampoDeTelefone } from '@/componentes/CamposDeContato';
import { AcoesDoBloco, usePendencia, useSincronizar, useTrava } from '@/componentes/AlteracoesPendentes';
import { Input } from '@/componentes/ui/input';
import { DOMINIO_DO_EMAIL, erroDoTelefone, mascararTelefone, usuarioGravado } from '@/lib/mascaras';
import { DonoDoBloco, Secao } from './Secao';

/**
 * Contato: telefone (máscara: só números na digitação) e e-mail institucional (o campo recebe só o usuário, e o @bombeiros.pe.gov.br fica fixo à direita). Do Pecúlio: sem papel acima
 * da lotação, só leitura.
 */
export function Contato({ ficha }: { ficha: FichaMilitar }) {
  const queryClient = useQueryClient();
  const peculio = ficha.podeEditar.peculio;
  // o telefone gravado aparece mascarado (se tem 10 ou 11 dígitos; senão, como está) e o e-mail, só com o usuário
  const telefoneGravado = ficha.telefone && erroDoTelefone(ficha.telefone) === null ? mascararTelefone(ficha.telefone) : (ficha.telefone ?? '');
  const doServidor = { telefone: telefoneGravado, email: usuarioGravado(ficha.email), emailPessoal: ficha.emailPessoal ?? '' };
  const [telefone, setTelefone] = useState(doServidor.telefone);
  const [email, setEmail] = useState(doServidor.email);
  const [emailPessoal, setEmailPessoal] = useState(doServidor.emailPessoal);
  const [aviso, setAviso] = useState<{ erro: boolean; texto: string } | null>(null);
  const [campos, setCampos] = useState<Record<string, string>>({});
  // o aviso de "só o usuário" aparece na hora, enquanto se digita ou cola
  const [erroDoEmail, setErroDoEmail] = useState<string | null>(null);
  const [salvo, setSalvo] = useState(doServidor);
  const sujo = telefone.trim() !== salvo.telefone || email.trim() !== salvo.email || emailPessoal.trim() !== salvo.emailPessoal;
  usePendencia('contato', sujo);
  useSincronizar(JSON.stringify(doServidor), sujo, () => {
    setTelefone(doServidor.telefone);
    setEmail(doServidor.email);
    setEmailPessoal(doServidor.emailPessoal);
    setErroDoEmail(null);
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
      const faltou = erroDoTelefone(telefone);
      const lido = telefone.trim() ? Telefone.safeParse(telefone.trim()) : null;
      if (faltou) erros.telefone = faltou;
      else if (lido && !lido.success) erros.telefone = lido.error.issues[0]!.message;
      else alteracoes.telefone = lido?.success ? lido.data : null;
    }
    if (email.trim() !== salvo.email) {
      const lido = email.trim() ? EmailInstitucional.safeParse(`${email.trim()}${DOMINIO_DO_EMAIL}`) : null;
      if (erroDoEmail) erros.email = erroDoEmail;
      else if (lido && !lido.success) erros.email = lido.error.issues[0]!.message;
      else alteracoes.email = lido?.success ? lido.data : null;
    }
    if (emailPessoal.trim() !== salvo.emailPessoal) {
      const lido = emailPessoal.trim() ? EmailPessoal.safeParse(emailPessoal.trim()) : null;
      if (lido && !lido.success) erros.emailPessoal = lido.error.issues[0]!.message;
      else alteracoes.emailPessoal = lido?.success ? lido.data : null;
    }
    if (Object.keys(erros).length) {
      setCampos(erros);
      return;
    }
    try {
      await editarMilitar(ficha.id, alteracoes);
      setSalvo({ telefone: telefone.trim(), email: email.trim(), emailPessoal: emailPessoal.trim() });
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
            <CampoDeTelefone id="ct-telefone" valor={telefone} disabled={!peculio} aoMudar={setTelefone} />
          </Campo>
          <Campo id="ct-email" rotulo="E-mail institucional" erro={erroDoEmail ?? campos.email}>
            <CampoDeEmailInstitucional id="ct-email" valor={email} disabled={!peculio} aoMudar={(usuario, erro) => { setEmail(usuario); setErroDoEmail(erro); }} />
          </Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <div className="hidden sm:block" aria-hidden />
          <Campo id="ct-email-pessoal" rotulo="E-mail pessoal" erro={campos.emailPessoal}>
            <Input id="ct-email-pessoal" type="text" inputMode="email" autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="nome@exemplo.com" value={emailPessoal} disabled={!peculio} onChange={(e) => setEmailPessoal(e.target.value)} />
          </Campo>
        </div>
        <AcoesDoBloco salvando={salvando} sujo={sujo} desabilitado={!peculio} aviso={aviso} rotulo="Salvar contato" />
      </form>
    </Secao>
  );
}
