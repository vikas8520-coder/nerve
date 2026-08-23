/**
 * Provider Reset Time Utilities
 * Calculates estimated reset times for free tier providers based on typical schedules
 */

export interface ProviderResetInfo {
  provider: string;
  resetTime: Date;
  timeUntilReset: string;
  resetDescription: string;
}

// Provider-specific reset schedules (estimated based on typical free tier behavior)
const PROVIDER_RESET_SCHEDULES: Record<string, {
  resetHourUTC: number;
  description: string;
  resetType: 'daily' | 'weekly' | 'monthly';
}> = {
  deepseek: {
    resetHourUTC: 16, // Beijing midnight = 16:00 UTC
    description: "16:00 UTC (Beijing midnight)",
    resetType: 'daily'
  },
  groq: {
    resetHourUTC: 0, // Midnight UTC
    description: "00:00 UTC (daily)",
    resetType: 'daily'
  },
  cerebras: {
    resetHourUTC: 0, // Midnight UTC
    description: "00:00 UTC (daily)",
    resetType: 'daily'
  },
  opencode: {
    resetHourUTC: 0, // Midnight UTC (estimated)
    description: "00:00 UTC (daily, estimated)",
    resetType: 'daily'
  },
  pollinations: {
    resetHourUTC: 0, // Midnight UTC (estimated)
    description: "00:00 UTC (daily, estimated)",
    resetType: 'daily'
  },
  gemini: {
    resetHourUTC: 0, // Midnight UTC (estimated, varies by tier)
    description: "00:00 UTC (estimated, varies by tier)",
    resetType: 'daily'
  },
  mistral: {
    resetHourUTC: 0, // 1st of month
    description: "1st of month (monthly)",
    resetType: 'monthly'
  },
  openrouter: {
    resetHourUTC: 0, // Mid-month (estimated)
    description: "Mid-month (estimated, varies by plan)",
    resetType: 'monthly'
  },
  nvidia: {
    resetHourUTC: 0, // Varies by model
    description: "Varies by model availability",
    resetType: 'daily' // Placeholder
  }
};

function getTimeUntilReset(resetDate: Date, now: Date): string {
  const diffMs = resetDate.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  
  if (diffHours < 0) {
    return "Should reset now";
  }
  
  if (diffHours < 1) {
    return `${diffMins}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h ${diffMins}m`;
  } else {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ${diffHours % 24}h`;
  }
}

function getNextDailyReset(resetHourUTC: number, now: Date): Date {
  const nextReset = new Date(now);
  nextReset.setUTCHours(resetHourUTC, 0, 0, 0);
  
  if (nextReset <= now) {
    nextReset.setUTCDate(nextReset.getUTCDate() + 1);
  }
  
  return nextReset;
}

function getNextMonthlyReset(now: Date): Date {
  const nextReset = new Date(now);
  nextReset.setUTCDate(1);
  nextReset.setUTCHours(0, 0, 0, 0);
  
  if (nextReset <= now) {
    nextReset.setUTCMonth(nextReset.getUTCMonth() + 1);
  }
  
  return nextReset;
}

function getNextMidMonthReset(now: Date): Date {
  const nextReset = new Date(now);
  const currentDay = now.getUTCDate();
  
  if (currentDay <= 15) {
    nextReset.setUTCDate(15);
    nextReset.setUTCHours(0, 0, 0, 0);
  } else {
    nextReset.setUTCMonth(nextReset.getUTCMonth() + 1);
    nextReset.setUTCDate(15);
    nextReset.setUTCHours(0, 0, 0, 0);
  }
  
  return nextReset;
}

export function getProviderResetInfo(provider: string, currentTime: Date = new Date()): ProviderResetInfo | null {
  const schedule = PROVIDER_RESET_SCHEDULES[provider.toLowerCase()];
  if (!schedule) {
    return null;
  }
  
  const now = currentTime;
  let resetTime: Date;
  
  switch (schedule.resetType) {
    case 'daily':
      if (provider.toLowerCase() === 'deepseek') {
        resetTime = getNextDailyReset(schedule.resetHourUTC, now);
      } else {
        resetTime = getNextDailyReset(schedule.resetHourUTC, now);
      }
      break;
    case 'monthly':
      if (provider.toLowerCase() === 'mistral') {
        resetTime = getNextMonthlyReset(now);
      } else if (provider.toLowerCase() === 'openrouter') {
        resetTime = getNextMidMonthReset(now);
      } else {
        resetTime = getNextMonthlyReset(now);
      }
      break;
    default:
      resetTime = getNextDailyReset(schedule.resetHourUTC, now);
  }
  
  return {
    provider: provider,
    resetTime,
    timeUntilReset: getTimeUntilReset(resetTime, now),
    resetDescription: schedule.description
  };
}

export function getAllProviderResetInfos(): ProviderResetInfo[] {
  return Object.keys(PROVIDER_RESET_SCHEDULES)
    .map(provider => getProviderResetInfo(provider))
    .filter((info): info is ProviderResetInfo => info !== null);
}