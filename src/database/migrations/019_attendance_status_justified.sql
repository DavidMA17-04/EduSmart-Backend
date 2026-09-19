-- PBI-25+: add JUSTIFIED to attendance.status enum (MySQL).

SET NAMES utf8mb4;

ALTER TABLE `attendance`
  MODIFY COLUMN `status` ENUM(
    'PRESENT',
    'ABSENT',
    'LATE',
    'JUSTIFIED'
  ) NOT NULL;
