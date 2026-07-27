-- ============================================================
-- ChristNerve — Database Schema
-- Multi-tenant church management + member marketplace
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- CHURCH TENANTS
-- ============================================================

CREATE TABLE church_tenants (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  tagline TEXT,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  address TEXT,
  city VARCHAR(100),
  region VARCHAR(100),
  phone VARCHAR(20),
  email VARCHAR(255),
  denomination VARCHAR(100),
  founded_year INTEGER,
  subscription_plan VARCHAR(50) DEFAULT 'starter',
  subscription_status VARCHAR(50) DEFAULT 'active',
  subscription_amount DECIMAL(10,2) DEFAULT 300.00,
  next_billing_date DATE,
  is_active BOOLEAN DEFAULT true,
  brand_color VARCHAR(20) DEFAULT '#2D1B69',
  short_name VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- CHURCH ADMIN USERS (pastors, admins, finance officers)
-- ============================================================

CREATE TABLE church_users (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(20),
  role VARCHAR(50) DEFAULT 'admin',
  -- roles: super-admin | pastor | admin | finance | secretary
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(church_id, email)
);

-- ============================================================
-- CHURCH MEMBERS
-- ============================================================

CREATE TABLE church_members (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_number VARCHAR(50),
  -- auto-generated: PKA-0001
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  other_names VARCHAR(100),
  email VARCHAR(255),
  phone VARCHAR(20),
  whatsapp VARCHAR(20),
  gender VARCHAR(20),
  date_of_birth DATE,
  marital_status VARCHAR(30),
  occupation VARCHAR(100),
  address TEXT,
  city VARCHAR(100),
  avatar_url TEXT,
  department VARCHAR(100),
  ministry VARCHAR(100),
  cell_group VARCHAR(100),
  membership_status VARCHAR(50) DEFAULT 'active',
  -- active | inactive | visitor | transferred
  membership_date DATE,
  baptism_date DATE,
  is_verified BOOLEAN DEFAULT false,
  marketplace_slug VARCHAR(100) UNIQUE,
  -- public storefront URL slug e.g. "kwame-asante"
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(church_id, email)
);

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE church_departments (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  leader_member_id INTEGER REFERENCES church_members(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ATTENDANCE
-- ============================================================

CREATE TABLE church_attendance (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  service_type VARCHAR(100) NOT NULL,
  -- Sunday Service | Midweek | Prayer Meeting | Youth Service
  service_date DATE NOT NULL,
  total_count INTEGER DEFAULT 0,
  men_count INTEGER DEFAULT 0,
  women_count INTEGER DEFAULT 0,
  children_count INTEGER DEFAULT 0,
  visitors_count INTEGER DEFAULT 0,
  notes TEXT,
  recorded_by INTEGER REFERENCES church_users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE church_member_attendance (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  attendance_id INTEGER REFERENCES church_attendance(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES church_members(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(attendance_id, member_id)
);

-- ============================================================
-- FINANCE: GIVING
-- ============================================================

CREATE TABLE church_giving (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES church_members(id),
  giving_type VARCHAR(100) NOT NULL,
  -- Tithe | Offering | Building Fund | Thanksgiving | Donation | Mission Fund
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'GHS',
  payment_method VARCHAR(50),
  -- Cash | MTN Mobile Money | Vodafone Cash | AirtelTigo Money | Bank Transfer
  mobile_money_ref VARCHAR(100),
  service_date DATE,
  notes TEXT,
  recorded_by INTEGER REFERENCES church_users(id),
  receipt_number VARCHAR(50) UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- FINANCE: EXPENSES
-- ============================================================

CREATE TABLE church_expenses (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) DEFAULT 'GHS',
  payment_method VARCHAR(50),
  expense_date DATE NOT NULL,
  receipt_url TEXT,
  approved_by INTEGER REFERENCES church_users(id),
  recorded_by INTEGER REFERENCES church_users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- EVENTS
-- ============================================================

CREATE TABLE church_events (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  event_type VARCHAR(100),
  -- Service | Conference | Outreach | Meeting | Social | Youth
  start_datetime TIMESTAMP NOT NULL,
  end_datetime TIMESTAMP,
  location TEXT,
  banner_url TEXT,
  is_public BOOLEAN DEFAULT true,
  created_by INTEGER REFERENCES church_users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ANNOUNCEMENTS
-- ============================================================

CREATE TABLE church_announcements (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  audience VARCHAR(50) DEFAULT 'all',
  -- all | members | department
  department_id INTEGER REFERENCES church_departments(id),
  is_pinned BOOLEAN DEFAULT false,
  publish_date DATE DEFAULT CURRENT_DATE,
  created_by INTEGER REFERENCES church_users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- MARKETPLACE: CATEGORIES
-- ============================================================

CREATE TABLE market_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  icon VARCHAR(50),
  display_order INTEGER DEFAULT 0
);

-- ============================================================
-- MARKETPLACE: LISTINGS
-- ============================================================

CREATE TABLE market_listings (
  id SERIAL PRIMARY KEY,
  church_id INTEGER REFERENCES church_tenants(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES church_members(id) ON DELETE CASCADE,
  category_id INTEGER REFERENCES market_categories(id),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price_min DECIMAL(10,2),
  price_max DECIMAL(10,2),
  price_label VARCHAR(100),
  -- "From GHS 45" | "GHS 200/session" | "Negotiable"
  location VARCHAR(100),
  whatsapp VARCHAR(20) NOT NULL,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  views_count INTEGER DEFAULT 0,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE market_listing_images (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES market_listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT false,
  display_order INTEGER DEFAULT 0
);

CREATE TABLE market_reviews (
  id SERIAL PRIMARY KEY,
  listing_id INTEGER REFERENCES market_listings(id) ON DELETE CASCADE,
  reviewer_member_id INTEGER REFERENCES church_members(id),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(listing_id, reviewer_member_id)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_members_church ON church_members(church_id);
CREATE INDEX idx_members_status ON church_members(membership_status);
CREATE INDEX idx_giving_church ON church_giving(church_id);
CREATE INDEX idx_giving_type ON church_giving(giving_type);
CREATE INDEX idx_giving_date ON church_giving(service_date);
CREATE INDEX idx_attendance_church ON church_attendance(church_id);
CREATE INDEX idx_attendance_date ON church_attendance(service_date);
CREATE INDEX idx_listings_church ON market_listings(church_id);
CREATE INDEX idx_listings_category ON market_listings(category_id);
CREATE INDEX idx_listings_member ON market_listings(member_id);
CREATE INDEX idx_listings_active ON market_listings(is_active);

-- ============================================================
-- SEED DATA (baseline)
-- ============================================================

-- Market categories
INSERT INTO market_categories (name, slug, icon, display_order) VALUES
('Fashion', 'fashion', 'Shirt', 1),
('Food & Groceries', 'food', 'ShoppingBasket', 2),
('Electronics', 'electronics', 'Smartphone', 3),
('Beauty & Hair', 'beauty', 'Sparkles', 4),
('Photography', 'photography', 'Camera', 5),
('Health Services', 'health', 'Heart', 6),
('Education & Tutoring', 'education', 'BookOpen', 7),
('Construction & Repairs', 'construction', 'Hammer', 8),
('Real Estate', 'real-estate', 'Home', 9),
('Transportation', 'transport', 'Car', 10),
('Graphic Design', 'design', 'Palette', 11),
('Catering & Events', 'catering', 'UtensilsCrossed', 12),
('Agriculture', 'agriculture', 'Leaf', 13),
('Cleaning Services', 'cleaning', 'Wind', 14),
('Other Services', 'other', 'Briefcase', 15);

-- Demo church tenant
INSERT INTO church_tenants (name, slug, tagline, city, region, denomination, subscription_status)
VALUES (
  'Pentecost Assembly Kumasi',
  'pka',
  'A church that believes in supporting one another',
  'Kumasi',
  'Ashanti',
  'Church of Pentecost',
  'active'
);
