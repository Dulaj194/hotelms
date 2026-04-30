import type {
  PackageCreateRequest,
  PackageDetailResponse,
  PackageUpdateRequest,
} from "@/types/subscription";

export type PackageFormState = {
  name: string;
  code: string;
  description: string;
  price: string;
  billing_period_days: string;
  is_active: boolean;
  privileges: string[];
};

export const EMPTY_PACKAGE_FORM: PackageFormState = {
  name: "",
  code: "",
  description: "",
  price: "",
  billing_period_days: "30",
  is_active: true,
  privileges: [],
};

export function mapPackageToFormState(pkg: PackageDetailResponse): PackageFormState {
  return {
    name: pkg.name,
    code: pkg.code,
    description: pkg.description ?? "",
    price: pkg.price,
    billing_period_days: String(pkg.billing_period_days),
    is_active: pkg.is_active,
    privileges: [...pkg.privileges],
  };
}

export function buildPackageCreatePayload(form: PackageFormState): PackageCreateRequest {
  return {
    name: form.name.trim(),
    code: form.code.trim().toLowerCase(),
    description: form.description.trim() || null,
    price: Number(form.price),
    billing_period_days: Number(form.billing_period_days),
    is_active: form.is_active,
    privileges: [...form.privileges],
  };
}

export function buildPackageUpdatePayload(form: PackageFormState): PackageUpdateRequest {
  return {
    name: form.name.trim(),
    code: form.code.trim().toLowerCase(),
    description: form.description.trim() || null,
    price: Number(form.price),
    billing_period_days: Number(form.billing_period_days),
    is_active: form.is_active,
    privileges: [...form.privileges],
  };
}
