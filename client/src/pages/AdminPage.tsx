import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiAdmin, User, Invite, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import { ArrowLeft, Copy, Plus, Ban, Trash2, RotateCcw } from 'lucide-react';

export function AdminPage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const [u, i] = await Promise.all([apiAdmin.listUsers(), apiAdmin.listInvites()]);
      setUsers(u.users);
      setInvites(i.invites);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  if (!user || user.role !== 'admin') {
    nav('/app', { replace: true });
    return null;
  }

  const createInvite = async () => {
    try {
      await apiAdmin.createInvite(7);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create invite');
    }
  };

  const copyInvite = (url: string) => navigator.clipboard.writeText(url);

  const revokeInvite = async (token: string) => {
    if (!confirm('Revoke this invite?')) return;
    await apiAdmin.revokeInvite(token);
    reload();
  };

  const toggleUserStatus = async (u: User) => {
    await apiAdmin.updateUser(u.id, { status: u.status === 'active' ? 'disabled' : 'active' });
    reload();
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete user ${u.email}? This removes their account metadata (R2 files unaffected).`)) return;
    await apiAdmin.deleteUser(u.id);
    reload();
  };

  return (
    <div className="min-h-screen bg-secondary/20">
      <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-30">
        <div className="container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => nav('/app')}> <ArrowLeft className="w-4 h-4" /> </Button>
            <h1 className="text-xl font-semibold">Admin Console</h1>
          </div>
          <span className="text-xs text-muted-foreground">Signed in as {user.email}</span>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {error && <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-2 duration-300">{error}</p>}

        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 fill-mode-backwards">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Invitations</CardTitle>
            <Button size="sm" onClick={createInvite}><Plus className="w-4 h-4 mr-1" /> New invite (7d)</Button>
          </CardHeader>
          <CardContent>
            {loading ? <p>Loading…</p> : invites.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invites yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Token</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invites.map((iv) => {
                    const url = `${window.location.origin}/invite/${iv.token}`;
                    return (
                      <TableRow key={iv.id}>
                        <TableCell className="font-mono text-xs">{iv.token.slice(0, 8)}…</TableCell>
                        <TableCell>{iv.status}</TableCell>
                        <TableCell>{formatDate(iv.expiresAt)}</TableCell>
                        <TableCell>{formatDate(iv.createdAt)}</TableCell>
                        <TableCell className="space-x-1">
                          <Button variant="ghost" size="icon" title="Copy link" onClick={() => copyInvite(url)}>
                            <Copy className="w-4 h-4" />
                          </Button>
                          {iv.status === 'pending' && (
                            <Button variant="ghost" size="icon" title="Revoke" onClick={() => revokeInvite(iv.token)}>
                              <Ban className="w-4 h-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150 fill-mode-backwards">
          <CardHeader><CardTitle>Users</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p>Loading…</p> : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Display name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.email}{u.id === user.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</TableCell>
                      <TableCell>{u.displayName}</TableCell>
                      <TableCell>{u.role}</TableCell>
                      <TableCell>{u.status}</TableCell>
                      <TableCell>{formatDate(u.createdAt || '')}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="icon" title={u.status === 'active' ? 'Disable' : 'Enable'} onClick={() => toggleUserStatus(u)}>
                          {u.status === 'active' ? <Ban className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                        </Button>
                        {u.id !== user.id && (
                          <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteUser(u)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
