/**
 * Auto-Migration Script
 * Loads the real ZIMSEC curriculum from pla_db.sql
 * Then adds auth/session tables needed by the backend API
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const runMigration = async () => {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
    : new Pool({
        host: process.env.POSTGRES_HOST,
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        user: process.env.POSTGRES_USER,
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DB
      });

  const client = await pool.connect();

  try {
    console.log('[MIGRATE] Starting database migration...');

    // Check if we need to reload (mismatched schema from previous deploy)
    let needsReload = false;
    const { rows: tableCheck } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'skills'"
    );

    if (tableCheck.length > 0) {
      // Check if the schema matches pla_db.sql (VARCHAR IDs) or old deploy (UUID IDs)
      try {
        const { rows: colCheck } = await client.query(
          "SELECT data_type FROM information_schema.columns WHERE table_name = 'students' AND column_name = 'student_id'"
        );
        if (colCheck.length > 0 && colCheck[0].data_type === 'uuid') {
          console.log('[MIGRATE] Detected UUID schema from previous deploy — will reload with correct schema');
          needsReload = true;
        }
      } catch (e) {
        // Table might not exist yet
      }
    }

    if (tableCheck.length === 0 || needsReload) {
      const sqlPath = path.join(__dirname, '..', '..', 'pla_db.sql');
      if (fs.existsSync(sqlPath)) {
        if (needsReload) {
          // Drop old tables first to avoid conflicts
          console.log('[MIGRATE] Dropping old tables to reload with correct schema...');
          await client.query(`
            DROP TABLE IF EXISTS reading_materials CASCADE;
            DROP TABLE IF EXISTS mastery CASCADE;
            DROP TABLE IF EXISTS questions CASCADE;
            DROP TABLE IF EXISTS skills CASCADE;
            DROP TABLE IF EXISTS modules CASCADE;
            DROP TABLE IF EXISTS subjects CASCADE;
            DROP TABLE IF EXISTS sessions CASCADE;
            DROP TABLE IF EXISTS attempts CASCADE;
            DROP TABLE IF EXISTS refresh_tokens CASCADE;
            DROP TABLE IF EXISTS classes CASCADE;
            DROP TABLE IF EXISTS students CASCADE;
          `);
        }

        const sql = fs.readFileSync(sqlPath, 'utf8');
        console.log('[MIGRATE] Loading pla_db.sql (' + Math.round(sql.length / 1024) + 'KB)...');
        await client.query(sql);
        console.log('[MIGRATE] ZIMSEC curriculum loaded: 10 modules, 44 skills, 176 questions, 88 materials');
      } else {
        console.error('[MIGRATE] pla_db.sql not found');
      }
    } else {
      console.log('[MIGRATE] Curriculum tables already exist with correct schema');
    }

    // Add auth/session tables the backend API needs (supplement to pla_db.sql)
    console.log('[MIGRATE] Adding backend API tables...');

    // Classes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS classes (
        class_id VARCHAR(20) PRIMARY KEY,
        class_name VARCHAR(100) NOT NULL,
        class_code VARCHAR(20) UNIQUE NOT NULL,
        grade_level VARCHAR(20) DEFAULT 'Form 1',
        subject VARCHAR(50) DEFAULT 'Mathematics',
        teacher_id VARCHAR(20),
        academic_year VARCHAR(20),
        max_students INTEGER DEFAULT 40,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
      )
    `);

    // Add columns to students if missing
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id VARCHAR(20)`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`);
    await client.query(`ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP`);

    // Refresh tokens table
    await client.query(`
      CREATE TABLE IF NOT EXISTS refresh_tokens (
        token_id VARCHAR(36) PRIMARY KEY,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Sessions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(36) PRIMARY KEY,
        student_id VARCHAR(20) REFERENCES students(student_id),
        class_id VARCHAR(20),
        started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        status VARCHAR(20) DEFAULT 'active',
        duration INTEGER,
        questions_answered INTEGER DEFAULT 0,
        correct_answers INTEGER DEFAULT 0
      )
    `);

    // Attempts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS attempts (
        attempt_id VARCHAR(36) PRIMARY KEY,
        session_id VARCHAR(36),
        student_id VARCHAR(20) REFERENCES students(student_id),
        question_id VARCHAR(20) REFERENCES questions(question_id),
        skill_id VARCHAR(20) REFERENCES skills(skill_id),
        student_answer TEXT,
        is_correct BOOLEAN NOT NULL,
        time_taken_seconds INTEGER,
        hints_used INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add indexes
    await client.query('CREATE INDEX IF NOT EXISTS idx_sessions_student ON sessions(student_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_attempts_student ON attempts(student_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_attempts_session ON attempts(session_id)');
    await client.query('CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)');

    // Create demo class and assign students
    await client.query(`
      INSERT INTO classes (class_id, class_name, class_code, grade_level, subject, teacher_id, academic_year)
      VALUES ('CLS001', 'Form 1A Mathematics', 'FORM1A', 'Form 1', 'Mathematics', 'TCH001', '2026')
      ON CONFLICT (class_code) DO NOTHING
    `);

    await client.query(`UPDATE students SET class_id = 'CLS001' WHERE class_id IS NULL`);

    // Set password hashes for demo accounts
    await ensurePasswordHashes(client);

    // Summary
    const { rows: counts } = await client.query(`
      SELECT
        (SELECT count(*) FROM students) as students,
        (SELECT count(*) FROM modules) as modules,
        (SELECT count(*) FROM skills) as skills,
        (SELECT count(*) FROM questions) as questions,
        (SELECT count(*) FROM reading_materials) as materials
    `);
    const c = counts[0];
    console.log('[MIGRATE] Migration complete!');
    console.log('[MIGRATE]   Students: ' + c.students + ', Modules: ' + c.modules + ', Skills: ' + c.skills);
    console.log('[MIGRATE]   Questions: ' + c.questions + ', Materials: ' + c.materials);
    console.log('[MIGRATE] Demo accounts:');
    console.log('[MIGRATE]   Student: tinashe.moyo / Test1234');
    console.log('[MIGRATE]   Teacher: blessing.chirwa / Teacher1234');

  } catch (error) {
    console.error('[MIGRATE] Error:', error.message);
    console.error('[MIGRATE] Server will continue without full migration');
  } finally {
    client.release();
    await pool.end();
  }
};

async function ensurePasswordHashes(client) {
  const bcrypt = require('bcryptjs');
  const rounds = parseInt(process.env.BCRYPT_ROUNDS || '10');

  const accounts = [
    { id: 'STU001', pw: 'Test1234' },
    { id: 'STU002', pw: 'Test1234' },
    { id: 'STU003', pw: 'Test1234' },
    { id: 'STU004', pw: 'Test1234' },
    { id: 'STU005', pw: 'Test1234' },
    { id: 'TCH001', pw: 'Teacher1234' },
  ];

  const { rows } = await client.query(
    "SELECT student_id FROM students WHERE password_hash = 'PLACEHOLDER' OR password_hash IS NULL LIMIT 1"
  );

  if (rows.length === 0) {
    console.log('[MIGRATE] Password hashes already set');
    return;
  }

  console.log('[MIGRATE] Setting password hashes...');
  for (const { id, pw } of accounts) {
    const hash = await bcrypt.hash(pw, rounds);
    await client.query('UPDATE students SET password_hash = $1 WHERE student_id = $2', [hash, id]);
  }
  console.log('[MIGRATE] Password hashes set for ' + accounts.length + ' accounts');
}

module.exports = { runMigration };

if (require.main === module) {
  require('dotenv').config();
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
