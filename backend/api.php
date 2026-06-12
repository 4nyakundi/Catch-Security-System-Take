<?php
// backend/api.php
header('Content-Type: application/json');

// Convert PHP errors and exceptions into JSON responses (helps the frontend avoid non-JSON replies)
set_error_handler(function($errno, $errstr, $errfile, $errline){
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "PHP Error: $errstr in $errfile on line $errline"]);
    exit;
});

set_exception_handler(function($ex){
    http_response_code(500);
    echo json_encode(["status" => "error", "message" => "Uncaught Exception: " . $ex->getMessage()]);
    exit;
});

function columnExists($conn, $table, $column) {
    $stmt = $conn->prepare("SELECT COUNT(*) AS c FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?");
    if (!$stmt) {
        return false;
    }
    $stmt->bind_param("ss", $table, $column);
    $stmt->execute();
    $result = $stmt->get_result();
    $row = $result->fetch_assoc();
    return isset($row['c']) && intval($row['c']) > 0;
}

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
    case 'generate_payroll_preview':
        generatePayrollPreview($conn);
        break;
    case 'save_payroll':
        savePayroll($conn);
        break;
    case 'get_payroll_report':
        getPayrollReport($conn);
        break;
    case 'get_payroll_months':
        getPayrollMonths($conn);
        break;
    case 'get_payroll_clients':
        getPayrollClients($conn);
        break;
    case 'get_company_taxes':
        getCompanyTaxes($conn);
        break;
    case 'debug_payroll_summary':
        debugPayrollSummary($conn);
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

function generatePayrollPreview($conn) {
    $sql = "SELECT e.id, e.first_name, e.last_name, e.id_number, e.phone_number, e.account_number, e.sha_number, e.nssf_number, e.kra_pin, e.role, e.basic_salary, e.payment_mode, e.payment_provider, e.bank_name, e.region_name, s.name AS branch_name, c.company_name, e.client_id FROM employees e LEFT JOIN sections s ON e.section_id = s.id LEFT JOIN clients c ON e.client_id = c.id WHERE e.status = 'Active'";
    $result = $conn->query($sql);
    if (!$result || $result->num_rows == 0) {
        echo json_encode(["status" => "error", "message" => "No active employees found."]);
        return;
    }

    $employees = [];
    while($emp = $result->fetch_assoc()) {
        $employees[] = $emp;
    }
    echo json_encode(["status" => "success", "data" => $employees]);
}

function savePayroll($conn) {
    try {
        $json = file_get_contents('php://input');
        $data = json_decode($json, true);

        if(!$data || !isset($data['month']) || !isset($data['records'])) {
            echo json_encode(["status" => "error", "message" => "Invalid payload."]);
            return;
        }

        $month = $data['month'];
        $records = $data['records'];

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

        $total_employer_nssf = 0;
        $total_employer_levy = 0;
        $total_nita = 0;
        $total_paye = 0;
        $count = 0;

        $baseColumns = [
            'employee_id', 'payroll_month', 'days_worked', 'basic_salary', 'gross_pay', 'nssf_deduction', 'sha_deduction', 'housing_levy', 'paye_tax', 'net_pay'
        ];
        $optionalColumns = [
            'payment_mode' => 's',
            'payment_provider' => 's',
            'branch_name' => 's',
            'region_name' => 's',
            'company_name' => 's',
            'client_id' => 'i',
            'account_number' => 's'
        ];

        $insertColumns = $baseColumns;
        $typeString = 'isiddddddd';
        $availableOptionalColumns = [];
        foreach ($optionalColumns as $col => $type) {
            if (columnExists($conn, 'payroll_records', $col)) {
                $insertColumns[] = $col;
                $typeString .= $type;
                $availableOptionalColumns[] = $col;
            }
        }

        $placeholders = implode(', ', array_fill(0, count($insertColumns), '?'));
        $stmt_insert = $conn->prepare("INSERT INTO payroll_records (" . implode(', ', $insertColumns) . ") VALUES ($placeholders)");
        if (!$stmt_insert) {
            throw new Exception("Failed to prepare INSERT statement. " . $conn->error);
        }

        foreach($records as $rec) {
            $emp_id = intval($rec['id']);
            $days = intval($rec['days']);
            $basic = floatval($rec['basic_salary']);
            $gross = floatval($rec['gross']);
            $nssf = floatval($rec['nssf']);
            $sha = floatval($rec['sha']);
            $levy = floatval($rec['levy']);
            $paye = floatval($rec['paye']);
            $net = floatval($rec['net']);
            $payment_mode = isset($rec['payment_mode']) ? $rec['payment_mode'] : 'Bank';
            $payment_provider = isset($rec['payment_provider']) ? $rec['payment_provider'] : ($rec['bank_name'] ?? 'Equity');
            $branch_name = isset($rec['branch_name']) ? $rec['branch_name'] : '';
            $region_name = isset($rec['region_name']) ? $rec['region_name'] : '';
            $company_name = isset($rec['company_name']) ? $rec['company_name'] : '';
            $client_id = isset($rec['client_id']) && $rec['client_id'] !== '' ? intval($rec['client_id']) : null;
            $account_number = isset($rec['account_number']) ? $rec['account_number'] : '';

            $params = [
                $typeString,
                $emp_id,
                $month,
                $days,
                $basic,
                $gross,
                $nssf,
                $sha,
                $levy,
                $paye,
                $net
            ];

            foreach ($availableOptionalColumns as $col) {
                switch ($col) {
                    case 'payment_mode':
                        $params[] = $payment_mode;
                        break;
                    case 'payment_provider':
                        $params[] = $payment_provider;
                        break;
                    case 'branch_name':
                        $params[] = $branch_name;
                        break;
                    case 'region_name':
                        $params[] = $region_name;
                        break;
                    case 'company_name':
                        $params[] = $company_name;
                        break;
                    case 'client_id':
                        $params[] = $client_id;
                        break;
                    case 'account_number':
                        $params[] = $account_number;
                        break;
                }
            }

            // Bind parameters dynamically
            $tmp = [];
            foreach ($params as $key => $value) {
                $tmp[$key] = &$params[$key];
            }
            call_user_func_array([$stmt_insert, 'bind_param'], $tmp);
            $stmt_insert->execute();

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
    } catch (Exception $e) {
        $errorMsg = $e->getMessage();
        if (strpos($errorMsg, "Unknown column") !== false || strpos($errorMsg, "Failed to prepare") !== false) {
            echo json_encode(["status" => "error", "message" => "Database columns missing! Please import database/alter_payroll_records.sql in phpMyAdmin."]);
        } else {
            echo json_encode(["status" => "error", "message" => "MySQL Error: " . $errorMsg]);
        }
    }
}

function getPayrollReport($conn) {
    $month = isset($_GET['month']) ? $_GET['month'] : '';
    $clientId = isset($_GET['client_id']) ? $_GET['client_id'] : 'all';
    $hasClientId = columnExists($conn, 'payroll_records', 'client_id');
    $hasCompanyName = columnExists($conn, 'payroll_records', 'company_name');
    $hasBranchName = columnExists($conn, 'payroll_records', 'branch_name');
    $hasRegionName = columnExists($conn, 'payroll_records', 'region_name');
    $hasPaymentMode = columnExists($conn, 'payroll_records', 'payment_mode');
    $hasPaymentProvider = columnExists($conn, 'payroll_records', 'payment_provider');
    $hasAccountNumber = columnExists($conn, 'payroll_records', 'account_number');

    $selectColumns = [
        'e.first_name',
        'e.last_name',
        'e.id_number',
        'e.phone_number',
        'e.sha_number',
        'e.nssf_number',
        'e.kra_pin',
        'e.role',
        'p.basic_salary',
        ($hasPaymentMode ? 'p.payment_mode' : "'Bank' AS payment_mode"),
        ($hasPaymentProvider ? 'p.payment_provider' : "'Equity' AS payment_provider"),
        ($hasAccountNumber ? 'p.account_number' : "'' AS account_number"),
        ($hasCompanyName ? 'p.company_name' : "'' AS company_name"),
        ($hasBranchName ? 'p.branch_name' : "'' AS branch_name"),
        ($hasRegionName ? 'p.region_name' : "'' AS region_name"),
        'p.gross_pay',
        'p.nssf_deduction',
        'p.sha_deduction',
        'p.housing_levy',
        'p.paye_tax',
        'p.net_pay',
        'p.days_worked'
    ];

    $sql = "SELECT " . implode(', ', $selectColumns) . " FROM payroll_records p LEFT JOIN employees e ON p.employee_id = e.id WHERE p.payroll_month = ?";

    if ($clientId === 'unassigned') {
        if ($hasClientId) {
            $sql .= " AND p.client_id IS NULL";
        } elseif ($hasCompanyName) {
            $sql .= " AND (p.company_name IS NULL OR p.company_name = '')";
        }
    } else if ($clientId !== 'all') {
        if ($hasClientId && is_numeric($clientId)) {
            $sql .= " AND p.client_id = ?";
        } elseif ($hasCompanyName) {
            $sql .= " AND p.company_name = ?";
        } else {
            // No reliable client/company column available; return no rows for this filtered request.
            echo json_encode(["status" => "success", "data" => []]);
            return;
        }
    }

    $stmt = $conn->prepare($sql);
    if($stmt) {
        if ($clientId !== 'all' && $clientId !== 'unassigned') {
            if ($hasClientId && is_numeric($clientId)) {
                $stmt->bind_param("si", $month, $clientId);
            } elseif ($hasCompanyName) {
                $stmt->bind_param("ss", $month, $clientId);
            }
        } else {
            $stmt->bind_param("s", $month);
        }

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

function getPayrollMonths($conn) {
    $sql = "SELECT DISTINCT payroll_month FROM payroll_records ORDER BY payroll_month DESC";
    $result = $conn->query($sql);
    $months = [];
    if ($result) {
        while($row = $result->fetch_assoc()) {
            $months[] = $row['payroll_month'];
        }
    }
    echo json_encode(["status" => "success", "data" => $months]);
}

function getPayrollClients($conn) {
    $month = isset($_GET['month']) ? $_GET['month'] : '';
    $hasClientId = columnExists($conn, 'payroll_records', 'client_id');
    $hasCompanyName = columnExists($conn, 'payroll_records', 'company_name');
    $clients = [];

    if ($hasClientId) {
        if ($hasCompanyName) {
            $sql = "SELECT DISTINCT p.client_id AS id, p.company_name FROM payroll_records p WHERE p.payroll_month = ? AND p.client_id IS NOT NULL ORDER BY p.company_name ASC";
        } else {
            $sql = "SELECT DISTINCT p.client_id AS id, COALESCE(c.company_name, '') AS company_name FROM payroll_records p LEFT JOIN clients c ON p.client_id = c.id WHERE p.payroll_month = ? AND p.client_id IS NOT NULL ORDER BY c.company_name ASC";
        }
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("s", $month);
            $stmt->execute();
            $result = $stmt->get_result();
            while($row = $result->fetch_assoc()) {
                $clients[] = $row;
            }
        }
    } elseif ($hasCompanyName) {
        $sql = "SELECT DISTINCT p.company_name FROM payroll_records p WHERE p.payroll_month = ? AND p.company_name IS NOT NULL AND p.company_name != '' ORDER BY p.company_name ASC";
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("s", $month);
            $stmt->execute();
            $result = $stmt->get_result();
            while($row = $result->fetch_assoc()) {
                $clients[] = ["id" => $row['company_name'], "company_name" => $row['company_name']];
            }
        }
    }

    // Also check if there are unassigned employees
    if ($hasClientId) {
        $sqlUnassigned = "SELECT COUNT(*) as count FROM payroll_records p WHERE p.payroll_month = ? AND p.client_id IS NULL";
    } elseif ($hasCompanyName) {
        $sqlUnassigned = "SELECT COUNT(*) as count FROM payroll_records p WHERE p.payroll_month = ? AND (p.company_name IS NULL OR p.company_name = '')";
    } else {
        $sqlUnassigned = "SELECT COUNT(*) as count FROM payroll_records p WHERE p.payroll_month = ?";
    }
    $stmtU = $conn->prepare($sqlUnassigned);
    if ($stmtU) {
        $stmtU->bind_param("s", $month);
        $stmtU->execute();
        $resU = $stmtU->get_result()->fetch_assoc();
        if ($resU && $resU['count'] > 0) {
            $clients[] = ["id" => "unassigned", "company_name" => "Unassigned / Floating Guards"];
        }
    }
    
    echo json_encode(["status" => "success", "data" => $clients]);
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

function debugPayrollSummary($conn) {
    $month = isset($_GET['month']) ? $_GET['month'] : '';
    if (!$month) {
        echo json_encode(["status" => "error", "message" => "Missing month parameter."]);
        return;
    }

    // Columns present in payroll_records
    $cols = [];
    $resCols = $conn->query("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'payroll_records'");
    if ($resCols) {
        while($r = $resCols->fetch_assoc()) {
            $cols[] = $r['COLUMN_NAME'];
        }
    }

    // Count total records for month
    $stmt = $conn->prepare("SELECT COUNT(*) as c FROM payroll_records WHERE payroll_month = ?");
    $total = 0;
    if ($stmt) {
        $stmt->bind_param("s", $month);
        $stmt->execute();
        $total = $stmt->get_result()->fetch_assoc()['c'];
    }

    // Sample up to 5 rows
    $sample = [];
    $stmt2 = $conn->prepare("SELECT * FROM payroll_records WHERE payroll_month = ? LIMIT 5");
    if ($stmt2) {
        $stmt2->bind_param("s", $month);
        $stmt2->execute();
        $res = $stmt2->get_result();
        while($r = $res->fetch_assoc()) {
            $sample[] = $r;
        }
    }

    echo json_encode(["status" => "success", "data" => ["columns" => $cols, "total" => intval($total), "sample" => $sample]]);
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
    $payment_mode = isset($data['payment_mode']) ? $data['payment_mode'] : 'Bank';
    $payment_provider = isset($data['payment_provider']) ? $data['payment_provider'] : '';
    $salary = floatval($data['basic_salary']);
    $bank_name = isset($data['bank_name']) ? $data['bank_name'] : '';
    $account_number = isset($data['account_number']) ? $data['account_number'] : '';

    // Map section IDs if they are 1,2,3,4.
    $sql = "INSERT INTO employees (first_name, last_name, id_number, phone_number, home_location, kra_pin, nssf_number, sha_number, role, section_id, region_name, client_id, payment_mode, payment_provider, bank_name, account_number, basic_salary) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    try {
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("sssssssssisissdss", $fname, $lname, $id_num, $phone, $location, $kra, $nssf, $sha, $role, $section, $region, $clientId, $payment_mode, $payment_provider, $bank_name, $account_number, $salary);
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
    $payment_mode = isset($data['payment_mode']) ? $data['payment_mode'] : 'Bank';
    $payment_provider = isset($data['payment_provider']) ? $data['payment_provider'] : '';
    $salary = floatval($data['basic_salary']);
    $bank_name = isset($data['bank_name']) ? $data['bank_name'] : '';
    $account_number = isset($data['account_number']) ? $data['account_number'] : '';

    $sql = "UPDATE employees SET first_name=?, last_name=?, id_number=?, phone_number=?, home_location=?, kra_pin=?, nssf_number=?, sha_number=?, role=?, section_id=?, region_name=?, client_id=?, payment_mode=?, payment_provider=?, bank_name=?, account_number=?, basic_salary=? WHERE id=?";
    
    try {
        $stmt = $conn->prepare($sql);
        if($stmt) {
            $stmt->bind_param("sssssssssisissdssi", $fname, $lname, $id_num, $phone, $location, $kra, $nssf, $sha, $role, $section, $region, $clientId, $payment_mode, $payment_provider, $bank_name, $account_number, $salary, $id);
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
