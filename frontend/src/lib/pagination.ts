export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

export function unwrapPaginated<T>(response: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(response) ? response : response.items;
}
