/**
 * API request counter with optional budget enforcement.
 * Tracks requests per API name, warns at 80%, hard-stops at limit.
 */

export class BudgetExceededError extends Error {
  constructor(total: number, max: number) {
    super(`API budget exceeded: ${total} requests (limit: ${max})`);
    this.name = 'BudgetExceededError';
  }
}

export class ApiTracker {
  private budget = 0;
  private counts = new Map<string, number>();
  private totalCount = 0;
  private warnedAt80 = false;

  setBudget(max: number): void {
    this.budget = max > 0 ? max : 0;
    this.warnedAt80 = false;
  }

  track(api: string): void {
    this.counts.set(api, (this.counts.get(api) ?? 0) + 1);
    this.totalCount++;
    if (this.budget <= 0) return;

    const pct = this.totalCount / this.budget;
    if (pct >= 0.8 && !this.warnedAt80) {
      this.warnedAt80 = true;
      console.warn(
        `\x1b[33m  [gk-api-tracker] budget ${this.totalCount}/${this.budget} requests used (80%)\x1b[0m`
      );
    }
    if (this.totalCount > this.budget) {
      throw new BudgetExceededError(this.totalCount, this.budget);
    }
  }

  get total(): number {
    return this.totalCount;
  }

  get usage(): Map<string, number> {
    return new Map(this.counts);
  }

  printSummary(): void {
    if (this.totalCount === 0) return;
    console.log('\n[gk-api-tracker] API Usage Summary');
    const maxLen = Math.max(...[...this.counts.keys()].map((k) => k.length), 5);
    for (const [api, count] of [...this.counts.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${api.padEnd(maxLen)}  ${count.toLocaleString().padStart(8)}`);
    }
    console.log(`  ${'─'.repeat(maxLen + 10)}`);
    console.log(`  ${'Total'.padEnd(maxLen)}  ${this.totalCount.toLocaleString().padStart(8)}`);
    if (this.budget > 0) {
      console.log(`  ${'Budget'.padEnd(maxLen)}  ${this.budget.toLocaleString().padStart(8)}`);
    }
  }

  reset(): void {
    this.counts.clear();
    this.totalCount = 0;
    this.warnedAt80 = false;
  }
}
