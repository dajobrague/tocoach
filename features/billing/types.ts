// Billing types and interfaces

export interface PaymentMethod {
  id: string;
  type: "card" | "bank_account";
  last4: string;
  brand?: string;
  isDefault: boolean;
}

export interface Subscription {
  id: string;
  status: "active" | "canceled" | "past_due" | "incomplete";
  plan: string;
  amount: number;
  currency: string;
  currentPeriodEnd: Date;
}

export interface Invoice {
  id: string;
  amount: number;
  currency: string;
  status: "paid" | "pending" | "failed";
  dueDate: Date;
  paidAt?: Date;
}
