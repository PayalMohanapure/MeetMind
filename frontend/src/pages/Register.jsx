import { Link, useSearchParams } from 'react-router';
import { useEffect } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { RegisterForm } from '@/components/auth/forms';

export default function Register() {
  const [p] = useSearchParams();
  useEffect(() => { document.title = 'Create account · MeetMind'; }, []);
  return (
    <AuthLayout>
      <h1 className="display text-[44px]">Create your account</h1>
      <p className="mt-3 mb-8 text-[16px] text-ink-2">Free to start. Your first minutes arrive minutes after you hang up.</p>
      <RegisterForm />
      <p className="mt-7 text-[14px] text-ink-2">Already have an account? <Link to={`/login${p.get('next') ? `?next=${encodeURIComponent(p.get('next'))}` : ''}`} className="link">Log in</Link></p>
    </AuthLayout>
  );
}
