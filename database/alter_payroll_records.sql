ALTER TABLE payroll_records ADD COLUMN days_worked INT DEFAULT 30 AFTER payroll_month;
ALTER TABLE payroll_records ADD COLUMN basic_salary DECIMAL(10, 2) NOT NULL AFTER days_worked;
