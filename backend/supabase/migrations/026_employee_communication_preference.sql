-- 026_employee_communication_preference.sql
-- Lets HR block system emails from going to an employee's personal address
-- once an official/work email has been assigned, so all future communication
-- goes only to the official address. Assigning the official email itself
-- already works via the existing work_email edit flow (updateEmployee) —
-- this column is the only missing piece.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS block_personal_email BOOLEAN NOT NULL DEFAULT false;
