import { config } from '../config.ts';

interface RateLimitInfo {
  count: number;
  resetAt: number;
  activeJobs: number;
}

export class RateLimiter {
  private ipData: Map<string, RateLimitInfo> = new Map();

  checkRateLimit(ip: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    let data = this.ipData.get(ip);

    if (!data || now > data.resetAt) {
      data = { count: 0, resetAt: now + config.RATE_LIMIT_WINDOW_MS, activeJobs: data?.activeJobs || 0 };
    }

    data.count++;
    this.ipData.set(ip, data);

    const allowed = data.count <= config.RATE_LIMIT_MAX_REQUESTS;
    return {
      allowed,
      remaining: Math.max(0, config.RATE_LIMIT_MAX_REQUESTS - data.count),
      resetAt: data.resetAt
    };
  }
  
  incrementActiveJob(ip: string) {
    const data = this.ipData.get(ip) || { count: 0, resetAt: Date.now() + config.RATE_LIMIT_WINDOW_MS, activeJobs: 0 };
    data.activeJobs++;
    this.ipData.set(ip, data);
  }
  
  decrementActiveJob(ip: string) {
    const data = this.ipData.get(ip);
    if (data) {
      data.activeJobs = Math.max(0, data.activeJobs - 1);
    }
  }
  
  getActiveJobs(ip: string): number {
    return this.ipData.get(ip)?.activeJobs || 0;
  }
}
