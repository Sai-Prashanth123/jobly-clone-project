import { Link } from 'react-router-dom';
import { Megaphone, Pin, AlertCircle, Info, Calendar, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Panel } from '../shared/Panel';
import { useAnnouncements } from '../../hooks/useAnnouncements';
import type { AnnouncementType } from '../../types';

const TYPE_CONFIG: Record<AnnouncementType, {
  label: string;
  icon: React.ReactNode;
  pill: string;
  border: string;
}> = {
  urgent: {
    label: 'Urgent',
    icon: <AlertCircle className="h-3.5 w-3.5" />,
    pill: 'bg-red-50 text-red-700 border-red-200',
    border: 'border-l-red-400',
  },
  info: {
    label: 'Info',
    icon: <Info className="h-3.5 w-3.5" />,
    pill: 'bg-blue-50 text-blue-700 border-blue-200',
    border: 'border-l-blue-400',
  },
  event: {
    label: 'Event',
    icon: <Calendar className="h-3.5 w-3.5" />,
    pill: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    border: 'border-l-emerald-400',
  },
  policy: {
    label: 'Policy',
    icon: <BookOpen className="h-3.5 w-3.5" />,
    pill: 'bg-purple-50 text-purple-700 border-purple-200',
    border: 'border-l-purple-400',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AnnouncementsWidget() {
  const { data, isError, refetch } = useAnnouncements({ limit: 3 });
  const items = data?.data ?? [];

  return (
    <Panel
      eyebrow="Latest"
      title="Announcements"
      icon={<Megaphone className="h-4 w-4 text-[#4069FF]" />}
      action={{ label: 'See all', to: '/portal/announcements' }}
    >
      {isError ? (
        <div className="flex items-center justify-between gap-2 py-2">
          <p className="text-sm text-red-500 flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> Failed to load announcements.</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-400 py-2">No announcements yet.</p>
      ) : (
        <ul className="space-y-3">
          {items.map(ann => {
            const cfg = TYPE_CONFIG[ann.type];
            return (
              <li
                key={ann.id}
                className={`border-l-[3px] pl-3 py-0.5 ${cfg.border}`}
              >
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      {ann.isPinned && (
                        <Pin className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      )}
                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cfg.pill}`}>
                        {cfg.icon}
                        {cfg.label}
                      </span>
                    </div>
                    <Link
                      to="/portal/announcements"
                      className="text-[13px] font-medium text-gray-800 hover:text-[#4069FF] transition-colors line-clamp-1"
                    >
                      {ann.title}
                    </Link>
                    <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-1">{ann.body}</p>
                  </div>
                  <span className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                    {timeAgo(ann.createdAt)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
