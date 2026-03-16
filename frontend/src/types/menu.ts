export interface Category {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  menu_id: number | null;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: number;
  name: string;
  description: string | null;
  price: number;
  image_path: string | null;
  is_available: boolean;
  category_id: number;
  subcategory_id: number | null;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
}

export interface Menu {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
}

export interface Subcategory {
  id: number;
  name: string;
  description: string | null;
  image_path: string | null;
  sort_order: number;
  is_active: boolean;
  category_id: number;
  restaurant_id: number;
  created_at: string;
  updated_at: string;
}
