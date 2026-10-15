/**
 * Minimal ambient types for Node's built-in `node:sqlite` module.
 * (Full types land in @types/node ≥ 22; this keeps us independent of that bump.)
 */
declare module 'node:sqlite' {
  export interface StatementResultingChanges {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  }

  export interface StatementSyncIteratorOptions {
    anonymous?: boolean;
  }

  export class StatementSync {
    run(...anonymousParameters: unknown[]): StatementResultingChanges;
    get(...anonymousParameters: unknown[]): unknown;
    all(...anonymousParameters: unknown[]): unknown[];
    iterate(...anonymousParameters: unknown[]): IterableIterator<unknown>;
  }

  export class DatabaseSync {
    constructor(path: string, options?: { open?: boolean });
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
    open(): void;
  }
}
