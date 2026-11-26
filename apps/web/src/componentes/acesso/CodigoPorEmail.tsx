import { useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { AVISO_DO_CODIGO } from 'contratos';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { criarSenhaComCodigo, pedirCodigo } from '@/api/acesso';
import { camposDe, mensagemDe, saida } from '@/api/cliente';
import { consultaEu } from '@/api/eu';
import { authCliente } from '@/auth-cliente';
import { Campo } from '@/componentes/Campo';
import { MoldeDoAcesso } from '@/componentes/acesso/MoldeDoAcesso';
import { RequisitosDaSenha, senhaCumpreOsRequisitos } from '@/componentes/acesso/RequisitosDaSenha';
import { Button } from '@/componentes/ui/button';
import { Input } from '@/componentes/ui/input';
import { pedeMenosMovimento } from '@/lib/transicao-login/regra';

/** Primeiro acesso e "Esqueci minha senha" são o mesmo mecanismo: só mudam o título e o texto. */
const TEXTOS = {
  'primeiro-acesso': { titulo: 'Primeiro acesso', pedido: 'Digite o e-mail cadastrado pela sua seção. Enviaremos um código para ele.' },
  esqueci: { titulo: 'Esqueci minha senha', pedido: 'Digite o e-mail cadastrado pela sua seção. Enviaremos um código para criar uma senha nova.' },
} as const;
const DESCRICAO_DO_CODIGO = 'Digite o código que chegou no e-mail e crie a sua senha.';
const SENHA_CRIADA_SEM_LOGIN = 'Sua senha foi criada. Entre com o e-mail e a senha nova.';

const LINK = 'justify-self-start text-sm text-vinho underline underline-offset-2';

/** O fluxo das duas telas: 1) o e-mail institucional e o código; 2) o código, a senha nova e a entrada. */
export function CodigoPorEmail({ variante }: { variante: keyof typeof TEXTOS }) {
  const textos = TEXTOS[variante];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<'email' | 'codigo'>('email');
  const [email, setEmail] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [repita, setRepita] = useState('');
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [senhaCriada, setSenhaCriada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const codigoRef = useRef<HTMLInputElement>(null);
  // o foco vai ao primeiro campo de cada etapa; a cada código recusado, volta ao código (num efeito, porque o campo só recebe foco depois de desenhado)
  useEffect(() => {
    (etapa === 'email' ? emailRef : codigoRef).current?.focus();
  }, [etapa]);
  const [recusas, setRecusas] = useState(0);
  useEffect(() => {
    if (recusas) codigoRef.current?.focus();
  }, [recusas]);

  async function pedir(e?: FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setErro(null);
    setCampos({});
    setEnviando(true);
    try {
      const r = await pedirCodigo(email.trim());
      setMensagem(r.mensagem);
      setCodigo('');
      setEtapa('codigo');
      // pedir outro código, já na etapa 2: o efeito de etapa não roda de novo, então o foco vai ao código aqui
      codigoRef.current?.focus();
    } catch (err) {
      const doEmail = camposDe(err).email;
      if (doEmail) setCampos({ email: doEmail });
      else setErro(mensagemDe(err));
    } finally {
      setEnviando(false);
    }
  }

  async function criar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!senhaCumpreOsRequisitos(senha, repita)) return;
    setErro(null);
    setCampos({});
    setEnviando(true);
    try {
      await criarSenhaComCodigo({ email: email.trim(), codigo: codigo.trim(), novaSenha: senha });
    } catch (err) {
      const recusados = camposDe(err);
      setCampos(recusados);
      if (!recusados.codigo && !recusados.novaSenha) setErro(mensagemDe(err));
      if (recusados.codigo) setRecusas((n) => n + 1);
      setEnviando(false);
      return;
    }
    // a senha está criada: entra com ela, como no login
    try {
      const { error } = await authCliente.signIn.email({ email: email.trim(), password: senha });
      if (error) throw new Error('login');
      saida.marcar(false);
      await queryClient.fetchQuery({ ...consultaEu, staleTime: 0 });
      // a entrada é a curta (a cena das mangueiras é do botão "Entrar" do login)
      await navigate({ to: '/', viewTransition: !pedeMenosMovimento() });
    } catch {
      setSenhaCriada(true);
      setErro(SENHA_CRIADA_SEM_LOGIN);
    } finally {
      setEnviando(false);
    }
  }

  if (etapa === 'email') {
    return (
      <MoldeDoAcesso titulo={textos.titulo} descricao={textos.pedido}>
        <form onSubmit={(e) => void pedir(e)} className="grid gap-4 px-[22px] pt-5 pb-8 lg:p-6" noValidate>
          <Campo id="email" rotulo="E-mail institucional" erro={campos.email}>
            <Input ref={emailRef} id="email" name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-[46px] lg:h-10" />
          </Campo>
          {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
          <Button type="submit" disabled={enviando || !email.trim()} className="mt-1 h-[46px] lg:h-10">
            {enviando ? 'Enviando…' : 'Enviar código'}
          </Button>
          <Link to="/entrar" className={LINK}>Voltar para entrar</Link>
        </form>
      </MoldeDoAcesso>
    );
  }

  return (
    <MoldeDoAcesso titulo={textos.titulo} descricao={DESCRICAO_DO_CODIGO}>
      <form onSubmit={(e) => void criar(e)} className="grid gap-4 px-[22px] pt-5 pb-8 lg:p-6" noValidate>
        <div className="grid gap-1">
          <p role="status" className="text-sm text-tinta">{mensagem}</p>
          <p className="text-sm text-apagado">{AVISO_DO_CODIGO}</p>
        </div>
        <Campo id="codigo" rotulo="Código (6 números)" erro={campos.codigo}>
          <Input
            ref={codigoRef}
            id="codigo"
            name="codigo"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
            className="h-[46px] tracking-[0.3em] lg:h-10"
          />
        </Campo>
        <Campo id="senha-nova" rotulo="Senha nova" erro={campos.novaSenha}>
          <Input id="senha-nova" name="senha-nova" type="password" autoComplete="new-password" value={senha} onChange={(e) => setSenha(e.target.value)} className="h-[46px] lg:h-10" />
        </Campo>
        <Campo id="senha-repita" rotulo="Repita a senha nova">
          <Input id="senha-repita" name="senha-repita" type="password" autoComplete="new-password" value={repita} onChange={(e) => setRepita(e.target.value)} className="h-[46px] lg:h-10" />
        </Campo>
        <RequisitosDaSenha senha={senha} confirmacao={repita} />
        {erro && <p role="alert" className="text-sm text-alerta">{erro}</p>}
        {senhaCriada && <Link to="/entrar" className={LINK}>Ir para o login</Link>}
        <Button type="submit" disabled={enviando || !senhaCumpreOsRequisitos(senha, repita)} className="mt-1 h-[46px] lg:h-10">
          {enviando ? 'Criando…' : 'Criar senha e entrar'}
        </Button>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <button type="button" disabled={enviando} onClick={() => void pedir()} className={LINK}>Pedir outro código</button>
          <button type="button" disabled={enviando} onClick={() => { setErro(null); setCampos({}); setEtapa('email'); }} className={LINK}>Usar outro e-mail</button>
        </div>
      </form>
    </MoldeDoAcesso>
  );
}
