import { LogOut, User, Settings, Key } from 'lucide-react';

import type { AppSession } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

/** Better Auth client session (read-only UI). */
export type Session = AppSession;

export interface SessionFlyoutProps {
  session: Session | null;
  onSignOut: () => void;
  onOpenAccountSettings: () => void;
  onOpenPreferences: () => void;
  onOpenApiKeys: () => void;
}

function formatRoleLabel(role: string | undefined): string {
  if (!role) return 'User';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function roleBadgeClass(role: string | undefined): string {
  switch (role) {
    case 'super_admin':
      return 'bg-purple-500/15 text-purple-400 border-purple-500/25';
    case 'admin':
      return 'bg-primary/15 text-primary border-primary/25';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

function formatExpiryLine(expiresAt: unknown): string {
  if (expiresAt == null) return 'Session active';
  const t = new Date(expiresAt as string | number | Date).getTime();
  if (Number.isNaN(t)) return 'Session active';
  const diff = t - Date.now();
  if (diff <= 0) return 'Session active';

  const hoursTotal = diff / (1000 * 60 * 60);
  if (hoursTotal >= 48) {
    const days = Math.floor(hoursTotal / 24);
    return `Expires in ${days} day${days === 1 ? '' : 's'}`;
  }
  if (hoursTotal >= 1) {
    const hours = Math.floor(hoursTotal);
    return `Expires in ${hours} hour${hours === 1 ? '' : 's'}`;
  }
  const minutes = Math.max(1, Math.ceil(diff / (1000 * 60)));
  return `Expires in ${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function getSessionExpiresAt(session: Session | null): unknown {
  if (!session) return undefined;
  const s = session as { session?: { expiresAt?: unknown }; expiresAt?: unknown };
  return s.session?.expiresAt ?? s.expiresAt;
}

function flyoutInitial(session: Session | null): string {
  const name = session?.user?.name;
  const email = session?.user?.email;
  const raw =
    typeof name === 'string' && name.trim()
      ? name.trim()[0]
      : typeof email === 'string' && email.trim()
        ? email.trim()[0]
        : 'U';
  return raw.toUpperCase();
}

export function SessionFlyout({ session, onSignOut, onOpenAccountSettings, onOpenPreferences, onOpenApiKeys }: SessionFlyoutProps) {
  const role = (session?.user as { role?: string } | undefined)?.role;
  const expiresAt = getSessionExpiresAt(session);
  const expiryLine = formatExpiryLine(expiresAt);

  return (
    <div className="p-3">
      <div className="flex gap-3">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={session?.user?.image ?? undefined} alt="" />
          <AvatarFallback className="bg-[hsl(var(--sidebar-primary))] text-base font-bold text-white">
            {flyoutInitial(session)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {session?.user?.name ?? '—'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {session?.user?.email ?? ''}
          </p>
          <span
            className={cn(
              'inline-block rounded border px-2 py-0.5 text-[0.65rem] font-semibold',
              roleBadgeClass(role),
            )}
          >
            Role: {formatRoleLabel(role)}
          </span>
        </div>
      </div>

      <Separator className="my-3" />

      <div className="flex flex-col space-y-1 mb-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenAccountSettings}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/50 h-9"
        >
          <User className="h-4 w-4 shrink-0" />
          Account Settings
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={onOpenPreferences}
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/50 h-9"
        >
          <Settings className="h-4 w-4 shrink-0" />
          Preferences
        </Button>
        {(role === 'admin' || role === 'super_admin') && (
          <Button
            type="button"
            variant="ghost"
            onClick={onOpenApiKeys}
            className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground hover:bg-accent/50 h-9"
          >
            <Key className="h-4 w-4 shrink-0" />
            API Keys
          </Button>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-medium text-foreground px-2">Session status</p>
        <p className="text-xs text-muted-foreground px-2">{expiryLine}</p>
      </div>

      <Separator className="my-3" />

      <Button
        type="button"
        variant="ghost"
        className="w-full justify-start gap-3 text-threat hover:bg-threat/10 hover:text-threat h-9"
        onClick={onSignOut}
      >
        <LogOut className="h-4 w-4 shrink-0" />
        Sign Out
      </Button>
    </div>
  );
}
