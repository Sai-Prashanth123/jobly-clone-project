import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  getValue?: (item: T) => string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  pageSize?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (item: T) => void;
  getRowKey: (item: T) => string;
  filterNode?: React.ReactNode;
}

export function DataTable<T>({
  data,
  columns,
  searchPlaceholder = 'Search...',
  searchKeys = [],
  pageSize = 10,
  emptyTitle = 'No records found',
  emptyDescription,
  onRowClick,
  getRowKey,
  filterNode,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const filtered = query
    ? data.filter(item =>
        searchKeys.some(key => {
          const val = item[key];
          return String(val ?? '').toLowerCase().includes(query.toLowerCase());
        })
      )
    : data;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = filtered.slice(start, start + pageSize);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        {filterNode}
      </div>

      <div className="rounded-md border bg-white overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-gray-50">
              {columns.map(col => (
                <TableHead key={col.key} className="font-semibold text-gray-700">
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="py-12">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : (
              paged.map(item => (
                <TableRow
                  key={getRowKey(item)}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''}
                  onClick={() => onRowClick?.(item)}
                >
                  {columns.map(col => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '—')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {filtered.length > pageSize && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {start + 1}–{Math.min(start + pageSize, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">Page {safePage} of {totalPages}</span>
            <Button
              variant="outline" size="sm"
              disabled={safePage === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
