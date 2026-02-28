export interface Wallet {
  user_id: string;
  balance: number;
  lifetime_earnings: number;
  pending_payout: number;
  currency: string;
  is_frozen: boolean;
}

export interface Transaction {
  id: string;
  wallet_id: string;
  type: 'earning' | 'payout' | 'refund' | 'adjustment' | 'subscription_payment';
  amount: number;
  currency: string;
  status: string;
  reference_type: string;
  reference_id: string;
  created_at: string;
}

export interface PayoutMethod {
  id: string;
  user_id: string;
  method_type: 'upi' | 'bank_transfer' | 'paypal';
  details: Record<string, string>;
  is_verified: boolean;
  created_at: string;
}

export interface Subscription {
  id: string;
  subscriber_id: string;
  creator_id: string;
  tier_id: string;
  tier_name: string;
  price: number;
  currency: string;
  status: 'active' | 'cancelled' | 'expired' | 'paused';
  current_period_start: string;
  current_period_end: string;
}

export interface CreatorTier {
  id: string;
  creator_id: string;
  name: string;
  price: number;
  currency: string;
  perks: string[];
  subscriber_count: number;
  is_active: boolean;
}

export interface TaxInfo {
  id: string;
  user_id: string;
  country: string;
  tax_data: Record<string, string>;
  verification_status: string;
}

export interface Dashboard {
  wallet: Wallet;
  recent_transactions: Transaction[];
  tiers: CreatorTier[];
}
