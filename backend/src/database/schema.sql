-- KOA CRM & Service Desk - Database Schema
-- Pure PostgreSQL DDL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & IAM
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('ADMIN', 'COMERCIAL', 'SOPORTE', 'EMPLEADO_INTERNO', 'CLIENTE', 'PROVEEDOR')),
    department VARCHAR(100),
    linked_company_id UUID,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. PIPELINES & STAGES
CREATE TABLE IF NOT EXISTS pipelines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_type VARCHAR(50) NOT NULL CHECK (module_type IN ('CRM', 'TICKETS')),
    name VARCHAR(150) NOT NULL,
    description TEXT,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_internal_only BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS pipeline_stages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    position INT NOT NULL DEFAULT 0,
    win_probability INT NOT NULL DEFAULT 0 CHECK (win_probability BETWEEN 0 AND 100),
    status_category VARCHAR(50) NOT NULL DEFAULT 'OPEN' CHECK (status_category IN ('OPEN', 'IN_PROGRESS', 'PAUSED', 'WON_RESOLVED', 'LOST_CLOSED')),
    default_sla_hours INT,
    color_hex VARCHAR(20) DEFAULT '#0F5C4D',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. COMPANIES & CONTACTS
CREATE TABLE IF NOT EXISTS companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    external_erp_id VARCHAR(100) UNIQUE,
    name VARCHAR(200) NOT NULL,
    tax_id VARCHAR(50), -- NIT
    industry VARCHAR(100),
    commercial_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(50),
    email VARCHAR(150),
    address TEXT,
    do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
    do_not_contact_at TIMESTAMP WITH TIME ZONE,
    do_not_contact_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    commercial_owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(150),
    phone VARCHAR(50),
    position_title VARCHAR(100),
    do_not_contact BOOLEAN NOT NULL DEFAULT FALSE,
    do_not_contact_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. TICKETS
CREATE SEQUENCE IF NOT EXISTS ticket_number_seq START WITH 1000;

CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number INT UNIQUE NOT NULL DEFAULT nextval('ticket_number_seq'),
    ticket_scope VARCHAR(50) NOT NULL DEFAULT 'CUSTOMER' CHECK (ticket_scope IN ('CUSTOMER', 'INTERNAL')),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id),
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    requester_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    requester_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    assigned_agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
    external_provider_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source_deal_id UUID,
    queue_name VARCHAR(100) NOT NULL DEFAULT 'General',
    category VARCHAR(100) NOT NULL DEFAULT 'Soporte General',
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    sla_due_at TIMESTAMP WITH TIME ZONE,
    sla_breached BOOLEAN NOT NULL DEFAULT FALSE,
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    handoff_target_type VARCHAR(20),
    handoff_target_id UUID,
    closed_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_activity_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. DEALS (COMERCIAL)
CREATE TABLE IF NOT EXISTS deals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pipeline_id UUID NOT NULL REFERENCES pipelines(id),
    stage_id UUID NOT NULL REFERENCES pipeline_stages(id),
    company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
    primary_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
    owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
    source_ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'COP',
    expected_close_date DATE,
    is_finalized BOOLEAN NOT NULL DEFAULT FALSE,
    finalized_at TIMESTAMP WITH TIME ZONE,
    handoff_target_type VARCHAR(20),
    handoff_target_id UUID,
    outcome_status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE' CHECK (outcome_status IN ('ACTIVE', 'POSTPONED_RECOVERY', 'LOST_DEFINITIVE', 'DO_NOT_CONTACT')),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    recovery_due_at TIMESTAMP WITH TIME ZONE,
    outcome_reason TEXT,
    closed_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_activity_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TASKS (ACTIVIDADES Y SEGUIMIENTO)
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    task_type VARCHAR(50) NOT NULL DEFAULT 'COMMERCIAL_FOLLOWUP' CHECK (task_type IN ('CALL', 'EMAIL', 'MEETING', 'COMMERCIAL_FOLLOWUP', 'COMMERCIAL_RECOVERY', 'INTERNAL_ACTION')),
    status VARCHAR(50) NOT NULL DEFAULT 'NOT_STARTED' CHECK (status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    priority VARCHAR(50) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    queue_name VARCHAR(100) DEFAULT 'General',
    assigned_to_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
    ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    due_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. INTERACTIONS, COMMENTS & STEP HISTORY
CREATE TABLE IF NOT EXISTS interactions_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('DEAL', 'TICKET', 'COMPANY', 'TASK')),
    target_id UUID NOT NULL,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    interaction_type VARCHAR(50) NOT NULL DEFAULT 'COMMENT' CHECK (interaction_type IN ('COMMENT', 'INTERNAL_NOTE', 'CALL_LOG', 'EMAIL_LOG', 'AI_SUMMARY', 'STAGE_HISTORY', 'FLOW_HANDOFF')),
    is_internal BOOLEAN NOT NULL DEFAULT FALSE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. TRANSACTIONAL OUTBOX EVENTS (RABBITMQ & ERP)
CREATE TABLE IF NOT EXISTS outbox_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregate_type VARCHAR(100) NOT NULL,
    aggregate_id UUID NOT NULL,
    routing_key VARCHAR(150) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED', 'FAILED')),
    retry_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE
);

-- 9. SYSTEM SETTINGS (ADMIN ONLY)
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(100) PRIMARY KEY,
    value_json JSONB NOT NULL,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_pipelines_module ON pipelines(module_type);
CREATE INDEX IF NOT EXISTS idx_stages_pipeline ON pipeline_stages(pipeline_id, position);
CREATE INDEX IF NOT EXISTS idx_deals_pipeline_stage ON deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_tickets_pipeline_stage ON tickets(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_due ON tasks(assigned_to_id, due_at);
CREATE INDEX IF NOT EXISTS idx_interactions_target ON interactions_comments(target_type, target_id, created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status, created_at);
