CREATE DATABASE IF NOT EXISTS tinder_trash_finder;
USE tinder_trash_finder;

CREATE TABLE IF NOT EXISTS waste_reports (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  location VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  photo_url TEXT NOT NULL,
  s3_key VARCHAR(500) NOT NULL,
  status ENUM('NEW', 'IN_PROGRESS', 'DONE') NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_schedules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  area_name VARCHAR(255) NOT NULL,
  day_of_week ENUM('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday') NOT NULL,
  pickup_time TIME NOT NULL,
  notes VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sanitation_workers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  worker_name VARCHAR(255) NOT NULL,
  assigned_area VARCHAR(255) NULL,
  status ENUM('ACTIVE', 'ON_ROUTE', 'OFFLINE', 'OFF_DUTY') NOT NULL DEFAULT 'OFFLINE',
  last_active_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO collection_schedules (area_name, day_of_week, pickup_time, notes)
VALUES
  ('Kecamatan A', 'Monday', '07:30:00', 'Angkut rutin pagi'),
  ('Kecamatan B', 'Wednesday', '08:00:00', 'Prioritas area pasar'),
  ('Kecamatan C', 'Friday', '09:00:00', 'Gunakan armada tambahan')
ON DUPLICATE KEY UPDATE notes = VALUES(notes);

INSERT INTO sanitation_workers (worker_name, assigned_area, status, last_active_at)
VALUES
  ('Budi Santoso', 'Kecamatan A', 'ACTIVE', NOW()),
  ('Siti Aminah', 'Kecamatan B', 'ON_ROUTE', NOW()),
  ('Andi Wijaya', 'Kecamatan C', 'OFFLINE', NOW())
ON DUPLICATE KEY UPDATE status = VALUES(status), last_active_at = VALUES(last_active_at);
