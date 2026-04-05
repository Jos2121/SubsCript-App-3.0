-- =========================================================================
-- 0. CONFIGURACIÓN DE ZONA HORARIA (CRÍTICO PARA PERÚ)
-- =========================================================================
-- Esto asegura que NOW() y los DEFAULT TIMESTAMP usen la hora de Lima.
-- Reemplaza 'isitespro_postgresql' con el nombre real de tu BD en Easypanel si es distinto.
ALTER DATABASE "subscript-bd" SET timezone TO 'America/Lima';
SET TIMEZONE='America/Lima';

-- =========================================================================
-- 1. Organizations (Tabla Raíz B2B)
-- =========================================================================
CREATE TABLE IF NOT EXISTS organizations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 2. SaaS Plans (Planes globales del SuperAdmin)
-- =========================================================================
CREATE TABLE IF NOT EXISTS saas_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    duration_months INTEGER DEFAULT 1,
    duration_type VARCHAR(50) DEFAULT 'monthly',
    price DECIMAL(10,2) NOT NULL,
    subscription_limit INTEGER DEFAULT 50,
    employee_limit INTEGER DEFAULT 10,
    plan_limit INTEGER DEFAULT 10,
    benefits TEXT,
    is_free_plan BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 3. Users (SuperAdmin, Admins y Employees)
-- =========================================================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    phone VARCHAR(50),
    plan_id INTEGER REFERENCES saas_plans(id) ON DELETE SET NULL,
    subscription_start_date TIMESTAMP,
    subscription_end_date TIMESTAMP,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 4. Customers (Clientes de las organizaciones)
-- =========================================================================
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 5. Subscription Plans (Planes creados por los Admins para sus clientes)
-- =========================================================================
CREATE TABLE IF NOT EXISTS subscription_plans (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    duration_months INTEGER DEFAULT 1,
    duration_type VARCHAR(50) DEFAULT 'monthly',
    price DECIMAL(10,2) NOT NULL,
    benefits TEXT,
    notes TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 6. Subscriptions (Suscripciones de clientes a los planes de las organizaciones)
-- =========================================================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id) ON DELETE CASCADE,
    assigned_employee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    notes TEXT,
    discount DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 7. Payments (Pagos, tanto del SaaS como de los Admins)
-- =========================================================================
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'other',
    status VARCHAR(20) DEFAULT 'confirmed',
    transaction_reference VARCHAR(100),
    payment_date TIMESTAMP DEFAULT NOW(),
    payment_type VARCHAR(50),
    is_platform_income BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 8. Payment Methods (Globales del SuperAdmin)
-- =========================================================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    qr_image_url TEXT,
    account_number VARCHAR(100),
    account_holder VARCHAR(255),
    bank_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 9. Organization Payment Methods (Métodos de pago de cada organización)
-- =========================================================================
CREATE TABLE IF NOT EXISTS organization_payment_methods (
    id SERIAL PRIMARY KEY,
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    qr_image_url TEXT,
    account_number VARCHAR(100),
    account_holder VARCHAR(255),
    bank_name VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 10. Platform Settings (Ajustes clave/valor globales)
-- =========================================================================
CREATE TABLE IF NOT EXISTS platform_settings (
    id SERIAL PRIMARY KEY,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- 11. Platform Customization (Personalización de marca)
-- =========================================================================
CREATE TABLE IF NOT EXISTS platform_customization (
    id SERIAL PRIMARY KEY,
    setting_type VARCHAR(50) DEFAULT 'superadmin',
    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
    platform_name VARCHAR(255),
    logo_url TEXT,
    favicon_url TEXT,
    page_title VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =========================================================================
-- REGLA CRÍTICA: ÍNDICES DE OPTIMIZACIÓN Y AISLAMIENTO DE ALTO RENDIMIENTO
-- =========================================================================

-- Índices de aislamiento B2B
CREATE INDEX IF NOT EXISTS idx_users_org ON users(organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_org ON payments(organization_id);

-- Índices compuestos para los Dashboards y Reportes de Ingresos
CREATE INDEX IF NOT EXISTS idx_payments_org_status ON payments(organization_id, status, is_platform_income);
CREATE INDEX IF NOT EXISTS idx_subs_org_status ON subscriptions(organization_id, status);

-- Índice para acelerar el Login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);