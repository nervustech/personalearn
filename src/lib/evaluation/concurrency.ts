/**
 * Lightweight p-limit-style concurrency queue for eval batch workers.
 * Caps parallel vision calls so bulk drafting does not melt provider quotas.
 */
export function createConcurrencyLimit(concurrency: number) {
  const max = Math.max(1, Math.floor(concurrency));
  let active = 0;
  const queue: Array<() => void> = [];

  const pump = () => {
    while (active < max && queue.length > 0) {
      const next = queue.shift();
      if (next) next();
    }
  };

  return function limit<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const run = () => {
        active += 1;
        fn()
          .then(resolve, reject)
          .finally(() => {
            active -= 1;
            pump();
          });
      };
      queue.push(run);
      pump();
    });
  };
}

/** Default parallel script drafts per batch (identity pages stay sequential). */
export const EVAL_DRAFT_CONCURRENCY = 3;
