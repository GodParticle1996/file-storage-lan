const TOKEN_KEY = 'vixi_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  details?: any;
  constructor(status: number, message: string, details?: any) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((init.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...init, headers });
  let body: any = null;
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) body = await res.json();
  else body = await res.text();

  if (!res.ok) {
    const message = body?.error || `HTTP ${res.status}`;
    throw new ApiError(res.status, message, body?.details);
  }
  return body as T;
}

export const api = {
  get: <T>(p: string) => request<T>(p),
  post: <T>(p: string, body?: any) => request<T>(p, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(p: string, body?: any) => request<T>(p, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(p: string) => request<T>(p, { method: 'DELETE' }),
};

// --- typed endpoints ---

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled';
  storageBytes: number;
  createdAt: string;
  updatedAt: string;
}

export interface Folder {
  id: string;
  name: string;
  description: string;
  tags: string[];
  ownerId: string;
  parentFolderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FileVersion { n: number; size: number; uploadedAt: string; checksum?: string }
export interface FileDoc {
  id: string;
  name: string;
  ownerId: string;
  folderId: string | null;
  mime: string;
  currentVersion: number;
  versions: FileVersion[];
  createdAt: string;
  updatedAt: string;
}

export interface Invite {
  id: string;
  token: string;
  status: 'pending' | 'used' | 'revoked';
  createdBy: string;
  usedBy?: string | null;
  expiresAt: string;
  createdAt: string;
}

export interface Share {
  id: string;
  token: string;
  type: 'folder' | 'file';
  resourceId: string;
  ownerId: string;
  permission: 'read' | 'write';
  scope: 'link' | 'direct';
  targetUserId?: string | null;
  revokedAt?: string | null;
  acceptedBy: string[];
  expiresAt?: string | null;
  createdAt: string;
}

export const apiAuth = {
  login: (email: string, password: string) => api.post<{ token: string; user: User }>('/api/auth/login', { email, password }),
  signup: (token: string, email: string, password: string, displayName: string) =>
    api.post<{ token: string; user: User }>('/api/auth/signup', { token, email, password, displayName }),
  me: () => api.get<{ user: User }>('/api/auth/me'),
  checkInvite: (token: string) => api.get<{ status: string; expiresAt: string }>(`/api/auth/invite/${token}`),
};

export const apiAdmin = {
  listUsers: () => api.get<{ users: User[] }>('/api/admin/users'),
  createInvite: (expiresDays?: number) => api.post<{ token: string; url: string; expiresAt: string }>('/api/admin/invites', { expiresDays }),
  listInvites: () => api.get<{ invites: Invite[] }>('/api/admin/invites'),
  revokeInvite: (token: string) => api.delete<{ ok: true }>(`/api/admin/invites/${token}`),
  updateUser: (id: string, patch: Partial<Pick<User, 'status' | 'role' | 'displayName'>>) =>
    api.patch<{ user: User }>(`/api/admin/users/${id}`, patch),
  deleteUser: (id: string) => api.delete<{ ok: true }>(`/api/admin/users/${id}`),
};

export const apiFolders = {
  list: (parent?: string | null) => api.get<{ folders: Folder[] }>(`/api/folders?parent=${parent ?? 'null'}`),
  create: (data: { name: string; description?: string; tags?: string[]; parentFolderId?: string }) =>
    api.post<{ folder: Folder }>('/api/folders', data),
  update: (id: string, patch: Partial<Pick<Folder, 'name' | 'description' | 'tags'>>) =>
    api.patch<{ folder: Folder }>(`/api/folders/${id}`, patch),
  delete: (id: string) => api.delete<{ ok: true }>(`/api/folders/${id}`),
};

export const apiFiles = {
  list: (parent?: string | null) => api.get<{ files: FileDoc[] }>(`/api/files?parent=${parent ?? 'null'}`),
  beginUpload: (data: { name: string; folderId?: string; mime: string; size: number }) =>
    api.post<{ uploadUrl: string; key: string; fileId: string; version: number; isNew: boolean }>('/api/files/begin-upload', data),
  commit: (data: { key: string; fileId: string; name: string; folderId?: string; mime: string; size: number; checksum?: string }) =>
    api.post<{ file: FileDoc }>('/api/files/commit', data),
  download: (id: string, version?: number) =>
    api.get<{ url: string; version: number; file: FileDoc }>(`/api/files/${id}/download${version ? `?version=${version}` : ''}`),
  versions: (id: string) => api.get<{ versions: FileVersion[]; current: number }>(`/api/files/${id}/versions`),
  rename: (id: string, name: string) => api.patch<{ file: FileDoc }>(`/api/files/${id}/rename`, { name }),
  delete: (id: string) => api.delete<{ ok: true }>(`/api/files/${id}`),
};

export const apiShares = {
  list: () => api.get<{ shares: Share[] }>('/api/shares'),
  create: (data: { type: 'folder' | 'file'; resourceId: string; permission: 'read' | 'write'; targetEmail?: string; expiresDays?: number }) =>
    api.post<{ token: string; url: string; permission: string; expiresAt: string | null; type: string; scope: string }>('/api/shares', data),
  get: (token: string) => api.get<{ share: Share; resource: Folder | FileDoc | null }>(`/api/shares/${token}`),
  accept: (token: string) => api.post<{ share: Share }>(`/api/shares/${token}/accept`),
  revoke: (token: string) => api.delete<{ ok: true }>(`/api/shares/${token}/revoke`),
};

export function rawUpload(url: string, file: File): Promise<void> {
  return fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  }).then((res) => {
    if (!res.ok) throw new Error(`R2 upload failed: HTTP ${res.status}`);
  });
}
