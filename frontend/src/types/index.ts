/** ChristNerve domain types — mirror DB / API shapes (snake_case). */

export type MembershipStatus = 'active' | 'inactive' | 'visitor' | 'transferred';
export type ChurchUserRole = 'super-admin' | 'pastor' | 'admin' | 'finance' | 'secretary';
export type GivingType =
  | 'Tithe'
  | 'Offering'
  | 'Building Fund'
  | 'Thanksgiving'
  | 'Donation'
  | 'Mission Fund'
  | string;
export type PaymentMethod =
  | 'Cash'
  | 'MTN Mobile Money'
  | 'Vodafone Cash'
  | 'AirtelTigo Money'
  | 'Bank Transfer'
  | string;
export type ServiceType =
  | 'Sunday Service'
  | 'Midweek'
  | 'Prayer Meeting'
  | 'Youth Service'
  | 'Special'
  | string;

export interface ChurchTenant {
  id: number;
  name: string;
  slug: string;
  tagline?: string | null;
  description?: string | null;
  logo_url?: string | null;
  banner_url?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  phone?: string | null;
  email?: string | null;
  denomination?: string | null;
  founded_year?: number | null;
  subscription_plan?: string | null;
  subscription_status: string;
  subscription_amount?: number | null;
  next_billing_date?: string | null;
  is_active: boolean;
  brand_color?: string | null;
  secondary_color?: string | null;
  short_name?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Optional aggregates from public/stats endpoints */
  member_count?: number;
  listing_count?: number;
}

export interface ChurchUser {
  id: number;
  church_id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  username?: string | null;
  role: ChurchUserRole | string;
  member_role?: string | null;
  credentials_set?: boolean;
  avatar_url?: string | null;
  is_active: boolean;
  last_login?: string | null;
  created_at?: string;
  marketplace_slug?: string | null;
  department?: string | null;
  whatsapp?: string | null;
  ministry?: string | null;
  cell_group?: string | null;
  membership_date?: string | null;
  is_verified?: boolean;
}

export interface ChurchMember {
  id: number;
  church_id: number;
  member_number?: string | null;
  first_name: string;
  last_name: string;
  other_names?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  gender?: string | null;
  date_of_birth?: string | null;
  marital_status?: string | null;
  occupation?: string | null;
  address?: string | null;
  city?: string | null;
  avatar_url?: string | null;
  department?: string | null;
  department_ids?: number[];
  ministry?: string | null;
  cell_group?: string | null;
  membership_status: MembershipStatus | string;
  membership_date?: string | null;
  baptism_date?: string | null;
  is_verified: boolean;
  marketplace_slug?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ChurchDepartment {
  id: number;
  church_id: number;
  name: string;
  description?: string | null;
  leader_member_id?: number | null;
  leader_name?: string | null;
  member_count?: number;
  created_at?: string;
}

export interface ChurchAttendance {
  id: number;
  church_id: number;
  service_type: ServiceType;
  service_date: string;
  total_count: number;
  men_count: number;
  women_count: number;
  children_count: number;
  visitors_count: number;
  notes?: string | null;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at?: string;
}

export interface ChurchMemberAttendance {
  id: number;
  church_id: number;
  attendance_id: number;
  member_id: number;
  checked_in_at: string;
}

export interface AttendanceStats {
  average_sunday?: number;
  highest_attendance?: number;
  highest_date?: string | null;
  this_month?: number;
  last_month?: number;
  trend?: ChurchAttendance[];
}

export interface ChurchGiving {
  id: number;
  church_id: number;
  member_id?: number | null;
  member_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  giving_type: GivingType;
  amount: number;
  currency?: string;
  payment_method?: PaymentMethod | null;
  mobile_money_ref?: string | null;
  service_date?: string | null;
  notes?: string | null;
  recorded_by?: number | null;
  receipt_number?: string | null;
  created_at?: string;
}

export interface GivingSummary {
  total_this_month?: number;
  tithes?: number;
  offerings?: number;
  building_fund?: number;
  other?: number;
  by_type?: Record<string, number>;
}

export interface ChurchExpense {
  id: number;
  church_id: number;
  category: string;
  description: string;
  amount: number;
  currency?: string;
  payment_method?: PaymentMethod | null;
  expense_date: string;
  receipt_url?: string | null;
  approved_by?: number | null;
  recorded_by?: number | null;
  recorded_by_name?: string | null;
  created_at?: string;
}

export interface FinanceReport {
  income_total: number;
  expense_total: number;
  net_balance: number;
  income_by_type: Record<string, number>;
  expenses_by_category: Record<string, number>;
  month?: string;
  year?: number;
}

export interface ChurchEvent {
  id: number;
  church_id: number;
  title: string;
  description?: string | null;
  event_type?: string | null;
  start_datetime: string;
  end_datetime?: string | null;
  location?: string | null;
  banner_url?: string | null;
  is_public: boolean;
  created_by?: number | null;
  created_at?: string;
}

export interface ChurchAnnouncement {
  id: number;
  church_id: number;
  title: string;
  body: string;
  audience: string;
  department_id?: number | null;
  department_name?: string | null;
  is_pinned: boolean;
  publish_date?: string | null;
  created_by?: number | null;
  created_by_name?: string | null;
  created_by_first_name?: string | null;
  created_by_last_name?: string | null;
  created_at?: string;
}

export interface MarketCategory {
  id: number;
  name: string;
  slug: string;
  icon?: string | null;
  display_order?: number;
}

export interface MarketListingImage {
  id?: number;
  listing_id?: number;
  image_url: string;
  is_primary?: boolean;
  display_order?: number;
}

export interface MarketListing {
  id: number;
  church_id: number;
  member_id: number;
  category_id?: number | null;
  title: string;
  description: string;
  price_min?: number | null;
  price_max?: number | null;
  price_label?: string | null;
  location?: string | null;
  whatsapp: string;
  phone?: string | null;
  is_active: boolean;
  is_featured: boolean;
  views_count: number;
  slug: string;
  created_at?: string;
  updated_at?: string;
  /** Joined fields from list/detail endpoints */
  category_name?: string | null;
  category_slug?: string | null;
  category_icon?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  is_verified?: boolean;
  marketplace_slug?: string | null;
  avatar_url?: string | null;
  primary_image?: string | null;
  images?: MarketListingImage[];
  avg_rating?: number | null;
  review_count?: number | null;
  church_name?: string | null;
  church_slug?: string | null;
  church_city?: string | null;
  church_tagline?: string | null;
  church_logo_url?: string | null;
}

export interface MarketReview {
  id: number;
  listing_id: number;
  reviewer_member_id?: number | null;
  reviewer_name?: string | null;
  rating: number;
  comment?: string | null;
  created_at?: string;
}

export interface MemberStorefront {
  member: ChurchMember;
  church: Pick<
    ChurchTenant,
    'id' | 'name' | 'slug' | 'logo_url' | 'tagline' | 'city' | 'denomination' | 'banner_url'
  >;
  listings: MarketListing[];
}

export interface PaginatedResponse<T> {
  data?: T[];
  items?: T[];
  listings?: T[];
  members?: T[];
  total: number;
  page: number;
  limit?: number;
  totalPages?: number;
  hasMore?: boolean;
}

export interface ApiError {
  error: string;
  message?: string;
}

export interface LoginResponse {
  token: string;
  user: ChurchUser;
  tenant: ChurchTenant;
}

export interface AuthMeResponse {
  user: ChurchUser;
  tenant: ChurchTenant;
}
