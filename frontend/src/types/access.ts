export interface FeatureFlagSnapshot {
  housekeeping: boolean;
  kds: boolean;
  reports: boolean;
  accountant: boolean;
  cashier: boolean;
}

export interface ModuleAccessSnapshot {
  orders: boolean;
  qr: boolean;
  kds: boolean;
  reports: boolean;
  billing: boolean;
  housekeeping: boolean;
  offers: boolean;
}
