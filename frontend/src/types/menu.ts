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
  more_details: string | null;
  price: number;
  currency: string;
  image_path: string | null;
  image_path_2: string | null;
  image_path_3: string | null;
  image_path_4: string | null;
  image_path_5: string | null;
  video_path: string | null;
  blog_link: string | null;
  is_available: boolean;
  category_id: number;
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


