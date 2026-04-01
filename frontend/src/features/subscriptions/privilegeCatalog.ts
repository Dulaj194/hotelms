import type {
  SubscriptionAccessModuleResponse,
  SubscriptionAccessPrivilegeResponse,
} from "@/types/subscription";

const ACCESS_MODULES: Record<string, SubscriptionAccessModuleResponse> = {
  ORDERS: {
    key: "orders",
    label: "Orders",
    description: "Kitchen, steward, and service order operations.",
  },
  REPORTS: {
    key: "reports",
    label: "Reports",
    description: "Operational and sales reporting dashboards.",
  },
  BILLING: {
    key: "billing",
    label: "Billing",
    description: "Invoice capture and bill settlement workflows.",
  },
  HOUSEKEEPING: {
    key: "housekeeping",
    label: "Housekeeping",
    description: "Room service tasks, requests, and housekeeping boards.",
  },
  OFFERS: {
    key: "offers",
    label: "Offers",
    description: "Promotional offers, discount campaigns, and marketing content.",
  },
};

const PRIVILEGE_CATALOG: Record<
  string,
  Omit<SubscriptionAccessPrivilegeResponse, "modules"> & { moduleKeys: string[] }
> = {
  QR_MENU: {
    code: "QR_MENU",
    label: "QR Menu",
    description: "Enables table and room QR ordering operations.",
    moduleKeys: ["ORDERS", "REPORTS", "BILLING"],
  },
  HOUSEKEEPING: {
    code: "HOUSEKEEPING",
    label: "Housekeeping",
    description: "Enables housekeeping workflows and room task management.",
    moduleKeys: ["HOUSEKEEPING"],
  },
  OFFERS: {
    code: "OFFERS",
    label: "Offers",
    description: "Enables promotional offers and discount campaign tools.",
    moduleKeys: ["OFFERS"],
  },
};

function prettifyCode(value: string): string {
  return value
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function buildPrivilegeSummary(code: string): SubscriptionAccessPrivilegeResponse {
  const normalizedCode = code.trim().toUpperCase();
  const definition = PRIVILEGE_CATALOG[normalizedCode];

  if (!definition) {
    return {
      code: normalizedCode,
      label: prettifyCode(normalizedCode),
      description: "Custom privilege configured for this package.",
      modules: [],
    };
  }

  return {
    code: definition.code,
    label: definition.label,
    description: definition.description,
    modules: definition.moduleKeys.map((moduleKey) => ACCESS_MODULES[moduleKey]),
  };
}

export function buildPrivilegeSummaries(
  codes: string[],
): SubscriptionAccessPrivilegeResponse[] {
  return Array.from(new Set(codes.map((code) => code.trim().toUpperCase()).filter(Boolean))).map(
    (code) => buildPrivilegeSummary(code),
  );
}

export function buildEnabledModules(
  codes: string[],
): SubscriptionAccessModuleResponse[] {
  const modules: SubscriptionAccessModuleResponse[] = [];
  const seenKeys = new Set<string>();

  buildPrivilegeSummaries(codes).forEach((privilege) => {
    privilege.modules.forEach((module) => {
      if (seenKeys.has(module.key)) {
        return;
      }
      seenKeys.add(module.key);
      modules.push(module);
    });
  });

  return modules;
}
