-- ============================================================
-- PLA DATABASE — FULL SCHEMA + ZIMSEC FORM 1 MATHS SEED DATA
-- Personalised Learning Assistant
-- Curriculum: ZIMSEC Form 1 Mathematics
-- ============================================================
-- Test account passwords:
--   Students  → Test1234
--   Teacher   → Teacher1234
-- Run seed-passwords.js after importing to apply bcrypt hashes
-- ============================================================

-- ============================================================
-- SCHEMA — DROP & RECREATE (safe re-run)
-- ============================================================

DROP TABLE IF EXISTS reading_materials CASCADE;
DROP TABLE IF EXISTS mastery CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS skills CASCADE;
DROP TABLE IF EXISTS modules CASCADE;
DROP TABLE IF EXISTS subjects CASCADE;
DROP TABLE IF EXISTS students CASCADE;

-- -------------------------------------------------------
-- STUDENTS
-- -------------------------------------------------------
CREATE TABLE students (
    student_id    VARCHAR(20) PRIMARY KEY,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    username      VARCHAR(100) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    grade_level   VARCHAR(20),
    age           INT,
    gender        VARCHAR(20),
    school_id     VARCHAR(20),
    role          VARCHAR(20) DEFAULT 'student',
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- -------------------------------------------------------
-- SUBJECTS
-- -------------------------------------------------------
CREATE TABLE subjects (
    subject_id       VARCHAR(20) PRIMARY KEY,
    subject_name     VARCHAR(100) NOT NULL,
    curriculum_board VARCHAR(50),
    description      TEXT
);

-- -------------------------------------------------------
-- MODULES
-- -------------------------------------------------------
CREATE TABLE modules (
    module_id      VARCHAR(20) PRIMARY KEY,
    subject_id     VARCHAR(20) REFERENCES subjects(subject_id),
    module_name    VARCHAR(100) NOT NULL,
    grade_level    VARCHAR(20),
    sequence_order INT
);

-- -------------------------------------------------------
-- SKILLS  (includes BKT parameters per skill)
-- bkt_prior  : initial probability of knowing the skill
-- bkt_learn  : probability of learning the skill on a trial
-- bkt_slip   : probability of incorrect response when skill is known
-- bkt_guess  : probability of correct response when skill is unknown
-- -------------------------------------------------------
CREATE TABLE skills (
    skill_id              VARCHAR(20) PRIMARY KEY,
    module_id             VARCHAR(20) REFERENCES modules(module_id),
    skill_name            VARCHAR(150) NOT NULL,
    sequence_order        INT,
    prerequisite_skill_id VARCHAR(20) REFERENCES skills(skill_id),
    bkt_prior             DECIMAL(4,3) DEFAULT 0.300,
    bkt_learn             DECIMAL(4,3) DEFAULT 0.200,
    bkt_slip              DECIMAL(4,3) DEFAULT 0.100,
    bkt_guess             DECIMAL(4,3) DEFAULT 0.200
);

-- -------------------------------------------------------
-- QUESTIONS
-- question_type: 'diagnostic' | 'practice' | 'assessment'
-- difficulty_level: 'Easy' | 'Medium' | 'Hard'
-- -------------------------------------------------------
CREATE TABLE questions (
    question_id      VARCHAR(20) PRIMARY KEY,
    skill_id         VARCHAR(20) REFERENCES skills(skill_id),
    question_title   VARCHAR(200),
    question_text    TEXT NOT NULL,
    question_type    VARCHAR(20) DEFAULT 'practice',
    difficulty_level VARCHAR(20) DEFAULT 'Medium',
    hint_1           TEXT,
    hint_2           TEXT,
    explanation      TEXT,
    correct_option   VARCHAR(100)
);

-- -------------------------------------------------------
-- MASTERY  (populated at runtime)
-- -------------------------------------------------------
CREATE TABLE mastery (
    student_id          VARCHAR(20) REFERENCES students(student_id),
    skill_id            VARCHAR(20) REFERENCES skills(skill_id),
    mastery_probability DECIMAL(5,3) DEFAULT 0.250,
    mastery_status      VARCHAR(30)  DEFAULT 'needs_support',
    last_updated        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (student_id, skill_id)
);

-- -------------------------------------------------------
-- READING MATERIALS
-- content_type: 'note' | 'worked_example' | 'summary' | 'video_ref'
-- content stored inline for offline availability
-- -------------------------------------------------------
CREATE TABLE reading_materials (
    material_id      VARCHAR(20) PRIMARY KEY,
    skill_id         VARCHAR(20) REFERENCES skills(skill_id),
    title            VARCHAR(200) NOT NULL,
    content_type     VARCHAR(30) DEFAULT 'note',
    content          TEXT,
    external_url     TEXT,
    difficulty_level VARCHAR(20) DEFAULT 'Medium',
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- SEED DATA
-- ============================================================

-- -------------------------------------------------------
-- STUDENTS  (password_hash = PLACEHOLDER — run seed-passwords.js)
-- -------------------------------------------------------
INSERT INTO students (student_id, first_name, last_name, username, password_hash, grade_level, age, gender, school_id, role) VALUES
('STU001', 'Tinashe',   'Moyo',      'tinashe.moyo',    'PLACEHOLDER', 'Form 1', 13, 'Male',   'SCH001', 'student'),
('STU002', 'Rudo',      'Chikwanda', 'rudo.chikwanda',  'PLACEHOLDER', 'Form 1', 12, 'Female', 'SCH001', 'student'),
('STU003', 'Takudzwa',  'Dube',      'takudzwa.dube',   'PLACEHOLDER', 'Form 1', 13, 'Male',   'SCH001', 'student'),
('STU004', 'Shamiso',   'Mutasa',    'shamiso.mutasa',  'PLACEHOLDER', 'Form 1', 12, 'Female', 'SCH001', 'student'),
('STU005', 'Farai',     'Ncube',     'farai.ncube',     'PLACEHOLDER', 'Form 1', 13, 'Male',   'SCH001', 'student'),
('TCH001', 'Blessing',  'Chirwa',    'blessing.chirwa', 'PLACEHOLDER', NULL,     NULL, 'Female','SCH001', 'teacher');

-- -------------------------------------------------------
-- SUBJECT
-- -------------------------------------------------------
INSERT INTO subjects (subject_id, subject_name, curriculum_board, description) VALUES
('SUB001', 'Mathematics', 'ZIMSEC',
 'Form 1 Mathematics covering Sets, Number Systems, Algebra, Geometry, Mensuration and Statistics as per the ZIMSEC curriculum framework.');

-- -------------------------------------------------------
-- MODULES
-- -------------------------------------------------------
INSERT INTO modules (module_id, subject_id, module_name, grade_level, sequence_order) VALUES
('MOD001', 'SUB001', 'Sets',                      'Form 1', 1),
('MOD002', 'SUB001', 'Number Systems',             'Form 1', 2),
('MOD003', 'SUB001', 'Squares, Cubes and Roots',   'Form 1', 3),
('MOD004', 'SUB001', 'Directed Numbers',           'Form 1', 4),
('MOD005', 'SUB001', 'Fractions and Percentages',  'Form 1', 5),
('MOD006', 'SUB001', 'Ratio and Proportion',       'Form 1', 6),
('MOD007', 'SUB001', 'Algebra',                    'Form 1', 7),
('MOD008', 'SUB001', 'Geometry',                   'Form 1', 8),
('MOD009', 'SUB001', 'Mensuration',                'Form 1', 9),
('MOD010', 'SUB001', 'Statistics',                 'Form 1', 10);


-- ============================================================
-- SKILLS  (44 skills, with BKT params tuned per difficulty)
-- ============================================================

-- MOD001: Sets
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL001', 'MOD001', 'Understanding sets and set notation',          1, NULL,     0.35, 0.28, 0.08, 0.20),
('SKL002', 'MOD001', 'Types of sets',                                2, 'SKL001', 0.30, 0.25, 0.09, 0.20),
('SKL003', 'MOD001', 'Set operations: union and intersection',       3, 'SKL002', 0.25, 0.22, 0.10, 0.18),
('SKL004', 'MOD001', 'Venn diagrams with two sets',                  4, 'SKL003', 0.25, 0.20, 0.10, 0.18),
('SKL005', 'MOD001', 'Venn diagrams with three sets',                5, 'SKL004', 0.18, 0.18, 0.12, 0.15);

-- MOD002: Number Systems
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL006', 'MOD002', 'Natural numbers, whole numbers and integers',  1, NULL,     0.45, 0.30, 0.07, 0.22),
('SKL007', 'MOD002', 'The number line and ordering integers',        2, 'SKL006', 0.38, 0.27, 0.08, 0.20),
('SKL008', 'MOD002', 'Fractions: proper, improper and mixed',        3, 'SKL006', 0.32, 0.25, 0.09, 0.20),
('SKL009', 'MOD002', 'Decimal fractions and place value',            4, 'SKL008', 0.30, 0.25, 0.09, 0.20),
('SKL010', 'MOD002', 'Number bases: converting between base 10 and base 2', 5, 'SKL006', 0.20, 0.18, 0.12, 0.15);

-- MOD003: Squares, Cubes and Roots
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL011', 'MOD003', 'Square numbers and perfect squares',           1, 'SKL006', 0.38, 0.28, 0.08, 0.20),
('SKL012', 'MOD003', 'Square roots of perfect squares',             2, 'SKL011', 0.30, 0.25, 0.10, 0.18),
('SKL013', 'MOD003', 'Cube numbers and perfect cubes',              3, 'SKL011', 0.30, 0.25, 0.10, 0.18),
('SKL014', 'MOD003', 'Cube roots of perfect cubes',                 4, 'SKL013', 0.25, 0.22, 0.11, 0.17);

-- MOD004: Directed Numbers
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL015', 'MOD004', 'Introduction to directed numbers (positive and negative)', 1, 'SKL007', 0.38, 0.28, 0.08, 0.20),
('SKL016', 'MOD004', 'Addition and subtraction of directed numbers', 2, 'SKL015', 0.28, 0.23, 0.10, 0.18),
('SKL017', 'MOD004', 'Multiplication and division of directed numbers', 3, 'SKL016', 0.25, 0.20, 0.11, 0.17);

-- MOD005: Fractions and Percentages
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL018', 'MOD005', 'Equivalent fractions and simplifying fractions', 1, 'SKL008', 0.35, 0.27, 0.08, 0.20),
('SKL019', 'MOD005', 'Addition and subtraction of fractions',        2, 'SKL018', 0.28, 0.23, 0.10, 0.18),
('SKL020', 'MOD005', 'Multiplication and division of fractions',     3, 'SKL019', 0.25, 0.22, 0.10, 0.18),
('SKL021', 'MOD005', 'Converting between fractions, decimals and percentages', 4, 'SKL020', 0.28, 0.23, 0.10, 0.18),
('SKL022', 'MOD005', 'Percentage calculations and percentage change', 5, 'SKL021', 0.25, 0.20, 0.11, 0.17);

-- MOD006: Ratio and Proportion
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL023', 'MOD006', 'Understanding and writing ratios',             1, 'SKL018', 0.35, 0.27, 0.08, 0.20),
('SKL024', 'MOD006', 'Simplifying and comparing ratios',            2, 'SKL023', 0.30, 0.25, 0.09, 0.19),
('SKL025', 'MOD006', 'Direct proportion',                           3, 'SKL024', 0.28, 0.23, 0.10, 0.18),
('SKL026', 'MOD006', 'Dividing a quantity in a given ratio',        4, 'SKL024', 0.25, 0.22, 0.10, 0.18);

-- MOD007: Algebra
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL027', 'MOD007', 'Algebraic expressions and collecting like terms', 1, 'SKL006', 0.32, 0.25, 0.09, 0.20),
('SKL028', 'MOD007', 'Substitution into algebraic expressions',     2, 'SKL027', 0.30, 0.25, 0.09, 0.19),
('SKL029', 'MOD007', 'Expanding brackets',                          3, 'SKL027', 0.25, 0.22, 0.10, 0.18),
('SKL030', 'MOD007', 'Solving simple linear equations',             4, 'SKL029', 0.25, 0.22, 0.10, 0.18),
('SKL031', 'MOD007', 'Solving equations with brackets and fractions', 5, 'SKL030', 0.18, 0.18, 0.12, 0.15);

-- MOD008: Geometry
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL032', 'MOD008', 'Types of angles: acute, obtuse, reflex, right angle', 1, NULL, 0.42, 0.30, 0.07, 0.22),
('SKL033', 'MOD008', 'Angles on a straight line and at a point',    2, 'SKL032', 0.35, 0.27, 0.08, 0.20),
('SKL034', 'MOD008', 'Angles in triangles',                         3, 'SKL033', 0.30, 0.25, 0.09, 0.19),
('SKL035', 'MOD008', 'Types of triangles and quadrilaterals',       4, 'SKL034', 0.32, 0.25, 0.09, 0.20),
('SKL036', 'MOD008', 'Interior angles of polygons',                 5, 'SKL034', 0.22, 0.20, 0.11, 0.17);

-- MOD009: Mensuration
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL037', 'MOD009', 'Perimeter of rectangles, squares and triangles', 1, 'SKL032', 0.38, 0.28, 0.08, 0.20),
('SKL038', 'MOD009', 'Area of rectangles and squares',              2, 'SKL037', 0.35, 0.27, 0.08, 0.20),
('SKL039', 'MOD009', 'Area of triangles and parallelograms',        3, 'SKL038', 0.28, 0.23, 0.10, 0.18),
('SKL040', 'MOD009', 'Circumference and area of a circle',          4, 'SKL038', 0.22, 0.20, 0.11, 0.17);

-- MOD010: Statistics
INSERT INTO skills (skill_id, module_id, skill_name, sequence_order, prerequisite_skill_id, bkt_prior, bkt_learn, bkt_slip, bkt_guess) VALUES
('SKL041', 'MOD010', 'Data collection and frequency tables',        1, NULL,     0.38, 0.28, 0.08, 0.20),
('SKL042', 'MOD010', 'Mean, median and mode',                       2, 'SKL041', 0.30, 0.25, 0.09, 0.19),
('SKL043', 'MOD010', 'Bar charts and pictograms',                   3, 'SKL041', 0.35, 0.27, 0.08, 0.20),
('SKL044', 'MOD010', 'Pie charts',                                  4, 'SKL043', 0.25, 0.22, 0.10, 0.18);


-- ============================================================
-- QUESTIONS  (4 per skill: 1 diagnostic + 3 practice)
-- ============================================================

-- -------------------------------------------------------
-- SKL001: Understanding sets and set notation
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q001', 'SKL001', 'Factors as a set',
 'Write the set of factors of 18 using roster notation.',
 'diagnostic', 'Medium',
 'Factors are numbers that divide 18 exactly. Start from 1 and work upwards.',
 'Check: 1×18, 2×9, 3×6. List all factor pairs.',
 'Factors of 18: 1×18=18, 2×9=18, 3×6=18. So the set is {1, 2, 3, 6, 9, 18}.',
 '{1,2,3,6,9,18}'),

('Q002', 'SKL001', 'Cardinality of a set',
 'How many elements are in the set {4, 8, 12, 16, 20}?',
 'practice', 'Easy',
 'Count each value listed in the set.',
 'The number of elements in a set is called the cardinality, written as n(A).',
 'The set {4, 8, 12, 16, 20} has 5 elements. So n(A) = 5.',
 '5'),

('Q003', 'SKL001', 'Set builder to roster',
 'Write the set {x : x is a prime number, x < 15} in roster notation.',
 'practice', 'Medium',
 'A prime number has exactly two factors: 1 and itself.',
 'Check each number from 2 to 14: Is 2 prime? Yes. Is 4 prime? No (divisible by 2).',
 'Prime numbers less than 15 are: 2, 3, 5, 7, 11, 13. Set = {2, 3, 5, 7, 11, 13}.',
 '{2,3,5,7,11,13}'),

('Q004', 'SKL001', 'Multiples as a set',
 'If A = {x : x is a multiple of 4, 1 ≤ x ≤ 20}, find n(A).',
 'practice', 'Hard',
 'List all multiples of 4 between 1 and 20 inclusive.',
 'Multiples of 4 are 4, 8, 12, 16, 20. Count them.',
 'Multiples of 4 from 1 to 20: {4, 8, 12, 16, 20}. There are 5 elements, so n(A) = 5.',
 '5');

-- -------------------------------------------------------
-- SKL002: Types of sets
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q005', 'SKL002', 'Identifying an empty set',
 'Which symbol is used to represent the empty set?',
 'diagnostic', 'Easy',
 'The empty set has no elements. It has a special symbol in set notation.',
 'The empty set can be written two ways: using curly braces with nothing inside, or a special symbol.',
 'The empty set is written as {} or ∅. Both are correct. The answer expected here is ∅.',
 '∅'),

('Q006', 'SKL002', 'Finite or infinite',
 'Is the set of natural numbers less than 100 a finite or infinite set?',
 'practice', 'Easy',
 'A finite set has a countable, limited number of elements.',
 'Natural numbers less than 100 are: 1, 2, 3, ..., 99. Can you count them all?',
 'There are exactly 99 natural numbers less than 100, so the set is finite.',
 'finite'),

('Q007', 'SKL002', 'Equal sets',
 'Are the sets A = {1, 2, 3} and B = {3, 1, 2} equal sets? Write yes or no.',
 'practice', 'Easy',
 'Equal sets have exactly the same elements. Order does not matter in a set.',
 'Compare the elements: does A contain everything in B and B contain everything in A?',
 'A = {1, 2, 3} and B = {3, 1, 2} contain the same elements (1, 2 and 3). Sets are equal regardless of order. Answer: yes.',
 'yes'),

('Q008', 'SKL002', 'Subset identification',
 'If A = {2, 4, 6} and B = {1, 2, 3, 4, 5, 6}, is A a subset of B? Write yes or no.',
 'practice', 'Medium',
 'A is a subset of B if every element of A is also in B.',
 'Check each element of A: Is 2 in B? Is 4 in B? Is 6 in B?',
 '2, 4 and 6 are all in B. Every element of A is in B, so A ⊂ B. Answer: yes.',
 'yes');

-- -------------------------------------------------------
-- SKL003: Set operations — union and intersection
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q009', 'SKL003', 'Union of two sets',
 'If A = {1, 3, 5, 7} and B = {3, 6, 7, 9}, find A ∪ B.',
 'diagnostic', 'Medium',
 'The union of two sets contains all elements from both sets with no repetition.',
 'List all elements from A, then add any elements from B that are not already listed.',
 'A ∪ B = {1, 3, 5, 6, 7, 9}. We include every element from A and B once.',
 '{1,3,5,6,7,9}'),

('Q010', 'SKL003', 'Intersection of two sets',
 'If P = {2, 4, 6, 8, 10} and Q = {4, 8, 12}, find P ∩ Q.',
 'practice', 'Easy',
 'The intersection contains only elements found in BOTH sets.',
 'Look for numbers that appear in both P and Q.',
 '4 and 8 appear in both P and Q. So P ∩ Q = {4, 8}.',
 '{4,8}'),

('Q011', 'SKL003', 'Complement of a set',
 'Universal set U = {1,2,3,4,5,6,7,8}. If A = {2,4,6,8}, find A''.',
 'practice', 'Medium',
 'The complement A'' contains all elements in U that are NOT in A.',
 'Go through U: 1 not in A? Yes. 2 in A? Yes — skip. Continue for all.',
 'Elements of U not in A: 1, 3, 5, 7. So A'' = {1, 3, 5, 7}.',
 '{1,3,5,7}'),

('Q012', 'SKL003', 'Combined operations',
 'A = {1,2,3,4,5}, B = {4,5,6,7}. Find n(A ∩ B).',
 'practice', 'Hard',
 'First find A ∩ B, then count its elements.',
 'A ∩ B contains elements in both A and B. Which numbers appear in both?',
 'A ∩ B = {4, 5}. There are 2 elements, so n(A ∩ B) = 2.',
 '2');

-- -------------------------------------------------------
-- SKL004: Venn diagrams with two sets
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q013', 'SKL004', 'Reading a Venn diagram',
 'In a class of 30 learners, 18 like football, 12 like cricket, and 5 like both. How many like neither?',
 'diagnostic', 'Medium',
 'Use the formula: n(A ∪ B) = n(A) + n(B) − n(A ∩ B)',
 'First find how many like at least one sport, then subtract from total.',
 'n(F ∪ C) = 18 + 12 − 5 = 25. Those who like neither = 30 − 25 = 5.',
 '5'),

('Q014', 'SKL004', 'Placing elements in a Venn diagram',
 'U = {1,2,3,4,5,6,7,8}, A = {2,4,6,8}, B = {1,2,3,4}. How many elements are in A ∩ B?',
 'practice', 'Easy',
 'A ∩ B is the overlapping region — elements in both A and B.',
 'List A: {2,4,6,8}. List B: {1,2,3,4}. Which appear in both?',
 'Elements in both A and B: 2 and 4. So n(A ∩ B) = 2.',
 '2'),

('Q015', 'SKL004', 'Only in one set',
 'A = {3,6,9,12}, B = {6,12,18}. How many elements are in A only (not in B)?',
 'practice', 'Medium',
 'Elements in A only means in A but not in B.',
 'A ∩ B = {6,12}. Remove these from A to find elements only in A.',
 'A = {3,6,9,12}. A ∩ B = {6,12}. A only = {3,9}. That is 2 elements.',
 '2'),

('Q016', 'SKL004', 'Venn diagram word problem',
 '40 students were surveyed. 25 study Maths, 20 study Science, 10 study both. How many study at least one subject?',
 'practice', 'Hard',
 'Use n(M ∪ S) = n(M) + n(S) − n(M ∩ S).',
 'Substitute: n(M ∪ S) = 25 + 20 − 10.',
 'n(M ∪ S) = 25 + 20 − 10 = 35. So 35 students study at least one subject.',
 '35');

-- -------------------------------------------------------
-- SKL005: Venn diagrams with three sets
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q017', 'SKL005', 'Three-set Venn problem',
 'In a group of 50 students: 30 like Maths (M), 25 like English (E), 20 like Science (S), 10 like M and E, 8 like M and S, 7 like E and S, and 4 like all three. How many like Maths only?',
 'diagnostic', 'Hard',
 'Maths only = n(M) − n(M∩E) − n(M∩S) + n(M∩E∩S)',
 'Subtract those shared with English and Science, but add back those in all three (they were subtracted twice).',
 'M only = 30 − 10 − 8 + 4 = 16.',
 '16'),

('Q018', 'SKL005', 'All three sets',
 'n(A) = 20, n(B) = 18, n(C) = 15, n(A∩B) = 7, n(A∩C) = 5, n(B∩C) = 6, n(A∩B∩C) = 3. Find n(A∪B∪C).',
 'practice', 'Hard',
 'Use the inclusion-exclusion formula: n(A∪B∪C) = n(A)+n(B)+n(C)−n(A∩B)−n(A∩C)−n(B∩C)+n(A∩B∩C)',
 'Substitute all values into the formula.',
 'n(A∪B∪C) = 20+18+15−7−5−6+3 = 38.',
 '38'),

('Q019', 'SKL005', 'Centre of three circles',
 'If n(A∩B∩C) = 4 and all three sets together share 4 common elements, what is the value placed in the centre region of the Venn diagram?',
 'practice', 'Medium',
 'The centre region of a three-circle Venn diagram is where all three sets overlap.',
 'The centre region represents A ∩ B ∩ C.',
 'The centre region always contains n(A ∩ B ∩ C) = 4.',
 '4'),

('Q020', 'SKL005', 'Elements in exactly two sets',
 'n(A∩B) = 9, n(A∩B∩C) = 4. How many elements are in A and B but NOT in C?',
 'practice', 'Hard',
 'Elements in A∩B includes those also in C. Subtract the centre to find those in exactly A and B.',
 'n(A and B only) = n(A∩B) − n(A∩B∩C)',
 'n(A∩B only) = 9 − 4 = 5.',
 '5');

-- -------------------------------------------------------
-- SKL006: Natural numbers, whole numbers and integers
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q021', 'SKL006', 'Classifying numbers',
 'Is −7 a natural number, a whole number, or an integer?',
 'diagnostic', 'Easy',
 'Natural numbers: 1, 2, 3, ... Whole numbers: 0, 1, 2, ... Integers: ...,−2,−1,0,1,2,...',
 'Negative numbers cannot be natural numbers or whole numbers.',
 '−7 is negative. It is not a natural number or whole number. It is an integer.',
 'integer'),

('Q022', 'SKL006', 'Largest natural number',
 'What is the smallest natural number?',
 'practice', 'Easy',
 'Natural numbers are the counting numbers starting from 1.',
 'The set of natural numbers begins: 1, 2, 3, ...',
 'The smallest natural number is 1.',
 '1'),

('Q023', 'SKL006', 'Counting integers in a range',
 'How many integers are there from −3 to 3 inclusive?',
 'practice', 'Medium',
 'List all integers including the endpoints: −3, −2, −1, 0, 1, 2, 3.',
 'Count each integer you listed.',
 'Integers from −3 to 3: −3, −2, −1, 0, 1, 2, 3. That is 7 integers.',
 '7'),

('Q024', 'SKL006', 'Classifying a set of numbers',
 'From the list: −5, 0, 3, 7.5, 12 — how many are integers?',
 'practice', 'Medium',
 'Integers include negative whole numbers, zero and positive whole numbers. No decimals.',
 'Check each: −5 (integer?), 0 (integer?), 3 (integer?), 7.5 (integer?), 12 (integer?)',
 '−5, 0, 3 and 12 are integers. 7.5 is not. So 4 numbers are integers.',
 '4');

-- -------------------------------------------------------
-- SKL007: The number line and ordering integers
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q025', 'SKL007', 'Ordering integers',
 'Arrange in ascending order: 4, −2, 0, −7, 3.',
 'diagnostic', 'Easy',
 'Ascending order means from smallest to largest. Negative numbers are smaller.',
 'On a number line, numbers to the left are smaller. −7 is the furthest left.',
 'Ascending: −7, −2, 0, 3, 4.',
 '-7,-2,0,3,4'),

('Q026', 'SKL007', 'Comparing integers',
 'Which is larger: −3 or −8?',
 'practice', 'Easy',
 'On the number line, the number to the right is always larger.',
 '−3 is to the right of −8 on the number line.',
 '−3 is larger than −8 because −3 is to the right on the number line.',
 '-3'),

('Q027', 'SKL007', 'Distance on number line',
 'What is the distance between −4 and 6 on the number line?',
 'practice', 'Medium',
 'Distance = larger value − smaller value.',
 'Distance = 6 − (−4) = 6 + 4.',
 'Distance = 6 − (−4) = 6 + 4 = 10.',
 '10'),

('Q028', 'SKL007', 'Missing value on number line',
 'If a number is 5 units to the left of 2 on the number line, what is that number?',
 'practice', 'Medium',
 'Moving left on a number line means subtracting.',
 '2 − 5 = ?',
 '2 − 5 = −3. The number is −3.',
 '-3');

-- -------------------------------------------------------
-- SKL008: Fractions — proper, improper and mixed
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q029', 'SKL008', 'Converting improper fraction',
 'Write 17/4 as a mixed number.',
 'diagnostic', 'Medium',
 'Divide the numerator by the denominator. The quotient is the whole number part.',
 '17 ÷ 4 = 4 remainder 1. Write as: whole number and remainder/denominator.',
 '17 ÷ 4 = 4 remainder 1. So 17/4 = 4 and 1/4.',
 '4 1/4'),

('Q030', 'SKL008', 'Identifying fraction type',
 'Is 5/3 a proper fraction, improper fraction, or mixed number?',
 'practice', 'Easy',
 'A proper fraction has numerator less than denominator. An improper fraction has numerator greater than or equal to denominator.',
 '5 is greater than 3. What type of fraction is this?',
 'Since 5 > 3, this is an improper fraction.',
 'improper fraction'),

('Q031', 'SKL008', 'Converting mixed to improper',
 'Convert 3 and 2/5 to an improper fraction.',
 'practice', 'Medium',
 'Multiply the whole number by the denominator, then add the numerator.',
 '3 × 5 = 15, then 15 + 2 = 17. The denominator stays the same.',
 '3 × 5 + 2 = 17. So 3 and 2/5 = 17/5.',
 '17/5'),

('Q032', 'SKL008', 'Comparing fractions',
 'Which is larger: 3/4 or 5/7?',
 'practice', 'Hard',
 'Convert both fractions to a common denominator to compare.',
 'LCM of 4 and 7 is 28. Convert: 3/4 = 21/28, 5/7 = 20/28.',
 '3/4 = 21/28 and 5/7 = 20/28. Since 21 > 20, 3/4 is larger.',
 '3/4');

-- -------------------------------------------------------
-- SKL009: Decimal fractions and place value
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q033', 'SKL009', 'Place value in decimals',
 'In the number 47.356, what digit is in the hundredths place?',
 'diagnostic', 'Medium',
 'After the decimal point: tenths, hundredths, thousandths.',
 '4 7 . 3 5 6 — count the decimal places from left to right.',
 'Tenths: 3, Hundredths: 5, Thousandths: 6. The digit in the hundredths place is 5.',
 '5'),

('Q034', 'SKL009', 'Ordering decimals',
 'Arrange in descending order: 0.5, 0.35, 0.509, 0.4.',
 'practice', 'Medium',
 'Compare digits place by place from left to right after the decimal.',
 'Write to same number of decimal places: 0.500, 0.350, 0.509, 0.400.',
 '0.509 > 0.500 > 0.400 > 0.350. Descending: 0.509, 0.5, 0.4, 0.35.',
 '0.509,0.5,0.4,0.35'),

('Q035', 'SKL009', 'Decimal to fraction',
 'Write 0.75 as a fraction in its simplest form.',
 'practice', 'Medium',
 '0.75 means 75 hundredths. Write as 75/100 then simplify.',
 'HCF of 75 and 100 is 25. Divide both by 25.',
 '75/100 = 3/4.',
 '3/4'),

('Q036', 'SKL009', 'Rounding decimals',
 'Round 6.847 to 2 decimal places.',
 'practice', 'Easy',
 'Look at the third decimal place to decide whether to round up or keep.',
 'The third decimal is 7. Since 7 ≥ 5, round up the second decimal place.',
 '6.847 rounded to 2 d.p.: the third decimal is 7 ≥ 5, so 4 rounds up to 5. Answer: 6.85.',
 '6.85');

-- -------------------------------------------------------
-- SKL010: Number bases
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q037', 'SKL010', 'Binary to denary',
 'Convert 1011 base 2 to base 10.',
 'diagnostic', 'Medium',
 'In base 2, the place values from right are: 1, 2, 4, 8, 16, ...',
 'Multiply each digit by its place value: 1×8 + 0×4 + 1×2 + 1×1.',
 '1×8 + 0×4 + 1×2 + 1×1 = 8 + 0 + 2 + 1 = 11.',
 '11'),

('Q038', 'SKL010', 'Denary to binary',
 'Convert 13 (base 10) to base 2.',
 'practice', 'Medium',
 'Repeatedly divide by 2, recording remainders. Read remainders from bottom to top.',
 '13÷2=6 r1, 6÷2=3 r0, 3÷2=1 r1, 1÷2=0 r1. Read remainders upward.',
 '13 → 6 r1 → 3 r0 → 1 r1 → 0 r1. Reading upward: 1101.',
 '1101'),

('Q039', 'SKL010', 'Adding in base 2',
 'Calculate 101 + 011 in base 2.',
 'practice', 'Hard',
 'Add column by column from right. In binary: 0+0=0, 0+1=1, 1+1=10 (write 0, carry 1).',
 'Column by column: 1+1=10, write 0 carry 1. 0+1+1=10, write 0 carry 1. 1+0+1=10, write 0 carry 1.',
 '101 + 011: rightmost 1+1=10 (0 carry 1), 0+1+1=10 (0 carry 1), 1+0+1=10 (0 carry 1). Result: 1000.',
 '1000'),

('Q040', 'SKL010', 'Binary value',
 'What is the value of 1000 in base 2?',
 'practice', 'Easy',
 'In base 2, each place doubles. The fourth position from the right has value 2³.',
 '2³ = 2 × 2 × 2 = 8.',
 '1000 in base 2 = 1×8 + 0×4 + 0×2 + 0×1 = 8.',
 '8');

-- -------------------------------------------------------
-- SKL011: Square numbers and perfect squares
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q041', 'SKL011', 'Squaring a number',
 'What is 13²?',
 'diagnostic', 'Easy',
 '13² means 13 × 13.',
 'Break it down: 13 × 13 = 13 × 10 + 13 × 3 = 130 + 39.',
 '13 × 13 = 169.',
 '169'),

('Q042', 'SKL011', 'Identifying perfect squares',
 'Which of these is a perfect square: 50, 64, 72, 90?',
 'practice', 'Easy',
 'A perfect square is the result of squaring a whole number.',
 'Try: 7²=49, 8²=64, 9²=81. Which matches a number in the list?',
 '8² = 64. So 64 is the perfect square.',
 '64'),

('Q043', 'SKL011', 'Squaring a fraction',
 'What is (2/3)²?',
 'practice', 'Medium',
 'Square both the numerator and the denominator separately.',
 '(2/3)² = 2²/3² = ?/9',
 '(2/3)² = 4/9.',
 '4/9'),

('Q044', 'SKL011', 'Perfect squares in range',
 'How many perfect squares are there between 1 and 100 inclusive?',
 'practice', 'Medium',
 'List the squares: 1²=1, 2²=4, ... up to 10²=100.',
 'Count from 1² to 10². How many values is that?',
 '1,4,9,16,25,36,49,64,81,100 — that is 10 perfect squares.',
 '10');

-- -------------------------------------------------------
-- SKL012: Square roots of perfect squares
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q045', 'SKL012', 'Finding a square root',
 'What is √144?',
 'diagnostic', 'Easy',
 'Think: what number multiplied by itself gives 144?',
 '12 × 12 = 144.',
 '√144 = 12.',
 '12'),

('Q046', 'SKL012', 'Square root of a fraction',
 'Find √(16/25).',
 'practice', 'Medium',
 'Take the square root of the numerator and denominator separately.',
 '√16 = 4 and √25 = 5.',
 '√(16/25) = 4/5.',
 '4/5'),

('Q047', 'SKL012', 'Using square root in equation',
 'If x² = 81, what is x? (Give the positive value.)',
 'practice', 'Easy',
 'Take the square root of both sides.',
 '√81 = ?',
 'x² = 81, so x = √81 = 9.',
 '9'),

('Q048', 'SKL012', 'Estimating square root',
 'Between which two consecutive integers does √50 lie?',
 'practice', 'Hard',
 'Find the perfect squares nearest to 50.',
 '7² = 49 and 8² = 64. 49 < 50 < 64.',
 '7² = 49 < 50 < 64 = 8². So √50 lies between 7 and 8.',
 '7 and 8');

-- -------------------------------------------------------
-- SKL013: Cube numbers and perfect cubes
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q049', 'SKL013', 'Cubing a number',
 'What is 4³?',
 'diagnostic', 'Easy',
 '4³ means 4 × 4 × 4.',
 'First: 4 × 4 = 16. Then: 16 × 4.',
 '4 × 4 × 4 = 64.',
 '64'),

('Q050', 'SKL013', 'Identifying perfect cubes',
 'Is 125 a perfect cube? Write yes or no.',
 'practice', 'Easy',
 'A perfect cube = n³ for some integer n. Try n = 5.',
 '5³ = 5 × 5 × 5 = 125.',
 '5³ = 125. Yes, 125 is a perfect cube.',
 'yes'),

('Q051', 'SKL013', 'Cubing a negative number',
 'What is (−3)³?',
 'practice', 'Medium',
 'A negative number cubed gives a negative result (odd power).',
 '(−3)³ = −3 × −3 × −3 = 9 × (−3).',
 '(−3)³ = −3 × −3 × −3 = 9 × (−3) = −27.',
 '-27'),

('Q052', 'SKL013', 'Comparing squares and cubes',
 'What is 2³ + 3²?',
 'practice', 'Medium',
 'Calculate 2³ and 3² separately then add.',
 '2³ = 8, 3² = 9.',
 '2³ + 3² = 8 + 9 = 17.',
 '17');

-- -------------------------------------------------------
-- SKL014: Cube roots of perfect cubes
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q053', 'SKL014', 'Finding a cube root',
 'What is ∛216?',
 'diagnostic', 'Medium',
 'Think: what number cubed gives 216?',
 'Try 6: 6 × 6 × 6 = ?',
 '6³ = 216. So ∛216 = 6.',
 '6'),

('Q054', 'SKL014', 'Cube root of a small number',
 'What is ∛8?',
 'practice', 'Easy',
 'What number multiplied by itself three times equals 8?',
 '2 × 2 × 2 = 8.',
 '∛8 = 2.',
 '2'),

('Q055', 'SKL014', 'Cube root of 1000',
 'What is ∛1000?',
 'practice', 'Medium',
 'Think of a number n such that n³ = 1000.',
 '10 × 10 × 10 = 1000.',
 '∛1000 = 10.',
 '10'),

('Q056', 'SKL014', 'Using cube root in an equation',
 'If y³ = 27, what is y?',
 'practice', 'Easy',
 'Take the cube root of both sides.',
 '∛27 = ?',
 'y = ∛27 = 3.',
 '3');

-- -------------------------------------------------------
-- SKL015: Introduction to directed numbers
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q057', 'SKL015', 'Real-life directed numbers',
 'A temperature of 5°C below zero is written as:',
 'diagnostic', 'Easy',
 'Below zero means negative. Above zero means positive.',
 'Below zero: use a negative sign.',
 '5°C below zero is written as −5°C.',
 '-5'),

('Q058', 'SKL015', 'Opposite of a directed number',
 'What is the opposite of −12?',
 'practice', 'Easy',
 'The opposite of a number is the same distance from zero in the other direction.',
 'The opposite of a negative number is positive.',
 'The opposite of −12 is +12.',
 '12'),

('Q059', 'SKL015', 'Absolute value',
 'What is |−9|?',
 'practice', 'Easy',
 'The absolute value (modulus) of a number is its distance from zero, always positive.',
 '|−9| means the distance of −9 from 0.',
 '|−9| = 9.',
 '9'),

('Q060', 'SKL015', 'Comparing directed numbers in context',
 'A submarine is at −120m and a helicopter is at 80m. What is the difference in height?',
 'practice', 'Hard',
 'Difference = higher position − lower position.',
 '80 − (−120) = 80 + 120.',
 '80 − (−120) = 80 + 120 = 200m.',
 '200');

-- -------------------------------------------------------
-- SKL016: Addition and subtraction of directed numbers
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q061', 'SKL016', 'Adding directed numbers',
 'Calculate: (−8) + (−5)',
 'diagnostic', 'Easy',
 'Adding two negative numbers: add the values and keep the negative sign.',
 '8 + 5 = 13. Both are negative.',
 '(−8) + (−5) = −13.',
 '-13'),

('Q062', 'SKL016', 'Subtracting a negative',
 'Calculate: 6 − (−4)',
 'practice', 'Medium',
 'Subtracting a negative is the same as adding a positive.',
 '6 − (−4) = 6 + 4.',
 '6 − (−4) = 6 + 4 = 10.',
 '10'),

('Q063', 'SKL016', 'Mixed operations',
 'Calculate: (−3) + 7 − (−2)',
 'practice', 'Medium',
 'Work left to right. Change subtraction of negative to addition.',
 '−3 + 7 = 4. Then 4 − (−2) = 4 + 2.',
 '−3 + 7 = 4. Then 4 + 2 = 6.',
 '6'),

('Q064', 'SKL016', 'Temperature change',
 'The temperature was −4°C. It rose by 11°C. What is the new temperature?',
 'practice', 'Easy',
 'Rising temperature means adding. Start at −4 and add 11.',
 '−4 + 11 = ?',
 '−4 + 11 = 7°C.',
 '7');

-- -------------------------------------------------------
-- SKL017: Multiplication and division of directed numbers
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q065', 'SKL017', 'Multiplying directed numbers',
 'Calculate: (−6) × (−7)',
 'diagnostic', 'Easy',
 'Negative × Negative = Positive.',
 '6 × 7 = 42. What sign does the product have?',
 '(−6) × (−7) = +42.',
 '42'),

('Q066', 'SKL017', 'Dividing with different signs',
 'Calculate: (−36) ÷ 4',
 'practice', 'Easy',
 'Negative ÷ Positive = Negative.',
 '36 ÷ 4 = 9. What sign is the answer?',
 '(−36) ÷ 4 = −9.',
 '-9'),

('Q067', 'SKL017', 'Mixed multiplication',
 'Calculate: (−3) × 5 × (−2)',
 'practice', 'Medium',
 'Work from left to right. Use sign rules at each step.',
 '(−3) × 5 = −15. Then (−15) × (−2) = ?',
 '(−3) × 5 = −15. (−15) × (−2) = +30.',
 '30'),

('Q068', 'SKL017', 'Sign rule summary',
 'What is the sign of the answer when you multiply three negative numbers together?',
 'practice', 'Hard',
 'Two negatives make a positive. Then positive × negative = ?',
 '(−) × (−) = (+). Then (+) × (−) = ?',
 '(−) × (−) × (−) = (+) × (−) = (−). The answer is negative.',
 'negative');

-- -------------------------------------------------------
-- SKL018: Equivalent fractions and simplifying
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q069', 'SKL018', 'Simplifying a fraction',
 'Simplify 36/48 to its lowest terms.',
 'diagnostic', 'Medium',
 'Find the Highest Common Factor (HCF) of 36 and 48.',
 'Factors of 36: 1,2,3,4,6,9,12,18,36. Factors of 48: 1,2,3,4,6,8,12,16,24,48. HCF = 12.',
 'HCF of 36 and 48 is 12. 36÷12=3, 48÷12=4. Simplified: 3/4.',
 '3/4'),

('Q070', 'SKL018', 'Equivalent fraction',
 'Fill in the blank: 3/5 = ?/20',
 'practice', 'Easy',
 'Multiply both numerator and denominator by the same number.',
 '5 × 4 = 20. So multiply numerator by 4 as well.',
 '3/5 = 12/20. Multiply numerator and denominator by 4.',
 '12'),

('Q071', 'SKL018', 'Simplify to lowest terms',
 'Simplify 24/36.',
 'practice', 'Medium',
 'Find the HCF of 24 and 36.',
 'HCF of 24 and 36 is 12.',
 '24÷12 = 2, 36÷12 = 3. Answer: 2/3.',
 '2/3'),

('Q072', 'SKL018', 'Comparing simplified fractions',
 'Write these fractions in order from smallest to largest: 2/3, 3/4, 5/6.',
 'practice', 'Hard',
 'Convert to a common denominator.',
 'LCM of 3, 4, 6 is 12. Convert each: 2/3=8/12, 3/4=9/12, 5/6=10/12.',
 '8/12 < 9/12 < 10/12. So order is: 2/3, 3/4, 5/6.',
 '2/3,3/4,5/6');

-- -------------------------------------------------------
-- SKL019: Addition and subtraction of fractions
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q073', 'SKL019', 'Adding fractions different denominators',
 'Calculate 2/3 + 3/4.',
 'diagnostic', 'Medium',
 'Find the LCM of the denominators first.',
 'LCM of 3 and 4 is 12. Convert: 2/3 = 8/12, 3/4 = 9/12.',
 '8/12 + 9/12 = 17/12 = 1 and 5/12.',
 '1 5/12'),

('Q074', 'SKL019', 'Adding simple fractions',
 'Calculate 1/4 + 2/4.',
 'practice', 'Easy',
 'When denominators are the same, add the numerators.',
 '1/4 + 2/4 = (1+2)/4.',
 '1/4 + 2/4 = 3/4.',
 '3/4'),

('Q075', 'SKL019', 'Subtracting fractions',
 'Calculate 5/6 − 1/4.',
 'practice', 'Medium',
 'Find the LCM of 6 and 4.',
 'LCM = 12. 5/6 = 10/12, 1/4 = 3/12.',
 '10/12 − 3/12 = 7/12.',
 '7/12'),

('Q076', 'SKL019', 'Adding mixed numbers',
 'Calculate 2 and 1/3 + 1 and 3/4.',
 'practice', 'Hard',
 'Add the whole numbers, then add the fractions separately with a common denominator.',
 '2+1=3. Then 1/3 + 3/4: LCM=12, gives 4/12 + 9/12 = 13/12 = 1 and 1/12.',
 '3 + 1 and 1/12 = 4 and 1/12.',
 '4 1/12');

-- -------------------------------------------------------
-- SKL020: Multiplication and division of fractions
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q077', 'SKL020', 'Multiplying fractions',
 'Calculate 3/4 × 8/9.',
 'diagnostic', 'Medium',
 'Multiply numerators together and denominators together, then simplify.',
 '(3×8)/(4×9) = 24/36. Simplify using HCF.',
 '24/36 = 2/3.',
 '2/3'),

('Q078', 'SKL020', 'Simple fraction multiplication',
 'Calculate 2/5 × 1/3.',
 'practice', 'Easy',
 'Multiply numerator × numerator, denominator × denominator.',
 '(2×1)/(5×3) = 2/15.',
 '2/5 × 1/3 = 2/15.',
 '2/15'),

('Q079', 'SKL020', 'Dividing fractions',
 'Calculate 3/4 ÷ 3/8.',
 'practice', 'Medium',
 'Dividing by a fraction means multiplying by its reciprocal.',
 'Flip the second fraction and multiply: 3/4 × 8/3.',
 '3/4 × 8/3 = 24/12 = 2.',
 '2'),

('Q080', 'SKL020', 'Fraction of a quantity',
 'What is 3/5 of 40?',
 'practice', 'Easy',
 'Of means multiply.',
 '3/5 × 40 = (3 × 40)/5.',
 '(3 × 40)/5 = 120/5 = 24.',
 '24');

-- -------------------------------------------------------
-- SKL021: Converting fractions, decimals and percentages
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q081', 'SKL021', 'Fraction to percentage',
 'Convert 3/8 to a percentage.',
 'diagnostic', 'Medium',
 'Multiply the fraction by 100%.',
 '3/8 × 100 = 300/8.',
 '300/8 = 37.5. So 3/8 = 37.5%.',
 '37.5%'),

('Q082', 'SKL021', 'Percentage to decimal',
 'Convert 45% to a decimal.',
 'practice', 'Easy',
 'Divide the percentage by 100.',
 '45 ÷ 100 = ?',
 '45% = 0.45.',
 '0.45'),

('Q083', 'SKL021', 'Decimal to percentage',
 'Convert 0.625 to a percentage.',
 'practice', 'Easy',
 'Multiply the decimal by 100.',
 '0.625 × 100 = ?',
 '0.625 × 100 = 62.5%.',
 '62.5%'),

('Q084', 'SKL021', 'Percentage to fraction',
 'Write 35% as a fraction in its simplest form.',
 'practice', 'Medium',
 'Percentage means per hundred. Write as fraction over 100 then simplify.',
 '35/100. HCF of 35 and 100 is 5.',
 '35/100 = 7/20.',
 '7/20');

-- -------------------------------------------------------
-- SKL022: Percentage calculations and percentage change
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q085', 'SKL022', 'Percentage of an amount',
 'Find 15% of $240.',
 'diagnostic', 'Easy',
 '15% means 15/100. Multiply 15/100 by 240.',
 '15/100 × 240 = 0.15 × 240.',
 '0.15 × 240 = $36.',
 '36'),

('Q086', 'SKL022', 'Percentage increase',
 'A bag costs $50. The price increases by 20%. What is the new price?',
 'practice', 'Medium',
 'Find 20% of $50 and add it to the original price.',
 '20% of 50 = 0.2 × 50 = 10. New price = 50 + 10.',
 'Increase = $10. New price = $50 + $10 = $60.',
 '60'),

('Q087', 'SKL022', 'Percentage decrease',
 'A phone costs $120. It is reduced by 25%. What is the new price?',
 'practice', 'Medium',
 'Find 25% of $120 and subtract from the original.',
 '25% of 120 = 0.25 × 120 = 30. New price = 120 − 30.',
 'Reduction = $30. New price = $90.',
 '90'),

('Q088', 'SKL022', 'Finding the percentage',
 'A learner scores 36 out of 48. What is their percentage score?',
 'practice', 'Medium',
 'Percentage = (score/total) × 100.',
 '(36/48) × 100 = ?',
 '36/48 = 3/4 = 0.75. 0.75 × 100 = 75%.',
 '75%');

-- -------------------------------------------------------
-- SKL023: Understanding and writing ratios
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q089', 'SKL023', 'Writing a ratio',
 'In a class of 12 boys and 18 girls, what is the ratio of boys to girls?',
 'diagnostic', 'Easy',
 'Write as boys : girls.',
 '12 : 18. Can this be simplified?',
 '12 : 18. HCF = 6. 12÷6 : 18÷6 = 2 : 3.',
 '2:3'),

('Q090', 'SKL023', 'Ratio from a description',
 'A recipe uses 200g of flour and 50g of butter. What is the ratio of flour to butter?',
 'practice', 'Easy',
 'Write flour : butter and simplify.',
 '200 : 50. Divide both by 50.',
 '200÷50 : 50÷50 = 4 : 1.',
 '4:1'),

('Q091', 'SKL023', 'Ratio and total parts',
 'The ratio of red to blue marbles is 3:5. If there are 40 marbles in total, how many are red?',
 'practice', 'Medium',
 'Total parts = 3 + 5 = 8. One part = 40 ÷ 8.',
 'Red = 3 parts = 3 × (40÷8).',
 '40 ÷ 8 = 5. Red = 3 × 5 = 15.',
 '15'),

('Q092', 'SKL023', 'Ratio with three parts',
 'Three friends share $120 in the ratio 1:2:3. How much does the third person receive?',
 'practice', 'Hard',
 'Total parts = 1+2+3 = 6. One part = 120÷6.',
 'Third person has 3 parts: 3 × (120÷6).',
 '120÷6 = 20. Third person = 3 × 20 = $60.',
 '60');

-- -------------------------------------------------------
-- SKL024: Simplifying and comparing ratios
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q093', 'SKL024', 'Simplifying a ratio',
 'Simplify the ratio 45 : 30.',
 'diagnostic', 'Easy',
 'Find the HCF of 45 and 30.',
 'HCF of 45 and 30 is 15.',
 '45÷15 : 30÷15 = 3 : 2.',
 '3:2'),

('Q094', 'SKL024', 'Ratio in the form 1:n',
 'Write 4:20 in the form 1:n.',
 'practice', 'Medium',
 'Divide both parts by the first number to make the first part equal to 1.',
 '4÷4 : 20÷4 = 1 : ?',
 '4:20 = 1:5.',
 '1:5'),

('Q095', 'SKL024', 'Equivalent ratios',
 'Are the ratios 6:9 and 4:6 equivalent? Write yes or no.',
 'practice', 'Medium',
 'Simplify both ratios to lowest terms and compare.',
 '6:9 = 2:3 (÷3). 4:6 = 2:3 (÷2).',
 'Both simplify to 2:3. They are equivalent. Answer: yes.',
 'yes'),

('Q096', 'SKL024', 'Comparing two ratios',
 'Which is the greater ratio: 5:8 or 3:4? Express as decimals to compare.',
 'practice', 'Hard',
 'Divide the first part by the second in each ratio.',
 '5÷8 = 0.625. 3÷4 = 0.75.',
 '0.625 < 0.75. So 3:4 is the greater ratio.',
 '3:4');

-- -------------------------------------------------------
-- SKL025: Direct proportion
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q097', 'SKL025', 'Direct proportion problem',
 '5 pens cost $3.50. How much do 8 pens cost?',
 'diagnostic', 'Medium',
 'Find the cost of one pen first.',
 '1 pen = $3.50 ÷ 5. Then multiply by 8.',
 'Cost of 1 pen = $0.70. Cost of 8 = $0.70 × 8 = $5.60.',
 '5.60'),

('Q098', 'SKL025', 'Identifying direct proportion',
 'A car travels 120km in 2 hours. How far does it travel in 5 hours at the same speed?',
 'practice', 'Medium',
 'Find the speed (distance per hour), then multiply by 5.',
 'Speed = 120÷2 = 60 km/h. Distance = 60 × 5.',
 '60 × 5 = 300km.',
 '300'),

('Q099', 'SKL025', 'Direct proportion table',
 'If y is directly proportional to x, and y = 12 when x = 4, find y when x = 7.',
 'practice', 'Hard',
 'Find the constant k from y = kx.',
 'k = y/x = 12/4 = 3. Then y = 3x = 3 × 7.',
 'k = 3. y = 3 × 7 = 21.',
 '21'),

('Q100', 'SKL025', 'Recipe proportion',
 'A recipe for 4 people needs 300g of rice. How much rice is needed for 10 people?',
 'practice', 'Easy',
 'Find rice per person, then multiply by 10.',
 '300÷4 = 75g per person.',
 '75 × 10 = 750g.',
 '750');

-- -------------------------------------------------------
-- SKL026: Dividing a quantity in a given ratio
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q101', 'SKL026', 'Dividing money in ratio',
 'Divide $180 in the ratio 2:7.',
 'diagnostic', 'Medium',
 'Total parts = 2 + 7 = 9. One part = $180 ÷ 9.',
 'First share = 2 × 20 = $40. Second share = 7 × 20 = $140.',
 '$180 ÷ 9 = $20 per part. Shares: $40 and $140.',
 '40 and 140'),

('Q102', 'SKL026', 'Dividing land in ratio',
 'A farm of 240 hectares is divided between two farmers in the ratio 3:5. How many hectares does the first farmer get?',
 'practice', 'Medium',
 'Total parts = 3 + 5 = 8.',
 'One part = 240÷8 = 30. First farmer = 3 × 30.',
 '3 × 30 = 90 hectares.',
 '90'),

('Q103', 'SKL026', 'Three-way division',
 'Divide 90 sweets among three children in the ratio 2:3:4. How many does the second child get?',
 'practice', 'Hard',
 'Total parts = 2+3+4 = 9. One part = 90÷9.',
 'Second child = 3 parts = 3 × 10.',
 '90÷9=10. Second child = 3×10 = 30.',
 '30'),

('Q104', 'SKL026', 'Ratio and remainder',
 'Pencils are shared in ratio 5:3. The larger share is 25. What is the smaller share?',
 'practice', 'Medium',
 'The larger share is 5 parts. Find the value of one part.',
 '1 part = 25 ÷ 5 = 5. Smaller share = 3 parts = 3 × 5.',
 '1 part = 5. Smaller share = 15.',
 '15');

-- -------------------------------------------------------
-- SKL027: Algebraic expressions and collecting like terms
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q105', 'SKL027', 'Simplifying expression',
 'Simplify: 3x + 5y − x + 2y',
 'diagnostic', 'Medium',
 'Collect like terms: group the x terms and the y terms separately.',
 'x terms: 3x − x = 2x. y terms: 5y + 2y = 7y.',
 '3x − x = 2x. 5y + 2y = 7y. Answer: 2x + 7y.',
 '2x+7y'),

('Q106', 'SKL027', 'Identifying like terms',
 'How many terms in 4a + 3b − 2a + 7 are like terms with 4a?',
 'practice', 'Easy',
 'Like terms have the same variable raised to the same power.',
 'Which terms have the variable "a"?',
 '4a and −2a are like terms. That is 2 terms (but we exclude 4a itself, so 1 other term: −2a).',
 '1'),

('Q107', 'SKL027', 'Simplifying with multiple variables',
 'Simplify: 5m + 3n − 2m − n + 4',
 'practice', 'Medium',
 'Group m terms, n terms and constant separately.',
 'm: 5m − 2m = 3m. n: 3n − n = 2n. Constant: 4.',
 '3m + 2n + 4.',
 '3m+2n+4'),

('Q108', 'SKL027', 'Writing an expression',
 'Write an expression for: "5 more than twice a number x"',
 'practice', 'Easy',
 'Twice a number = 2x. Five more = add 5.',
 '2x + 5.',
 'The expression is 2x + 5.',
 '2x+5');

-- -------------------------------------------------------
-- SKL028: Substitution
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q109', 'SKL028', 'Substitution into expression',
 'If a = 3 and b = −2, find the value of 4a − 3b.',
 'diagnostic', 'Medium',
 'Replace a with 3 and b with −2 in the expression.',
 '4(3) − 3(−2) = 12 − (−6).',
 '4(3) = 12. 3(−2) = −6. 12 − (−6) = 12 + 6 = 18.',
 '18'),

('Q110', 'SKL028', 'Simple substitution',
 'If x = 5, find the value of 3x + 7.',
 'practice', 'Easy',
 'Replace x with 5.',
 '3(5) + 7 = 15 + 7.',
 '3(5) + 7 = 22.',
 '22'),

('Q111', 'SKL028', 'Substitution with powers',
 'If p = 4, find the value of p² − 3p + 1.',
 'practice', 'Medium',
 'Replace p with 4 and evaluate each term.',
 '4² = 16. 3×4 = 12. 16 − 12 + 1.',
 '16 − 12 + 1 = 5.',
 '5'),

('Q112', 'SKL028', 'Substitution with two variables',
 'If x = 2 and y = −3, find x² + y.',
 'practice', 'Medium',
 'Calculate x² first, then add y.',
 '2² = 4. 4 + (−3) = ?',
 '4 + (−3) = 1.',
 '1');

-- -------------------------------------------------------
-- SKL029: Expanding brackets
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q113', 'SKL029', 'Expanding a bracket',
 'Expand: 3(2x − 5)',
 'diagnostic', 'Easy',
 'Multiply the term outside the bracket by EACH term inside.',
 '3 × 2x = 6x. 3 × (−5) = −15.',
 '3(2x − 5) = 6x − 15.',
 '6x-15'),

('Q114', 'SKL029', 'Expanding and simplifying',
 'Expand and simplify: 2(x + 3) + 3(x − 1)',
 'practice', 'Medium',
 'Expand each bracket first, then collect like terms.',
 '2x + 6 + 3x − 3.',
 '2x + 3x = 5x. 6 − 3 = 3. Answer: 5x + 3.',
 '5x+3'),

('Q115', 'SKL029', 'Expanding with a negative',
 'Expand: −2(3x + 4)',
 'practice', 'Medium',
 'Multiply −2 by each term inside the bracket. Mind the signs.',
 '(−2)(3x) = −6x. (−2)(4) = −8.',
 '−2(3x + 4) = −6x − 8.',
 '-6x-8'),

('Q116', 'SKL029', 'Expanding two brackets',
 'Expand: (x + 3)(x + 2)',
 'practice', 'Hard',
 'Use FOIL: First, Outer, Inner, Last.',
 'x×x + x×2 + 3×x + 3×2 = x² + 2x + 3x + 6.',
 'x² + 5x + 6.',
 'x^2+5x+6');

-- -------------------------------------------------------
-- SKL030: Solving simple linear equations
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q117', 'SKL030', 'One-step equation',
 'Solve: 3x = 18',
 'diagnostic', 'Easy',
 'Divide both sides by 3 to isolate x.',
 '3x ÷ 3 = 18 ÷ 3.',
 'x = 6.',
 'x=6'),

('Q118', 'SKL030', 'Two-step equation',
 'Solve: 2x + 7 = 15',
 'practice', 'Easy',
 'First subtract 7 from both sides, then divide by 2.',
 '2x = 15 − 7 = 8. Then x = 8 ÷ 2.',
 'x = 4.',
 'x=4'),

('Q119', 'SKL030', 'Equation with variable on both sides',
 'Solve: 5x − 3 = 2x + 9',
 'practice', 'Medium',
 'Collect x terms on one side and numbers on the other.',
 '5x − 2x = 9 + 3. 3x = 12.',
 '3x = 12. x = 4.',
 'x=4'),

('Q120', 'SKL030', 'Forming and solving an equation',
 'A number doubled and then increased by 5 gives 21. Find the number.',
 'practice', 'Hard',
 'Let the number be x. Write the equation: 2x + 5 = 21.',
 '2x = 21 − 5 = 16. x = 8.',
 'x = 8.',
 'x=8');

-- -------------------------------------------------------
-- SKL031: Solving equations with brackets and fractions
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q121', 'SKL031', 'Equation with brackets',
 'Solve: 3(2x − 1) = 21',
 'diagnostic', 'Medium',
 'Expand the bracket first, then solve.',
 '6x − 3 = 21. Add 3 to both sides.',
 '6x = 24. x = 4.',
 'x=4'),

('Q122', 'SKL031', 'Equation with fraction',
 'Solve: x/3 = 7',
 'practice', 'Easy',
 'Multiply both sides by 3 to eliminate the fraction.',
 'x = 7 × 3.',
 'x = 21.',
 'x=21'),

('Q123', 'SKL031', 'Fractional equation',
 'Solve: (2x + 1)/3 = 5',
 'practice', 'Medium',
 'Multiply both sides by 3 first to clear the fraction.',
 '2x + 1 = 15. Subtract 1: 2x = 14.',
 'x = 7.',
 'x=7'),

('Q124', 'SKL031', 'Complex equation',
 'Solve: 2(x + 3) = 3(x − 1)',
 'practice', 'Hard',
 'Expand both brackets, then collect x terms.',
 '2x + 6 = 3x − 3. 6 + 3 = 3x − 2x.',
 '9 = x. So x = 9.',
 'x=9');

-- -------------------------------------------------------
-- SKL032: Types of angles
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q125', 'SKL032', 'Naming an angle',
 'What type of angle is 135°?',
 'diagnostic', 'Easy',
 'Acute: less than 90°. Right: exactly 90°. Obtuse: between 90° and 180°. Reflex: greater than 180°.',
 '135° is between 90° and 180°.',
 '135° is an obtuse angle.',
 'obtuse'),

('Q126', 'SKL032', 'Angle classification',
 'Classify an angle of 270°.',
 'practice', 'Easy',
 'A reflex angle is greater than 180° and less than 360°.',
 '270° > 180°.',
 '270° is a reflex angle.',
 'reflex'),

('Q127', 'SKL032', 'Right angle identification',
 'How many degrees are in a right angle?',
 'practice', 'Easy',
 'A right angle is shown by a small square in diagrams.',
 'The symbol □ in a corner means exactly this many degrees.',
 'A right angle is exactly 90°.',
 '90'),

('Q128', 'SKL032', 'Angle estimation',
 'An angle measures 47°. Is it acute, right, obtuse or reflex?',
 'practice', 'Easy',
 'An acute angle is less than 90°.',
 '47° < 90°.',
 '47° is an acute angle.',
 'acute');

-- -------------------------------------------------------
-- SKL033: Angles on a straight line and at a point
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q129', 'SKL033', 'Angles on a straight line',
 'Two angles on a straight line are 65° and x°. Find x.',
 'diagnostic', 'Easy',
 'Angles on a straight line add up to 180°.',
 '65 + x = 180.',
 'x = 180 − 65 = 115°.',
 '115'),

('Q130', 'SKL033', 'Angles at a point',
 'Three angles at a point are 90°, 120°, and y°. Find y.',
 'practice', 'Medium',
 'Angles at a point add up to 360°.',
 '90 + 120 + y = 360.',
 'y = 360 − 90 − 120 = 150°.',
 '150'),

('Q131', 'SKL033', 'Vertically opposite angles',
 'Two straight lines cross. One angle formed is 42°. What is the vertically opposite angle?',
 'practice', 'Easy',
 'Vertically opposite angles are equal.',
 'The angle directly across from 42° is equal to 42°.',
 'Vertically opposite angle = 42°.',
 '42'),

('Q132', 'SKL033', 'Finding multiple angles',
 'Angles on a straight line are in the ratio 2:3. Find both angles.',
 'practice', 'Hard',
 'Total = 180°. Split in ratio 2:3. Total parts = 5.',
 '1 part = 180÷5 = 36°. Angles = 2×36 and 3×36.',
 '72° and 108°.',
 '72 and 108');

-- -------------------------------------------------------
-- SKL034: Angles in triangles
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q133', 'SKL034', 'Missing angle in triangle',
 'A triangle has angles 55° and 72°. Find the third angle.',
 'diagnostic', 'Easy',
 'The sum of angles in a triangle is 180°.',
 '55 + 72 + third = 180.',
 'Third angle = 180 − 55 − 72 = 53°.',
 '53'),

('Q134', 'SKL034', 'Isosceles triangle angles',
 'An isosceles triangle has a base angle of 48°. Find the apex angle.',
 'practice', 'Medium',
 'An isosceles triangle has two equal base angles. The sum of all angles is 180°.',
 'Base angles: 48 + 48 = 96. Apex = 180 − 96.',
 'Apex = 180 − 96 = 84°.',
 '84'),

('Q135', 'SKL034', 'Equilateral triangle',
 'What is each angle in an equilateral triangle?',
 'practice', 'Easy',
 'An equilateral triangle has three equal angles that add up to 180°.',
 '180 ÷ 3 = ?',
 'Each angle = 60°.',
 '60'),

('Q136', 'SKL034', 'Exterior angle of triangle',
 'An exterior angle of a triangle is 110°. One of the non-adjacent interior angles is 45°. Find the other.',
 'practice', 'Hard',
 'The exterior angle equals the sum of the two non-adjacent interior angles.',
 '110 = 45 + other angle.',
 'Other angle = 110 − 45 = 65°.',
 '65');

-- -------------------------------------------------------
-- SKL035: Types of triangles and quadrilaterals
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q137', 'SKL035', 'Identifying a quadrilateral',
 'A quadrilateral has all sides equal and all angles equal. What is it called?',
 'diagnostic', 'Easy',
 'Which quadrilateral has all sides equal AND all right angles?',
 'Equal sides + equal angles (90°) = ?',
 'A quadrilateral with all sides equal and all angles 90° is a square.',
 'square'),

('Q138', 'SKL035', 'Properties of a rhombus',
 'Does a rhombus have equal sides? Write yes or no.',
 'practice', 'Easy',
 'A rhombus is a special parallelogram.',
 'All four sides of a rhombus are equal.',
 'Yes, a rhombus has all four sides equal.',
 'yes'),

('Q139', 'SKL035', 'Scalene triangle',
 'A triangle with sides 3cm, 5cm and 7cm is what type of triangle?',
 'practice', 'Easy',
 'Scalene: all sides different. Isosceles: two sides equal. Equilateral: all equal.',
 '3 ≠ 5 ≠ 7. All sides are different.',
 'All sides are different, so it is a scalene triangle.',
 'scalene'),

('Q140', 'SKL035', 'Angles of a parallelogram',
 'A parallelogram has one angle of 65°. What are the other three angles?',
 'practice', 'Hard',
 'In a parallelogram, opposite angles are equal and co-interior angles add up to 180°.',
 'Adjacent angle = 180 − 65 = 115°. Opposite angles are equal.',
 'Angles: 65°, 115°, 65°, 115°.',
 '65,115,65,115');

-- -------------------------------------------------------
-- SKL036: Interior angles of polygons
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q141', 'SKL036', 'Sum of interior angles',
 'What is the sum of interior angles of a hexagon?',
 'diagnostic', 'Medium',
 'Formula: Sum of interior angles = (n − 2) × 180°, where n is the number of sides.',
 'A hexagon has 6 sides. (6 − 2) × 180.',
 '(6 − 2) × 180 = 4 × 180 = 720°.',
 '720'),

('Q142', 'SKL036', 'Interior angle of regular polygon',
 'What is each interior angle of a regular pentagon?',
 'practice', 'Medium',
 'Sum of interior angles = (5−2) × 180 = 540°. Divide by number of angles.',
 '540 ÷ 5 = ?',
 '540 ÷ 5 = 108°.',
 '108'),

('Q143', 'SKL036', 'Sum of angles in a quadrilateral',
 'What is the sum of interior angles of any quadrilateral?',
 'practice', 'Easy',
 'Use the formula (n − 2) × 180 with n = 4.',
 '(4 − 2) × 180 = 2 × 180.',
 '2 × 180 = 360°.',
 '360'),

('Q144', 'SKL036', 'Identifying the polygon from its angle sum',
 'A polygon has an interior angle sum of 1080°. How many sides does it have?',
 'practice', 'Hard',
 '(n − 2) × 180 = 1080. Solve for n.',
 'n − 2 = 1080 ÷ 180 = 6. So n = 8.',
 'n = 6 + 2 = 8 sides. It is an octagon.',
 '8');

-- -------------------------------------------------------
-- SKL037: Perimeter of rectangles, squares and triangles
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q145', 'SKL037', 'Perimeter of a rectangle',
 'A rectangle is 8cm long and 5cm wide. What is its perimeter?',
 'diagnostic', 'Easy',
 'Perimeter of a rectangle = 2(length + width).',
 '2(8 + 5) = 2 × 13.',
 '2 × 13 = 26cm.',
 '26'),

('Q146', 'SKL037', 'Perimeter of a square',
 'A square has side 9cm. What is its perimeter?',
 'practice', 'Easy',
 'Perimeter of a square = 4 × side.',
 '4 × 9 = ?',
 '4 × 9 = 36cm.',
 '36'),

('Q147', 'SKL037', 'Perimeter of a triangle',
 'A triangle has sides 7cm, 9cm and 11cm. Find its perimeter.',
 'practice', 'Easy',
 'Perimeter = sum of all sides.',
 '7 + 9 + 11 = ?',
 '7 + 9 + 11 = 27cm.',
 '27'),

('Q148', 'SKL037', 'Finding side from perimeter',
 'A rectangle has a perimeter of 36cm and a length of 11cm. Find the width.',
 'practice', 'Medium',
 'P = 2(l + w). Substitute and solve.',
 '36 = 2(11 + w). 18 = 11 + w.',
 'w = 18 − 11 = 7cm.',
 '7');

-- -------------------------------------------------------
-- SKL038: Area of rectangles and squares
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q149', 'SKL038', 'Area of a rectangle',
 'Find the area of a rectangle 12cm long and 7cm wide.',
 'diagnostic', 'Easy',
 'Area = length × width.',
 '12 × 7 = ?',
 '12 × 7 = 84cm².',
 '84'),

('Q150', 'SKL038', 'Area of a square',
 'A square has a side of 6cm. What is its area?',
 'practice', 'Easy',
 'Area of a square = side².',
 '6² = ?',
 '6² = 36cm².',
 '36'),

('Q151', 'SKL038', 'Finding side from area',
 'A square has an area of 49cm². What is its side length?',
 'practice', 'Medium',
 'Area = side². Find the square root of the area.',
 '√49 = ?',
 '√49 = 7cm.',
 '7'),

('Q152', 'SKL038', 'Composite area',
 'An L-shaped figure is made from two rectangles: one 6×4cm and one 3×2cm. What is the total area?',
 'practice', 'Hard',
 'Find the area of each rectangle and add them.',
 '6×4 = 24cm². 3×2 = 6cm². Total = ?',
 '24 + 6 = 30cm².',
 '30');

-- -------------------------------------------------------
-- SKL039: Area of triangles and parallelograms
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q153', 'SKL039', 'Area of a triangle',
 'A triangle has a base of 10cm and a height of 6cm. Find its area.',
 'diagnostic', 'Easy',
 'Area of triangle = ½ × base × height.',
 '½ × 10 × 6 = ?',
 '½ × 10 × 6 = 30cm².',
 '30'),

('Q154', 'SKL039', 'Area of a parallelogram',
 'A parallelogram has a base of 9cm and a perpendicular height of 5cm. Find the area.',
 'practice', 'Easy',
 'Area of parallelogram = base × height.',
 '9 × 5 = ?',
 '9 × 5 = 45cm².',
 '45'),

('Q155', 'SKL039', 'Finding height from area',
 'A triangle has an area of 40cm² and a base of 8cm. Find the height.',
 'practice', 'Medium',
 'Area = ½ × base × height. Rearrange to find height.',
 '40 = ½ × 8 × h. 40 = 4h.',
 'h = 40 ÷ 4 = 10cm.',
 '10'),

('Q156', 'SKL039', 'Composite shape area',
 'A shape is a rectangle 8×6cm with a triangle cut from one end (base 4cm, height 3cm). Find the remaining area.',
 'practice', 'Hard',
 'Area of rectangle − Area of triangle.',
 '8×6 = 48. ½×4×3 = 6. 48 − 6 = ?',
 '48 − 6 = 42cm².',
 '42');

-- -------------------------------------------------------
-- SKL040: Circumference and area of a circle
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q157', 'SKL040', 'Circumference of a circle',
 'Find the circumference of a circle with radius 7cm. (Use π = 22/7)',
 'diagnostic', 'Medium',
 'Circumference = 2πr.',
 '2 × 22/7 × 7 = ?',
 '2 × 22/7 × 7 = 2 × 22 = 44cm.',
 '44'),

('Q158', 'SKL040', 'Area of a circle',
 'Find the area of a circle with radius 5cm. (Use π = 3.14)',
 'practice', 'Medium',
 'Area = πr².',
 '3.14 × 5² = 3.14 × 25.',
 '3.14 × 25 = 78.5cm².',
 '78.5'),

('Q159', 'SKL040', 'Diameter to circumference',
 'A circle has a diameter of 14cm. Find its circumference. (Use π = 22/7)',
 'practice', 'Medium',
 'Circumference = πd. Or find radius first: r = d/2.',
 '22/7 × 14 = ?',
 '22/7 × 14 = 22 × 2 = 44cm.',
 '44'),

('Q160', 'SKL040', 'Finding radius from area',
 'A circle has an area of 154cm². Find its radius. (Use π = 22/7)',
 'practice', 'Hard',
 'A = πr². Rearrange: r² = A/π.',
 'r² = 154 ÷ (22/7) = 154 × 7/22 = 49.',
 'r² = 49. r = 7cm.',
 '7');

-- -------------------------------------------------------
-- SKL041: Data collection and frequency tables
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q161', 'SKL041', 'Reading a frequency table',
 'A frequency table shows: Score 1: freq 3, Score 2: freq 7, Score 3: freq 5. What is the total frequency?',
 'diagnostic', 'Easy',
 'Total frequency = sum of all frequencies.',
 '3 + 7 + 5 = ?',
 '3 + 7 + 5 = 15.',
 '15'),

('Q162', 'SKL041', 'Constructing a tally',
 'How many tally marks represent the number 7?',
 'practice', 'Easy',
 'Every 5th tally is a diagonal across 4 upright marks (a gate). Count groups of 5 plus any extras.',
 '5 + 2 = 7. One gate (5) plus 2 extra marks.',
 '7 is represented by one group of 5 (one gate) and 2 extra tallies.',
 '1 gate and 2'),

('Q163', 'SKL041', 'Finding a frequency',
 'In a survey, the number of learners who chose each colour: Red=8, Blue=12, Green=5, Yellow=7. What fraction chose Blue?',
 'practice', 'Medium',
 'Fraction = frequency of Blue ÷ total frequency.',
 'Total = 8+12+5+7 = 32. Fraction = 12/32.',
 '12/32 = 3/8.',
 '3/8'),

('Q164', 'SKL041', 'Grouped frequency',
 'Data: 12, 15, 18, 21, 14, 17, 20, 16, 19, 13. How many values fall in the class 15−19?',
 'practice', 'Hard',
 'Count values from 15 to 19 inclusive.',
 'Values in 15−19: 15, 18, 17, 16, 19. Count them.',
 '15, 16, 17, 18, 19 → that is 5 values.',
 '5');

-- -------------------------------------------------------
-- SKL042: Mean, median and mode
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q165', 'SKL042', 'Calculating the mean',
 'Find the mean of: 6, 9, 4, 11, 10.',
 'diagnostic', 'Easy',
 'Mean = sum of all values ÷ number of values.',
 '6+9+4+11+10 = 40. Divide by 5.',
 '40 ÷ 5 = 8.',
 '8'),

('Q166', 'SKL042', 'Finding the median',
 'Find the median of: 3, 7, 1, 9, 5.',
 'practice', 'Medium',
 'Arrange in order first, then find the middle value.',
 'Ordered: 1, 3, 5, 7, 9. Middle value is the 3rd.',
 'Ordered: 1, 3, 5, 7, 9. Median = 5.',
 '5'),

('Q167', 'SKL042', 'Finding the mode',
 'What is the mode of: 4, 7, 4, 9, 3, 7, 4?',
 'practice', 'Easy',
 'The mode is the value that appears most often.',
 'Count occurrences: 4 appears 3 times, 7 appears 2 times, others appear once.',
 'Mode = 4 (appears 3 times).',
 '4'),

('Q168', 'SKL042', 'Mean from frequency table',
 'Scores: 2 (freq 3), 4 (freq 5), 6 (freq 2). Find the mean.',
 'practice', 'Hard',
 'Mean = (Σfx) ÷ (Σf). Multiply each score by its frequency first.',
 '(2×3)+(4×5)+(6×2) = 6+20+12 = 38. Total freq = 3+5+2 = 10.',
 '38 ÷ 10 = 3.8.',
 '3.8');

-- -------------------------------------------------------
-- SKL043: Bar charts and pictograms
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q169', 'SKL043', 'Reading a bar chart',
 'A bar chart shows monthly sales. January bar reaches 40, February reaches 55, March reaches 35. What is the total sales for these three months?',
 'diagnostic', 'Easy',
 'Add the values shown by each bar.',
 '40 + 55 + 35 = ?',
 '40 + 55 + 35 = 130.',
 '130'),

('Q170', 'SKL043', 'Pictogram key',
 'A pictogram uses 1 symbol to represent 4 students. If 3 symbols are shown, how many students does that represent?',
 'practice', 'Easy',
 'Multiply number of symbols by the key value.',
 '3 × 4 = ?',
 '3 × 4 = 12 students.',
 '12'),

('Q171', 'SKL043', 'Half symbol in pictogram',
 'A pictogram key shows 1 symbol = 10 items. A row shows 3 and a half symbols. How many items are shown?',
 'practice', 'Medium',
 'A half symbol represents half the key value.',
 '3 whole = 30. Half symbol = 5. Total = 35.',
 '3.5 × 10 = 35.',
 '35'),

('Q172', 'SKL043', 'Drawing a bar chart — scale',
 'You have data with a maximum value of 75 and want to draw a bar chart. What is a suitable scale for the y-axis if you use intervals of 10?',
 'practice', 'Medium',
 'The scale must go at least as high as the largest value.',
 'Round 75 up to the next multiple of 10.',
 'A suitable scale goes from 0 to 80 (in steps of 10).',
 '0 to 80');

-- -------------------------------------------------------
-- SKL044: Pie charts
-- -------------------------------------------------------
INSERT INTO questions (question_id, skill_id, question_title, question_text, question_type, difficulty_level, hint_1, hint_2, explanation, correct_option) VALUES
('Q173', 'SKL044', 'Angle in a pie chart',
 'In a survey of 60 people, 15 prefer tea. What angle represents tea in a pie chart?',
 'diagnostic', 'Medium',
 'Angle = (frequency ÷ total) × 360°.',
 '(15 ÷ 60) × 360.',
 '15/60 × 360 = 0.25 × 360 = 90°.',
 '90'),

('Q174', 'SKL044', 'Reading a pie chart',
 'A pie chart has a sector of 120°. The total represented is 360 items. How many items does this sector represent?',
 'practice', 'Medium',
 'Items = (angle ÷ 360°) × total.',
 '(120/360) × 360 = ?',
 '(120/360) × 360 = 120 items.',
 '120'),

('Q175', 'SKL044', 'Pie chart angle calculation',
 '50 students were asked their favourite subject. 20 said Maths. What angle represents Maths in a pie chart?',
 'practice', 'Medium',
 'Angle = (20/50) × 360.',
 '20/50 = 0.4. 0.4 × 360.',
 '0.4 × 360 = 144°.',
 '144'),

('Q176', 'SKL044', 'Total from angle',
 'In a pie chart, a sector for Science is 72°. There are 200 students in total. How many chose Science?',
 'practice', 'Hard',
 'Number = (angle ÷ 360) × total.',
 '(72/360) × 200 = 0.2 × 200.',
 '0.2 × 200 = 40 students.',
 '40');


-- ============================================================
-- READING MATERIALS  (2 per skill — concept note + worked example)
-- ============================================================

-- SKL001
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM001', 'SKL001', 'What is a Set?', 'note',
'A SET is a well-defined collection of distinct objects called ELEMENTS or MEMBERS.

Ways to describe a set:
1. ROSTER/LISTING notation: List all elements in curly brackets.
   Example: A = {1, 2, 3, 4, 5}

2. SET BUILDER notation: Describe the rule for membership.
   Example: A = {x : x is a natural number less than 6}

Important symbols:
• ∈ means "is an element of"   Example: 3 ∈ {1,2,3}
• ∉ means "is not an element of"   Example: 4 ∉ {1,2,3}
• n(A) means the number of elements in A (cardinality)

ZIMSEC tip: Always use curly braces { } when writing sets.',
'Easy'),

('RM002', 'SKL001', 'Sets: Worked Examples', 'worked_example',
'EXAMPLE 1: List the elements of B = {x : x is a factor of 24}
Step 1: Find all factors of 24: 1×24, 2×12, 3×8, 4×6
Step 2: B = {1, 2, 3, 4, 6, 8, 12, 24}
Step 3: n(B) = 8

EXAMPLE 2: Write {2, 4, 6, 8, 10} in set builder notation.
Answer: {x : x is a positive even number, x ≤ 10}

EXAMPLE 3: If C = {vowels in the English alphabet}
C = {a, e, i, o, u}, n(C) = 5

Practice: Write the set of multiples of 5 less than 30 in roster notation.',
'Medium');

-- SKL002
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM003', 'SKL002', 'Types of Sets', 'note',
'TYPES OF SETS you must know for ZIMSEC:

1. EMPTY SET (Null Set): Has no elements. Written as {} or ∅
   Example: {x : x is a whole number between 1 and 2} = ∅

2. FINITE SET: Has a countable number of elements
   Example: {months of the year} — 12 elements

3. INFINITE SET: Elements go on forever
   Example: {even numbers} = {2, 4, 6, 8, ...}

4. EQUAL SETS: Same elements (order does not matter)
   A = {1,2,3} and B = {3,1,2} → A = B

5. EQUIVALENT SETS: Same NUMBER of elements (not necessarily the same elements)
   A = {1,2,3} and B = {a,b,c} → equivalent (both have 3 elements)

6. SUBSET: A ⊆ B means every element of A is in B
   {2,4} ⊆ {1,2,3,4,5}

7. UNIVERSAL SET (U): Contains all elements under consideration',
'Easy'),

('RM004', 'SKL002', 'Types of Sets: Worked Examples', 'worked_example',
'EXAMPLE 1: State the type of set: D = {x : x² = −4, x is real}
No real number squared gives −4, so D = ∅ (empty set)

EXAMPLE 2: Are A = {a,b,c,d} and B = {1,2,3,4} equal or equivalent?
They have the same number of elements (4 each) but different elements.
Answer: EQUIVALENT but not equal.

EXAMPLE 3: List all subsets of {p, q}
Subsets: {}, {p}, {q}, {p,q} — there are 4 subsets.
Rule: A set with n elements has 2ⁿ subsets.

Practice: How many subsets does {1,2,3} have?',
'Medium');

-- SKL003
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM005', 'SKL003', 'Set Operations', 'note',
'KEY SET OPERATIONS:

UNION (A ∪ B): All elements in A OR B (or both). No repetition.
Example: A={1,3,5}, B={3,5,7} → A∪B = {1,3,5,7}

INTERSECTION (A ∩ B): Only elements in BOTH A and B.
Example: A={1,3,5}, B={3,5,7} → A∩B = {3,5}

COMPLEMENT (A''): Elements in the Universal set U but NOT in A.
Example: U={1,2,3,4,5}, A={1,3,5} → A'' = {2,4}

IMPORTANT RULES:
• A ∪ ∅ = A
• A ∩ ∅ = ∅
• A ∪ A'' = U
• A ∩ A'' = ∅
• n(A∪B) = n(A) + n(B) − n(A∩B)   ← Very important formula!',
'Medium'),

('RM006', 'SKL003', 'Set Operations: Worked Examples', 'worked_example',
'EXAMPLE: U = {1,2,3,4,5,6,7,8}, A = {1,2,4,8}, B = {2,4,6,8}

Find: (a) A∪B  (b) A∩B  (c) A''  (d) n(A∪B)

(a) A∪B = {1,2,4,6,8} — combine all, no repeats
(b) A∩B = {2,4,8} — elements in both
(c) A'' = {3,5,6,7} — elements of U not in A
(d) n(A∪B) = n(A) + n(B) − n(A∩B) = 4 + 4 − 3 = 5 ✓

VERIFICATION: A∪B = {1,2,4,6,8} has 5 elements ✓',
'Medium');

-- SKL004
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM007', 'SKL004', 'Venn Diagrams with Two Sets', 'note',
'A VENN DIAGRAM uses overlapping circles inside a rectangle (universal set U).

For TWO SETS A and B:
• Left region (A only): elements in A but not B
• Middle region (A∩B): elements in BOTH A and B
• Right region (B only): elements in B but not A
• Outside both circles: elements in neither A nor B

KEY FORMULA: n(A∪B) = n(A) + n(B) − n(A∩B)

REARRANGEMENTS:
• n(A∩B) = n(A) + n(B) − n(A∪B)
• Neither = n(U) − n(A∪B)

ZIMSEC EXAM TIP: Always fill in the CENTRE region (A∩B) first when drawing Venn diagrams!',
'Medium'),

('RM008', 'SKL004', 'Venn Diagrams: Worked Example', 'worked_example',
'EXAMPLE: In a class of 40 learners, 24 study French, 18 study Spanish, and 10 study both.

Step 1: Both French AND Spanish = 10 (centre)
Step 2: French ONLY = 24 − 10 = 14
Step 3: Spanish ONLY = 18 − 10 = 8
Step 4: Neither = 40 − (14 + 10 + 8) = 40 − 32 = 8

Draw: Rectangle with two circles.
Left circle (French only): 14
Centre (both): 10
Right circle (Spanish only): 8
Outside: 8

CHECK: 14 + 10 + 8 + 8 = 40 ✓',
'Medium');

-- SKL005
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM009', 'SKL005', 'Venn Diagrams with Three Sets', 'note',
'THREE-SET VENN DIAGRAMS have 7 regions inside the rectangle:
1. A only
2. B only
3. C only
4. A∩B only (not C)
5. A∩C only (not B)
6. B∩C only (not A)
7. A∩B∩C (centre — all three)

FILLING ORDER (always do this):
1. Start with A∩B∩C (centre)
2. Fill each pair intersection (subtract centre)
3. Fill each individual set region (subtract all overlaps)
4. Check total equals n(U)

FORMULA:
n(A∪B∪C) = n(A)+n(B)+n(C) − n(A∩B) − n(A∩C) − n(B∩C) + n(A∩B∩C)',
'Hard'),

('RM010', 'SKL005', 'Three-Set Venn: Worked Example', 'worked_example',
'EXAMPLE: 60 students, n(M)=35, n(E)=30, n(S)=25, n(M∩E)=12, n(M∩S)=10, n(E∩S)=8, n(M∩E∩S)=5

Step 1: Centre (all 3) = 5
Step 2: M∩E only = 12−5 = 7
Step 3: M∩S only = 10−5 = 5
Step 4: E∩S only = 8−5 = 3
Step 5: M only = 35−7−5−5 = 18
Step 6: E only = 30−7−3−5 = 15
Step 7: S only = 25−5−3−5 = 12
Step 8: Neither = 60−(18+7+5+15+3+5+12) = 60−65 = −5

If you get a negative number, recheck your original data!',
'Hard');

-- SKL006
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM011', 'SKL006', 'Types of Numbers', 'note',
'NUMBER SETS (from smallest to largest group):

NATURAL NUMBERS (N): Counting numbers → {1, 2, 3, 4, ...}
• Used for counting objects
• Does NOT include zero or negative numbers

WHOLE NUMBERS (W): Natural numbers plus zero → {0, 1, 2, 3, ...}

INTEGERS (Z): All whole numbers including negatives → {..., −3, −2, −1, 0, 1, 2, 3, ...}
• Z comes from the German word "Zahlen" meaning numbers

RATIONAL NUMBERS (Q): Can be written as p/q where p and q are integers, q≠0
• Includes all fractions, decimals that terminate or recur
• Example: 3/4, 0.5, −2, 1.333...

REMEMBER: Every natural number is also a whole number.
Every whole number is also an integer.
Every integer is also a rational number.',
'Easy'),

('RM012', 'SKL006', 'Number Classification: Examples', 'worked_example',
'Classify each number: −5, 0, 3, 2/3, √4, π

−5: Negative → Integer, Rational. NOT natural or whole.
0: Zero → Whole number, Integer, Rational. NOT natural.
3: Positive → Natural, Whole, Integer, Rational.
2/3: Fraction → Rational only.
√4 = 2: Same as 3 above.
π = 3.14159...: Never-ending non-repeating decimal → Irrational (NOT rational)

ZIMSEC EXAM PRACTICE:
"Write down two integers that are NOT natural numbers."
Answer: Any two negatives, e.g., −1 and −7. OR zero (0).',
'Easy');

-- SKL007-SKL010 (shorter versions for space)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM013', 'SKL007', 'The Number Line and Ordering', 'note',
'THE NUMBER LINE runs infinitely in both directions.
← −5  −4  −3  −2  −1  0  1  2  3  4  5 →

KEY RULES:
• Numbers to the RIGHT are GREATER
• Numbers to the LEFT are SMALLER
• Negative numbers are always less than positive numbers
• −1 > −100 (−1 is to the right of −100)

ASCENDING ORDER: smallest to largest (left to right on number line)
DESCENDING ORDER: largest to smallest (right to left)

DISTANCE between two numbers = larger − smaller
Example: Distance from −3 to 5 = 5 − (−3) = 5 + 3 = 8',
'Easy'),

('RM014', 'SKL007', 'Number Line: Worked Examples', 'worked_example',
'EXAMPLE 1: Arrange in ascending order: 2, −5, 0, −1, 3
Step 1: Identify negatives (furthest left): −5, −1
Step 2: Then 0, then positives: 2, 3
Answer: −5, −1, 0, 2, 3

EXAMPLE 2: Find the distance between −6 and 4.
Distance = 4 − (−6) = 4 + 6 = 10

EXAMPLE 3: What number is 3 to the left of −2?
−2 − 3 = −5

EXAMPLE 4: What number is halfway between −4 and 6?
Halfway = (−4 + 6) ÷ 2 = 2 ÷ 2 = 1',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM015', 'SKL008', 'Fractions: Types and Conversion', 'note',
'TYPES OF FRACTIONS:
• PROPER fraction: numerator < denominator. Example: 3/5
• IMPROPER fraction: numerator ≥ denominator. Example: 7/4
• MIXED NUMBER: whole number + proper fraction. Example: 1 and 3/4

CONVERTING:
Improper → Mixed: Divide numerator by denominator
Example: 11/3 = 3 remainder 2 = 3 and 2/3

Mixed → Improper: (Whole × denominator) + numerator, keep denominator
Example: 2 and 3/4 = (2×4+3)/4 = 11/4

COMPARING FRACTIONS:
To compare, use a common denominator.
Example: Compare 2/3 and 3/5
→ 10/15 vs 9/15 → 2/3 is larger',
'Easy'),

('RM016', 'SKL008', 'Fractions: Worked Examples', 'worked_example',
'EXAMPLE 1: Convert 23/6 to a mixed number.
23 ÷ 6 = 3 remainder 5. Answer: 3 and 5/6.

EXAMPLE 2: Convert 4 and 2/7 to an improper fraction.
(4 × 7 + 2)/7 = (28+2)/7 = 30/7.

EXAMPLE 3: Arrange 1/2, 2/3, 3/8 from smallest to largest.
LCM of 2, 3, 8 = 24.
1/2 = 12/24, 2/3 = 16/24, 3/8 = 9/24.
Order: 9/24 < 12/24 < 16/24 → 3/8, 1/2, 2/3.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM017', 'SKL009', 'Decimals and Place Value', 'note',
'PLACE VALUE TABLE:
Hundreds | Tens | Ones | . | Tenths | Hundredths | Thousandths
   2       4      7    .    3          5              8
= 247.358

READING DECIMALS:
0.3 = 3 tenths, 0.03 = 3 hundredths, 0.003 = 3 thousandths

ROUNDING RULES:
• Look at the digit AFTER the rounding position
• If it is 5 or more: round UP
• If it is less than 5: round DOWN (keep as is)

ORDERING DECIMALS:
Write all to the same number of decimal places, then compare digit by digit.
0.4, 0.35, 0.409 → 0.400, 0.350, 0.409 → Order: 0.35 < 0.4 < 0.409',
'Easy'),

('RM018', 'SKL009', 'Decimals: Worked Examples', 'worked_example',
'EXAMPLE 1: Round 8.3746 to 2 decimal places.
Look at 3rd decimal: 4 < 5, so round down.
Answer: 8.37

EXAMPLE 2: Convert 0.35 to a fraction.
0.35 = 35/100 = 7/20

EXAMPLE 3: Convert 3/8 to a decimal.
3 ÷ 8 = 0.375

EXAMPLE 4: Order 0.72, 0.7, 0.702 from largest to smallest.
Make equal d.p.: 0.720, 0.700, 0.702
Descending: 0.720 > 0.702 > 0.700
Answer: 0.72, 0.702, 0.7',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM019', 'SKL010', 'Number Bases: Binary and Denary', 'note',
'BASE 10 (Denary): Uses digits 0−9. Place values are powers of 10.
Example: 347 = 3×100 + 4×10 + 7×1

BASE 2 (Binary): Uses only 0 and 1. Place values are powers of 2.
Place values (right to left): 1, 2, 4, 8, 16, 32, ...

BINARY → DENARY:
Write down place values, multiply each digit, add up.
Example: 1101₂ = 1×8 + 1×4 + 0×2 + 1×1 = 8+4+0+1 = 13₁₀

DENARY → BINARY:
Divide repeatedly by 2, record remainders, read upwards.
Example: 10₁₀
10÷2 = 5 r0
5÷2 = 2 r1
2÷2 = 1 r0
1÷2 = 0 r1
Read remainders upward: 1010₂',
'Medium'),

('RM020', 'SKL010', 'Number Bases: Worked Examples', 'worked_example',
'CONVERT 25₁₀ to base 2:
25÷2=12 r1, 12÷2=6 r0, 6÷2=3 r0, 3÷2=1 r1, 1÷2=0 r1
Read upward: 11001₂
CHECK: 16+8+0+0+1 = 25 ✓

CONVERT 10110₂ to denary:
1×16 + 0×8 + 1×4 + 1×2 + 0×1 = 16+0+4+2+0 = 22₁₀

ADD in binary: 1101 + 1011
  1101
+ 1011
------
Right: 1+1=10, write 0 carry 1
Next: 0+1+1=10, write 0 carry 1
Next: 1+0+1=10, write 0 carry 1
Next: 1+1+1=11, write 1 carry 1
Result: 11000₂ = 24₁₀ ✓ (13+11=24)',
'Hard');

-- SKL011-SKL014 (Squares, Cubes)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM021', 'SKL011', 'Square Numbers', 'note',
'A SQUARE NUMBER is found by multiplying a whole number by itself.
n² = n × n

PERFECT SQUARES to memorise:
1²=1, 2²=4, 3²=9, 4²=16, 5²=25, 6²=36, 7²=49, 8²=64, 9²=81, 10²=100,
11²=121, 12²=144, 13²=169, 14²=196, 15²=225

SQUARING FRACTIONS: (a/b)² = a²/b²
Example: (3/4)² = 9/16

SQUARING DECIMALS: Multiply the decimal by itself
Example: 0.3² = 0.09 (note: less than 0.3)

ZIMSEC TIP: Learn the first 15 perfect squares by heart!',
'Easy'),

('RM022', 'SKL011', 'Squares: Worked Examples', 'worked_example',
'EXAMPLE 1: Find 17²
Method 1: 17×17 = 17×10 + 17×7 = 170 + 119 = 289
Method 2: (20−3)² = 400 − 120 + 9 = 289

EXAMPLE 2: Is 196 a perfect square?
√196 = 14 (since 14×14=196). YES.

EXAMPLE 3: Between which two consecutive perfect squares does 50 lie?
7²=49 and 8²=64. So 49 < 50 < 64. 50 lies between 7² and 8².

EXAMPLE 4: Find (1.2)²
1.2 × 1.2 = 1.44',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM023', 'SKL012', 'Square Roots', 'note',
'The SQUARE ROOT of a number n is the value that when multiplied by itself gives n.
Written: √n

KEY SQUARE ROOTS to know:
√1=1, √4=2, √9=3, √16=4, √25=5, √36=6, √49=7, √64=8, √81=9, √100=10,
√121=11, √144=12, √169=13, √196=14, √225=15

PROPERTIES:
√(a×b) = √a × √b
√(a/b) = √a / √b
√(a²) = a (for positive a)

ESTIMATING: If n is not a perfect square, find the two perfect squares it lies between.
Example: √75: 8²=64 < 75 < 81=9², so 8 < √75 < 9',
'Easy'),

('RM024', 'SKL012', 'Square Roots: Worked Examples', 'worked_example',
'EXAMPLE 1: Find √(49/64)
√49/√64 = 7/8

EXAMPLE 2: Solve x² = 100
x = ±√100 = ±10 (positive solution: x = 10)

EXAMPLE 3: Simplify √48
√48 = √(16×3) = √16 × √3 = 4√3

EXAMPLE 4: Between which two integers does √130 lie?
11²=121 < 130 < 144=12²
So 11 < √130 < 12',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM025', 'SKL013', 'Cube Numbers', 'note',
'A CUBE NUMBER is found by multiplying a number by itself three times.
n³ = n × n × n

PERFECT CUBES to memorise:
1³=1, 2³=8, 3³=27, 4³=64, 5³=125, 6³=216, 7³=343, 8³=512, 9³=729, 10³=1000

SIGN RULES for cubing:
• Positive cubed = positive: 3³ = 27
• Negative cubed = negative: (−3)³ = −27
(An odd power keeps the sign of the base)

CUBING FRACTIONS:
(a/b)³ = a³/b³
Example: (2/3)³ = 8/27',
'Easy'),

('RM026', 'SKL013', 'Cubes: Worked Examples', 'worked_example',
'EXAMPLE 1: Find (−4)³
(−4)³ = −4 × −4 × −4 = 16 × (−4) = −64

EXAMPLE 2: Evaluate 2³ + 3³
2³ = 8, 3³ = 27. Answer: 35.

EXAMPLE 3: Is 512 a perfect cube?
∛512 = 8 (since 8³=512). YES.

EXAMPLE 4: Find (1/2)³
(1/2)³ = 1/8',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM027', 'SKL014', 'Cube Roots', 'note',
'The CUBE ROOT of n is the number that when cubed gives n. Written: ∛n

KEY CUBE ROOTS:
∛1=1, ∛8=2, ∛27=3, ∛64=4, ∛125=5, ∛216=6, ∛343=7, ∛512=8, ∛1000=10

CUBE ROOT OF NEGATIVE NUMBERS:
∛(−27) = −3 (since (−3)³ = −27)

CUBE ROOT OF FRACTIONS:
∛(a/b) = ∛a / ∛b
Example: ∛(8/27) = 2/3',
'Easy'),

('RM028', 'SKL014', 'Cube Roots: Worked Examples', 'worked_example',
'EXAMPLE 1: Find ∛(−125)
We need a number n such that n³ = −125.
(−5)³ = −125. So ∛(−125) = −5.

EXAMPLE 2: Solve y³ = 64
y = ∛64 = 4

EXAMPLE 3: Evaluate ∛8 + ∛27
2 + 3 = 5

EXAMPLE 4: Find ∛(27/1000)
∛27/∛1000 = 3/10',
'Easy');

-- SKL015-SKL017 (Directed Numbers)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM029', 'SKL015', 'Directed Numbers in Real Life', 'note',
'DIRECTED NUMBERS have both size and direction (positive or negative).

REAL-LIFE EXAMPLES:
• Temperature: −5°C means 5 degrees BELOW zero
• Altitude: −200m means 200m BELOW sea level
• Banking: −$50 means $50 overdrawn (debt)
• Floors: −2 means 2 floors underground

THE NUMBER LINE:
Negative ← −5  −4  −3  −2  −1  0  1  2  3  4  5 → Positive

ABSOLUTE VALUE (|n|): The distance from zero, always positive.
|−7| = 7,  |+7| = 7,  |0| = 0

OPPOSITE: The opposite of n is −n.
Opposite of −8 is +8. Opposite of 3 is −3.',
'Easy'),

('RM030', 'SKL015', 'Directed Numbers: Introduction Examples', 'worked_example',
'EXAMPLE 1: Write as directed numbers:
(a) 200m above sea level → +200 or 200
(b) 50m below sea level → −50
(c) A profit of $30 → +30
(d) A loss of $15 → −15

EXAMPLE 2: Find the difference in altitude between a mountain at 1850m and a valley at −120m.
Difference = 1850 − (−120) = 1850 + 120 = 1970m

EXAMPLE 3: Compare −3 and −8. Which is greater?
On the number line, −3 is to the right of −8.
So −3 > −8.',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM031', 'SKL016', 'Adding and Subtracting Directed Numbers', 'note',
'RULES FOR ADDITION:
• Positive + Positive = Positive: 4 + 3 = 7
• Negative + Negative = Negative: (−4) + (−3) = −7
• Different signs: Subtract, keep sign of larger absolute value.
  (−7) + 4 = −3 (7 is larger, so negative)
  7 + (−4) = 3 (7 is larger, so positive)

RULES FOR SUBTRACTION:
SUBTRACTING is the same as ADDING THE OPPOSITE.
a − b = a + (−b)
a − (−b) = a + b

Examples:
5 − 8 = 5 + (−8) = −3
5 − (−3) = 5 + 3 = 8
(−4) − (−6) = (−4) + 6 = 2',
'Medium'),

('RM032', 'SKL016', 'Directed Number Operations: Examples', 'worked_example',
'EXAMPLE 1: (−9) + 5
|−9| > |5|, so answer is negative.
(−9) + 5 = −4

EXAMPLE 2: (−3) − (−8)
= (−3) + 8 = 5

EXAMPLE 3: 4 − 11 + (−3) − (−5)
= 4 − 11 − 3 + 5
= (4 + 5) − (11 + 3)
= 9 − 14 = −5

EXAMPLE 4: Temperature fell from 6°C to −4°C. What was the change?
Change = −4 − 6 = −10°C (fell by 10°C)',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM033', 'SKL017', 'Multiplying and Dividing Directed Numbers', 'note',
'SIGN RULES — memorise these:

MULTIPLICATION & DIVISION:
(+) × (+) = (+)    Example: 4 × 3 = 12
(+) × (−) = (−)    Example: 4 × (−3) = −12
(−) × (+) = (−)    Example: (−4) × 3 = −12
(−) × (−) = (+)    Example: (−4) × (−3) = 12

MEMORY TRICK: "Same signs = Positive. Different signs = Negative."

For MULTIPLE SIGNS: Count the negatives.
• Even number of negatives → POSITIVE result
• Odd number of negatives → NEGATIVE result

Example: (−2) × (−3) × (−1) × (−2)
4 negative signs (even) → Positive answer
2 × 3 × 1 × 2 = 12. Answer: +12',
'Medium'),

('RM034', 'SKL017', 'Multiplication/Division Examples', 'worked_example',
'EXAMPLE 1: (−5) × (−4) × 3
Step 1: (−5) × (−4) = +20 (same signs)
Step 2: 20 × 3 = 60

EXAMPLE 2: (−48) ÷ (−6)
Same signs → positive. 48 ÷ 6 = 8. Answer: +8.

EXAMPLE 3: (−3)⁴
= (−3) × (−3) × (−3) × (−3)
= 9 × 9 = 81 (even power → positive)

EXAMPLE 4: (−2)³
= (−2) × (−2) × (−2) = 4 × (−2) = −8 (odd power → negative)',
'Medium');

-- SKL018-SKL022 (Fractions and Percentages)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM035', 'SKL018', 'Equivalent Fractions and Simplifying', 'note',
'EQUIVALENT FRACTIONS have the same value but different numerators/denominators.
Created by multiplying OR dividing top and bottom by the SAME number.

Example: 2/3 = 4/6 = 6/9 = 10/15 (multiply by 2, 3, 5)

SIMPLIFYING (reducing to lowest terms):
Divide both numerator and denominator by their HCF.

Finding HCF:
Method 1: List factors of both numbers, find largest in common.
Method 2: Use prime factorisation.

Example: Simplify 24/36
Factors of 24: 1,2,3,4,6,8,12,24
Factors of 36: 1,2,3,4,6,9,12,18,36
HCF = 12. So 24/36 = 2/3.',
'Easy'),

('RM036', 'SKL018', 'Simplifying Fractions: Examples', 'worked_example',
'EXAMPLE 1: Simplify 60/84
HCF of 60 and 84:
60 = 2²×3×5, 84 = 2²×3×7. HCF = 2²×3 = 12.
60/84 = 5/7.

EXAMPLE 2: Find the equivalent fraction: 5/8 = ?/48
8 × 6 = 48. So multiply top by 6: 5×6 = 30.
5/8 = 30/48.

EXAMPLE 3: Are 14/21 and 10/15 equivalent?
14/21 = 2/3 (÷7). 10/15 = 2/3 (÷5). YES, both equal 2/3.',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM037', 'SKL019', 'Adding and Subtracting Fractions', 'note',
'SAME DENOMINATOR: Add/subtract numerators, keep denominator.
3/8 + 2/8 = 5/8

DIFFERENT DENOMINATORS: Find LCM of denominators first.
Steps:
1. Find LCM of denominators
2. Convert each fraction to equivalent fraction with LCM
3. Add/subtract numerators
4. Simplify if possible

Example: 1/4 + 2/3
LCM(4,3) = 12
1/4 = 3/12, 2/3 = 8/12
3/12 + 8/12 = 11/12

MIXED NUMBERS:
Option 1: Convert to improper fractions first.
Option 2: Add whole parts, add fraction parts.',
'Medium'),

('RM038', 'SKL019', 'Fraction Addition/Subtraction: Examples', 'worked_example',
'EXAMPLE 1: 3/4 + 5/6
LCM(4,6) = 12. 3/4 = 9/12. 5/6 = 10/12.
9/12 + 10/12 = 19/12 = 1 and 7/12.

EXAMPLE 2: 5/6 − 3/8
LCM(6,8) = 24. 5/6 = 20/24. 3/8 = 9/24.
20/24 − 9/24 = 11/24.

EXAMPLE 3: 3 and 1/2 + 1 and 2/3
Fractions: 1/2 + 2/3. LCM=6. 3/6+4/6 = 7/6 = 1 and 1/6.
Whole: 3+1+1 = 5.
Total: 5 and 1/6.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM039', 'SKL020', 'Multiplying and Dividing Fractions', 'note',
'MULTIPLYING FRACTIONS:
Multiply numerators together AND denominators together.
a/b × c/d = (a×c)/(b×d)
Always simplify (can cancel BEFORE multiplying to keep numbers small).

Example: 3/4 × 8/9
Cancel: 3 and 9 share factor 3 → 1 and 3. 8 and 4 share factor 4 → 2 and 1.
= (1×2)/(1×3) = 2/3

DIVIDING FRACTIONS — "Keep, Change, Flip":
a/b ÷ c/d = a/b × d/c
KEEP the first fraction, CHANGE ÷ to ×, FLIP the second fraction.

Example: 2/3 ÷ 4/5 = 2/3 × 5/4 = 10/12 = 5/6',
'Medium'),

('RM040', 'SKL020', 'Fraction Multiplication/Division: Examples', 'worked_example',
'EXAMPLE 1: 5/6 × 3/10
Cancel: 5 and 10 → 1 and 2. 3 and 6 → 1 and 2.
= 1/2 × 1/2 = 1/4.

EXAMPLE 2: 4/5 ÷ 2/15
= 4/5 × 15/2 = (4×15)/(5×2) = 60/10 = 6.

EXAMPLE 3: What is 2/3 of 45?
2/3 × 45 = 90/3 = 30.

EXAMPLE 4: Mixed division: 1 and 1/2 ÷ 3/4
= 3/2 ÷ 3/4 = 3/2 × 4/3 = 12/6 = 2.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM041', 'SKL021', 'Converting Between Fractions, Decimals and Percentages', 'note',
'CONVERSION TABLE:
Fraction → Decimal: Divide numerator by denominator
Fraction → Percentage: ×100%
Decimal → Fraction: Write over power of 10, simplify
Decimal → Percentage: ×100
Percentage → Decimal: ÷100
Percentage → Fraction: Write over 100, simplify

COMMON CONVERSIONS to memorise:
1/2 = 0.5 = 50%
1/4 = 0.25 = 25%
3/4 = 0.75 = 75%
1/5 = 0.2 = 20%
1/10 = 0.1 = 10%
1/3 = 0.333... = 33.3%
2/3 = 0.666... = 66.7%
1/8 = 0.125 = 12.5%',
'Medium'),

('RM042', 'SKL021', 'Conversions: Worked Examples', 'worked_example',
'EXAMPLE 1: Convert 7/8 to a decimal and percentage.
7 ÷ 8 = 0.875. 0.875 × 100 = 87.5%.

EXAMPLE 2: Convert 0.64 to a fraction.
0.64 = 64/100 = 16/25.

EXAMPLE 3: Convert 85% to a fraction.
85/100 = 17/20.

EXAMPLE 4: Arrange in ascending order: 3/5, 0.55, 62%
Convert all to decimals: 0.6, 0.55, 0.62.
Order: 0.55 < 0.6 < 0.62 → 0.55, 3/5, 62%.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM043', 'SKL022', 'Percentage Calculations', 'note',
'FINDING PERCENTAGE OF A QUANTITY:
x% of n = (x/100) × n
Example: 35% of $60 = (35/100) × 60 = $21

PERCENTAGE INCREASE:
New value = original × (1 + rate/100)
OR: Find increase, add to original.
Example: $80 increased by 15% = 80 × 1.15 = $92

PERCENTAGE DECREASE:
New value = original × (1 − rate/100)
Example: $80 decreased by 15% = 80 × 0.85 = $68

FINDING WHAT PERCENTAGE:
% = (part/whole) × 100
Example: 18 as % of 24 = (18/24) × 100 = 75%',
'Medium'),

('RM044', 'SKL022', 'Percentage Change: Examples', 'worked_example',
'EXAMPLE 1: A shirt costs $45. VAT is 15%. Find the price including VAT.
VAT = 15% of 45 = 0.15 × 45 = $6.75.
Total = 45 + 6.75 = $51.75.

EXAMPLE 2: A TV was $350 and is now $280. Find the percentage decrease.
Decrease = 350 − 280 = 70.
% decrease = (70/350) × 100 = 20%.

EXAMPLE 3: A learner improved from 56 to 70 marks. Find the % increase.
Increase = 14. % increase = (14/56) × 100 = 25%.',
'Medium');

-- SKL023-SKL026 (Ratio and Proportion)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM045', 'SKL023', 'Ratios', 'note',
'A RATIO compares two or more quantities of the same kind.
Written with a colon: a : b

WRITING RATIOS:
• Must be in the same UNITS
• Simplify by dividing by HCF
• Can be written as a fraction: a:b = a/b

RATIO AND TOTAL PARTS:
In ratio a:b, total parts = a + b.
Each part = total quantity ÷ (a + b).

RATIO WITH THREE QUANTITIES: a:b:c, total parts = a+b+c

EXAMPLE: Divide $200 in ratio 3:2.
Total parts = 5. One part = $40.
First share = 3×40 = $120. Second share = 2×40 = $80.',
'Easy'),

('RM046', 'SKL023', 'Ratios: Worked Examples', 'worked_example',
'EXAMPLE 1: In a bag of 35 sweets, red:blue:green = 3:4:7
Total parts = 14. One part = 35÷14 = 2.5.
Red = 3×2.5 = 7.5 ≈ 7 or 8 (check: 7+10+17.5 won''t work with whole numbers)
Note: always check the ratio gives whole numbers!

EXAMPLE 2: Simplify 0.5:1.5
Multiply both by 2: 1:3.

EXAMPLE 3: Express 30cm to 1.2m as a ratio.
Same units: 30cm to 120cm = 30:120 = 1:4.',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM047', 'SKL025', 'Direct Proportion', 'note',
'DIRECT PROPORTION: As one quantity increases, the other increases at the SAME RATE.
y ∝ x means y = kx, where k is the constant of proportionality.

Finding k: k = y/x (use a given pair of values)

UNITARY METHOD:
Step 1: Find the value for 1 unit.
Step 2: Multiply by the required number of units.

Example: 6 books cost $18. Find cost of 10 books.
Cost of 1 book = $18 ÷ 6 = $3.
Cost of 10 books = $3 × 10 = $30.

TABLE METHOD: In direct proportion, the ratio y/x is constant.
x: 2  4  6  8
y: 5  10 15 20  (k = 2.5)',
'Medium'),

('RM048', 'SKL025', 'Direct Proportion: Examples', 'worked_example',
'EXAMPLE 1: A tap fills 120 litres in 3 hours. How long to fill 200 litres?
Rate = 120/3 = 40 litres/hour.
Time = 200/40 = 5 hours.

EXAMPLE 2: y is directly proportional to x. When x=5, y=20.
Find: (a) the constant k  (b) y when x=12  (c) x when y=36.
(a) k = 20/5 = 4
(b) y = 4×12 = 48
(c) 36 = 4x → x = 9

EXAMPLE 3: A car uses 8 litres of fuel per 100km. How much for 350km?
Fuel = (8/100) × 350 = 28 litres.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM049', 'SKL026', 'Dividing in a Ratio', 'note',
'STEPS to divide a quantity Q in ratio a:b:c:
1. Find total parts: T = a + b + c
2. Find one part: 1 part = Q ÷ T
3. Multiply each ratio number by one part

CHECKING: Sum of all shares = Q ✓

REVERSE PROBLEM: Given one share, find the total or other shares.
Example: In ratio 2:5, the smaller share is $14. Find total.
2 parts = $14. 1 part = $7. Total (7 parts) = $49.',
'Medium'),

('RM050', 'SKL026', 'Dividing in Ratio: Examples', 'worked_example',
'EXAMPLE 1: Divide 360° in ratio 1:2:3.
Total = 6 parts. 1 part = 60°.
Shares: 60°, 120°, 180°. Check: 60+120+180=360° ✓

EXAMPLE 2: Mukai and Chipo share profits of $2100 in ratio 4:3.
1 part = 2100÷7 = $300.
Mukai: 4×300 = $1200. Chipo: 3×300 = $900.

EXAMPLE 3: Three siblings share sweets. The eldest gets twice as much as each of the others. Write and use the ratio.
Ratio = 2:1:1. Total parts = 4.
If 40 sweets total: eldest = 20, others = 10 each.',
'Medium');

-- SKL027-SKL031 (Algebra)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM051', 'SKL027', 'Algebraic Expressions', 'note',
'KEY VOCABULARY:
• TERM: a single number, variable, or their product (e.g., 3x, 5, 2y²)
• EXPRESSION: group of terms joined by + or − (e.g., 4x + 3y − 7)
• LIKE TERMS: same variable AND same power (e.g., 3x and −5x are like)
• UNLIKE TERMS: different variables or powers (3x and 3y are unlike)

SIMPLIFYING — COLLECTING LIKE TERMS:
Only add/subtract like terms. Treat the variable as a label.
3x + 5x = 8x (same as 3 apples + 5 apples = 8 apples)
3x + 5y CANNOT be simplified (different variables)

WRITING EXPRESSIONS:
"3 more than x" = x + 3
"twice y minus 4" = 2y − 4
"product of a and b" = ab',
'Easy'),

('RM052', 'SKL027', 'Algebraic Expressions: Examples', 'worked_example',
'EXAMPLE 1: Simplify 7a − 3b + 2a + 5b − 1
Group: (7a+2a) + (−3b+5b) − 1 = 9a + 2b − 1

EXAMPLE 2: Simplify 4x² + 3x − x² + 2x − 5
Group: (4x²−x²) + (3x+2x) − 5 = 3x² + 5x − 5

EXAMPLE 3: Write an expression for the perimeter of a rectangle with length (2x+1) and width x.
P = 2(2x+1) + 2x = 4x + 2 + 2x = 6x + 2

EXAMPLE 4: If sweets cost d cents each, write the cost of 8 sweets.
Cost = 8d cents.',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM053', 'SKL030', 'Solving Linear Equations', 'note',
'An EQUATION has an equals sign (=). We SOLVE for the unknown.

GOLDEN RULE: Whatever you do to one side, do to the OTHER side.

STEPS:
1. Remove fractions (multiply both sides by LCM of denominators)
2. Expand brackets
3. Collect variable terms on one side
4. Collect numbers on the other side
5. Divide to isolate the variable
6. CHECK by substituting back

EXAMPLE: Solve 3x − 4 = 11
+4 both sides: 3x = 15
÷3 both sides: x = 5
CHECK: 3(5)−4 = 15−4 = 11 ✓',
'Medium'),

('RM054', 'SKL030', 'Linear Equations: Examples', 'worked_example',
'EXAMPLE 1: 5x + 2 = 3x + 10
5x − 3x = 10 − 2
2x = 8
x = 4

EXAMPLE 2: 4(2x − 1) = 3(x + 5)
8x − 4 = 3x + 15
5x = 19
x = 19/5 = 3.8

EXAMPLE 3: Form and solve: "Three times a number is 8 more than the number. Find the number."
Let n = the number.
3n = n + 8
2n = 8
n = 4.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM055', 'SKL029', 'Expanding Brackets', 'note',
'SINGLE BRACKET: a(b + c) = ab + ac
Multiply the factor OUTSIDE by EVERY term inside.

NEGATIVE OUTSIDE: −a(b + c) = −ab − ac
Remember: negative × positive = negative!

TWO BRACKETS (FOIL):
(a + b)(c + d) = ac + ad + bc + bd
F: First terms (a×c)
O: Outer terms (a×d)
I: Inner terms (b×c)
L: Last terms (b×d)

COMMON MISTAKES:
✗ 2(x + 3) ≠ 2x + 3 (forgot to multiply the 3)
✓ 2(x + 3) = 2x + 6',
'Medium'),

('RM056', 'SKL029', 'Expanding Brackets: Examples', 'worked_example',
'EXAMPLE 1: Expand and simplify 4(2x−3) − 2(x+1)
= 8x − 12 − 2x − 2
= 6x − 14

EXAMPLE 2: Expand (x + 4)(x − 3)
FOIL: x² − 3x + 4x − 12 = x² + x − 12

EXAMPLE 3: Expand (2x + 1)(3x − 2)
= 6x² − 4x + 3x − 2 = 6x² − x − 2

EXAMPLE 4: Show that 3(x+2) + 2(x−1) = 5(x+?) 
3x+6+2x−2 = 5x+4 = 5(x + 4/5). Actually 5x+4.',
'Medium');

-- SKL032-SKL036 (Geometry)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM057', 'SKL032', 'Types of Angles', 'note',
'ANGLE TYPES:
• ACUTE angle: between 0° and 90°. Example: 45°, 73°
• RIGHT angle: exactly 90°. Shown by □ symbol.
• OBTUSE angle: between 90° and 180°. Example: 110°, 135°
• STRAIGHT angle: exactly 180° (a straight line)
• REFLEX angle: between 180° and 360°. Example: 250°, 315°
• FULL rotation: exactly 360°

MEASURING ANGLES:
Use a protractor. Line up the baseline with one arm of the angle.

ADJACENT ANGLES: Share a common arm and vertex.
COMPLEMENTARY ANGLES: Add up to 90°.
SUPPLEMENTARY ANGLES: Add up to 180°.',
'Easy'),

('RM058', 'SKL032', 'Angle Types: Examples', 'worked_example',
'EXAMPLE 1: Find the complement of 37°.
Complement = 90 − 37 = 53°.

EXAMPLE 2: Find the supplement of 112°.
Supplement = 180 − 112 = 68°.

EXAMPLE 3: An angle is 3 times its complement. Find the angle.
Let angle = x. x = 3(90 − x). x = 270 − 3x. 4x = 270. x = 67.5°.

EXAMPLE 4: Classify each angle:
(a) 89° → acute
(b) 91° → obtuse
(c) 189° → reflex
(d) 90° → right angle',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM059', 'SKL033', 'Angle Relationships', 'note',
'ANGLES ON A STRAIGHT LINE: Add up to 180°.
If angles a, b, c are on a straight line: a + b + c = 180°.

ANGLES AT A POINT: Add up to 360°.
All angles meeting at one point: a + b + c + ... = 360°.

VERTICALLY OPPOSITE ANGLES: Equal.
When two straight lines cross, opposite angles are equal.

PARALLEL LINES (cut by a transversal):
• Corresponding angles: Equal (F-shape)
• Alternate angles: Equal (Z-shape)
• Co-interior (same-side interior): Add to 180° (C-shape)

ZIMSEC TIP: Always state your reason when finding angles.
"Angles on a straight line" / "Vertically opposite angles" etc.',
'Medium'),

('RM060', 'SKL033', 'Angle Calculations: Examples', 'worked_example',
'EXAMPLE 1: Angles on a straight line: 2x, 3x, 4x. Find x.
2x + 3x + 4x = 180. 9x = 180. x = 20°.
Angles: 40°, 60°, 80°.

EXAMPLE 2: Find the unknown angle at a point where four angles meet: 90°, 115°, 73°, y°.
90 + 115 + 73 + y = 360. y = 360 − 278 = 82°.

EXAMPLE 3: Two lines cross. One angle is 58°. Find all four angles.
Vertically opposite: 58° and 58°.
Supplementary pairs: 180°−58° = 122° and 122°.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM061', 'SKL034', 'Angles in Triangles', 'note',
'KEY TRIANGLE ANGLE FACTS:

1. ANGLE SUM: The three interior angles of ANY triangle add up to 180°.

2. EXTERIOR ANGLE: An exterior angle of a triangle equals the sum of the two non-adjacent interior angles.

3. EQUILATERAL TRIANGLE: All angles = 60°.

4. ISOSCELES TRIANGLE: Two equal sides, two equal base angles.
   If apex angle = A, then each base angle = (180 − A)/2.

5. RIGHT-ANGLED TRIANGLE: One angle = 90°. Other two angles add up to 90°.

PROOF OF ANGLE SUM: Draw a line through a vertex parallel to the opposite side. Use alternate angles.',
'Medium'),

('RM062', 'SKL034', 'Triangle Angles: Examples', 'worked_example',
'EXAMPLE 1: Isosceles triangle. Apex = 40°. Find base angles.
Base angles = (180 − 40)/2 = 140/2 = 70° each.

EXAMPLE 2: Exterior angle is 125°. One interior angle is 55°. Find the third.
125 = 55 + third. Third = 70°.

EXAMPLE 3: Right-angled triangle. One acute angle is 38°. Find the other.
90° + 38° + other = 180°. Other = 52°.

EXAMPLE 4: Triangle angles are (2x+10)°, (3x−5)°, and (x+15)°. Find x.
Sum = 180: 2x+10+3x−5+x+15 = 180.
6x + 20 = 180. 6x = 160. x = 26.67°.',
'Medium');

-- SKL037-SKL040 (Mensuration)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM063', 'SKL037', 'Perimeter', 'note',
'PERIMETER is the total distance around the outside of a shape. Measured in cm, m, km.

FORMULAS:
• Rectangle: P = 2(l + w) or P = 2l + 2w
• Square: P = 4s
• Triangle: P = a + b + c (add all three sides)
• Regular polygon: P = n × s (n sides, each length s)

PROBLEM TYPES:
1. Find perimeter given dimensions
2. Find a missing side given perimeter
3. Real-life problems (fencing, border, frame)

IMPORTANT: Make sure all measurements are in the SAME UNIT before calculating.',
'Easy'),

('RM064', 'SKL037', 'Perimeter: Examples', 'worked_example',
'EXAMPLE 1: A rectangular garden is 15m long and 8m wide. How much fencing is needed?
P = 2(15 + 8) = 2 × 23 = 46m.

EXAMPLE 2: A square has perimeter 52cm. Find each side.
Side = 52 ÷ 4 = 13cm.

EXAMPLE 3: An equilateral triangle has perimeter 36cm. Find each side.
Side = 36 ÷ 3 = 12cm.

EXAMPLE 4: A rectangle has perimeter 40m and width 7m. Find the length.
40 = 2(l+7). 20 = l+7. l = 13m.',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM065', 'SKL038', 'Area of Rectangles and Squares', 'note',
'AREA is the amount of surface inside a shape. Measured in cm², m², etc.

FORMULAS:
• Rectangle: A = l × w
• Square: A = s² (side squared)

RELATIONSHIP between area and perimeter:
Two shapes can have the same perimeter but different areas.

FINDING DIMENSIONS FROM AREA:
If A = l × w and you know A and one dimension:
• Find l: l = A ÷ w

UNITS:
• 1m² = 10,000cm²
• 1cm² = 100mm²',
'Easy'),

('RM066', 'SKL038', 'Area: Examples', 'worked_example',
'EXAMPLE 1: Find the area of a rectangle 13m × 5m.
A = 13 × 5 = 65m².

EXAMPLE 2: A square room has area 81m². What is the side length?
s² = 81. s = √81 = 9m.

EXAMPLE 3: A rectangle has area 72cm² and length 12cm. Find the width.
w = 72 ÷ 12 = 6cm.

EXAMPLE 4: How many 1m² tiles are needed for a 6m × 8m room?
Area = 48m². Need 48 tiles.',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM067', 'SKL039', 'Area of Triangles and Parallelograms', 'note',
'TRIANGLE AREA:
A = ½ × base × height
• The height must be PERPENDICULAR to the base.
• Height is NOT the slant side unless the triangle is right-angled.

PARALLELOGRAM AREA:
A = base × perpendicular height
• Like a rectangle "pushed over".
• Use perpendicular height, not the slant side.

TRAPEZIUM AREA (bonus):
A = ½ × (a + b) × h  where a and b are the parallel sides.

COMPOSITE SHAPES:
Split into simpler shapes. Find each area. Add (or subtract if cut out).',
'Medium'),

('RM068', 'SKL039', 'Triangle/Parallelogram Area: Examples', 'worked_example',
'EXAMPLE 1: Triangle: base 14cm, height 9cm.
A = ½ × 14 × 9 = 63cm².

EXAMPLE 2: Parallelogram: base 11cm, height 6cm.
A = 11 × 6 = 66cm².

EXAMPLE 3: Triangle area = 30cm², base = 12cm. Find height.
30 = ½ × 12 × h → 30 = 6h → h = 5cm.

EXAMPLE 4: L-shape = 10×7 rectangle − 3×4 rectangle.
Area = 70 − 12 = 58cm².',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM069', 'SKL040', 'Circles: Circumference and Area', 'note',
'KEY TERMS:
• RADIUS (r): distance from centre to edge
• DIAMETER (d): distance across circle through centre. d = 2r
• π (pi) ≈ 3.14 or 22/7

FORMULAS:
• Circumference: C = 2πr = πd
• Area: A = πr²

ZIMSEC EXAM NOTE: Unless told otherwise, use π = 22/7 or π = 3.14 as given in the question.

FINDING RADIUS FROM CIRCUMFERENCE:
C = 2πr → r = C/(2π)

FINDING RADIUS FROM AREA:
A = πr² → r² = A/π → r = √(A/π)',
'Medium'),

('RM070', 'SKL040', 'Circles: Worked Examples', 'worked_example',
'EXAMPLE 1: Circumference with r = 21cm. (π=22/7)
C = 2 × 22/7 × 21 = 2 × 66 = 132cm.

EXAMPLE 2: Area with r = 7cm. (π=22/7)
A = 22/7 × 7² = 22/7 × 49 = 22 × 7 = 154cm².

EXAMPLE 3: A circle has circumference 44cm. Find radius. (π=22/7)
44 = 2 × 22/7 × r. 44 = 44r/7. r = 7cm.

EXAMPLE 4: Semicircle perimeter with r = 10cm. (π=3.14)
Straight edge = 20cm. Curved part = πr = 31.4cm. Total = 51.4cm.',
'Medium');

-- SKL041-SKL044 (Statistics)
INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM071', 'SKL041', 'Data Collection and Frequency Tables', 'note',
'DATA TYPES:
• RAW DATA: data as collected, not yet organised
• DISCRETE data: countable values (e.g., number of students)
• CONTINUOUS data: measured values (e.g., height, weight)

FREQUENCY TABLE:
Organises data by listing each value/class and how many times it occurs.

TALLY MARKS:
| = 1,  || = 2,  ||| = 3,  |||| = 4,  ⌿|||| = 5 (diagonal across four)

GROUPED FREQUENCY TABLES:
Used when data has a wide range.
Classes should not overlap.
Example: 0−9, 10−19, 20−29 (class width = 10)

RELATIVE FREQUENCY = frequency ÷ total frequency',
'Easy'),

('RM072', 'SKL041', 'Frequency Tables: Examples', 'worked_example',
'EXAMPLE: Data: 3,5,2,3,4,5,5,3,2,4,3,5
Construct a frequency table.

Value | Tally | Frequency
  2   |  ||   |    2
  3   | ||||  |    4
  4   |  ||   |    2
  5   | ||||  |    4
Total:          12

Relative frequency of 5 = 4/12 = 1/3.

Most common value (mode) = 3 and 5 (both appear 4 times — bimodal).',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM073', 'SKL042', 'Mean, Median and Mode', 'note',
'Three MEASURES OF CENTRAL TENDENCY:

MEAN (average):
Mean = (sum of all values) ÷ (number of values)
Affected by extreme values.

MEDIAN (middle value):
Arrange data in ORDER. Find the middle value.
• Odd number of values: middle one.
• Even number of values: mean of the two middle ones.

MODE:
The value that appears MOST OFTEN.
• Can have no mode, one mode, or multiple modes.

WHEN TO USE WHICH:
• Mean: when data is fairly uniform
• Median: when there are extreme values
• Mode: for categorical data or most popular value',
'Medium'),

('RM074', 'SKL042', 'Mean, Median, Mode: Examples', 'worked_example',
'DATA: 4, 7, 2, 9, 4, 6, 4, 8

MEAN: (4+7+2+9+4+6+4+8)/8 = 44/8 = 5.5

MEDIAN: Ordered: 2,4,4,4,6,7,8,9
Even count (8): middle values are 4th and 5th = 4 and 6.
Median = (4+6)/2 = 5.

MODE: 4 (appears 3 times)

FROM FREQUENCY TABLE:
Scores: 1(×3), 2(×4), 3(×2), 4(×1). Total frequency=10.
Σfx = 1×3+2×4+3×2+4×1 = 3+8+6+4 = 21.
Mean = 21/10 = 2.1. Mode = 2.',
'Medium');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM075', 'SKL043', 'Bar Charts and Pictograms', 'note',
'BAR CHART:
• Bars are EQUAL WIDTH with gaps between them
• Height of bar shows frequency
• Title, labelled axes, and consistent scale required
• Bars can be vertical or horizontal

PICTOGRAM:
• Uses symbols/pictures to represent data
• KEY shows what each symbol represents
• Half/quarter symbols may be used
• Must have a key

READING CHARTS:
• Read the scale carefully
• Half a symbol = half the key value
• Always read the KEY for pictograms

ZIMSEC TIP: When drawing, use a ruler, label ALL axes, and include a title!',
'Easy'),

('RM076', 'SKL043', 'Bar Charts: Examples', 'worked_example',
'EXAMPLE: Favourite fruits: Apple=15, Banana=22, Orange=8, Mango=18.

Drawing bar chart:
• y-axis: 0 to 25 (scale in 5s)
• x-axis: fruit names
• Draw bars with heights 15, 22, 8, 18

Reading: Which fruit is least favourite? Orange (bar height = 8).
How many more prefer Banana over Apple? 22 − 15 = 7.

PICTOGRAM (symbol = 4 students):
Apple: 3 and 3/4 symbols
Banana: 5 and 1/2 symbols
Orange: 2 symbols
Mango: 4 and 1/2 symbols',
'Easy');

INSERT INTO reading_materials (material_id, skill_id, title, content_type, content, difficulty_level) VALUES
('RM077', 'SKL044', 'Pie Charts', 'note',
'A PIE CHART (circle graph) shows data as sectors of a circle.
The full circle = 360° = 100% of the data.

DRAWING A PIE CHART:
1. Find total frequency.
2. For each category: angle = (frequency/total) × 360°
3. Draw circle, measure and draw each angle with a protractor.
4. Label each sector and give a title.

READING A PIE CHART:
• Sector angle ÷ 360 gives fraction of total.
• Items in sector = (angle/360) × total

ZIMSEC TIP: Angles should add up to exactly 360°. If they don''t, recheck!',
'Medium'),

('RM078', 'SKL044', 'Pie Charts: Examples', 'worked_example',
'EXAMPLE: 120 students chose subjects: Maths=50, Science=30, English=25, History=15.

Calculate angles:
Maths: (50/120) × 360 = 150°
Science: (30/120) × 360 = 90°
English: (25/120) × 360 = 75°
History: (15/120) × 360 = 45°
CHECK: 150+90+75+45 = 360° ✓

Reading: A pie chart has a sector of 108°. Total = 300.
Items = (108/360) × 300 = 90.',
'Medium');


-- ============================================================
-- seed-passwords.js instructions (store in comments)
-- ============================================================
-- After importing this file, run the following in your backend:
--
-- node -e "
-- const bcrypt = require('bcryptjs');
-- const { Pool } = require('pg');
-- require('dotenv').config();
-- const pool = new Pool({ ... }); // your config
-- const accounts = [
--   { id: 'STU001', pw: 'Test1234' }, { id: 'STU002', pw: 'Test1234' },
--   { id: 'STU003', pw: 'Test1234' }, { id: 'STU004', pw: 'Test1234' },
--   { id: 'STU005', pw: 'Test1234' }, { id: 'TCH001', pw: 'Teacher1234' }
-- ];
-- Promise.all(accounts.map(async a => {
--   const hash = await bcrypt.hash(a.pw, 10);
--   return pool.query('UPDATE students SET password_hash=$1 WHERE student_id=$2', [hash, a.id]);
-- })).then(() => { console.log('Passwords set.'); pool.end(); });
-- "
-- ============================================================
