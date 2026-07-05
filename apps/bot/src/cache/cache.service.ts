import { Injectable, Logger } from '@nestjs/common';

/**
 * Write-invalidated in-memory cache.
 *
 * Values are stored indefinitely — there is no TTL. The caller is responsible
 * for calling `del()` or `delByPrefix()` whenever the underlying DB record is
 * mutated (create / update / delete).
 *
 * This is intentionally simple: no Redis, no distributed coordination.
 * Works perfectly for a single-instance free-tier deployment.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private readonly store = new Map<string, unknown>();

  /** Return a cached value, or `undefined` if not present. */
  get<T>(key: string): T | undefined {
    return this.store.get(key) as T | undefined;
  }

  /** Store a value unconditionally. */
  set(key: string, value: unknown): void {
    this.store.set(key, value);
  }

  /** Remove a single key. */
  del(key: string): void {
    if (this.store.has(key)) {
      this.logger.debug(`cache bust: ${key}`);
      this.store.delete(key);
    }
  }

  /**
   * Remove all keys whose name starts with `prefix`.
   * E.g. `delByPrefix('workers')` clears `workers`, `workers:category:maid`, etc.
   */
  delByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key === prefix || key.startsWith(`${prefix}:`)) {
        this.logger.debug(`cache bust (prefix): ${key}`);
        this.store.delete(key);
      }
    }
  }

  /**
   * Bust several prefixes at once — convenient for analytics which depend on
   * multiple models.
   */
  delAll(...prefixes: string[]): void {
    for (const prefix of prefixes) {
      this.delByPrefix(prefix);
    }
  }
}
