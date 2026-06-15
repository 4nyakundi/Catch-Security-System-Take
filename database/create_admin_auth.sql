USE catch_security_db;

-- Admins Table
CREATE TABLE IF NOT EXISTS admins (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OTP verification table
CREATE TABLE IF NOT EXISTS admin_otps (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT NOT NULL,
    otp_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
);

-- Seed initial admin: username='admin', email='admin@catchsecurity.co.ke', password='c@#365'
-- Password hash generated using password_hash('c@#365', PASSWORD_DEFAULT)
INSERT INTO admins (id, username, email, password_hash) 
VALUES (1, 'admin', 'admin@catchsecurity.co.ke', '$2y$10$xp.i88WyNNuyjGexLCdImeZocle8HS13zTEwfUPNoJXvSYDB2tjw.')
ON DUPLICATE KEY UPDATE 
email = VALUES(email),
password_hash = VALUES(password_hash);
