import type {
  RestaurantAdminUpdateRequest,
  RestaurantCreateRequest,
  RestaurantMeResponse,
} from "@/types/restaurant";
import type {
  PackageDetailResponse,
  SubscriptionAccessSummaryResponse,
  SubscriptionResponse,
} from "@/types/subscription";
import type { StaffDetailResponse, UserRole } from "@/types/user";

export type InlineMessage = {
  type: "ok" | "err";
  text: string;
} | null;

export type ConfirmActionState = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmTone?: "primary" | "success" | "warning" | "danger";
  onConfirm: () => Promise<void>;
} | null;

export type SubscriptionFormState = {
  status: string;
  expires_at: string;
  package_id: string;
};

export type AddHotelUserFormState = {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
};

export type SuperAdminRestaurantsState = {
  list: RestaurantMeResponse[];
  subscriptionStatusByHotel: Record<number, string>;
  packages: PackageDetailResponse[];
  hotelUsers: StaffDetailResponse[];
  selected: RestaurantMeResponse | null;
  selectedSub: SubscriptionResponse | null;
  selectedAccess: SubscriptionAccessSummaryResponse | null;
  form: RestaurantCreateRequest;
  editForm: RestaurantAdminUpdateRequest;
  subForm: SubscriptionFormState;
  addUserForm: AddHotelUserFormState;
};
