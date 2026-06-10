export interface FeatureFlagSnapshot {
  steward: boolean;
  housekeeping: boolean;
  kds: boolean;
  reports: boolean;
  accountant: boolean;
  cashier: boolean;
  tables: boolean;
  rooms: boolean;
}

export interface ModuleAccessSnapshot {
  orders: boolean;
  qr: boolean;
  qr_tables: boolean;
  qr_rooms: boolean;
  kds: boolean;
  steward_ops: boolean;
  reports: boolean;
  billing: boolean;
  housekeeping: boolean;
  offers: boolean;
}
