import { createFileRoute } from '@tanstack/react-router';
import { CodigoPorEmail } from '@/componentes/acesso/CodigoPorEmail';

export const Route = createFileRoute('/primeiro-acesso')({ component: () => <CodigoPorEmail variante="primeiro-acesso" /> });
