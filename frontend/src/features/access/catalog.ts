import type { FeatureFlagSnapshot, ModuleAccessSnapshot } from "@/types/access";

export type FeatureFlagCatalogItem = {
  key: keyof FeatureFlagSnapshot;
  label: string;
  description: string;
};

export type ModuleCatalogItem = {
  key: keyof ModuleAccessSnapshot;
  label: string;
  description: string;
};

export const FEATURE_FLAG_CATALOG: FeatureFlagCatalogItem[] = [
  {
    key: "housekeeping",
    label: "Housekeeping",
    description: "Allow housekeeping task boards and room-service request workflows.",
  },
  {
    key: "kds",
    label: "KDS",
    description: "Allow kitchen display and steward order-processing workflows.",
  },
  {
    key: "reports",
    label: "Reports",
    description: "Allow report dashboards and sales exports.",
  },
  {
    key: "accountant",
    label: "Accountant",
    description: "Allow accounting-oriented billing review access.",
  },
  {
    key: "cashier",
    label: "Cashier",
    description: "Allow cashier billing and payment-settlement access.",
  },
];

export const MODULE_ACCESS_CATALOG: Record<keyof ModuleAccessSnapshot, ModuleCatalogItem> = {
  orders: {
    key: "orders",
    label: "Orders",
    description: "Guest ordering workflows and order-management tools.",
  },
  qr: {
    key: "qr",
    label: "QR Codes",
    description: "Table and room QR generation and management.",
  },
  kds: {
    key: "kds",
    label: "KDS",
    description: "Kitchen display and steward order-processing boards.",
  },
  reports: {
    key: "reports",
    label: "Reports",
    description: "Operational and sales reporting dashboards.",
  },
  billing: {
    key: "billing",
    label: "Billing",
    description: "Invoice capture, payment handling, and settlement workflows.",
  },
  housekeeping: {
    key: "housekeeping",
    label: "Housekeeping",
    description: "Room-service tasks, requests, and housekeeping boards.",
  },
  offers: {
    key: "offers",
    label: "Offers",
    description: "Promotional offers, discount campaigns, and marketing content.",
  },
};

export function createEmptyFeatureFlags(): FeatureFlagSnapshot {
  return {
    housekeeping: false,
    kds: false,
    reports: false,
    accountant: false,
    cashier: false,
  };
}

export function createEmptyModuleAccess(): ModuleAccessSnapshot {
  return {
    orders: false,
    qr: false,
    kds: false,
    reports: false,
    billing: false,
    housekeeping: false,
    offers: false,
  };
}

export function getFeatureFlagEntries(
  flags: Partial<FeatureFlagSnapshot> | null | undefined,
) {
  const snapshot = { ...createEmptyFeatureFlags(), ...(flags ?? {}) };
  return FEATURE_FLAG_CATALOG.map((item) => ({
    ...item,
    enabled: Boolean(snapshot[item.key]),
  }));
}

export function formatSettingFieldLabel(key: string): string {
  const featureFlag = FEATURE_FLAG_CATALOG.find((item) => item.key === key);
  if (featureFlag) {
    return `${featureFlag.label} Feature`;
  }

  const baseLabels: Record<string, string> = {
    name: "Name",
    email: "Email",
    phone: "Phone",
    address: "Address",
    country: "Country",
    currency: "Currency",
    billing_email: "Billing Email",
    opening_time: "Opening Time",
    closing_time: "Closing Time",
    logo_url: "Logo",
  };
  return baseLabels[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatSettingFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (typeof value === "string") return value || "-";
  if (typeof value === "number") return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
