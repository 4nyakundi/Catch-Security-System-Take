<?php
require_once 'db_connect.php';

try {
    // Check if region_name exists
    $result = $conn->query("SHOW COLUMNS FROM employees LIKE 'region_name'");
    if ($result->num_rows == 0) {
        $conn->query("ALTER TABLE employees ADD COLUMN region_name VARCHAR(100) AFTER section_id");
        echo "Successfully added region_name column!";
    } else {
        echo "region_name column already exists.";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
?>
