const MAX_RECENT_REPORT_IDS = 512;
const BURST_LIMIT = 20;
const BURST_WINDOW_MS = 60_000;

export type ClientRenderFailureAdmission =
  | { readonly outcome: 'accepted' }
  | { readonly outcome: 'duplicate' }
  | { readonly outcome: 'rate_limited'; readonly retryAfterSeconds: number };

class ClientRenderFailureRateLimit {
  private readonly recentReportIds = new Set<string>();
  private windowStartedAt = Date.now();
  private windowAccepted = 0;

  admit(reportId: string, now = Date.now()): ClientRenderFailureAdmission {
    if (this.recentReportIds.has(reportId)) {
      return { outcome: 'duplicate' };
    }

    const elapsed = now - this.windowStartedAt;
    if (elapsed >= BURST_WINDOW_MS || elapsed < 0) {
      this.windowStartedAt = now;
      this.windowAccepted = 0;
    }
    if (this.windowAccepted >= BURST_LIMIT) {
      return {
        outcome: 'rate_limited',
        retryAfterSeconds: Math.max(1, Math.ceil((BURST_WINDOW_MS - (now - this.windowStartedAt)) / 1000)),
      };
    }

    this.windowAccepted += 1;
    this.recentReportIds.add(reportId);
    if (this.recentReportIds.size > MAX_RECENT_REPORT_IDS) {
      const oldest = this.recentReportIds.values().next().value;
      if (oldest) {
        this.recentReportIds.delete(oldest);
      }
    }
    return { outcome: 'accepted' };
  }

  resetForTesting(): void {
    if (process.env.NODE_ENV !== 'test') {
      throw new Error('Client render failure intake reset is test-only.');
    }
    this.recentReportIds.clear();
    this.windowStartedAt = Date.now();
    this.windowAccepted = 0;
  }
}

export const clientRenderFailureRateLimit = new ClientRenderFailureRateLimit();
