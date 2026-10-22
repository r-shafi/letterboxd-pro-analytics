/**
 * AIMD (Additive Increase / Multiplicative Decrease) Adaptive Concurrency Limiter
 * Dynamically adjusts concurrent requests to TMDb API, handles 429 rate limits,
 * jittered exponential backoff, pause/resume/cancel controls.
 */

export interface LimiterStats {
  concurrency: number;
  inFlight: number;
  queueLength: number;
  isPaused: boolean;
  totalCompleted: number;
  totalFailed: number;
}

export class AdaptiveRateLimiter {
  private currentConcurrency = 10;
  private minConcurrency = 2;
  private maxConcurrency = 25;
  private consecutiveSuccesses = 0;
  private successStep = 15; // increment concurrency every 15 consecutive 200s

  private inFlight = 0;
  private queue: Array<{
    task: () => Promise<unknown>;
    resolve: (val: unknown) => void;
    reject: (err: unknown) => void;
  }> = [];

  private isPaused = false;
  private isCancelled = false;
  private globalPauseUntil = 0;

  private totalCompleted = 0;
  private totalFailed = 0;

  constructor(initialConcurrency = 10, maxConcurrency = 25) {
    this.currentConcurrency = initialConcurrency;
    this.maxConcurrency = maxConcurrency;
  }

  public getStats(): LimiterStats {
    return {
      concurrency: this.currentConcurrency,
      inFlight: this.inFlight,
      queueLength: this.queue.length,
      isPaused: this.isPaused,
      totalCompleted: this.totalCompleted,
      totalFailed: this.totalFailed
    };
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    this.processQueue();
  }

  public cancel(): void {
    this.isCancelled = true;
    const remaining = [...this.queue];
    this.queue = [];
    remaining.forEach(({ reject }) => reject(new Error('Operation cancelled by user')));
  }

  public reset(): void {
    this.isCancelled = false;
    this.isPaused = false;
    this.totalCompleted = 0;
    this.totalFailed = 0;
    this.queue = [];
    this.inFlight = 0;
    this.currentConcurrency = 10;
  }

  /**
   * Enqueues an async task through the adaptive limiter.
   */
  public schedule<T>(task: () => Promise<T>): Promise<T> {
    if (this.isCancelled) {
      return Promise.reject(new Error('Operation cancelled by user'));
    }

    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task: task as () => Promise<unknown>,
        resolve: resolve as (val: unknown) => void,
        reject
      });
      this.processQueue();
    });
  }

  private processQueue(): void {
    if (this.isPaused || this.isCancelled) return;
    if (Date.now() < this.globalPauseUntil) {
      setTimeout(() => this.processQueue(), Math.max(50, this.globalPauseUntil - Date.now()));
      return;
    }

    while (this.inFlight < this.currentConcurrency && this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      this.inFlight++;
      this.executeTask(item.task, item.resolve, item.reject);
    }
  }

  private async executeTask(
    task: () => Promise<unknown>,
    resolve: (val: unknown) => void,
    reject: (err: unknown) => void,
    retryCount = 0
  ): Promise<void> {
    try {
      const result = await task();
      this.onSuccess();
      this.totalCompleted++;
      resolve(result);
    } catch (err: unknown) {
      const isRateLimit =
        err instanceof Error &&
        (err.message.includes('429') || err.message.toLowerCase().includes('rate limit'));
      const isServerError =
        err instanceof Error &&
        (err.message.includes('500') || err.message.includes('502') || err.message.includes('503'));

      if ((isRateLimit || isServerError) && retryCount < 4 && !this.isCancelled) {
        this.onBackoff(isRateLimit);
        // Jittered exponential backoff: 500ms * 2^retry + jitter
        const backoffMs = Math.pow(2, retryCount) * 500 + Math.random() * 300;
        this.globalPauseUntil = Math.max(this.globalPauseUntil, Date.now() + backoffMs);

        setTimeout(() => {
          this.executeTask(task, resolve, reject, retryCount + 1);
        }, backoffMs);
        return;
      }

      this.totalFailed++;
      reject(err);
    } finally {
      this.inFlight--;
      this.processQueue();
    }
  }

  private onSuccess(): void {
    this.consecutiveSuccesses++;
    if (this.consecutiveSuccesses >= this.successStep) {
      this.consecutiveSuccesses = 0;
      if (this.currentConcurrency < this.maxConcurrency) {
        this.currentConcurrency++;
      }
    }
  }

  private onBackoff(is429: boolean): void {
    this.consecutiveSuccesses = 0;
    // Multiplicative decrease: cut concurrency in half
    this.currentConcurrency = Math.max(this.minConcurrency, Math.floor(this.currentConcurrency / 2));
    if (is429) {
      // Pause queue for 1.5s minimum on 429
      this.globalPauseUntil = Math.max(this.globalPauseUntil, Date.now() + 1500);
    }
  }
}
