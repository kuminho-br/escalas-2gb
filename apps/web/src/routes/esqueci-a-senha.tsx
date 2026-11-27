import { createFileRoute } from '@tanstack/react-router';
import { CodigoPorEmail } from '@/componentes/acesso/CodigoPorEmail';

export const Route = createFileRoute('/esqueci-a-senha')({ component: () => <CodigoPorEmail variante="esqueci" /> });
