import { Link, useSearchParams } from 'react-router';
import { useEffect } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { LoginForm, DemoButton } from '@/components/auth/forms';

export default function Login() {
  const [p] = useSearchParams();
  useEffect(() => { document.title = 'Log in · MeetMind'; }, []);
  return (
    <AuthLayout>
      <h1 className="display text-[44px]">Welcome back</h1>
      <p className="mt-3 mb-8 text-[16px] text-ink-2">Log in to your meetings, minutes and tasks.</p>
      <LoginForm />
      <DemoButton />
      <p className="mt-7 text-[14px] text-ink-2">New to MeetMind? <Link to={`/register${p.get('next') ? `?next=${encodeURIComponent(p.get('next'))}` : ''}`} className="link">Create an account</Link></p>
    </AuthLayout>
  );
}
