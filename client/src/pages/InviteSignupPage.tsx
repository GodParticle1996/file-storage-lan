import { useEffect, useState, FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiAuth, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

export function InviteSignupPage() {
  const { token = '' } = useParams();
  const { signup } = useAuth();
  const nav = useNavigate();
  const [status, setStatus] = useState<'checking' | 'valid' | 'used' | 'revoked' | 'expired' | 'invalid'>('checking');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiAuth
      .checkInvite(token)
      .then((r) => setStatus(r.status === 'valid' ? 'valid' : (r.status as any)))
      .catch(() => setStatus('invalid'));
  }, [token]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signup(token, email, password, displayName);
      nav('/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Signup failed');
    } finally {
      setBusy(false);
    }
  };

  if (status === 'checking') return <Centered>Note: checking invite…</Centered>;
  if (status !== 'valid')
    return (
      <Centered>
        <Card className="w-full max-w-md shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500">
          <CardHeader>
            <CardTitle>Invite unavailable</CardTitle>
            <CardDescription>This invite link is {status}.</CardDescription>
          </CardHeader>
        </Card>
      </Centered>
    );

  return (
    <Centered>
      <Card className="w-full max-w-md shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500">
        <form onSubmit={submit}>
          <CardHeader>
            <CardTitle>Create your Vixi File Storage account</CardTitle>
            <CardDescription>You were invited to join this Vixi File Storage instance.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" minLength={8} />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Creating account…' : 'Create account'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/60 via-background to-secondary/40 p-4">{children}</div>;
}
