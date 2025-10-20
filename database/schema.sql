
-- Database schema for multi-tenant Roblox Verifier Tool
-- This file contains the complete database structure

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CUSTOMERS TABLE
-- Stores information about each customer organization
-- ============================================
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Additional customer metadata
    contact_email VARCHAR(255),
    max_users INTEGER DEFAULT 5, -- Future: Limit users per customer
    
    -- Indexes
    CONSTRAINT customers_name_check CHECK (name <> '')
);

CREATE INDEX IF NOT EXISTS idx_customers_is_active ON customers(is_active);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);

-- ============================================
-- USERS TABLE
-- Stores user accounts with role-based access
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('SUPER_ADMIN', 'CUSTOMER_ADMIN', 'CUSTOMER_USER')),
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    
    -- User metadata
    email VARCHAR(255),
    full_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    
    -- Constraints
    CONSTRAINT users_username_check CHECK (username <> ''),
    CONSTRAINT users_password_check CHECK (password_hash <> ''),
    CONSTRAINT users_customer_role_check CHECK (
        (role = 'SUPER_ADMIN' AND customer_id IS NULL) OR
        (role IN ('CUSTOMER_ADMIN', 'CUSTOMER_USER') AND customer_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON users(customer_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- ============================================
-- SEARCH HISTORY TABLE
-- Logs all searches performed by users
-- ============================================
CREATE TABLE IF NOT EXISTS search_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    
    -- Search details
    search_type VARCHAR(50) NOT NULL CHECK (search_type IN ('username', 'displayName', 'userId', 'url', 'exact', 'smart')),
    search_mode VARCHAR(50) NOT NULL DEFAULT 'exact' CHECK (search_mode IN ('exact', 'smart', 'displayName')),
    search_query VARCHAR(500) NOT NULL,
    
    -- Roblox user details (if found)
    roblox_username VARCHAR(255),
    roblox_user_id BIGINT,
    roblox_display_name VARCHAR(255),
    has_verified_badge BOOLEAN,
    
    -- Result metadata
    result_data JSONB, -- Store full result data
    result_count INTEGER DEFAULT 0,
    result_status VARCHAR(50) CHECK (result_status IN ('success', 'no_results', 'error')),
    error_message TEXT,
    
    -- Performance metrics
    response_time_ms INTEGER,
    
    -- Timestamp
    searched_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT search_history_user_customer_check CHECK (
        -- Ensure user and customer are related (enforced at application level too)
        user_id IS NOT NULL AND customer_id IS NOT NULL
    )
);

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_customer_id ON search_history(customer_id);
CREATE INDEX IF NOT EXISTS idx_search_history_searched_at ON search_history(searched_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_roblox_user_id ON search_history(roblox_user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_search_type ON search_history(search_type);

-- ============================================
-- AUDIT LOG TABLE (Optional - for future use)
-- Tracks admin actions and system events
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
    
    -- Action details
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50), -- e.g., 'customer', 'user', 'search'
    entity_id INTEGER,
    
    -- Change details
    old_values JSONB,
    new_values JSONB,
    
    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_customer_id ON audit_logs(customer_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON customers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View: Customer stats with user counts and search counts
CREATE OR REPLACE VIEW customer_stats AS
SELECT 
    c.id,
    c.name,
    c.is_active,
    c.created_at,
    COUNT(DISTINCT u.id) as total_users,
    COUNT(DISTINCT CASE WHEN u.is_active THEN u.id END) as active_users,
    COUNT(sh.id) as total_searches,
    MAX(sh.searched_at) as last_search_at,
    MAX(u.last_login) as last_login_at
FROM customers c
LEFT JOIN users u ON c.id = u.customer_id
LEFT JOIN search_history sh ON c.id = sh.customer_id
GROUP BY c.id, c.name, c.is_active, c.created_at;

-- View: User activity summary
CREATE OR REPLACE VIEW user_activity AS
SELECT 
    u.id,
    u.username,
    u.role,
    u.customer_id,
    c.name as customer_name,
    u.is_active,
    u.last_login,
    COUNT(sh.id) as total_searches,
    MAX(sh.searched_at) as last_search_at,
    COUNT(CASE WHEN sh.searched_at > CURRENT_TIMESTAMP - INTERVAL '7 days' THEN 1 END) as searches_last_7_days,
    COUNT(CASE WHEN sh.searched_at > CURRENT_TIMESTAMP - INTERVAL '30 days' THEN 1 END) as searches_last_30_days
FROM users u
LEFT JOIN customers c ON u.customer_id = c.id
LEFT JOIN search_history sh ON u.id = sh.user_id
GROUP BY u.id, u.username, u.role, u.customer_id, c.name, u.is_active, u.last_login;

-- ============================================
-- INITIAL COMMENTS
-- ============================================

COMMENT ON TABLE customers IS 'Stores customer organizations that use the Roblox Verifier Tool';
COMMENT ON TABLE users IS 'Stores user accounts with role-based access control';
COMMENT ON TABLE search_history IS 'Logs all Roblox user searches performed by authenticated users';
COMMENT ON TABLE audit_logs IS 'Tracks admin actions and system events for security and compliance';

COMMENT ON COLUMN users.role IS 'User role: SUPER_ADMIN (platform owner), CUSTOMER_ADMIN (customer admin), CUSTOMER_USER (regular customer user)';
COMMENT ON COLUMN users.customer_id IS 'NULL for SUPER_ADMIN, required for CUSTOMER_ADMIN and CUSTOMER_USER';
COMMENT ON COLUMN search_history.result_data IS 'Full JSON response from Roblox API for detailed analysis';
