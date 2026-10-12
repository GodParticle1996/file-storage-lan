import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/hooks/useAuth';
import { LoginPage } from '@/pages/LoginPage';
import { InviteSignupPage } from '@/pages/InviteSignupPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { AdminPage } from '@/pages/AdminPage';
import { Loader2 } from 'lucide-react';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <CenterLoader />;
  if (!user) return <Navigate to="/login" state={{ from: loc }} replace />;
  return children;
}

function CenterLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/:token" element={<InviteSignupPage />} />
          <Route path="/share/:token" element={<ShareLanding />} />
          <Route path="/app" element={<RequireAuth><DashboardPage /></RequireAuth>} />
          <Route path="/admin" element={<RequireAuth><AdminPage /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

function ShareLanding() {
  return <ShareLandingInner />;
}

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiShares, ApiError } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

function ShareLandingInner() {
  const { token = '' } = useParams();
  const nav = useNavigate();
  const [state, setState] = useState<'loading' | 'revoked' | 'expired' | 'ready' | 'error'>('loading');
  const [name, setName] = useState<string>('');

  useEffect(() => {
    if (!token) return;
    apiShares
      .get(token)
      .then(({ share, resource }) => {
        if (share.revokedAt) return setState('revoked');
        if (share.expiresAt && new Date(share.expiresAt) < new Date()) return setState('expired');
        setName((resource as any)?.name || 'Shared item');
        setState('ready');
      })
      .catch(() => setState('error'));
  }, [token]);

  const accept = async () => {
    try {
      await apiShares.accept(token);
      nav('/app', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        // Not signed in yet — go log in, then come back to this share.
        nav('/login', { state: { from: { pathname: `/share/${token}` } } });
        return;
      }
      setState('error');
    }
  };

  if (state === 'loading') return <CenterLoader />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-secondary/60 via-background to-secondary/40 p-4">
      <Card className="w-full max-w-md shadow-lg animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CardHeader>
          <CardTitle>{state === 'ready' ? `Shared with you: ${name}` : 'Share unavailable'}</CardTitle>
          <CardDescription>
            {state === 'ready' && 'You are about to accept this share. Sign in first if prompted.'}
            {state === 'revoked' && 'This share has been revoked by the owner.'}
            {state === 'expired' && 'This share has expired.'}
            {state === 'error' && 'Could not load this share.'}
          </CardDescription>
        </CardHeader>
        {state === 'ready' && (
          <CardFooter>
            <Button onClick={accept}>Accept share</Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

export { App };
