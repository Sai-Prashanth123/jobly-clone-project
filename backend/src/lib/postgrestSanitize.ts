// PostgREST's .or()/.filter() DSL treats , ( ) as structural characters.
// Strip them from user-supplied search input before interpolating into a
// filter string, so a crafted search value can't alter the intended filter
// logic or probe other columns.
export function sanitizeForPostgrestFilter(input: string): string {
  return input.replace(/[,()]/g, '');
}
