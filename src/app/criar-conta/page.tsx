import type { Metadata } from 'next';
import { AuthForm } from '@/components/auth/AuthForm';

export const metadata: Metadata = { title: 'Criar conta' };

export default function CriarContaPage() {
  return <AuthForm mode="criar-conta" />;
}
