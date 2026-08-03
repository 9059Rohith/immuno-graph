import {
  createContext,
  useContext,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
/* eslint-disable react-refresh/only-export-components -- authentication components and their colocated context form one lazy feature boundary. */
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { ArrowRight, Dna, LoaderCircle, ShieldCheck, Sparkles } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiJson, apiRequest } from '@/lib/api-client';

const userSchema = z.object({
  user: z.object({ id: z.string().uuid(), email: z.string().email(), displayName: z.string() }),
});
type User = z.infer<typeof userSchema>['user'];
type AuthContextValue = {
  user: User | null;
  loading: boolean;
  refresh(): Promise<void>;
  logout(): Promise<void>;
};
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const refresh = async () => {
    try {
      setUser((await apiRequest('/auth/me', userSchema)).user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      refresh,
      logout: async () => {
        await apiRequest('/auth/logout', z.object({ success: z.boolean() }), apiJson('POST', {}));
        setUser(null);
      },
    }),
    [user, loading],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  // Keeps isolated page/component previews usable without bootstrapping the full app provider.
  if (value === null)
    return {
      user: { id: 'preview', email: 'preview@local', displayName: 'Researcher' },
      loading: false,
      refresh: async () => undefined,
      logout: async () => undefined,
    };
  return value;
}

export function Protected({ children }: { children: ReactNode }) {
  const auth = useAuth();
  if (auth.loading)
    return (
      <div className="grid min-h-screen place-items-center bg-[#071512]">
        <LoaderCircle className="size-8 animate-spin text-emerald-300" />
      </div>
    );
  return auth.user === null ? <Navigate to="/login" replace /> : children;
}

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const auth = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  if (!auth.loading && auth.user !== null) return <Navigate to="/" replace />;
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const body = {
      ...(mode === 'signup' ? { displayName: String(data.get('displayName')) } : {}),
      email: String(data.get('email')),
      password: String(data.get('password')),
    };
    try {
      await apiRequest(`/auth/${mode}`, userSchema, apiJson('POST', body));
      await auth.refresh();
      navigate('/');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Authentication failed.');
    } finally {
      setPending(false);
    }
  };
  return (
    <main className="auth-stage">
      <div className="auth-orb auth-orb-one" />
      <div className="auth-orb auth-orb-two" />
      <section className="auth-story">
        <div className="brand-lockup">
          <span>
            <Dna />
          </span>{' '}
          ImmunoGraph
        </div>
        <div className="space-y-6">
          <p className="eyebrow">
            <Sparkles /> Computational immunology, visualized
          </p>
          <h1>
            From sequence to
            <br />
            <em>structural insight.</em>
          </h1>
          <p>
            Rank epitopes, inspect evidence, generate protein structures, and evaluate docking poses
            in one private research environment.
          </p>
        </div>
        <div className="auth-trust">
          <ShieldCheck />
          <div>
            <strong>Private by design</strong>
            <span>Opaque sessions, traceable engines, reproducible artifacts.</span>
          </div>
        </div>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Private workspace'}</p>
          <h2>{mode === 'login' ? 'Sign in to continue' : 'Create your account'}</h2>
          <p>
            {mode === 'login'
              ? 'Access your research workspace and active studies.'
              : 'Start a secure, single-researcher ImmunoGraph workspace.'}
          </p>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode === 'signup' && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Full name</Label>
                <Input
                  id="displayName"
                  name="displayName"
                  minLength={2}
                  required
                  placeholder="Dr. Ada Lovelace"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@laboratory.org"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={10}
                required
                placeholder="At least 10 characters"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <Button className="h-12 w-full rounded-xl" disabled={pending}>
              {pending ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign in' : 'Create account'} <ArrowRight />
                </>
              )}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm">
            {mode === 'login' ? 'New to ImmunoGraph?' : 'Already have an account?'}{' '}
            <Link
              className="font-semibold text-primary hover:underline"
              to={mode === 'login' ? '/signup' : '/login'}
            >
              {mode === 'login' ? 'Create an account' : 'Sign in'}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
