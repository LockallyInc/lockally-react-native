// Cursor-pagination helper. Wrap a generated list call into an async iterator
// so callers can `for await (const item of paginate(...))` instead of threading
// cursors by hand.
//
//   for await (const msg of paginate((cursor) =>
//     api.listMessages({ cursor }).then((r) => ({ items: r.data, nextCursor: r.nextCursor }))
//   )) { console.log(msg.id); }

export interface PageResult<T> {
  items: T[];
  /** Empty/undefined on the last page. The API returns `next_cursor`. */
  nextCursor?: string | null;
}

export async function* paginate<T>(
  fetchPage: (cursor: string) => Promise<PageResult<T>>,
): AsyncGenerator<T, void, unknown> {
  let cursor = "";
  const seen = new Set<string>();
  for (;;) {
    const page = await fetchPage(cursor);
    for (const item of page.items) yield item;

    const next = page.nextCursor ?? "";
    if (!next || next === cursor || seen.has(next)) return; // done, or looping cursor
    seen.add(cursor);
    cursor = next;
  }
}

/** Drain every page into an array. Prefer paginate() for large result sets. */
export async function collect<T>(
  fetchPage: (cursor: string) => Promise<PageResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for await (const item of paginate(fetchPage)) out.push(item);
  return out;
}
