import { useState, useEffect, useCallback, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import { Search, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, Download } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  getValue?: (item: T) => string;
  hideOnMobile?: boolean;
  sortable?: boolean;
}

type SortDir = 'asc' | 'desc' | null;

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
  selectable?: boolean;
  onSelectionChange?: (items: T[]) => void;
  exportFilename?: string;
}

function escapeCsvCell(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
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
  selectable,
  onSelectionChange,
  exportFilename,
}: DataTableProps<T>) {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Reset page on filter/sort change
  useEffect(() => { setPage(1); }, [query, sortKey, sortDir]);
  // Clear selection on data/filter change
  useEffect(() => { setSelected(new Set()); }, [query, page]);

  // Notify parent of selection changes — use refs for data/getRowKey/callback
  // so we only re-run when the selection itself changes. This prevents parent
  // re-renders (parents rarely memoize onSelectionChange) from causing an
  // effect loop, while still seeing the latest data at notify-time.
  const onSelectionChangeRef = useRef(onSelectionChange);
  const dataRef = useRef(data);
  const getRowKeyRef = useRef(getRowKey);
  useEffect(() => {
    onSelectionChangeRef.current = onSelectionChange;
    dataRef.current = data;
    getRowKeyRef.current = getRowKey;
  });
  useEffect(() => {
    const cb = onSelectionChangeRef.current;
    if (cb) {
      const items = dataRef.current.filter(item => selected.has(getRowKeyRef.current(item)));
      cb(items);
    }
  }, [selected]);

  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else if (sortDir === 'desc') {
      setSortKey(null);
      setSortDir(null);
    }
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />;
    if (sortDir === 'asc') return <ChevronUp className="h-3.5 w-3.5 text-blue-600" />;
    return <ChevronDown className="h-3.5 w-3.5 text-blue-600" />;
  };

  const filtered = query
    ? data.filter(item =>
        searchKeys.some(key => {
          const val = item[key];
          return String(val ?? '').toLowerCase().includes(query.toLowerCase());
        })
      )
    : data;

  const sorted = sortKey && sortDir
    ? [...filtered].sort((a, b) => {
        const col = columns.find(c => c.key === sortKey);
        const va = col?.getValue ? col.getValue(a) : String((a as Record<string, unknown>)[sortKey] ?? '');
        const vb = col?.getValue ? col.getValue(b) : String((b as Record<string, unknown>)[sortKey] ?? '');
        const cmp = va.localeCompare(vb, undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : filtered;

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const paged = sorted.slice(start, start + pageSize);

  // Bulk selection helpers
  const pageKeys = paged.map(getRowKey);
  const allPageSelected = pageKeys.length > 0 && pageKeys.every(k => selected.has(k));
  const somePageSelected = pageKeys.some(k => selected.has(k)) && !allPageSelected;

  const toggleSelectAll = () => {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) {
        pageKeys.forEach(k => next.delete(k));
      } else {
        pageKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const toggleRow = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // CSV export
  const handleExport = useCallback(() => {
    const exportCols = columns.filter(col => col.getValue || !col.hideOnMobile);
    const header = exportCols.map(c => escapeCsvCell(c.header)).join(',');
    const rows = sorted.map(item =>
      exportCols.map(col => {
        const val = col.getValue
          ? col.getValue(item)
          : String((item as Record<string, unknown>)[col.key] ?? '');
        return escapeCsvCell(val);
      }).join(',')
    );
    const csv = [header, ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFilename ?? 'export'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [sorted, columns, exportFilename]);

  const visibleColumns = selectable
    ? [{ key: '__select__', header: '', render: undefined } as Column<T>, ...columns]
    : columns;

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Search + filters + export */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={query}
            onChange={e => { setQuery(e.target.value); setPage(1); }}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {filterNode && <div>{filterNode}</div>}
          {exportFilename && (
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2 h-9 text-xs">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          )}
        </div>
      </div>

      {/* Selection summary */}
      {selectable && selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-blue-50 rounded-md border border-blue-200 text-xs text-blue-700">
          <span className="font-semibold">{selected.size} row{selected.size !== 1 ? 's' : ''} selected</span>
          <button
            className="underline hover:no-underline"
            onClick={() => setSelected(new Set())}
          >
            Clear
          </button>
        </div>
      )}

      {/* Table with horizontal scroll on mobile */}
      <div className="rounded-md border bg-white overflow-x-auto">
        <Table className="min-w-[500px]">
          <TableHeader>
            <TableRow className="bg-gray-50">
              {selectable && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    ref={(el) => { if (el) (el as HTMLButtonElement & { indeterminate: boolean }).indeterminate = somePageSelected; }}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all on page"
                  />
                </TableHead>
              )}
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={`font-semibold text-gray-700 text-xs sm:text-sm whitespace-nowrap ${col.hideOnMobile ? 'hidden sm:table-cell' : ''} ${col.sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}`}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && getSortIcon(col.key)}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length} className="py-12">
                  <EmptyState title={emptyTitle} description={emptyDescription} />
                </TableCell>
              </TableRow>
            ) : (
              paged.map(item => {
                const rowKey = getRowKey(item);
                const isSelected = selected.has(rowKey);
                return (
                  <TableRow
                    key={rowKey}
                    className={`${onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''} ${isSelected ? 'bg-blue-50/50' : ''}`}
                    onClick={() => onRowClick?.(item)}
                  >
                    {selectable && (
                      <TableCell className="w-10" onClick={e => { e.stopPropagation(); toggleRow(rowKey); }}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleRow(rowKey)}
                          aria-label="Select row"
                        />
                      </TableCell>
                    )}
                    {columns.map(col => (
                      <TableCell
                        key={col.key}
                        className={`text-sm py-3 ${col.hideOnMobile ? 'hidden sm:table-cell' : ''}`}
                      >
                        {col.render ? col.render(item) : String((item as Record<string, unknown>)[col.key] ?? '—')}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {sorted.length > pageSize && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-gray-600">
          <span className="text-xs sm:text-sm">
            Showing {start + 1}–{Math.min(start + pageSize, sorted.length)} of {sorted.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline" size="sm"
              disabled={safePage === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2 text-xs sm:text-sm">Page {safePage} of {totalPages}</span>
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
