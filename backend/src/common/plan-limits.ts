// Plan limits enforced across the platform.
// Must stay in sync with the pricing advertised on the landing page:
//   STARTER (مجاني): صفحة واحدة، 100 رد شهرياً
//   PRO (احترافي): 5 صفحات، ردود لا محدودة
//   ENTERPRISE (مؤسسات): صفحات لا محدودة، ردود لا محدودة
// -1 means unlimited.

export interface PlanLimits {
  maxConnections: number;
  maxRepliesPerMonth: number;
  // Anti-ban throttle: Facebook flags pages that reply too fast for too long.
  // Applies to every plan — it protects the customer's page, not our infra.
  maxRepliesPerHour: number;
  // Contact-based limit (like ManyChat): total stored subscribers/contacts.
  maxSubscribers: number;
}

export const PLAN_LIMITS: Record<string, PlanLimits> = {
  STARTER: {
    maxConnections: 1,
    maxRepliesPerMonth: 100,
    maxRepliesPerHour: 20,
    maxSubscribers: 1000,
  },
  PRO: {
    maxConnections: 5,
    maxRepliesPerMonth: -1,
    maxRepliesPerHour: 120,
    maxSubscribers: 10000,
  },
  ENTERPRISE: {
    maxConnections: -1,
    maxRepliesPerMonth: -1,
    maxRepliesPerHour: 300,
    maxSubscribers: -1,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  return PLAN_LIMITS[plan] || PLAN_LIMITS.STARTER;
}

export function startOfCurrentMonth(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
