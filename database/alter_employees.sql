USE catch_security_db;

ALTER TABLE employees
ADD COLUMN kra_pin VARCHAR(50) UNIQUE AFTER id_number,
ADD COLUMN nssf_number VARCHAR(50) UNIQUE AFTER kra_pin,
ADD COLUMN sha_number VARCHAR(50) UNIQUE AFTER nssf_number,
ADD COLUMN phone_number VARCHAR(50) AFTER sha_number,
ADD COLUMN home_location VARCHAR(200) AFTER phone_number,
ADD COLUMN payment_mode ENUM('Bank', 'Sacco') NOT NULL DEFAULT 'Bank' AFTER home_location,
ADD COLUMN payment_provider VARCHAR(100) DEFAULT 'Equity' AFTER payment_mode;
