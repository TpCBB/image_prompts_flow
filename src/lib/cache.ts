/**
 * Cache layer implementation with TTL-based expiration and LRU eviction
 * Requirements: 2.1, 2.4
 */

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export interface CacheOptions {
  /** Time to live in milliseconds, default 60000 (60 seconds) */
  ttl?: number;
  /** Maximum number of entries, default 100 */
  maxSize?: number;
}

const DEFAULT_TTL = 60 * 1000; // 60 seconds
const DEFAULT_MAX_SIZE = 100;

/**
 * In-memory cache with TTL-based expiration and LRU eviction strategy
 */
export class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>>;
  private accessOrder: string[];
  private readonly defaultTtl: number;
  private readonly maxSize: number;
  private pending = new Map<string, Promise<unknown>>();
  private generation = 0;

  constructor(options: CacheOptions = {}) {
    this.cache = new Map();
    this.accessOrder = [];
    this.defaultTtl = options.ttl ?? DEFAULT_TTL;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
  }

  /**
   * Get a value from cache
   * Returns null if key doesn't exist or entry has expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.delete(key);
      return null;
    }

    // Update access order for LRU
    this.updateAccessOrder(key);

    return entry.data as T;
  }

  /**
   * Set a value in cache with optional TTL override
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // If key already exists, remove it from access order first
    if (this.cache.has(key)) {
      this.removeFromAccessOrder(key);
    }

    // Evict if at capacity (before adding new entry)
    while (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data: value,
      timestamp: Date.now(),
      ttl: ttl ?? this.defaultTtl,
    };

    this.cache.set(key, entry);
    this.accessOrder.push(key);
  }

  /** Share concurrent misses, including failures, without caching rejected work. */
  async getOrLoad<T>(key: string, load: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;
    const existing = this.pending.get(key);
    if (existing) return existing as Promise<T>;
    if (this.pending.size >= 64) throw new Error('Too many pending cache loads');

    const generation = this.generation;
    const task = Promise.resolve().then(load).then((result) => {
      if (this.generation === generation) this.set(key, result, ttl);
      return result;
    }).finally(() => {
      if (this.pending.get(key) === task) this.pending.delete(key);
    });
    this.pending.set(key, task);
    return task;
  }

  /**
   * Delete a specific key from cache
   */
  delete(key: string): boolean {
    const existed = this.cache.has(key);
    if (existed) {
      this.cache.delete(key);
      this.removeFromAccessOrder(key);
    }
    return existed;
  }

  /**
   * Clear all entries from cache
   */
  clear(): void {
    this.generation++;
    this.pending.clear();
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Check if a key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get the current number of entries in cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Check if an entry has expired
   */
  private isExpired(entry: CacheEntry<unknown>): boolean {
    return Date.now() - entry.timestamp > entry.ttl;
  }

  /**
   * Update access order for LRU tracking
   */
  private updateAccessOrder(key: string): void {
    this.removeFromAccessOrder(key);
    this.accessOrder.push(key);
  }

  /**
   * Remove a key from access order array
   */
  private removeFromAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
  }

  /**
   * Evict the least recently used entry
   */
  private evictLRU(): void {
    // First, try to evict expired entries
    const keys = Array.from(this.cache.keys());
    for (const key of keys) {
      const entry = this.cache.get(key);
      if (entry && this.isExpired(entry)) {
        this.delete(key);
        return;
      }
    }

    // If no expired entries, evict the least recently used
    if (this.accessOrder.length > 0) {
      const lruKey = this.accessOrder[0];
      this.delete(lruKey);
    }
  }
}

// Singleton instance for global cache usage
let globalCache: MemoryCache | null = null;

/**
 * Get the global cache instance
 */
export function getCache(options?: CacheOptions): MemoryCache {
  if (!globalCache) {
    globalCache = new MemoryCache(options);
  }
  return globalCache;
}

/**
 * Reset the global cache instance (useful for testing)
 */
export function resetCache(): void {
  globalCache = null;
}
