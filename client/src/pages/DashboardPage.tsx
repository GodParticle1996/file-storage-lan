import { useState, useEffect, useCallback, DragEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import {
  api,
  apiFolders,
  apiFiles,
  rawUpload,
  Folder,
  FileDoc,
  apiShares,
  ApiError,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Dialog, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { formatBytes, formatDate } from '@/lib/utils';
import { LogOut, FolderPlus, Upload, Download, Share2, Trash2, History, Pencil, ShieldCheck, FolderOpen, Search, HardDrive, ChevronRight } from 'lucide-react';

export function DashboardPage() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Folder navigation: stack of folders from root down to the current one
  const [path, setPath] = useState<Folder[]>([]);
  const [query, setQuery] = useState('');
  const [storageBytes, setStorageBytes] = useState<number | null>(null);

  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [newFolder, setNewFolder] = useState({ name: '', description: '', tags: '' });

  const [renameTarget, setRenameTarget] = useState<FileDoc | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [versionTarget, setVersionTarget] = useState<FileDoc | null>(null);
  const [shareTarget, setShareTarget] = useState<{ type: 'folder' | 'file'; id: string; name: string } | null>(null);

  const currentFolder = path.length > 0 ? path[path.length - 1] : null;
  const currentId = currentFolder?.id ?? null;

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [f, fl, me] = await Promise.all([
        apiFolders.list(currentId),
        apiFiles.list(currentId),
        api.get<{ user: { storageBytes?: number } }>('/api/auth/me'),
      ]);
      setFolders(f.folders);
      setFiles(fl.files);
      setStorageBytes(me.user?.storageBytes ?? 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [currentId]);

  useEffect(() => { reload(); }, [reload]);

  if (!user) {
    nav('/login', { replace: true, state: { from: { pathname: '/app' } } });
    return null;
  }

  const createFolder = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const tags = newFolder.tags.split(',').map((t) => t.trim()).filter(Boolean);
      await apiFolders.create({ name: newFolder.name, description: newFolder.description, tags, parentFolderId: currentId || undefined });
      setNewFolder({ name: '', description: '', tags: '' });
      setShowFolderDialog(false);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to create folder');
    }
  };

  const handleFiles = async (fileList: FileList) => {
    setError(null);
    for (const file of Array.from(fileList)) {
      try {
        const begun = await apiFiles.beginUpload({ name: file.name, folderId: currentId || undefined, mime: file.type || 'application/octet-stream', size: file.size });
        await rawUpload(begun.uploadUrl, file);
        await apiFiles.commit({
          key: begun.key,
          fileId: begun.fileId,
          name: file.name,
          folderId: currentId || undefined,
          mime: file.type || 'application/octet-stream',
          size: file.size,
        });
      } catch (err) {
        setError(`Upload of ${file.name} failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    reload();
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files);
  };

  const downloadFile = async (file: FileDoc, version?: number) => {
    try {
      const { url } = await apiFiles.download(file.id, version);
      window.location.href = url;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Download failed');
    }
  };

  const deleteFile = async (file: FileDoc) => {
    if (!confirm(`Delete ${file.name}? All versions will be removed.`)) return;
    try {
      await apiFiles.delete(file.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  const deleteFolder = async (f: Folder) => {
    if (!confirm(`Delete folder "${f.name}"? It must be empty.`)) return;
    try {
      await apiFolders.delete(f.id);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Delete failed');
    }
  };

  const q = query.trim().toLowerCase();
  const shownFolders = q ? folders.filter((f) => f.name.toLowerCase().includes(q)) : folders;
  const shownFiles = q ? files.filter((f) => f.name.toLowerCase().includes(q)) : files;

  const submitRename = async (e: FormEvent) => {
    e.preventDefault();
    if (!renameTarget) return;
    try {
      await apiFiles.rename(renameTarget.id, renameValue);
      setRenameTarget(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Rename failed');
    }
  };

  return (
    <div
      className="min-h-screen bg-secondary/20"
      onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
      onDragLeave={() => setDragActive(false)}
      onDrop={onDrop}
    >
      {dragActive && (
        <div className="fixed inset-0 z-40 flex items-center justify-center border-4 border-dashed border-primary/60 bg-primary/5 backdrop-blur-[2px] pointer-events-none animate-in fade-in-0 duration-150">
          <div className="flex items-center gap-3 rounded-lg bg-card px-6 py-4 shadow-2xl animate-in zoom-in-90 slide-in-from-bottom-4 duration-300">
            <Upload className="w-6 h-6 animate-bounce" />
            <span className="text-lg font-medium">Drop files to upload</span>
          </div>
        </div>
      )}
      <header className="border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-30">
        <div className="container flex items-center justify-between py-3">
          <div>
            <h1 className="text-xl font-semibold">Vixi File Storage</h1>
            <p className="text-xs text-muted-foreground">Signed in as {user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground mr-2" title="Storage used">
              <HardDrive className="w-3.5 h-3.5" />
              {storageBytes !== null ? formatBytes(storageBytes) : '…'} used
            </span>
            {user.role === 'admin' && (
              <Button variant="outline" size="sm" onClick={() => nav('/admin')}>
                <ShieldCheck className="w-4 h-4 mr-1" /> Admin
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-1" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-6 space-y-6">
        {error && <p className="text-sm text-destructive animate-in fade-in-0 slide-in-from-top-2 duration-300">{error}</p>}

        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1 text-sm">
            <button
              className={`hover:underline ${path.length === 0 ? 'font-semibold' : 'text-muted-foreground'}`}
              onClick={() => { setPath([]); setQuery(''); }}
            >
              Home
            </button>
            {path.map((f, i) => (
              <span key={f.id} className="flex items-center gap-1">
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                <button
                  className={`hover:underline ${i === path.length - 1 ? 'font-semibold' : 'text-muted-foreground'}`}
                  onClick={() => { setPath(path.slice(0, i + 1)); setQuery(''); }}
                >
                  {f.name}
                </button>
              </span>
            ))}
          </nav>

          {/* Search */}
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search this folder…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 fill-mode-backwards">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Folders</CardTitle>
            <Button size="sm" onClick={() => setShowFolderDialog(true)}>
              <FolderPlus className="w-4 h-4 mr-1" /> New folder
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : shownFolders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {q ? 'No folders match your search.' : 'No folders here. Create one to organize your files.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownFolders.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell className="font-medium">
                        <button
                          className="flex items-center gap-2 hover:underline"
                          onClick={() => { setPath([...path, f]); setQuery(''); }}
                          title="Open folder"
                        >
                          <FolderOpen className="w-4 h-4 text-muted-foreground" />
                          {f.name}
                        </button>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-muted-foreground">{f.description || '—'}</TableCell>
                      <TableCell className="text-muted-foreground">{f.tags.join(', ')}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(f.updatedAt)}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="icon" onClick={() => setShareTarget({ type: 'folder', id: f.id, name: f.name })} title="Share">
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteFolder(f)} title="Delete (must be empty)">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="animate-in fade-in-0 slide-in-from-bottom-4 duration-500 delay-150 fill-mode-backwards">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Files</CardTitle>
            <label className="cursor-pointer">
              <Button size="sm" type="button" onClick={() => document.getElementById('file-input')?.click()}>
                <Upload className="w-4 h-4 mr-1" /> Upload
              </Button>
              <input id="file-input" type="file" multiple className="hidden" onChange={(e) => e.target.files && handleFiles(e.target.files)} />
            </label>
          </CardHeader>
          <CardContent>
            {shownFiles.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {q ? 'No files match your search.' : `No files ${currentFolder ? `in "${currentFolder.name}"` : 'here'}. Drag files anywhere to upload.`}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shownFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell>v{file.currentVersion}</TableCell>
                      <TableCell>{formatBytes(file.versions.find((v) => v.n === file.currentVersion)?.size || 0)}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(file.updatedAt)}</TableCell>
                      <TableCell className="space-x-1">
                        <Button variant="ghost" size="icon" title="Download" onClick={() => downloadFile(file)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Rename" onClick={() => { setRenameTarget(file); setRenameValue(file.name); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Versions" onClick={() => setVersionTarget(file)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Share" onClick={() => setShareTarget({ type: 'file', id: file.id, name: file.name })}>
                          <Share2 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Delete" onClick={() => deleteFile(file)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* New folder */}
      <Dialog open={showFolderDialog} onClose={() => setShowFolderDialog(false)}>
        <DialogTitle>Create folder</DialogTitle>
        <DialogDescription>Add a new folder to your vault.</DialogDescription>
        <form onSubmit={createFolder} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="f-name">Name</Label>
            <Input id="f-name" required value={newFolder.name} onChange={(e) => setNewFolder({ ...newFolder, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-desc">Description</Label>
            <Textarea id="f-desc" value={newFolder.description} onChange={(e) => setNewFolder({ ...newFolder, description: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="f-tags">Tags (comma-separated)</Label>
            <Input id="f-tags" value={newFolder.tags} onChange={(e) => setNewFolder({ ...newFolder, tags: e.target.value })} placeholder="invoices, tax, 2026" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setShowFolderDialog(false)}>Cancel</Button>
            <Button type="submit">Create</Button>
          </div>
        </form>
      </Dialog>

      {/* Rename */}
      <Dialog open={!!renameTarget} onClose={() => setRenameTarget(null)}>
        <DialogTitle>Rename file</DialogTitle>
        <form onSubmit={submitRename} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="rn">New name</Label>
            <Input id="rn" required value={renameValue} onChange={(e) => setRenameValue(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button type="submit">Rename</Button>
          </div>
        </form>
      </Dialog>

      {/* Versions */}
      {versionTarget && <VersionHistoryDialog file={versionTarget} onClose={() => setVersionTarget(null)} onDownload={downloadFile} />}

      {/* Share */}
      {shareTarget && <ShareDialog target={shareTarget} onClose={() => setShareTarget(null)} />}
    </div>
  );
}

function VersionHistoryDialog({ file, onClose, onDownload }: { file: FileDoc; onClose: () => void; onDownload: (f: FileDoc, v?: number) => void }) {
  return (
    <Dialog open onClose={onClose} className="max-w-2xl">
      <DialogTitle>Version history — {file.name}</DialogTitle>
      <DialogDescription>Each upload creates a new version. {file.versions.length} version(s) total.</DialogDescription>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>v</TableHead>
            <TableHead>Size</TableHead>
            <TableHead>Uploaded</TableHead>
            <TableHead>Current</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...file.versions].reverse().map((v) => (
            <TableRow key={v.n}>
              <TableCell>v{v.n}</TableCell>
              <TableCell>{formatBytes(v.size)}</TableCell>
              <TableCell>{formatDate(v.uploadedAt)}</TableCell>
              <TableCell>{v.n === file.currentVersion ? '✓' : ''}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" onClick={() => onDownload(file, v.n)}>Download</Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Dialog>
  );
}

function ShareDialog({ target, onClose }: { target: { type: 'folder' | 'file'; id: string; name: string }; onClose: () => void }) {
  const [permission, setPermission] = useState<'read' | 'write'>('read');
  const [targetEmail, setTargetEmail] = useState('');
  const [expiresDays, setExpiresDays] = useState(7);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const out = await apiShares.create({
        type: target.type,
        resourceId: target.id,
        permission,
        targetEmail: targetEmail || undefined,
        expiresDays,
      });
      setLink(out.url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Share failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose}>
      <DialogTitle>Share — {target.name}</DialogTitle>
      <DialogDescription>Generate a single-use-style link for another user on this instance.</DialogDescription>
      <form onSubmit={share} className="space-y-3">
        <div className="space-y-2">
          <Label>Permission</Label>
          <div className="flex gap-2">
            {(['read', 'write'] as const).map((p) => (
              <Button key={p} type="button" variant={permission === p ? 'default' : 'outline'} onClick={() => setPermission(p)}>
                {p === 'read' ? 'Read-only' : 'Read+Write'}
              </Button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="e">Target user email (optional — blank for any signed-in user)</Label>
          <Input id="e" type="email" value={targetEmail} onChange={(e) => setTargetEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="d">Expires in (days)</Label>
          <Input id="d" type="number" min={1} max={90} value={expiresDays} onChange={(e) => setExpiresDays(Number(e.target.value))} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {link && (
          <div className="space-y-2">
            <Label>Share link</Label>
            <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="secondary" onClick={() => navigator.clipboard.writeText(link)}>Copy</Button>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={busy}>{busy ? 'Generating…' : 'Generate share link'}</Button>
        </div>
      </form>
    </Dialog>
  );
}
