<?php
// backend/api.php
header('Content-Type: application/json');

// Check if db_connect exists to avoid breaking if not yet set up in XAMPP
if (file_exists('db_connect.php')) {
    include 'db_connect.php';
} else {
    echo json_encode(["status" => "error", "message" => "Database connection file not found."]);
    exit;
}

$action = isset($_GET['action']) ? $_GET['action'] : '';

switch ($action) {
    case 'get_employees':
        getEmployees($conn);
        break;
    case 'run_payroll':
        runPayroll($conn);
        break;
    case 'get_payroll_report':
        getPayrollReport($conn);
        break;
    case 'get_company_taxes':
        getCompanyTaxes($conn);
        break;
    case 'add_employee':
        addEmployee($conn);
        break;
    case 'update_employee':
        updateEmployee($conn);
        break;
    case 'delete_employee':
        deleteEmployee($conn);
        break;
    case 'get_clients':
        getClients($conn);
        break;
    case 'add_client':
        addClient($conn);
        break;
    case 'update_client':
        updateClient($conn);
        break;
    case 'delete_client':
        deleteClient($conn);
        break;
    case 'get_dashboard_stats':
        getDashboardStats($conn);
        break;
    case 'login':
        adminLogin();
        break;
    default:
        echo json_encode(["status" => "error", "message" => "Invalid action."]);
}

function runPayroll($conn) {
    $month = isset($_GET['month']) ? $_GET['month'] : '';
    if(!$month) {
        echo json_encode(["status" => "error", "message" => "No month specified."]);
        return;
    }

    // Clear existing records for the month to avoid duplicates
    $stmt = $conn->prepare("DELETE FROM payroll_records WHERE payroll_month = ?");
    if($stmt) {
        $stmt->bind_param("s", $month);
        $stmt->execute();
    }

    $stmt2 = $conn->prepare("DELETE FROM company_finances WHERE finance_month = ?");
    if($stmt2) {
        $stmt2->bind_param("s", $month);
        $stmt2->execute();
    }

    $result = $conn->query("SELECT * FROM employees WHERE status = 'Active'");
    if (!$result || $result->num_rows == 0) {
        echo json_encode(["status" => "error", "message" => "No active employees found."]);
        return;
    }

    $total_employer_nssf = 0;
    $total_employer_levy = 0;
    $total_nita = 0;
    $total_paye = 0;
    $count = 0;

    $stmt_insert = $conn->prepare("INSERT INTO payroll_records (employee_id, payroll_month, gross_pay, nssf_deduction, sha_deduction, housing_levy, paye_tax, net_pay) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");

    while($emp = $result->fetch_assoc()) {
        $gross = floatval($emp['basic_salary']);
        
        // 1. NSSF: 6% capped at Ksh 2,160 (for 2024 tier 2 upper limit)
        $nssf = round(min($gross * 0.06, 2160), 2);
        
        // 2. SHA: 2.75% of gross
        $sha = round($gross * 0.0275, 2);
        
        // 3. Housing Levy: 1.5% of gross
        $levy = round($gross * 0.015, 2);

        // 4. PAYE (Simplified 2024 logic)
        $taxable = $gross - $nssf - $levy; // NSSF and Levy are allowable deductions
        $paye = 0;
        if($taxable > 24000) {
            $tax = 24000 * 0.10;
            if($taxable > 32333) {
                $tax += (32333 - 24000) * 0.25;
                if($taxable > 500000) {
                    $tax += (500000 - 32333) * 0.30;
                    $tax += ($taxable - 500000) * 0.35;
                } else {
                    $tax += ($taxable - 32333) * 0.30;
                }
            } else {
                $tax += ($taxable - 24000) * 0.25;
            }
            $paye = max(0, $tax - 2400); // subtract personal relief
        }
        $paye = round($paye, 2);
        
        $net = $gross - $nssf - $sha - $levy - $paye;

        if($stmt_insert) {
            $stmt_insert->bind_param("isdddddd", $emp['id'], $month, $gross, $nssf, $sha, $levy, $paye, $net);
            $stmt_insert->execute();
        }

        // Company obligations
        $total_employer_nssf += $nssf; // Matching NSSF
        $total_employer_levy += $levy; // Matching Levy
        $total_nita += 50; // Standard Ksh 50
        $total_paye += $paye;
        $count++;
    }

    // Insert company finances
    $stmt_comp = $conn->prepare("INSERT INTO company_finances (finance_month, total_employer_nssf, total_employer_housing_levy, total_nita, total_paye_remitted) VALUES (?, ?, ?, ?, ?)");
    if($stmt_comp) {
        $stmt_comp->bind_param("sdddd", $month, $total_employer_nssf, $total_employer_levy, $total_nita, $total_paye);
        $stmt_comp->execute();
    }

    echo json_encode(["status" => "success", "count" => $count]);
}

function getPayrollReport($conn) {
    $month = isset($_GET['month']) ? $_GET['month'] : '';
    $sql = "SELECT e.first_name, e.last_name, e.bank_name, e.account_number, p.* FROM payroll_records p 
            JOIN employees e ON p.employee_id = e.id 
            WHERE p.payroll_month = ?";
    $stmt = $conn->prepare($sql);
    if($stmt) {
        $stmt->bind_param("s", $month);
        $stmt->execute();
        $result = $stmt->get_result();
        $data = [];
        while($row = $result->fetch_assoc()) {
            $data[] = $row;
        }
        echo json_encode(["status" => "success", "data" => $data]);
    } else {
        echo json_encode(["status" => "error", "message" => "Database query failed."]);
    }
}

function getCompanyTaxes($conn) {
    $month = isset($_GET['month']) ? $_GET['month'] : '';
    $sql = "SELECT * FROM company_finances WHERE finance_month = ?";
    $stmt = $conn->prepare($sql);
    if($stmt) {
        $stmt->bind_param("s", $month);
        $stmt->execute();
        $result = $stmt->get_result();
        $row = $result->fetch_assoc();
        if($row) {
            echo json_encode(["status" => "success", "data" => $row]);
        } else {
            echo json_encode(["status" => "success", "data" => null]);
        }
    } else {
        echo json_encode(["status" => "error", "message" => "Database query failed."]);
    }
}

function addEmployee($conn) {
    // Read JSON POST payload
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if(!$data || !isset($data['first_name']) || !isset($data['id_number'])) {
        echo json_encode(["status" => "error", "message" => "Invalid payload data."]);
        return;
    }

    $fname = $data['first_name'];
    $lname = $data['last_name'];
    $id_num = $data['id_number'];
    $phone = $data['phone_number'];
    $location = $data['home_location'];
    $kra = $data['kra_pin'];
    $nssf = $data['nssf_number'];
    $sha = $data['sha_number'];
    $role = $data['role'];
    $section = intval($data['section_id']);
    $region = isset($data['region_name']) ? $data['region_name'] : '';
    $clientId = !empty($data['client_id']) ? intval($data['client_id']) : null;
    $salary = floatval($data['basic_salary']);
    $bank_name = isset($data['bank_name']) ? $data['bank_name'] : '';
    $account_number = isset($data['account_number']) ? $data['account_number'] : '';

    // Map section IDs if they are 1,2,3,4.
    $sql = "INSERT INTO employees (first_name, last_name, id_number, phone_number, home_location, kra_pin, nssf_number, sha_number, role, section_id, region_name, client_id, basic_salary, bank_name, account_number) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    try {
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("sssssssssisidss", $fname, $lname, $id_num, $phone, $location, $kra, $nssf, $sha, $role, $section, $region, $clientId, $salary, $bank_name, $account_number);
            if($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Employee added successfully"]);
            } else {
                echo json_encode(["status" => "error", "message" => "Failed to add employee. Make sure ID, KRA, NSSF, and SHA are unique."]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "Database schema error. Did you run alter_employees.sql?"]);
        }
    } catch (Exception $e) {
        $errorMsg = $e->getMessage();
        if (strpos($errorMsg, "Unknown column") !== false) {
            echo json_encode(["status" => "error", "message" => "Database columns missing! Please import database/alter_employees.sql in phpMyAdmin."]);
        } else {
            echo json_encode(["status" => "error", "message" => "MySQL Error: " . $errorMsg]);
        }
    }
}

function updateEmployee($conn) {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if(!$data || !isset($data['id'])) {
        echo json_encode(["status" => "error", "message" => "Invalid payload data."]);
        return;
    }

    $id = intval($data['id']);
    $fname = $data['first_name'];
    $lname = $data['last_name'];
    $id_num = $data['id_number'];
    $phone = $data['phone_number'];
    $location = $data['home_location'];
    $kra = $data['kra_pin'];
    $nssf = $data['nssf_number'];
    $sha = $data['sha_number'];
    $role = $data['role'];
    $section = intval($data['section_id']);
    $region = isset($data['region_name']) ? $data['region_name'] : '';
    $clientId = !empty($data['client_id']) ? intval($data['client_id']) : null;
    $salary = floatval($data['basic_salary']);
    $bank_name = isset($data['bank_name']) ? $data['bank_name'] : '';
    $account_number = isset($data['account_number']) ? $data['account_number'] : '';

    $sql = "UPDATE employees SET first_name=?, last_name=?, id_number=?, phone_number=?, home_location=?, kra_pin=?, nssf_number=?, sha_number=?, role=?, section_id=?, region_name=?, client_id=?, basic_salary=?, bank_name=?, account_number=? WHERE id=?";
    
    try {
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("sssssssssisidssi", $fname, $lname, $id_num, $phone, $location, $kra, $nssf, $sha, $role, $section, $region, $clientId, $salary, $bank_name, $account_number, $id);
            if($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Employee updated successfully"]);
            } else {
                echo json_encode(["status" => "error", "message" => "Failed to update employee."]);
            }
        } else {
            echo json_encode(["status" => "error", "message" => "Database statement preparation failed."]);
        }
    } catch (Exception $e) {
        echo json_encode(["status" => "error", "message" => "MySQL Error: " . $e->getMessage()]);
    }
}

function getEmployees($conn) {
    // Check if table exists
    $check = $conn->query("SHOW TABLES LIKE 'employees'");
    if ($check->num_rows == 0) {
        echo json_encode(["status" => "error", "message" => "Table 'employees' does not exist."]);
        return;
    }

    $sectionFilter = isset($_GET['section_id']) ? intval($_GET['section_id']) : 0;
    
    $sql = "SELECT e.*, s.name as section_name, c.company_name 
            FROM employees e 
            LEFT JOIN sections s ON e.section_id = s.id 
            LEFT JOIN clients c ON e.client_id = c.id";
            
    if ($sectionFilter > 0) {
        $sql .= " WHERE e.section_id = $sectionFilter ";
    }
    
    $sql .= " ORDER BY e.created_at DESC";
    
    $result = $conn->query($sql);

    $employees = [];
    if ($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $employees[] = $row;
        }
        echo json_encode(["status" => "success", "data" => $employees]);
    } else {
        echo json_encode(["status" => "success", "data" => []]); // Empty list
    }
}

function getDashboardStats($conn) {
    try {
        $stats = [
            "total_staff" => 0,
            "total_gross" => 0,
            "total_paye" => 0,
            "total_deductions" => 0,
            "sections" => []
        ];

        $res = $conn->query("SELECT COUNT(*) as c FROM employees WHERE status='Active'");
        if($res && $r = $res->fetch_assoc()) $stats["total_staff"] = $r['c'];

        // Get limits based on most recent payroll
        $res = $conn->query("SELECT payroll_month FROM payroll_records ORDER BY id DESC LIMIT 1");
        if($res && $res->num_rows > 0) {
            $month = $res->fetch_assoc()['payroll_month'];
            
            $sql2 = "SELECT SUM(gross_pay) as g, SUM(paye_tax) as p, SUM(nssf_deduction + sha_deduction + housing_levy) as d FROM payroll_records WHERE payroll_month = ?";
            $stmt = $conn->prepare($sql2);
            $stmt->bind_param("s", $month);
            $stmt->execute();
            $totals = $stmt->get_result()->fetch_assoc();
            
            $stats["total_gross"] = $totals['g'] ?: 0;
            $stats["total_paye"] = $totals['p'] ?: 0;
            $stats["total_deductions"] = $totals['d'] ?: 0;

            // Group by section
            $sql3 = "SELECT s.name, COUNT(p.id) as headcount, SUM(p.gross_pay) as total_gross, SUM(p.net_pay) as total_net 
                     FROM payroll_records p
                     JOIN employees e ON p.employee_id = e.id
                     JOIN sections s ON e.section_id = s.id
                     WHERE p.payroll_month = ?
                     GROUP BY s.id";
            $stmt3 = $conn->prepare($sql3);
            $stmt3->bind_param("s", $month);
            $stmt3->execute();
            $secRes = $stmt3->get_result();
            while($srow = $secRes->fetch_assoc()){
                $stats["sections"][] = $srow;
            }
        }

        echo json_encode(["status" => "success", "data" => $stats]);

    } catch (Exception $e) {
        echo json_encode(["status" => "error", "message" => "MySQL Error: " . $e->getMessage()]);
    }
}

function adminLogin() {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);

    if(!$data || !isset($data['username']) || !isset($data['password'])) {
        echo json_encode(["status" => "error", "message" => "Missing credentials."]);
        return;
    }

    $user = trim($data['username']);
    $pass = trim($data['password']);

    // Hardcoded requested admin credentials for immediate local XAMPP access
    if (strtolower($user) === 'admin' && $pass === 'c@#365') {
        echo json_encode(["status" => "success", "message" => "Authenticated"]);
    } else {
        echo json_encode(["status" => "error", "message" => "Invalid username or password!"]);
    }
}

// ---- CLIENTS APIs ----
function getClients($conn) {
    // Select clients and count assigned active guards
    $sql = "SELECT c.*, s.name as section_name, COUNT(e.id) as total_guards 
            FROM clients c
            LEFT JOIN sections s ON c.branch_id = s.id
            LEFT JOIN employees e ON e.client_id = c.id AND e.status = 'Active'
            GROUP BY c.id ORDER BY c.created_at DESC";
    $result = $conn->query($sql);
    
    $clients = [];
    if($result && $result->num_rows > 0) {
        while($row = $result->fetch_assoc()) {
            $clients[] = $row;
        }
    }
    echo json_encode(["status" => "success", "data" => $clients]);
}

function addClient($conn) {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    if(!$data || !isset($data['company_name'])) {
        echo json_encode(["status" => "error", "message" => "Invalid payload."]); return;
    }

    $sql = "INSERT INTO clients (company_name, contact_person, phone_number, branch_id, region_name) VALUES (?, ?, ?, ?, ?)";
    $stmt = $conn->prepare($sql);
    if($stmt) {
        $stmt->bind_param("sssis", $data['company_name'], $data['contact_person'], $data['phone_number'], $data['branch_id'], $data['region_name']);
        if($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Client added"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Failed to add client"]);
        }
    }
}

function updateClient($conn) {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    if(!$data || !isset($data['id'])) {
        echo json_encode(["status" => "error", "message" => "Invalid payload."]); return;
    }

    $sql = "UPDATE clients SET company_name=?, contact_person=?, phone_number=?, branch_id=?, region_name=? WHERE id=?";
    $stmt = $conn->prepare($sql);
    if($stmt) {
        $stmt->bind_param("sssisi", $data['company_name'], $data['contact_person'], $data['phone_number'], $data['branch_id'], $data['region_name'], $data['id']);
        if($stmt->execute()) {
            echo json_encode(["status" => "success", "message" => "Client updated"]);
        } else {
            echo json_encode(["status" => "error", "message" => "Failed to update client"]);
        }
    }
}

function deleteClient($conn) {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if(!$data || !isset($data['id']) || !isset($data['admin_password'])) {
        echo json_encode(["status" => "error", "message" => "Missing parameters."]);
        return;
    }
    
    if($data['admin_password'] !== 'c@#365') {
        echo json_encode(["status" => "error", "message" => "Unauthorized access. Incorrect admin password."]);
        return;
    }
    
    $id = intval($data['id']);
    $sql = "DELETE FROM clients WHERE id=?";
    
    try {
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("i", $id);
            if($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Client permanently deleted."]);
            } else {
                echo json_encode(["status" => "error", "message" => "Failed to update employee"]);
            }
        }
    } catch(Exception $e) {
        echo json_encode(["status" => "error", "message" => "Exception: " . $e->getMessage()]);
    }
}

function deleteEmployee($conn) {
    $json = file_get_contents('php://input');
    $data = json_decode($json, true);
    
    if(!$data || !isset($data['id']) || !isset($data['admin_password'])) {
        echo json_encode(["status" => "error", "message" => "Missing parameters."]);
        return;
    }
    
    if($data['admin_password'] !== 'c@#365') {
        echo json_encode(["status" => "error", "message" => "Unauthorized access. Incorrect admin password."]);
        return;
    }
    
    $id = intval($data['id']);
    $sql = "DELETE FROM employees WHERE id=?";
    
    try {
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("i", $id);
            if($stmt->execute()) {
                echo json_encode(["status" => "success", "message" => "Employee permanently deleted."]);
            } else {
                echo json_encode(["status" => "error", "message" => "Failed to delete employee"]);
            }
        }
    } catch(Exception $e) {
        echo json_encode(["status" => "error", "message" => "Database Error: " . $e->getMessage()]);
    }
}

// ---- DASHBOARD APIs ----?>
