// test\e2e\helpers\testTag.ts
// Every E2E-created entity must be visibly tagged and only ever
// created/deleted by the test that made it — never touch pre-existing data
// (this suite runs against the real production Supabase project, BACKLOG #1).

/** A unique, greppable name for a disposable test entity. */
export function testTag(label: string): string {
  return `E2E TEST ${label} ${Date.now()}`
}
