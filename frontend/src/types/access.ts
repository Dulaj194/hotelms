export interface FeatureFlagSnapshot {
  steward: boolean;
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
  steward_ops: boolean;
  reports: boolean;
  billing: boolean;
  housekeeping: boolean;
  offers: boolean;
}
