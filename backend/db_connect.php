<?php
// db_connect.php
$servername = "localhost";
$username = "root"; // Default XAMPP user
$password = ""; // Default XAMPP password
$dbname = "catch_security_db"; // As defined in schema.sql

try {
    $conn = new mysqli($servername, $username, $password, $dbname);
    if ($conn->connect_error) {
        throw new Exception($conn->connect_error);
    }
} catch (Exception $e) {
    // If called from API, return JSON
    if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], 'api.php') !== false) {
        echo json_encode(["status" => "error", "message" => "Database connection failed. Did you import schema.sql into XAMPP? Error: " . $e->getMessage()]);
        exit;
    } else {
        die("Connection failed: " . $e->getMessage());
    }
}
?>
