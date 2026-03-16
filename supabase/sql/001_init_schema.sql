BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS districts (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  state TEXT NOT NULL DEFAULT 'Tamil Nadu'
);

CREATE TABLE IF NOT EXISTS degrees (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS colleges (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  district_id INT NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  is_verified BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  degree_id INT NOT NULL REFERENCES degrees(id) ON DELETE RESTRICT,
  UNIQUE (name, degree_id)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  district_id INT NOT NULL REFERENCES districts(id) ON DELETE RESTRICT,
  college_id INT NOT NULL REFERENCES colleges(id) ON DELETE RESTRICT,
  student_status TEXT NOT NULL CHECK (student_status IN ('student','alumni')),
  year_of_study INT NULL,
  graduation_year INT NULL,
  degree_id INT NOT NULL REFERENCES degrees(id) ON DELETE RESTRICT,
  course_id INT NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT users_status_academic_check CHECK (
    (student_status = 'student' AND year_of_study IS NOT NULL AND graduation_year IS NULL)
    OR
    (student_status = 'alumni' AND graduation_year IS NOT NULL AND year_of_study IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fingerprint TEXT NOT NULL,
  ram INT NULL,
  cpu INT NULL,
  gpu BOOLEAN NULL,
  npu BOOLEAN NULL,
  last_seen TIMESTAMP NOT NULL DEFAULT now(),
  UNIQUE (user_id, fingerprint)
);

CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_colleges_district_id ON colleges(district_id);
CREATE INDEX IF NOT EXISTS idx_courses_degree_id ON courses(degree_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_district_id ON users(district_id);
CREATE INDEX IF NOT EXISTS idx_users_college_id ON users(college_id);
CREATE INDEX IF NOT EXISTS idx_users_degree_id ON users(degree_id);
CREATE INDEX IF NOT EXISTS idx_users_course_id ON users(course_id);
CREATE INDEX IF NOT EXISTS idx_devices_user_id ON devices(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_device_id ON sessions(device_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

COMMIT;
