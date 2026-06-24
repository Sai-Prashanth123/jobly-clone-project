import { useState } from 'react';
import { Clock, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useEntityAuditTrail } from '../../hooks/useAdmin';
import { useAuth } from '../../hooks/useAuth';

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  deleted: 'bg-red-100 text-red-800',
  status_changed: 'bg-amber-100 text-amber-800',
  submitted: 'bg-purple-100 text-purple-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-800',
  hr: 'bg-blue-100 text-blue-800',
  operations: 'bg-orange-100 text-orange-800',
  finance: 'bg-green-100 text-green-800',
  employee: 'bg-gray-100 text-gray-800',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function formatAction(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

interface Props {
  entityType: string;
  entityId: string | undefined;
}

export function EntityAuditTrail({ entityType, entityId }: Props) {
  const { user } = useAuth();
  const [showAll, setShowAll] = useState(false);

  if (!user || (user.role !== 'admin' && user.role !== 'hr')) return null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { data: logs, isLoading } = useEntityAuditTrail(entityType, entityId);

  if (isLoading) return null;
  if (!logs || logs.length === 0) return null;

  const visible = showAll ? logs : logs.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Activity History
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {visible.map(log => (
            <li key={log.id} className="flex items-start gap-3 px-6 py-3">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                  <Badge className={`text-xs px-1.5 py-0 font-medium ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-800'}`}>
                    {formatAction(log.action)}
                  </Badge>
                  {log.entityLabel && (
                    <span className="text-xs text-muted-foreground truncate max-w-[180px]">{log.entityLabel}</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium">{log.actorName ?? 'System'}</span>
                  {log.actorRole && (
                    <Badge className={`text-xs px-1.5 py-0 ${ROLE_COLORS[log.actorRole] ?? 'bg-gray-100 text-gray-800'}`}>
                      {log.actorRole}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">{timeAgo(log.createdAt)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {logs.length > 5 && (
          <div className="px-6 py-3 border-t">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAll(v => !v)}>
              {showAll ? 'Show less' : `Show all ${logs.length} entries`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
