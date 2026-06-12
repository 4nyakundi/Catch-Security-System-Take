# Catch Security System - HR & Payroll Management

Welcome to the **Catch Security System**, a comprehensive Human Resources and Payroll Management application tailored specifically for **Catch Security Links Ltd**. This system streamlines the administration of security guards and staff, manages client contracts, automates payroll calculations (in compliance with Kenyan tax regulations), and provides robust reporting tools.

## 🚀 Key Features

*   **Interactive Dashboard:** Real-time overview of active staff, total gross payroll, tax remittances, and total deductions, complete with branch-specific breakdowns.
*   **Employee Management:** 
    *   Register, edit, and manage records for Staff and Guards.
    *   Track crucial details including ID Number, KRA PIN, NSSF, SHA, Phone Number, Home Location, and Payment Details (Bank/Sacco).
    *   Filter staff by branch (Mombasa, Nairobi) and region.
*   **Client / Company Management:**
    *   Manage contracted clients, assigning them to specific branches and regions.
    *   Track contact persons and the number of guards assigned to each client.
*   **Automated Payroll Processing:**
    *   Generate a monthly payroll preview that calculates gross pay based on a standard 30-day work month.
    *   **Auto-Calculated Taxes & Deductions:** Fully integrates Kenyan statutory deductions including PAYE (Graduated scale), NSSF, SHA (2.75%), and Housing Levy (1.5%).
    *   Adjust days worked on-the-fly with real-time recalculation of net pay.
    *   Save final payrolls securely for archival and reporting.
*   **Reports & Exports:**
    *   Generate comprehensive payroll master sheets or filter by specific clients.
    *   Includes automated summaries for Bank vs. Sacco payments (e.g., CIA TABASURI SACCO, IMARIKA SACCO).
    *   **Export Options:** Instantly export reports to Excel (`.xlsx`) or PDF format.
*   **Company Taxes Summary:**
    *   Calculate total employer financial obligations monthly (Employer NSSF matching, Employer Housing Levy, NITA, and Total PAYE).
*   **Security & Authentication:** 
    *   Secure admin login system.
    *   Admin verification required for destructive actions (e.g., deleting employees or clients) to prevent accidental data loss.

## 🛠️ Technology Stack

*   **Frontend:** HTML5, CSS3 (Custom styling, Vanilla CSS), Vanilla JavaScript (ES6+).
*   **Backend:** PHP (RESTful API architecture handling JSON requests/responses).
*   **Database:** MySQL (Relational schema managing employees, clients, payroll records, and financials).
*   **Third-Party Libraries:**
    *   [FontAwesome](https://fontawesome.com/) - For UI Icons.
    *   [SheetJS](https://sheetjs.com/) - For Excel data exports.
    *   [html2pdf.js](https://ekoopmans.github.io/html2pdf.js/) - For generating PDF reports directly from the browser.

## 📂 Project Structure

```text
Catch Security System/
│
├── backend/
│   ├── api.php                  # Main API routing and logic handler
│   ├── db_connect.php           # Database connection configuration (to be created based on env)
│   └── migrate_regions.php      # Migration script for location data
│
├── css/
│   └── style.css                # Global stylesheet and UI design
│
├── database/
│   ├── schema.sql               # Core database structure
│   ├── alter_employees.sql      # Database schema updates for employees
│   └── alter_payroll_records.sql# Database schema updates for payroll
│
├── img/
│   └── logo.jpg                 # Company Logo
│
├── js/
│   └── app.js                   # Main application logic and API integration
│
├── index.html                   # Main application interface (Dashboard, Payroll, etc.)
└── login.html                   # Admin authentication portal
```

## ⚙️ Installation & Setup (Local Environment)

To run this project locally, it is recommended to use a local server environment like **XAMPP**, **WAMP**, or **MAMP**.

1.  **Clone / Copy the Project:**
    Place the `Catch Security System` folder into your local server's web directory (e.g., `C:\xampp\htdocs\` for XAMPP).
2.  **Database Setup:**
    *   Open phpMyAdmin (usually `http://localhost/phpmyadmin`).
    *   Run the SQL scripts provided in the `database/` folder in the following order:
        1.  `schema.sql` (Creates the `catch_security_db` database and base tables)
        2.  `alter_employees.sql`
        3.  `alter_payroll_records.sql`
3.  **Database Connection:**
    *   Ensure that the `backend/db_connect.php` file exists and contains the correct MySQL credentials (typically `root` user with an empty password for local XAMPP).
4.  **Launch the Application:**
    *   Open your web browser and navigate to: `http://localhost/Catch Security System/login.html`
    *   Login using the default Admin credentials (provided securely).

## 🔒 Security Note

*   This system includes hardcoded admin logic for initial setup/testing. For production deployment, ensure that all authentication is securely managed via the database with encrypted passwords.
*   Ensure the `database/` folder is not publicly accessible in a live environment.

## 📄 License
Created and Distributed by E. Nyakundi. N for DataPort. Inc. All rights reserved by Catch Security Links Ltd.
