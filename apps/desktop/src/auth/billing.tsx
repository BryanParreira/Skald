import type { ReactNode } from "react";

import type { BillingInfo } from "@notiz/supabase";

type BillingContextValue = BillingInfo & {
  isReady: boolean;
  canStartTrial: { data: boolean; isPending: boolean };
  upgradeToPro: () => void;
};

export type BillingAccess = BillingContextValue;

const BILLING_STUB: BillingContextValue = {
  entitlements: ["notiz_pro"],
  subscriptionStatus: "active",
  isPro: true,
  isLite: false,
  isPaid: true,
  isTrialing: false,
  trialEnd: null,
  trialDaysRemaining: null,
  plan: "pro",
  isReady: true,
  canStartTrial: { data: false, isPending: false },
  upgradeToPro: () => {},
};

export function BillingProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useBillingAccess() {
  return BILLING_STUB;
}
