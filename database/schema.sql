-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Application status pipeline
CREATE TYPE application_status AS ENUM (
  'scraped', 'matched', 'approved', 'applied',
  'interview_scheduled', 'assessment', 'rejected', 'offer'
);

-- Email classification
CREATE TYPE email_classification AS ENUM (
  'interview_invite', 'test_assignment', 'screening_call',
  'rejection', 'follow_up', 'marketing_spam'
);

-- ATS type for company list
CREATE TYPE ats_type AS ENUM (
  'greenhouse', 'lever', 'ashby', 'workday', 'custom', 'email'
);

-- Core applications table
CREATE TABLE applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company VARCHAR(255) NOT NULL,
    role VARCHAR(255) NOT NULL,
    jd_url TEXT UNIQUE NOT NULL,
    jd_text TEXT,
    salary_range VARCHAR(100),
    location VARCHAR(255),
    ats_type ats_type DEFAULT 'greenhouse',
    match_score INT CHECK (match_score BETWEEN 0 AND 100),
    match_justification TEXT,
    missing_skills TEXT[],
    matched_skills TEXT[],
    status application_status DEFAULT 'scraped',
    resume_storage_url TEXT,
    cover_letter_storage_url TEXT,
    is_manual_required BOOLEAN DEFAULT FALSE,
    applied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email/communication logs
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    email_subject TEXT,
    email_snippet TEXT,
    classification email_classification,
    gmail_message_id TEXT UNIQUE,
    telegram_sent BOOLEAN DEFAULT FALSE,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE PROCEDURE update_updated_at();

-- Indexes for performance
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_applications_match_score ON applications(match_score DESC);
CREATE INDEX idx_applications_created_at ON applications(created_at DESC);
CREATE INDEX idx_communication_logs_application_id ON communication_logs(application_id);

-- Companies to scrape
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ats_type ats_type NOT NULL,
    ats_id VARCHAR(255) NOT NULL,
    careers_url TEXT,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(ats_type, ats_id)
);

CREATE INDEX idx_companies_active ON companies(active);

-- Enable Row Level Security
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role full access" ON applications
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON communication_logs
    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON companies
    FOR ALL USING (auth.role() = 'service_role');
