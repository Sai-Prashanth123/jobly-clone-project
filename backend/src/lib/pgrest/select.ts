// Parser for PostgREST select strings.
//
// Grammar (the subset this codebase actually uses - verified by grepping every
// .select() call in src/):
//
//   select := item (',' item)*
//   item   := '*'
//           | alias? column
//           | alias? table ('!' hint)? '(' select ')'
//   alias  := name ':'
//
// Real examples from the services:
//   '*, employees!employee_id(first_name, last_name, display_id)'
//   '*, completed_by_user:portal_users!completed_by(name)'
//   '*, case_notes(*, portal_users!author_id(name), tagged_to_user:portal_users!tagged_to(name))'
//
// A regex cannot do this - embeds nest - so it is a small recursive-descent
// parser over a character cursor.

export type SelectNode =
  | { kind: 'star' }
  | { kind: 'column'; name: string; alias?: string }
  | { kind: 'embed'; table: string; alias?: string; hint?: string; children: SelectNode[] };

const NAME_RE = /[A-Za-z0-9_]/;

class Cursor {
  constructor(readonly src: string, public i = 0) {}

  get done(): boolean {
    return this.i >= this.src.length;
  }

  peek(): string {
    return this.src[this.i];
  }

  skipWs(): void {
    while (!this.done && /\s/.test(this.src[this.i])) this.i++;
  }

  /** Read a bare identifier. */
  readName(): string {
    const start = this.i;
    while (!this.done && NAME_RE.test(this.src[this.i])) this.i++;
    if (this.i === start) {
      throw new Error(
        `pgrest: expected a name at position ${start} in select string: ${this.src}`,
      );
    }
    return this.src.slice(start, this.i);
  }
}

function parseList(c: Cursor, depth: number): SelectNode[] {
  const out: SelectNode[] = [];
  for (;;) {
    c.skipWs();
    if (c.done) break;
    // End of a nested list - let the caller consume the ')'.
    if (c.peek() === ')') break;

    out.push(parseItem(c, depth));

    c.skipWs();
    if (!c.done && c.peek() === ',') {
      c.i++;
      continue;
    }
    break;
  }
  return out;
}

function parseItem(c: Cursor, depth: number): SelectNode {
  if (c.peek() === '*') {
    c.i++;
    return { kind: 'star' };
  }

  let name = c.readName();
  let alias: string | undefined;

  // 'alias:target' - the colon means what we just read was the alias.
  c.skipWs();
  if (!c.done && c.peek() === ':') {
    c.i++;
    c.skipWs();
    alias = name;
    name = c.readName();
  }

  // '!hint' disambiguates which foreign key to follow.
  let hint: string | undefined;
  c.skipWs();
  if (!c.done && c.peek() === '!') {
    c.i++;
    c.skipWs();
    hint = c.readName();
  }

  // A trailing '(' makes this an embedded resource rather than a column.
  c.skipWs();
  if (!c.done && c.peek() === '(') {
    if (depth > 4) {
      // Nothing in this codebase nests beyond two levels; a runaway depth
      // means a malformed string, and recursing on it would blow the stack.
      throw new Error(`pgrest: select embedding nested too deeply: ${c.src}`);
    }
    c.i++;
    const children = parseList(c, depth + 1);
    c.skipWs();
    if (c.done || c.peek() !== ')') {
      throw new Error(`pgrest: unbalanced parentheses in select string: ${c.src}`);
    }
    c.i++;
    return { kind: 'embed', table: name, alias, hint, children };
  }

  return { kind: 'column', name, alias };
}

/**
 * Parse a PostgREST select string. An empty/absent string means '*', matching
 * supabase-js, where .select() with no argument returns every column.
 */
export function parseSelect(select?: string | null): SelectNode[] {
  const src = (select ?? '').trim();
  if (src === '') return [{ kind: 'star' }];

  const c = new Cursor(src);
  const nodes = parseList(c, 0);
  c.skipWs();
  if (!c.done) {
    throw new Error(
      `pgrest: unexpected "${c.peek()}" at position ${c.i} in select string: ${src}`,
    );
  }
  return nodes.length ? nodes : [{ kind: 'star' }];
}

/** True if any node in the tree is an embedded resource. */
export function hasEmbed(nodes: SelectNode[]): boolean {
  return nodes.some(n => n.kind === 'embed');
}
