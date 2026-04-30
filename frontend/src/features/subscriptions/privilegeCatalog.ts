import type {
  SubscriptionAccessModuleResponse,
  SubscriptionAccessPrivilegeResponse,
} from "@/types/subscription";
import { MODULE_ACCESS_CATALOG } from "@/features/access/catalog";

function withDefaultAccessState(
  moduleKey: keyof typeof MODULE_ACCESS_CATALOG,
): SubscriptionAccessModuleResponse {
  const definition = MODULE_ACCESS_CATALOG[moduleKey];
  return {
    key: definition.key,
    label: definition.label,
    description: definition.description,
    package_privileges: [],
    feature_flags: [],
    enabled_by_package: true,
    enabled_by_feature_flags: true,
    is_enabled: true,
  };
}

const PRIVILEGE_CATALOG: Record<
  string,
  Omit<SubscriptionAccessPrivilegeResponse, "modules"> & {
    moduleKeys: Array<keyof typeof MODULE_ACCESS_CATALOG>;
  }
> = {
  QR_MENU: {
    code: "QR_MENU",
    label: "QR Menu",
    description: "Enables table and room QR ordering operations.",
    moduleKeys: ["orders", "qr", "kds", "steward_ops", "reports", "billing"],
  },
  HOUSEKEEPING: {
    code: "HOUSEKEEPING",
    label: "Housekeeping",
    description: "Enables housekeeping workflows and room task management.",
    moduleKeys: ["housekeeping"],
  },
  OFFERS: {
    code: "OFFERS",
    label: "Offers",
    description: "Enables promotional offers and discount campaign tools.",
    moduleKeys: ["offers"],
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
    modules: definition.moduleKeys.map((moduleKey) => withDefaultAccessState(moduleKey)),
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
