// PostgREST's .or()/.filter() DSL treats , ( ) as structural characters, and
// this shim's parser additionally treats { } as nesting delimiters — see
// splitTopLevel in lib/pgrest/filters.ts, which increments depth on BOTH
// `(` and `{`. Strip all of them from user-supplied search input before
// interpolating into a filter string.
//
// The braces were the bug. Stripping only , ( ) meant a search containing a
// single `{` left the parser's depth permanently above zero, so no comma ever
// split the filter and the whole multi-branch OR collapsed into one nonsense
// term — matching nothing. A user searching for "{test" in Cases, Clients or
// Employees got an empty result set and no error, which reads as "no such
// record" rather than "your search broke". A term that lands mid-token is
// worse: it throws "malformed filter term" and surfaces as a 500.
//
// PostgREST itself treated `{` as an ordinary pattern character, so this is
// shim-specific and would not have happened on Supabase.
export function sanitizeForPostgrestFilter(input: string): string {
  return input.replace(/[,(){}]/g, '');
}
