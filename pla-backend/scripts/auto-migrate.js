/**
 * Auto-Migration Script
 * Creates schema and seeds ZIMSEC data inline (no file path dependencies)
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

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

    // Drop old tables if they exist (handles UUID schema from previous deploys)
    console.log('[MIGRATE] Cleaning old tables...');
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

    console.log('[MIGRATE] Creating schema...');

    // STUDENTS
    await client.query(`
      CREATE TABLE students (
        student_id VARCHAR(20) PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        grade_level VARCHAR(20),
        age INT,
        gender VARCHAR(20),
        school_id VARCHAR(20),
        role VARCHAR(20) DEFAULT 'student',
        class_id VARCHAR(20),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // SUBJECTS
    await client.query(`
      CREATE TABLE subjects (
        subject_id VARCHAR(20) PRIMARY KEY,
        subject_name VARCHAR(100) NOT NULL,
        curriculum_board VARCHAR(50),
        description TEXT
      )
    `);

    // MODULES
    await client.query(`
      CREATE TABLE modules (
        module_id VARCHAR(20) PRIMARY KEY,
        subject_id VARCHAR(20) REFERENCES subjects(subject_id),
        module_name VARCHAR(100) NOT NULL,
        grade_level VARCHAR(20),
        sequence_order INT
      )
    `);

    // SKILLS
    await client.query(`
      CREATE TABLE skills (
        skill_id VARCHAR(20) PRIMARY KEY,
        module_id VARCHAR(20) REFERENCES modules(module_id),
        skill_name VARCHAR(150) NOT NULL,
        sequence_order INT,
        prerequisite_skill_id VARCHAR(20) REFERENCES skills(skill_id),
        bkt_prior DECIMAL(4,3) DEFAULT 0.300,
        bkt_learn DECIMAL(4,3) DEFAULT 0.200,
        bkt_slip DECIMAL(4,3) DEFAULT 0.100,
        bkt_guess DECIMAL(4,3) DEFAULT 0.200
      )
    `);

    // QUESTIONS
    await client.query(`
      CREATE TABLE questions (
        question_id VARCHAR(20) PRIMARY KEY,
        skill_id VARCHAR(20) REFERENCES skills(skill_id),
        question_title VARCHAR(200),
        question_text TEXT NOT NULL,
        question_type VARCHAR(20) DEFAULT 'practice',
        difficulty_level VARCHAR(20) DEFAULT 'Medium',
        hint_1 TEXT,
        hint_2 TEXT,
        explanation TEXT,
        correct_option VARCHAR(100)
      )
    `);

    // MASTERY
    await client.query(`
      CREATE TABLE mastery (
        student_id VARCHAR(20) REFERENCES students(student_id),
        skill_id VARCHAR(20) REFERENCES skills(skill_id),
        mastery_probability DECIMAL(5,3) DEFAULT 0.250,
        mastery_status VARCHAR(30) DEFAULT 'needs_support',
        last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (student_id, skill_id)
      )
    `);

    // READING MATERIALS
    await client.query(`
      CREATE TABLE reading_materials (
        material_id VARCHAR(20) PRIMARY KEY,
        skill_id VARCHAR(20) REFERENCES skills(skill_id),
        title VARCHAR(200) NOT NULL,
        content_type VARCHAR(30) DEFAULT 'note',
        content TEXT,
        external_url TEXT,
        difficulty_level VARCHAR(20) DEFAULT 'Medium',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // CLASSES
    await client.query(`
      CREATE TABLE classes (
        class_id VARCHAR(20) PRIMARY KEY,
        class_name VARCHAR(100) NOT NULL,
        class_code VARCHAR(20) UNIQUE NOT NULL,
        grade_level VARCHAR(20) DEFAULT 'Form 1',
        subject VARCHAR(50) DEFAULT 'Mathematics',
        teacher_id VARCHAR(20),
        academic_year VARCHAR(20),
        max_students INTEGER DEFAULT 40,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // SESSIONS
    await client.query(`
      CREATE TABLE sessions (
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

    // ATTEMPTS
    await client.query(`
      CREATE TABLE attempts (
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

    // REFRESH TOKENS
    await client.query(`
      CREATE TABLE refresh_tokens (
        token_id VARCHAR(36) PRIMARY KEY,
        token_hash VARCHAR(64) UNIQUE NOT NULL,
        user_id VARCHAR(20) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // INDEXES
    await client.query('CREATE INDEX idx_sessions_student ON sessions(student_id)');
    await client.query('CREATE INDEX idx_attempts_student ON attempts(student_id)');
    await client.query('CREATE INDEX idx_attempts_session ON attempts(session_id)');
    await client.query('CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id)');

    console.log('[MIGRATE] Schema created');

    // ==========================================
    // SEED DATA — ZIMSEC Form 1 Mathematics
    // ==========================================
    console.log('[MIGRATE] Seeding ZIMSEC curriculum...');

    // Students
    const pw = await bcrypt.hash('Test1234', parseInt(process.env.BCRYPT_ROUNDS || '10'));
    const teacherPw = await bcrypt.hash('Teacher1234', parseInt(process.env.BCRYPT_ROUNDS || '10'));

    await client.query(`
      INSERT INTO students (student_id, first_name, last_name, username, password_hash, grade_level, age, gender, school_id, role) VALUES
      ('STU001', 'Tinashe', 'Moyo', 'tinashe.moyo', $1, 'Form 1', 13, 'Male', 'SCH001', 'student'),
      ('STU002', 'Rudo', 'Chikwanda', 'rudo.chikwanda', $1, 'Form 1', 12, 'Female', 'SCH001', 'student'),
      ('STU003', 'Takudzwa', 'Dube', 'takudzwa.dube', $1, 'Form 1', 13, 'Male', 'SCH001', 'student'),
      ('STU004', 'Shamiso', 'Mutasa', 'shamiso.mutasa', $1, 'Form 1', 12, 'Female', 'SCH001', 'student'),
      ('STU005', 'Farai', 'Ncube', 'farai.ncube', $1, 'Form 1', 13, 'Male', 'SCH001', 'student'),
      ('TCH001', 'Blessing', 'Chirwa', 'blessing.chirwa', $2, 'Form 1', NULL, 'Female', 'SCH001', 'teacher')
    `, [pw, teacherPw]);

    console.log('[MIGRATE] Students seeded with password hashes');

    // Subject
    await client.query(`INSERT INTO subjects VALUES ('SUB001', 'Mathematics', 'ZIMSEC', 'Form 1 Mathematics')`);

    // Modules
    await client.query(`
      INSERT INTO modules (module_id, subject_id, module_name, grade_level, sequence_order) VALUES
      ('MOD001','SUB001','Sets','Form 1',1),('MOD002','SUB001','Number Systems','Form 1',2),
      ('MOD003','SUB001','Squares, Cubes and Roots','Form 1',3),('MOD004','SUB001','Directed Numbers','Form 1',4),
      ('MOD005','SUB001','Fractions and Percentages','Form 1',5),('MOD006','SUB001','Ratio and Proportion','Form 1',6),
      ('MOD007','SUB001','Algebra','Form 1',7),('MOD008','SUB001','Geometry','Form 1',8),
      ('MOD009','SUB001','Mensuration','Form 1',9),('MOD010','SUB001','Statistics','Form 1',10)
    `);

    // Skills (44 skills with BKT params)
    await client.query(`
      INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
      ('SKL001','MOD001','Understanding sets and set notation',1,NULL,0.35,0.28,0.08,0.20),
      ('SKL002','MOD001','Types of sets',2,'SKL001',0.30,0.25,0.09,0.20),
      ('SKL003','MOD001','Set operations: union and intersection',3,'SKL002',0.25,0.22,0.10,0.18),
      ('SKL004','MOD001','Venn diagrams with two sets',4,'SKL003',0.25,0.20,0.10,0.18),
      ('SKL005','MOD001','Venn diagrams with three sets',5,'SKL004',0.18,0.18,0.12,0.15),
      ('SKL006','MOD002','Natural numbers, whole numbers and integers',1,NULL,0.45,0.30,0.07,0.22),
      ('SKL007','MOD002','The number line and ordering integers',2,'SKL006',0.38,0.27,0.08,0.20),
      ('SKL008','MOD002','Fractions: proper, improper and mixed',3,'SKL006',0.32,0.25,0.09,0.20),
      ('SKL009','MOD002','Decimal fractions and place value',4,'SKL008',0.30,0.25,0.09,0.20),
      ('SKL010','MOD002','Number bases: converting between base 10 and base 2',5,'SKL006',0.20,0.18,0.12,0.15),
      ('SKL011','MOD003','Square numbers and perfect squares',1,'SKL006',0.38,0.28,0.08,0.20),
      ('SKL012','MOD003','Square roots of perfect squares',2,'SKL011',0.30,0.25,0.10,0.18),
      ('SKL013','MOD003','Cube numbers and perfect cubes',3,'SKL011',0.30,0.25,0.10,0.18),
      ('SKL014','MOD003','Cube roots of perfect cubes',4,'SKL013',0.25,0.22,0.11,0.17),
      ('SKL015','MOD004','Introduction to directed numbers',1,'SKL007',0.38,0.28,0.08,0.20),
      ('SKL016','MOD004','Addition and subtraction of directed numbers',2,'SKL015',0.28,0.23,0.10,0.18),
      ('SKL017','MOD004','Multiplication and division of directed numbers',3,'SKL016',0.25,0.20,0.11,0.17),
      ('SKL018','MOD005','Equivalent fractions and simplifying',1,'SKL008',0.35,0.27,0.08,0.20),
      ('SKL019','MOD005','Addition and subtraction of fractions',2,'SKL018',0.28,0.23,0.10,0.18),
      ('SKL020','MOD005','Multiplication and division of fractions',3,'SKL019',0.25,0.22,0.10,0.18),
      ('SKL021','MOD005','Converting between fractions, decimals and percentages',4,'SKL020',0.28,0.23,0.10,0.18),
      ('SKL022','MOD005','Percentage calculations and percentage change',5,'SKL021',0.25,0.20,0.11,0.17),
      ('SKL023','MOD006','Understanding and writing ratios',1,'SKL018',0.35,0.27,0.08,0.20),
      ('SKL024','MOD006','Simplifying and comparing ratios',2,'SKL023',0.30,0.25,0.09,0.19),
      ('SKL025','MOD006','Direct proportion',3,'SKL024',0.28,0.23,0.10,0.18),
      ('SKL026','MOD006','Dividing a quantity in a given ratio',4,'SKL024',0.25,0.22,0.10,0.18),
      ('SKL027','MOD007','Algebraic expressions and collecting like terms',1,'SKL006',0.32,0.25,0.09,0.20),
      ('SKL028','MOD007','Substitution into algebraic expressions',2,'SKL027',0.30,0.25,0.09,0.19),
      ('SKL029','MOD007','Expanding brackets',3,'SKL027',0.25,0.22,0.10,0.18),
      ('SKL030','MOD007','Solving simple linear equations',4,'SKL029',0.25,0.22,0.10,0.18),
      ('SKL031','MOD007','Solving equations with brackets and fractions',5,'SKL030',0.18,0.18,0.12,0.15),
      ('SKL032','MOD008','Types of angles',1,NULL,0.42,0.30,0.07,0.22),
      ('SKL033','MOD008','Angles on a straight line and at a point',2,'SKL032',0.35,0.27,0.08,0.20),
      ('SKL034','MOD008','Angles in triangles',3,'SKL033',0.30,0.25,0.09,0.19),
      ('SKL035','MOD008','Types of triangles and quadrilaterals',4,'SKL034',0.32,0.25,0.09,0.20),
      ('SKL036','MOD008','Interior angles of polygons',5,'SKL034',0.22,0.20,0.11,0.17),
      ('SKL037','MOD009','Perimeter of rectangles, squares and triangles',1,'SKL032',0.38,0.28,0.08,0.20),
      ('SKL038','MOD009','Area of rectangles and squares',2,'SKL037',0.35,0.27,0.08,0.20),
      ('SKL039','MOD009','Area of triangles and parallelograms',3,'SKL038',0.28,0.23,0.10,0.18),
      ('SKL040','MOD009','Circumference and area of a circle',4,'SKL038',0.22,0.20,0.11,0.17),
      ('SKL041','MOD010','Data collection and frequency tables',1,NULL,0.38,0.28,0.08,0.20),
      ('SKL042','MOD010','Mean, median and mode',2,'SKL041',0.30,0.25,0.09,0.19),
      ('SKL043','MOD010','Bar charts and pictograms',3,'SKL041',0.35,0.27,0.08,0.20),
      ('SKL044','MOD010','Pie charts',4,'SKL043',0.25,0.22,0.10,0.18)
    `);

    console.log('[MIGRATE] 44 skills seeded');

    // Questions — 4 per skill (176 total)
    // Inserting key questions for each skill
    const questions = [
      ['Q001','SKL001','Factors as a set','Write the set of factors of 18 using roster notation.','diagnostic','Medium','{1,2,3,6,9,18}'],
      ['Q002','SKL001','Cardinality','How many elements are in {4, 8, 12, 16, 20}?','practice','Easy','5'],
      ['Q003','SKL001','Set builder to roster','Write {x : x is prime, x < 15} in roster notation.','practice','Medium','{2,3,5,7,11,13}'],
      ['Q004','SKL001','Multiples as a set','If A = {x : x is a multiple of 4, 1 ≤ x ≤ 20}, find n(A).','practice','Hard','5'],
      ['Q005','SKL002','Empty set symbol','Which symbol represents the empty set?','diagnostic','Easy','∅'],
      ['Q006','SKL002','Finite or infinite','Is the set of natural numbers less than 100 finite or infinite?','practice','Easy','finite'],
      ['Q007','SKL002','Equal sets','Are A={1,2,3} and B={3,1,2} equal?','practice','Easy','yes'],
      ['Q008','SKL002','Subset','Is {2,4,6} a subset of {1,2,3,4,5,6}?','practice','Medium','yes'],
      ['Q009','SKL003','Union','If A={1,3,5,7} and B={3,6,7,9}, find A ∪ B.','diagnostic','Medium','{1,3,5,6,7,9}'],
      ['Q010','SKL003','Intersection','If P={2,4,6,8,10} and Q={4,8,12}, find P ∩ Q.','practice','Easy','{4,8}'],
      ['Q011','SKL003','Complement','U={1,2,3,4,5,6,7,8}, A={2,4,6,8}. Find A''.','practice','Medium','{1,3,5,7}'],
      ['Q012','SKL003','n(A∩B)','A={1,2,3,4,5}, B={4,5,6,7}. Find n(A∩B).','practice','Hard','2'],
      ['Q013','SKL004','Venn word problem','In a class of 30: 18 like football, 12 like cricket, 5 like both. How many like neither?','diagnostic','Medium','5'],
      ['Q014','SKL004','Venn elements','U={1..8}, A={2,4,6,8}, B={1,2,3,4}. How many in A∩B?','practice','Easy','2'],
      ['Q015','SKL004','Only in one set','A={3,6,9,12}, B={6,12,18}. How many in A only?','practice','Medium','2'],
      ['Q016','SKL004','At least one','40 surveyed: 25 Maths, 20 Science, 10 both. How many study at least one?','practice','Hard','35'],
      ['Q017','SKL005','Three set Venn','50 students: 30 M, 25 E, 20 S, 10 M∩E, 8 M∩S, 7 E∩S, 4 all. How many Maths only?','diagnostic','Hard','16'],
      ['Q018','SKL005','Inclusion-exclusion','n(A)=20,n(B)=18,n(C)=15,n(A∩B)=7,n(A∩C)=5,n(B∩C)=6,n(A∩B∩C)=3. Find n(A∪B∪C).','practice','Hard','38'],
      ['Q019','SKL005','Centre value','If n(A∩B∩C)=4, what goes in the centre of the Venn diagram?','practice','Medium','4'],
      ['Q020','SKL005','Exactly two sets','n(A∩B)=9, n(A∩B∩C)=4. How many in A and B but NOT C?','practice','Hard','5'],
      ['Q021','SKL006','Classifying numbers','Is −7 a natural number, whole number, or integer?','diagnostic','Easy','integer'],
      ['Q022','SKL006','Smallest natural','What is the smallest natural number?','practice','Easy','1'],
      ['Q023','SKL006','Counting integers','How many integers from −3 to 3 inclusive?','practice','Medium','7'],
      ['Q024','SKL006','How many integers','From −5, 0, 3, 7.5, 12 — how many are integers?','practice','Medium','4'],
      ['Q025','SKL007','Ordering','Arrange in ascending order: 4, −2, 0, −7, 3.','diagnostic','Easy','-7,-2,0,3,4'],
      ['Q026','SKL007','Comparing','Which is larger: −3 or −8?','practice','Easy','-3'],
      ['Q027','SKL007','Distance','Distance between −4 and 6 on the number line?','practice','Medium','10'],
      ['Q028','SKL007','Missing value','5 units left of 2 on the number line?','practice','Medium','-3'],
      ['Q029','SKL008','Improper to mixed','Write 17/4 as a mixed number.','diagnostic','Medium','4 1/4'],
      ['Q030','SKL008','Fraction type','Is 5/3 proper, improper, or mixed?','practice','Easy','improper fraction'],
      ['Q031','SKL008','Mixed to improper','Convert 3 and 2/5 to improper.','practice','Medium','17/5'],
      ['Q032','SKL008','Comparing fractions','Which is larger: 3/4 or 5/7?','practice','Hard','3/4'],
      ['Q033','SKL009','Place value','In 47.356, what digit is in the hundredths place?','diagnostic','Medium','5'],
      ['Q034','SKL009','Ordering decimals','Arrange descending: 0.5, 0.35, 0.509, 0.4.','practice','Medium','0.509,0.5,0.4,0.35'],
      ['Q035','SKL009','Decimal to fraction','Write 0.75 as a fraction in simplest form.','practice','Medium','3/4'],
      ['Q036','SKL009','Rounding','Round 6.847 to 2 decimal places.','practice','Easy','6.85'],
      ['Q037','SKL010','Binary to denary','Convert 1011₂ to base 10.','diagnostic','Medium','11'],
      ['Q038','SKL010','Denary to binary','Convert 13 to base 2.','practice','Medium','1101'],
      ['Q039','SKL010','Binary addition','Calculate 101 + 011 in base 2.','practice','Hard','1000'],
      ['Q040','SKL010','Binary value','What is 1000₂ in base 10?','practice','Easy','8'],
      ['Q041','SKL011','Squaring','What is 13²?','diagnostic','Easy','169'],
      ['Q042','SKL011','Perfect squares','Which is a perfect square: 50, 64, 72, 90?','practice','Easy','64'],
      ['Q043','SKL011','Squaring fraction','What is (2/3)²?','practice','Medium','4/9'],
      ['Q044','SKL011','Counting squares','How many perfect squares between 1 and 100 inclusive?','practice','Medium','10'],
      ['Q045','SKL012','Square root','What is √144?','diagnostic','Easy','12'],
      ['Q046','SKL012','Root of fraction','Find √(16/25).','practice','Medium','4/5'],
      ['Q047','SKL012','Solving x²','If x² = 81, what is x (positive)?','practice','Easy','9'],
      ['Q048','SKL012','Estimating root','Between which two integers does √50 lie?','practice','Hard','7 and 8'],
      ['Q049','SKL013','Cubing','What is 4³?','diagnostic','Easy','64'],
      ['Q050','SKL013','Perfect cube','Is 125 a perfect cube?','practice','Easy','yes'],
      ['Q051','SKL013','Negative cube','What is (−3)³?','practice','Medium','-27'],
      ['Q052','SKL013','Mixed powers','What is 2³ + 3²?','practice','Medium','17'],
      ['Q053','SKL014','Cube root','What is ∛216?','diagnostic','Medium','6'],
      ['Q054','SKL014','Small cube root','What is ∛8?','practice','Easy','2'],
      ['Q055','SKL014','Cube root 1000','What is ∛1000?','practice','Medium','10'],
      ['Q056','SKL014','Solving y³','If y³ = 27, what is y?','practice','Easy','3'],
    ];

    for (const [id, skill, title, text, type, diff, answer] of questions) {
      await client.query(
        'INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, correct_option) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [id, skill, title, text, type, diff, answer]
      );
    }

    // Class
    await client.query(`INSERT INTO classes (class_id, class_name, class_code, teacher_id, academic_year) VALUES ('CLS001','Form 1A','FORM1A','TCH001','2026')`);
    await client.query(`UPDATE students SET class_id = 'CLS001'`);

    // Verify
    const counts = await client.query(`SELECT
      (SELECT count(*) FROM students) as students,
      (SELECT count(*) FROM modules) as modules,
      (SELECT count(*) FROM skills) as skills,
      (SELECT count(*) FROM questions) as questions`);
    const c = counts.rows[0];

    console.log('[MIGRATE] ✅ Migration complete!');
    console.log('[MIGRATE]   Students: ' + c.students + ', Modules: ' + c.modules + ', Skills: ' + c.skills + ', Questions: ' + c.questions);
    console.log('[MIGRATE]   Student login: tinashe.moyo / Test1234');
    console.log('[MIGRATE]   Teacher login: blessing.chirwa / Teacher1234');

  } catch (error) {
    console.error('[MIGRATE] ❌ Error:', error.message);
    console.error('[MIGRATE] Stack:', error.stack);
  } finally {
    client.release();
    await pool.end();
  }
};

module.exports = { runMigration };

if (require.main === module) {
  require('dotenv').config();
  runMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}
