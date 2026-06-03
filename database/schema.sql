-- Create Database
CREATE DATABASE IF NOT EXISTS catch_security_db;
USE catch_security_db;

-- Sections Table (Mombasa, Nairobi)
CREATE TABLE IF NOT EXISTS sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO sections (id, name) VALUES 
(1, 'Mombasa'), 
(2, 'Nairobi');

-- Clients Table
CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(200) NOT NULL,
    contact_person VARCHAR(100),
    phone_number VARCHAR(50),
    branch_id INT,
    region_name VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (branch_id) REFERENCES sections(id) ON DELETE SET NULL
);

-- Employees Table (Staff & Guards)
CREATE TABLE IF NOT EXISTS employees (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    id_number VARCHAR(50) UNIQUE NOT NULL,
    kra_pin VARCHAR(50) UNIQUE,
    nssf_number VARCHAR(50) UNIQUE,
    sha_number VARCHAR(50) UNIQUE,
    phone_number VARCHAR(50),
    home_location VARCHAR(200),
    role ENUM('Guard', 'Staff') NOT NULL DEFAULT 'Guard',
    section_id INT,
    region_name VARCHAR(100),
    client_id INT NULL,
    payment_mode ENUM('Bank', 'Sacco') NOT NULL DEFAULT 'Bank',
    payment_provider VARCHAR(100) DEFAULT 'Equity',
    bank_name VARCHAR(100),
    account_number VARCHAR(100),
    basic_salary DECIMAL(10, 2) NOT NULL,
    status ENUM('Active', 'Inactive') DEFAULT 'Active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (section_id) REFERENCES sections(id) ON DELETE SET NULL,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- Allowances Table
CREATE TABLE IF NOT EXISTS allowances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    allowance_name VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- Payroll Records Table (Monthly processing per employee)
CREATE TABLE IF NOT EXISTS payroll_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    employee_id INT NOT NULL,
    payroll_month VARCHAR(20) NOT NULL, -- e.g., '2024-05'
    days_worked INT DEFAULT 30,
    basic_salary DECIMAL(10, 2) NOT NULL,
    gross_pay DECIMAL(10, 2) NOT NULL,
    nssf_deduction DECIMAL(10, 2) NOT NULL,
    sha_deduction DECIMAL(10, 2) NOT NULL,
    housing_levy DECIMAL(10, 2) NOT NULL,
    paye_tax DECIMAL(10, 2) NOT NULL,
    net_pay DECIMAL(10, 2) NOT NULL,
    payment_mode ENUM('Bank', 'Sacco') NOT NULL DEFAULT 'Bank',
    payment_provider VARCHAR(100) DEFAULT 'Equity',
    branch_name VARCHAR(100),
    region_name VARCHAR(100),
    company_name VARCHAR(200),
    client_id INT NULL,
    account_number VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- Company Financials (Employer Obligations & VAT)
CREATE TABLE IF NOT EXISTS company_finances (
    id INT AUTO_INCREMENT PRIMARY KEY,
    finance_month VARCHAR(20) NOT NULL, -- e.g., '2024-05'
    total_employer_nssf DECIMAL(10, 2) NOT NULL,
    total_employer_housing_levy DECIMAL(10, 2) NOT NULL,
    total_nita DECIMAL(10, 2) NOT NULL,
    total_paye_remitted DECIMAL(10, 2) NOT NULL,
    vat_collected DECIMAL(10, 2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
