#!/bin/bash
# ============================================================
# PLA Database Migration & Seed Script
# Creates required tables and seeds demo data
# ============================================================

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Database connection
PGHOST="${POSTGRES_HOST:-localhost}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
PGDATABASE="${POSTGRES_DB:-pla_db}"

export PGPASSWORD

log_info "Starting database migration..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    log_error "psql not found. Install postgresql-client or use docker exec."
    exit 1
fi

# Wait for PostgreSQL to be ready
log_info "Waiting for PostgreSQL at $PGHOST:$PGPORT..."
for i in $(seq 1 30); do
    if pg_isready -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -q 2>/dev/null; then
        log_info "PostgreSQL is ready!"
        break
    fi
    if [ "$i" -eq 30 ]; then
        log_error "PostgreSQL not ready after 30 seconds"
        exit 1
    fi
    sleep 1
done

# Run migration SQL
log_info "Running migration..."
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" << 'MIGRATION_SQL'

-- ============================================================
-- PLA Database Schema
-- Full schema for Personalised Learning Assistant
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- SCHOOLS
-- ============================================================
CREATE TABLE IF NOT EXISTS schools (
    school_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_name VARCHAR(255) NOT NULL,
    district VARCHAR(100),
    province VARCHAR(100),
    country VARCHAR(100) DEFAULT 'Zimbabwe',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- TEACHERS
-- ============================================================
CREATE TABLE IF NOT EXISTS teachers (
    teacher_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    school_id UUID REFERENCES schools(school_id),
    role VARCHAR(20) DEFAULT 'teacher' CHECK (role IN ('teacher', 'admin', 'super_admin')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- CLASSES
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
    class_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_name VARCHAR(100) NOT NULL,
    class_code VARCHAR(20) UNIQUE NOT NULL,
    grade_level VARCHAR(20) DEFAULT 'Form 1',
    subject VARCHAR(50) DEFAULT 'Mathematics',
    teacher_id UUID REFERENCES teachers(teacher_id),
    school_id UUID REFERENCES schools(school_id),
    academic_year VARCHAR(20),
    max_students INTEGER DEFAULT 40,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- STUDENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS students (
    student_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    grade_level VARCHAR(20) DEFAULT 'Form 1',
    class_id UUID REFERENCES classes(class_id),
    age INTEGER CHECK (age >= 10 AND age <= 25),
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    school_id UUID REFERENCES schools(school_id),
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN ('student', 'teacher', 'admin')),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- MODULES (Curriculum)
-- ============================================================
CREATE TABLE IF NOT EXISTS modules (
    module_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    module_name VARCHAR(200) NOT NULL,
    module_code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    grade_level VARCHAR(20) DEFAULT 'Form 1',
    subject VARCHAR(50) DEFAULT 'Mathematics',
    sequence_order INTEGER NOT NULL,
    estimated_hours DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- SKILLS
-- ============================================================
CREATE TABLE IF NOT EXISTS skills (
    skill_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_name VARCHAR(200) NOT NULL,
    skill_code VARCHAR(20),
    module_id UUID REFERENCES modules(module_id),
    description TEXT,
    sequence_order INTEGER NOT NULL,
    prerequisite_skill_id UUID REFERENCES skills(skill_id),
    difficulty_level VARCHAR(20) DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- QUESTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS questions (
    question_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID REFERENCES skills(skill_id),
    question_text TEXT NOT NULL,
    question_type VARCHAR(30) DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'short_answer', 'numeric', 'diagnostic')),
    difficulty_level VARCHAR(20) DEFAULT 'medium' CHECK (difficulty_level IN ('easy', 'medium', 'hard')),
    difficulty_param DECIMAL(5,3),  -- IRT b parameter
    discrimination_param DECIMAL(5,3) DEFAULT 1.0,  -- IRT a parameter
    options JSONB,  -- For multiple choice
    correct_answer TEXT NOT NULL,
    explanation TEXT,
    hint TEXT,
    image_url TEXT,
    points INTEGER DEFAULT 1,
    time_limit_seconds INTEGER DEFAULT 120,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- MASTERY (BKT + IRT tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS mastery (
    mastery_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(student_id) ON DELETE CASCADE,
    skill_id UUID REFERENCES skills(skill_id),
    mastery_probability DECIMAL(5,4) DEFAULT 0.0 CHECK (mastery_probability >= 0 AND mastery_probability <= 1),
    theta_estimate DECIMAL(6,3) DEFAULT 0.0,  -- IRT ability estimate
    times_correct INTEGER DEFAULT 0,
    times_incorrect INTEGER DEFAULT 0,
    hints_used INTEGER DEFAULT 0,
    streak INTEGER DEFAULT 0,
    last_practiced TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(student_id, skill_id)
);

-- ============================================================
-- SESSIONS (Learning sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
    session_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(student_id),
    class_id UUID REFERENCES classes(class_id),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'abandoned')),
    duration INTEGER,  -- in seconds
    questions_answered INTEGER DEFAULT 0,
    correct_answers INTEGER DEFAULT 0
);

-- ============================================================
-- ATTEMPTS (Question responses)
-- ============================================================
CREATE TABLE IF NOT EXISTS attempts (
    attempt_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID REFERENCES sessions(session_id),
    student_id UUID REFERENCES students(student_id),
    question_id UUID REFERENCES questions(question_id),
    skill_id UUID REFERENCES skills(skill_id),
    student_answer TEXT,
    is_correct BOOLEAN NOT NULL,
    time_taken_seconds INTEGER,
    hints_used INTEGER DEFAULT 0,
    difficulty_at_time DECIMAL(5,3),
    theta_at_time DECIMAL(6,3),
    mastery_at_time DECIMAL(5,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- REFRESH TOKENS
-- ============================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(64) UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- MATERIALS (Learning resources)
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
    material_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    skill_id UUID REFERENCES skills(skill_id),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    material_type VARCHAR(30) CHECK (material_type IN ('video', 'article', 'interactive', 'worksheet', 'game')),
    url TEXT,
    difficulty_level VARCHAR(20) DEFAULT 'medium',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    action VARCHAR(50) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_students_username ON students(username);
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_mastery_student ON mastery(student_id);
CREATE INDEX IF NOT EXISTS idx_mastery_skill ON mastery(skill_id);
CREATE INDEX IF NOT EXISTS idx_mastery_student_skill ON mastery(student_id, skill_id);
CREATE INDEX IF NOT EXISTS idx_questions_skill ON questions(skill_id);
CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);

MIGRATION_SQL

log_info "Schema migration complete!"

# ============================================================
# SEED DEMO DATA
# ============================================================

log_info "Seeding demo data..."

psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" << 'SEED_SQL'

-- Insert demo school
INSERT INTO schools (school_id, school_name, district, province)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Demo High School', 'Harare', 'Harare')
ON CONFLICT DO NOTHING;

-- Insert demo teacher (password: Teacher123!)
INSERT INTO teachers (teacher_id, first_name, last_name, email, password_hash, school_id, role)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'Tendai',
    'Moyo',
    'teacher@demo.pla',
    '$2a$12$LJ3MFgKsSWWEsFjxn/87M.p789w7yMB.g5XBLVGfCA4MFy3.5JO6y',  -- bcrypt hash
    'a0000000-0000-0000-0000-000000000001',
    'teacher'
)
ON CONFLICT (email) DO NOTHING;

-- Insert demo class
INSERT INTO classes (class_id, class_name, class_code, grade_level, subject, teacher_id, school_id, academic_year)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'Form 1A Mathematics',
    'FORM1A',
    'Form 1',
    'Mathematics',
    'b0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000001',
    '2026'
)
ON CONFLICT (class_code) DO NOTHING;

-- Insert demo student (password: Student123!)
INSERT INTO students (student_id, first_name, last_name, username, password_hash, grade_level, class_id, age, gender, school_id, role)
VALUES (
    'd0000000-0000-0000-0000-000000000001',
    'Tatenda',
    'Ncube',
    'student1',
    '$2a$12$8K1p/ZKqgfuO6Q7R5VXJ7OBxGZ8vXB87.rBj5VUvP8wAhMKz1gK5S',  -- bcrypt hash
    'Form 1',
    'c0000000-0000-0000-0000-000000000001',
    14,
    'female',
    'a0000000-0000-0000-0000-000000000001',
    'student'
)
ON CONFLICT (username) DO NOTHING;

-- Insert ZIMSEC Form 1 Mathematics modules
INSERT INTO modules (module_id, module_name, module_code, description, grade_level, sequence_order, estimated_hours)
VALUES
    ('e0000000-0000-0000-0000-000000000001', 'Whole Numbers', 'M1', 'Operations with whole numbers, place value, and number properties', 'Form 1', 1, 12),
    ('e0000000-0000-0000-0000-000000000002', 'Fractions and Decimals', 'M2', 'Understanding, comparing, and operating with fractions and decimals', 'Form 1', 2, 14),
    ('e0000000-0000-0000-0000-000000000003', 'Algebraic Expressions', 'M3', 'Introduction to variables, expressions, and simple equations', 'Form 1', 3, 16),
    ('e0000000-0000-0000-0000-000000000004', 'Geometry', 'M4', 'Basic geometric shapes, angles, and measurements', 'Form 1', 4, 14),
    ('e0000000-0000-0000-0000-000000000005', 'Statistics and Probability', 'M5', 'Data collection, representation, and basic probability', 'Form 1', 5, 10),
    ('e0000000-0000-0000-0000-000000000006', 'Ratio, Proportion and Rates', 'M6', 'Understanding ratios, direct proportion, and rates of change', 'Form 1', 6, 12)
ON CONFLICT (module_code) DO NOTHING;

-- Insert skills for Module 1: Whole Numbers
INSERT INTO skills (skill_id, skill_name, skill_code, module_id, description, sequence_order, difficulty_level)
VALUES
    ('f0000000-0000-0000-0000-000000000001', 'Place Value', 'S1-1', 'e0000000-0000-0000-0000-000000000001', 'Understanding place value up to millions', 1, 'easy'),
    ('f0000000-0000-0000-0000-000000000002', 'Addition and Subtraction', 'S1-2', 'e0000000-0000-0000-0000-000000000001', 'Addition and subtraction of whole numbers', 2, 'easy'),
    ('f0000000-0000-0000-0000-000000000003', 'Multiplication', 'S1-3', 'e0000000-0000-0000-0000-000000000001', 'Multiplication of whole numbers', 3, 'medium'),
    ('f0000000-0000-0000-0000-000000000004', 'Division', 'S1-4', 'e0000000-0000-0000-0000-000000000001', 'Division of whole numbers including remainders', 4, 'medium'),
    ('f0000000-0000-0000-0000-000000000005', 'Order of Operations', 'S1-5', 'e0000000-0000-0000-0000-000000000001', 'BODMAS/BIDMAS rules', 5, 'hard')
ON CONFLICT DO NOTHING;

-- Insert skills for Module 2: Fractions
INSERT INTO skills (skill_id, skill_name, skill_code, module_id, description, sequence_order, difficulty_level)
VALUES
    ('f0000000-0000-0000-0000-000000000006', 'Understanding Fractions', 'S2-1', 'e0000000-0000-0000-0000-000000000002', 'Types of fractions and equivalent fractions', 1, 'easy'),
    ('f0000000-0000-0000-0000-000000000007', 'Adding Fractions', 'S2-2', 'e0000000-0000-0000-0000-000000000002', 'Addition and subtraction of fractions', 2, 'medium'),
    ('f0000000-0000-0000-0000-000000000008', 'Multiplying Fractions', 'S2-3', 'e0000000-0000-0000-0000-000000000002', 'Multiplication and division of fractions', 3, 'medium'),
    ('f0000000-0000-0000-0000-000000000009', 'Decimals', 'S2-4', 'e0000000-0000-0000-0000-000000000002', 'Operations with decimals', 4, 'medium')
ON CONFLICT DO NOTHING;

-- Insert skills for Module 3: Algebra
INSERT INTO skills (skill_id, skill_name, skill_code, module_id, description, sequence_order, difficulty_level)
VALUES
    ('f0000000-0000-0000-0000-000000000010', 'Variables and Expressions', 'S3-1', 'e0000000-0000-0000-0000-000000000003', 'Introduction to algebraic variables', 1, 'medium'),
    ('f0000000-0000-0000-0000-000000000011', 'Simplifying Expressions', 'S3-2', 'e0000000-0000-0000-0000-000000000003', 'Collecting like terms and simplifying', 2, 'medium'),
    ('f0000000-0000-0000-0000-000000000012', 'Solving Linear Equations', 'S3-3', 'e0000000-0000-0000-0000-000000000003', 'Solving simple linear equations', 3, 'hard')
ON CONFLICT DO NOTHING;

-- Insert sample questions for Place Value skill
INSERT INTO questions (question_id, skill_id, question_text, question_type, difficulty_level, difficulty_param, discrimination_param, options, correct_answer, explanation, points)
VALUES
    ('q0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001',
     'What is the value of the digit 7 in the number 4,725?',
     'multiple_choice', 'easy', -1.0, 1.2,
     '["7", "70", "700", "7000"]',
     '700',
     'The digit 7 is in the hundreds place, so its value is 7 × 100 = 700.',
     1),
    ('q0000000-0000-0000-0000-000000000002', 'f0000000-0000-0000-0000-000000000001',
     'Write the number 3 million, 45 thousand, and 12 in standard form.',
     'multiple_choice', 'medium', 0.0, 1.0,
     '["3,045,012", "3,450,012", "3,045,120", "30,045,012"]',
     '3,045,012',
     '3 million = 3,000,000; 45 thousand = 45,000; and 12. Total = 3,045,012.',
     1),
    ('q0000000-0000-0000-0000-000000000003', 'f0000000-0000-0000-0000-000000000002',
     'Calculate: 2,345 + 1,678',
     'numeric', 'easy', -1.2, 1.0,
     NULL,
     '4023',
     '2345 + 1678 = 4023. Add column by column from right to left.',
     1),
    ('q0000000-0000-0000-0000-000000000004', 'f0000000-0000-0000-0000-000000000002',
     'Calculate: 5,000 - 2,467',
     'numeric', 'medium', -0.5, 1.0,
     NULL,
     '2533',
     '5000 - 2467 = 2533. You may need to borrow from higher place values.',
     1),
    ('q0000000-0000-0000-0000-000000000005', 'f0000000-0000-0000-0000-000000000003',
     'Calculate: 23 × 45',
     'numeric', 'medium', 0.0, 1.0,
     NULL,
     '1035',
     '23 × 45 = (23 × 40) + (23 × 5) = 920 + 115 = 1035.',
     1),
    ('q0000000-0000-0000-0000-000000000006', 'f0000000-0000-0000-0000-000000000005',
     'Evaluate: 8 + 2 × (6 - 3)²',
     'numeric', 'hard', 1.0, 1.2,
     NULL,
     '26',
     'BODMAS: Brackets first (6-3)=3, then Indices 3²=9, then Multiplication 2×9=18, then Addition 8+18=26.',
     2),
    ('q0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000006',
     'Which fraction is equivalent to 3/4?',
     'multiple_choice', 'easy', -1.5, 1.0,
     '["6/10", "9/12", "4/6", "12/15"]',
     '9/12',
     '3/4 = 9/12 because 3×3=9 and 4×3=12. Multiply both numerator and denominator by the same number.',
     1),
    ('q0000000-0000-0000-0000-000000000008', 'f0000000-0000-0000-0000-000000000010',
     'If x = 5, what is the value of 3x + 7?',
     'numeric', 'medium', -0.3, 1.0,
     NULL,
     '22',
     'Substitute x=5: 3(5) + 7 = 15 + 7 = 22.',
     1)
ON CONFLICT DO NOTHING;

-- Create some initial mastery entries for demo student
INSERT INTO mastery (student_id, skill_id, mastery_probability, theta_estimate, times_correct, times_incorrect, streak, last_practiced)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 0.85, 1.2, 8, 2, 4, NOW() - INTERVAL '1 day'),
    ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000002', 0.72, 0.8, 5, 3, 2, NOW() - INTERVAL '2 hours'),
    ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000003', 0.45, -0.2, 3, 4, 0, NOW() - INTERVAL '3 days'),
    ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000006', 0.65, 0.5, 4, 3, 1, NOW() - INTERVAL '12 hours')
ON CONFLICT (student_id, skill_id) DO NOTHING;

SEED_SQL

log_info "Demo data seeded successfully!"
log_info ""
log_info "Demo accounts:"
log_info "  Student: username=student1, password=Student123!"
log_info "  Teacher: email=teacher@demo.pla, password=Teacher123!"
