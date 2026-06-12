USE catch_security_db;

-- Add Next of Kin to employees table
ALTER TABLE employees ADD COLUMN next_of_kin VARCHAR(200) AFTER home_location;

-- Add payment mode and provider to clients table
ALTER TABLE clients ADD COLUMN payment_mode ENUM('Bank', 'Sacco') NOT NULL DEFAULT 'Bank' AFTER region_name;
ALTER TABLE clients ADD COLUMN payment_provider VARCHAR(100) DEFAULT 'Equity' AFTER payment_mode;
