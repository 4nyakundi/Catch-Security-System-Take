// Tab Switching Logic
function switchTab(tabId, el, sectionId = null) {
    // Update active class on sidebar items
    document.querySelectorAll('.sidebar ul li').forEach(li => li.classList.remove('active'));
    if(el) el.classList.add('active');

    // Hide all views
    document.querySelectorAll('.view-section').forEach(view => view.style.display = 'none');
    
    // Show selected view
    document.getElementById('view-' + tabId).style.display = 'block';

    // Update Page Title
    const titles = {
        'dashboard': 'Dashboard',
        'employees': sectionId ? 'Guards & Staff (Filtered)' : 'All Staff & Guards',
        'clients': 'Contracted Companies & Clients',
        'payroll': 'Process Payroll',
        'reports': 'Reports & Exports',
        'company': 'Company Taxes'
    };
    document.getElementById('page-title').innerText = titles[tabId] || 'Dashboard';

    if(tabId === 'employees') {
        loadEmployees(sectionId);
    } else if (tabId === 'clients') {
        loadClients();
    } else if (tabId === 'reports') {
        loadPayrollArchives();
    } else if (tabId === 'company') {
        loadCompanyTaxes();
    } else if (tabId === 'dashboard') {
        loadDashboard();
    }
}

function toggleSectionsMenu() {
    const menu = document.getElementById('sections-submenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function loadDashboard() {
    try {
        const response = await fetch('backend/api.php?action=get_dashboard_stats');
        const data = await response.json();
        if(data.status === 'success') {
            document.getElementById('dash-staff').innerText = data.data.total_staff;
            document.getElementById('dash-gross').innerText = 'Ksh ' + parseFloat(data.data.total_gross).toLocaleString();
            document.getElementById('dash-paye').innerText = 'Ksh ' + parseFloat(data.data.total_paye).toLocaleString();
            document.getElementById('dash-deductions').innerText = 'Ksh ' + parseFloat(data.data.total_deductions).toLocaleString();
            
            const list = document.getElementById('dash-section-list');
            list.innerHTML = '';
            if(data.data.sections && data.data.sections.length > 0) {
                data.data.sections.forEach(s => {
                    list.innerHTML += `
                        <tr>
                            <td>${s.name}</td>
                            <td>${s.headcount}</td>
                            <td>Ksh ${parseFloat(s.total_gross || 0).toLocaleString()}</td>
                            <td>Ksh ${parseFloat(s.total_net || 0).toLocaleString()}</td>
                        </tr>
                    `;
                });
            } else {
                list.innerHTML = '<tr><td colspan="4" style="text-align: center;">No payroll records found for the latest month.</td></tr>';
            }
        }
    } catch(e) {
        console.error("Dashboard fetch error:", e);
    }
}

// Fetch Employees from Backend
let globalEmployees = [];
async function loadEmployees(sectionId = null) {
    const list = document.getElementById('employees-list');
    list.innerHTML = '<tr><td colspan="8" style="text-align:center;">Loading...</td></tr>';

    try {
        let url = 'backend/api.php?action=get_employees';
        if(sectionId) url += '&section_id=' + sectionId;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === 'success') {
            globalEmployees = data.data; // Cache for editing
            list.innerHTML = '';
            data.data.forEach(emp => {
                list.innerHTML += `
                    <tr>
                        <td>${emp.id_number}</td>
                        <td>${emp.first_name} ${emp.last_name}</td>
                        <td><span class="btn btn-accent" style="padding:0.2rem 0.5rem; font-size:0.8rem;">${emp.role}</span></td>
                        <td style="font-weight: 600; color: var(--csl-dark);">${emp.company_name || '<span style="color:#aaa; font-weight:normal;">Unassigned</span>'}</td>
                        <td>${emp.section_name || 'N/A'}</td>
                        <td>${emp.region_name || 'Unassigned'}</td>
                        <td>Ksh ${parseFloat(emp.basic_salary).toLocaleString()}</td>
                        <td>
                            <button class="btn btn-primary" onclick="editEmployee(${emp.id})" style="padding: 0.3rem 0.6rem;"><i class="fa-solid fa-pen"></i></button>
                            <button class="btn" style="background:#dc3545; color:white; padding: 0.3rem 0.6rem; margin-left:5px;" onclick="promptDelete('employee', ${emp.id})"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        } else {
            list.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">No records found or error connecting to DB.</td></tr>';
        }
    } catch (e) {
        console.warn("Backend error.", e);
        list.innerHTML = '<tr><td colspan="8" style="text-align:center; color:red;">Connection error.</td></tr>';
    }
}

let payrollPreviewData = [];

// Generate Editable Payroll Preview
async function generatePayrollPreview() {
    const month = document.getElementById('payroll-month').value;
    const statusDiv = document.getElementById('payroll-status');
    if(!month) return;

    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating preview...';
    document.getElementById('payroll-preview-section').style.display = 'none';

    try {
        const response = await fetch(`backend/api.php?action=generate_payroll_preview`);
        const data = await response.json();
        
        if(data.status === 'success') {
            payrollPreviewData = data.data.map(emp => {
                // Initialize default calculations for 30 days
                emp.basic_salary = parseFloat(emp.basic_salary) || 0;
                emp.days = 30;
                emp.gross = emp.basic_salary; // Gross 2 (Actual)
                
                return calculatePayrollTaxes(emp);
            });
            
            renderPayrollPreviewTable();
            document.getElementById('payroll-preview-section').style.display = 'block';
            statusDiv.innerHTML = '';
        } else {
            statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: ${data.message}`;
        }
    } catch(e) {
        statusDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error connecting to backend.';
    }
}

function calculatePayrollTaxes(emp) {
    // 1. Gross 2 based on days
    emp.gross = (emp.basic_salary / 30) * emp.days;
    let gross = emp.gross;

    // 2. NSSF: 6% capped at Ksh 2,160 (for 2024 tier 2 upper limit)
    emp.nssf = Math.min(gross * 0.06, 2160);
    
    // 3. SHA: 2.75% of gross
    emp.sha = gross * 0.0275;
    
    // 4. Housing Levy: 1.5% of gross
    emp.levy = gross * 0.015;

    // 5. PAYE (Simplified 2024 logic)
    let taxable = gross - emp.nssf - emp.levy;
    let paye = 0;
    if(taxable > 24000) {
        let tax = 24000 * 0.10;
        if(taxable > 32333) {
            tax += (32333 - 24000) * 0.25;
            if(taxable > 500000) {
                tax += (500000 - 32333) * 0.30;
                tax += (taxable - 500000) * 0.35;
            } else {
                tax += (taxable - 32333) * 0.30;
            }
        } else {
            tax += (taxable - 24000) * 0.25;
        }
        paye = Math.max(0, tax - 2400); // subtract personal relief
    }
    emp.paye = paye;
    
    emp.net = gross - emp.nssf - emp.sha - emp.levy - emp.paye;

    return emp;
}

function renderPayrollPreviewTable() {
    const list = document.getElementById('payroll-preview-list');
    list.innerHTML = '';
    
    if(payrollPreviewData.length === 0) {
        list.innerHTML = '<tr><td colspan="16" style="text-align:center;">No active employees found.</td></tr>';
        return;
    }

    payrollPreviewData.forEach((emp, index) => {
        list.innerHTML += `
            <tr>
                <td>${emp.first_name} ${emp.last_name}</td>
                <td>${emp.id_number}</td>
                <td>${emp.phone_number || 'N/A'}</td>
                <td>${emp.account_number || 'N/A'}</td>
                <td>${emp.sha_number || 'N/A'}</td>
                <td>${emp.nssf_number || 'N/A'}</td>
                <td>${emp.kra_pin || 'N/A'}</td>
                <td>${emp.role}</td>
                <td>
                    <input type="number" value="${emp.days}" min="0" max="31" 
                           style="width: 60px; padding: 0.2rem;" 
                           onchange="updatePayrollRow(${index}, this.value)">
                </td>
                <td>${emp.basic_salary.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td id="row-gross-${index}">${emp.gross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td id="row-nssf-${index}">${emp.nssf.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td id="row-sha-${index}">${emp.sha.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td id="row-levy-${index}">${emp.levy.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td id="row-paye-${index}">${emp.paye.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td id="row-net-${index}" style="font-weight:bold; color:var(--csl-green);">${emp.net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
            </tr>
        `;
    });
}

function updatePayrollRow(index, newDays) {
    let days = parseFloat(newDays) || 0;
    if(days < 0) days = 0;
    
    payrollPreviewData[index].days = days;
    payrollPreviewData[index] = calculatePayrollTaxes(payrollPreviewData[index]);
    
    const emp = payrollPreviewData[index];
    document.getElementById(`row-gross-${index}`).innerText = emp.gross.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById(`row-nssf-${index}`).innerText = emp.nssf.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById(`row-sha-${index}`).innerText = emp.sha.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById(`row-levy-${index}`).innerText = emp.levy.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById(`row-paye-${index}`).innerText = emp.paye.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
    document.getElementById(`row-net-${index}`).innerText = emp.net.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

async function saveFinalPayroll() {
    const month = document.getElementById('payroll-month').value;
    const btn = document.getElementById('save-payroll-btn');
    const statusDiv = document.getElementById('payroll-status');
    
    if(!month || payrollPreviewData.length === 0) return;

    btn.innerText = 'Saving...';
    btn.disabled = true;

    try {
        const response = await fetch('backend/api.php?action=save_payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ month: month, records: payrollPreviewData })
        });
        
        const rawText = await response.text();
        try {
            const data = JSON.parse(rawText);
            if(data.status === 'success') {
                statusDiv.innerHTML = `<i class="fa-solid fa-check"></i> Successfully saved payroll for ${data.count} employees.`;
                document.getElementById('payroll-preview-section').style.display = 'none';
            } else {
                statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: ${data.message}`;
            }
        } catch (jsonErr) {
            console.error("Backend Error:", rawText);
            statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Backend Error: Did you run the database alter script?`;
        }
    } catch(e) {
        statusDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error connecting to backend.';
    } finally {
        btn.innerHTML = '<i class="fa-solid fa-save"></i> Save Final Payroll';
        btn.disabled = false;
    }
}

// Fetch Payroll Archives (Folders)
async function loadPayrollArchives() {
    const tree = document.getElementById('payroll-folder-tree');
    tree.innerHTML = '<div style="text-align:center; padding:1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Loading archives...</div>';
    
    // Hide report content until a sub-folder is clicked
    document.getElementById('report-content').style.display = 'none';
    document.getElementById('report-title-display').innerText = 'Select a Report Folder';
    
    try {
        const response = await fetch('backend/api.php?action=get_payroll_months');
        const data = await response.json();
        
        tree.innerHTML = '';
        if (data.status === 'success' && data.data.length > 0) {
            data.data.forEach(month => {
                tree.innerHTML += `
                    <div class="folder-month" style="margin-bottom: 0.5rem;">
                        <div style="cursor: pointer; padding: 0.5rem; background: #f8fafc; border-radius: 4px; display: flex; align-items: center; gap: 10px; font-weight: bold; border: 1px solid #e2e8f0;" onclick="toggleMonthFolder('${month}', this)">
                            <i class="fa-solid fa-folder text-green" id="icon-month-${month}"></i> 
                            ${month}
                        </div>
                        <div id="subfolders-${month}" style="display: none; padding-left: 1.5rem; padding-top: 0.5rem; border-left: 1px dashed #ccc; margin-left: 0.8rem;">
                            <!-- Clients loaded here -->
                        </div>
                    </div>
                `;
            });
        } else {
            tree.innerHTML = '<div style="color:#777; font-size: 0.9rem; padding: 1rem;">No saved payrolls found.</div>';
        }
    } catch(e) {
        tree.innerHTML = '<div style="color:red; font-size: 0.9rem; padding: 1rem;">Error loading archives.</div>';
    }
}

async function toggleMonthFolder(month, el) {
    const sub = document.getElementById(`subfolders-${month}`);
    const icon = document.getElementById(`icon-month-${month}`);
    
    // Toggle visibility
    if (sub.style.display === 'block') {
        sub.style.display = 'none';
        icon.classList.remove('fa-folder-open');
        icon.classList.add('fa-folder');
        return;
    }
    
    sub.style.display = 'block';
    icon.classList.remove('fa-folder');
    icon.classList.add('fa-folder-open');
    
    // If already loaded, don't fetch again
    if (sub.innerHTML.trim() !== '<!-- Clients loaded here -->') return;
    
    sub.innerHTML = '<div style="font-size:0.8rem; color:#888;"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>';
    
    try {
        const response = await fetch(`backend/api.php?action=get_payroll_clients&month=${month}`);
        const data = await response.json();
        
        sub.innerHTML = '';
        if (data.status === 'success') {
            // Add "All Clients" option
            sub.innerHTML += `
                <div style="cursor: pointer; padding: 0.3rem 0; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; color: var(--csl-dark);" onclick="loadPayrollReport('${month}', 'all', 'All Active Guards')">
                    <i class="fa-solid fa-file-lines" style="color: var(--csl-green);"></i> All Clients Master Sheet
                </div>
            `;
            
            data.data.forEach(client => {
                sub.innerHTML += `
                    <div style="cursor: pointer; padding: 0.3rem 0; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; color: #444;" onclick="loadPayrollReport('${month}', '${client.id}', '${client.company_name.replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-file-invoice-dollar" style="color: #64748b;"></i> ${client.company_name}
                    </div>
                `;
            });
        } else {
            sub.innerHTML = '<div style="font-size:0.8rem; color:red;">Failed to load clients.</div>';
        }
    } catch(e) {
        sub.innerHTML = '<div style="font-size:0.8rem; color:red;">Network Error.</div>';
    }
}

// Fetch Payroll Data for Reports
async function loadPayrollReport(month, clientId = 'all', clientName = 'All Guards') {
    const list = document.getElementById('payroll-report-list');
    list.innerHTML = '<tr><td colspan="17" style="text-align:center;">Loading records...</td></tr>';
    
    document.getElementById('report-content').style.display = 'block';
    document.getElementById('report-title-display').innerText = `Payroll Report: ${month} - ${clientName}`;

    try {
        const response = await fetch(`backend/api.php?action=get_payroll_report&month=${month}&client_id=${clientId}`);
        const data = await response.json();
        
        list.innerHTML = '';
        if (data.status === 'success' && data.data.length > 0) {
            data.data.forEach(p => {
                const isOldRecord = parseFloat(p.basic_salary || 0) === 0;
                const daysDisplay = isOldRecord ? '' : (p.days_worked || 30);
                const basicDisplay = isOldRecord ? '' : parseFloat(p.basic_salary).toLocaleString(undefined, {minimumFractionDigits: 2});

                list.innerHTML += `
                    <tr>
                        <td>${p.first_name} ${p.last_name}</td>
                        <td>${p.id_number || 'N/A'}</td>
                        <td>${p.phone_number || 'N/A'}</td>
                        <td>${p.bank_name || 'N/A'}</td>
                        <td>${p.account_number || 'N/A'}</td>
                        <td>${p.sha_number || 'N/A'}</td>
                        <td>${p.nssf_number || 'N/A'}</td>
                        <td>${p.kra_pin || 'N/A'}</td>
                        <td>${p.role || 'N/A'}</td>
                        <td>${daysDisplay}</td>
                        <td>${basicDisplay}</td>
                        <td>${parseFloat(p.gross_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td>${parseFloat(p.nssf_deduction).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td>${parseFloat(p.sha_deduction).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td>${parseFloat(p.housing_levy).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td>${parseFloat(p.paye_tax).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                        <td style="font-weight:bold; color:var(--csl-green);">${parseFloat(p.net_pay).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                    </tr>
                `;
            });
        } else {
            list.innerHTML = '<tr><td colspan="17" style="text-align:center;">No payroll records found for this month. Please Run Payroll first.</td></tr>';
        }
    } catch (e) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Backend connection failed.</td></tr>';
    }
}

// Load Company Taxes
async function loadCompanyTaxes() {
    const month = document.getElementById('company-tax-month').value;
    if(!month) return;

    try {
        const response = await fetch(`backend/api.php?action=get_company_taxes&month=${month}`);
        const data = await response.json();
        
        if (data.status === 'success' && data.data) {
            document.getElementById('comp-nssf').innerText = 'Ksh ' + parseFloat(data.data.total_employer_nssf).toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById('comp-levy').innerText = 'Ksh ' + parseFloat(data.data.total_employer_housing_levy).toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById('comp-nita').innerText = 'Ksh ' + parseFloat(data.data.total_nita).toLocaleString(undefined, {minimumFractionDigits: 2});
            document.getElementById('comp-paye').innerText = 'Ksh ' + parseFloat(data.data.total_paye_remitted).toLocaleString(undefined, {minimumFractionDigits: 2});
        } else {
            document.getElementById('comp-nssf').innerText = 'Ksh 0.00';
            document.getElementById('comp-levy').innerText = 'Ksh 0.00';
            document.getElementById('comp-nita').innerText = 'Ksh 0.00';
            document.getElementById('comp-paye').innerText = 'Ksh 0.00';
        }
    } catch(e) {
        console.error("Failed to load taxes", e);
    }
}

// Export to Excel using SheetJS
function exportToExcel() {
    let table = document.getElementById("payroll-report-table");
    let wb = XLSX.utils.table_to_book(table, {sheet: "Payroll Report"});
    XLSX.writeFile(wb, "Catch_Security_Payroll_Report.xlsx");
}

// Export to PDF using html2pdf
function exportToPDF() {
    const element = document.getElementById('report-content');
    
    // Temporarily remove overflow constraints so html2canvas doesn't clip the table
    element.classList.remove('table-container');
    element.style.overflow = 'visible';

    const opt = {
        margin:       [0.15, 0.2], // [top/bottom, left/right] in inches
        filename:     'Catch_Security_Payroll_Report.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true }, // useCORS prevents external logos from vanishing
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' }
    };
    
    html2pdf().set(opt).from(element).save().then(() => {
        // Restore properties after export
        element.classList.add('table-container');
        element.style.overflow = '';
    });
}

// Modal Logic - Employees
async function openAddEmployeeModal() {
    document.getElementById('emp-edit-id').value = '';
    document.getElementById('modal-title').innerText = 'Register New Employee';
    document.getElementById('submit-emp-btn').innerText = 'Save Employee';
    document.getElementById('addEmployeeForm').reset();
    document.getElementById('addEmployeeModal').style.display = 'block';
    document.getElementById('emp-submit-status').innerText = '';
    updateRegionsDropdown();
    
    // Fetch and populate clients
    populateClientDropdown();
}

let globalClientListForForm = [];

async function populateClientDropdown(selectedClientId = null) {
    const clientSelect = document.getElementById('emp-client');
    clientSelect.innerHTML = '<option value="">Unassigned / Floating Guard</option>';
    try {
        const response = await fetch('backend/api.php?action=get_clients');
        const data = await response.json();
        if(data.status === 'success') {
            globalClientListForForm = data.data;
            filterClientsLocally(selectedClientId);
        }
    } catch(e) { console.error("Failed to fetch clients for dropdown", e); }
}

function filterClientsLocally(selectedClientId = null) {
    const clientSelect = document.getElementById('emp-client');
    const bId = document.getElementById('emp-section').value;
    const rName = document.getElementById('emp-region').value;
    
    const currentVal = selectedClientId || clientSelect.value;
    clientSelect.innerHTML = '<option value="">Unassigned / Floating Guard</option>';
    
    globalClientListForForm.forEach(c => {
        if (c.branch_id == bId && c.region_name === rName) {
            clientSelect.innerHTML += `<option value="${c.id}">${c.company_name}</option>`;
        }
    });

    if (currentVal) clientSelect.value = currentVal;
}

function updateRegionsDropdown() {
    const branch = document.getElementById('emp-section').value;
    const regionSelect = document.getElementById('emp-region');
    regionSelect.innerHTML = ''; // clear existing
    
    if (branch == '1') { // Mombasa
        const options = ['Nyali', 'Mtwapa', 'Mombasa Cbd', 'Changamwe'];
        options.forEach(opt => {
            regionSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
    } else if (branch == '2') { // Nairobi
        regionSelect.innerHTML += `<option value="Nairobi Cbd">Nairobi Cbd</option>`;
    } else {
        regionSelect.innerHTML = `<option value="">Select Branch First</option>`;
    }
    
    filterClientsLocally();
}

function editEmployee(id) {
    const emp = globalEmployees.find(e => e.id == id);
    if(!emp) return;
    
    document.getElementById('emp-edit-id').value = emp.id;
    document.getElementById('modal-title').innerText = 'Edit Employee';
    document.getElementById('submit-emp-btn').innerText = 'Update Employee';
    
    // Fill fields
    document.getElementById('emp-fname').value = emp.first_name;
    document.getElementById('emp-lname').value = emp.last_name;
    document.getElementById('emp-id').value = emp.id_number;
    document.getElementById('emp-phone').value = emp.phone_number || '';
    document.getElementById('emp-location').value = emp.home_location || '';
    document.getElementById('emp-kra').value = emp.kra_pin || '';
    document.getElementById('emp-nssf').value = emp.nssf_number || '';
    document.getElementById('emp-sha').value = emp.sha_number || '';
    document.getElementById('emp-role').value = emp.role;
    document.getElementById('emp-section').value = emp.section_id;
    updateRegionsDropdown();
    document.getElementById('emp-region').value = emp.region_name || '';
    populateClientDropdown(emp.client_id);
    document.getElementById('emp-bank').value = emp.bank_name || '';
    document.getElementById('emp-account').value = emp.account_number || '';
    document.getElementById('emp-salary').value = emp.basic_salary;
    
    document.getElementById('addEmployeeModal').style.display = 'block';
    document.getElementById('emp-submit-status').innerText = '';
}

function closeAddEmployeeModal() {
    document.getElementById('addEmployeeModal').style.display = 'none';
    document.getElementById('addEmployeeForm').reset();
}

// Close Modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('addEmployeeModal');
    if (event.target == modal) {
        closeAddEmployeeModal();
    }
}

// Add New Employee Form Submission
async function submitEmployeeForm(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-emp-btn');
    const statusDiv = document.getElementById('emp-submit-status');
    
    // Gather all form data including the new Kenyan requirements
    const editId = document.getElementById('emp-edit-id').value;
    const data = {
        id: editId,
        first_name: document.getElementById('emp-fname').value,
        last_name: document.getElementById('emp-lname').value,
        id_number: document.getElementById('emp-id').value,
        phone_number: document.getElementById('emp-phone').value,
        home_location: document.getElementById('emp-location').value,
        kra_pin: document.getElementById('emp-kra').value,
        nssf_number: document.getElementById('emp-nssf').value,
        sha_number: document.getElementById('emp-sha').value,
        role: document.getElementById('emp-role').value,
        section_id: document.getElementById('emp-section').value,
        region_name: document.getElementById('emp-region').value,
        client_id: document.getElementById('emp-client').value,
        bank_name: document.getElementById('emp-bank').value,
        account_number: document.getElementById('emp-account').value,
        basic_salary: document.getElementById('emp-salary').value
    };

    btn.innerText = 'Saving...';
    btn.disabled = true;
    
    // Call update API if ID exists, else call add API
    const endpoint = editId ? 'backend/api.php?action=update_employee' : 'backend/api.php?action=add_employee';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        // Ensure successful HTTP response before parsing JSON
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const rawText = await response.text();
        try {
            const result = JSON.parse(rawText);
            if(result.status === 'success') {
                statusDiv.innerHTML = '<span class="text-green"><i class="fa-solid fa-check"></i> ' + (editId ? 'Employee updated successfully!' : 'Employee saved successfully!') + '</span>';
                setTimeout(() => {
                    closeAddEmployeeModal();
                    loadEmployees(); // Reload the list
                }, 1500);
            } else {
                statusDiv.innerHTML = `<span style="color:red;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${result.message}</span>`;
            }
        } catch (jsonErr) {
            console.error("JSON Parsing Error from PHP:", rawText);
            statusDiv.innerHTML = '<span style="color:red;"><i class="fa-solid fa-triangle-exclamation"></i> Backend returned an invalid response (Check your database connection).</span>';
        }

    } catch(err) {
        console.error(err);
        if(window.location.protocol === 'file:') {
            statusDiv.innerHTML = '<span style="color:red;"><i class="fa-solid fa-triangle-exclamation"></i> You cannot run this directly from a file. Please open via localhost (XAMPP).</span>';
        } else {
            statusDiv.innerHTML = '<span style="color:red;"><i class="fa-solid fa-triangle-exclamation"></i> Failed to connect to server. Check your XAMPP connection.</span>';
        }
    } finally {
        btn.innerText = 'Save Employee';
        btn.disabled = false;
    }
}

function logoutAdmin() {
    sessionStorage.removeItem('admin_auth');
    window.location.href = 'login.html';
}

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // If the dashboard stats section exists on the current page, load it immediately
    if (document.getElementById('dash-staff')) {
        loadDashboard();
        
        // Start Live Clock
        setInterval(() => {
            const now = new Date();
            const dateStr = now.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
            const timeStr = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            
            const clockEl = document.getElementById('live-clock');
            if (clockEl) {
                clockEl.innerHTML = `<div>${timeStr}</div><div style="font-size: 11px; color: #888;">${dateStr}</div>`;
            }
            
            // Sync Report Timestamp with live machine time
            const reportStamp = document.getElementById('report-timestamp');
            if (reportStamp) {
                reportStamp.innerText = `Report Generated On: ${dateStr} at ${timeStr} (System Time Sync)`;
            }
        }, 1000);
    }
});

// ==========================================
// CLIENTS MODULE LOGIC
// ==========================================
let globalClients = [];

async function loadClients() {
    const list = document.getElementById('clients-list');
    list.innerHTML = '<tr><td colspan="7" style="text-align:center;">Loading clients...</td></tr>';
    
    try {
        const response = await fetch('backend/api.php?action=get_clients');
        const data = await response.json();
        
        list.innerHTML = '';
        if(data.status === 'success' && data.data.length > 0) {
            globalClients = data.data;
            data.data.forEach(c => {
                list.innerHTML += `
                    <tr>
                        <td style="font-weight: 600; color: var(--csl-dark);"><i class="fa-solid fa-building" style="color:var(--csl-green);"></i> ${c.company_name}</td>
                        <td>${c.section_name || 'N/A'}</td>
                        <td>${c.region_name || 'N/A'}</td>
                        <td>${c.contact_person || 'N/A'}</td>
                        <td>${c.phone_number || 'N/A'}</td>
                        <td><span class="btn" style="background:#e2e8f0; padding:0.2rem 0.6rem; color:#333;"><i class="fa-solid fa-user-shield"></i> ${c.total_guards} Guards</span></td>
                        <td>
                            <button class="btn btn-primary" onclick="editClient(${c.id})" style="padding: 0.3rem 0.6rem;"><i class="fa-solid fa-pen"></i> Edit</button>
                            <button class="btn" style="background:#dc3545; color:white; padding: 0.3rem 0.6rem; margin-left:5px;" onclick="promptDelete('client', ${c.id})"><i class="fa-solid fa-trash"></i></button>
                        </td>
                    </tr>
                `;
            });
        } else {
            list.innerHTML = '<tr><td colspan="7" style="text-align:center;">No clients registered yet.</td></tr>';
        }
    } catch(e) {
        list.innerHTML = '<tr><td colspan="7" style="text-align:center; color:red;">Failed to connect to backend.</td></tr>';
    }
}

function openAddClientModal() {
    document.getElementById('addClientForm').reset();
    document.getElementById('client-edit-id').value = '';
    document.getElementById('client-modal-title').innerText = 'Register New Client';
    document.getElementById('submit-client-btn').innerText = 'Save Client';
    document.getElementById('client-submit-status').innerHTML = '';
    updateClientRegionsDropdown();
    document.getElementById('addClientModal').style.display = 'block';
}

function closeAddClientModal() {
    document.getElementById('addClientModal').style.display = 'none';
}

function updateClientRegionsDropdown() {
    const branch = document.getElementById('client-section').value;
    const regionSelect = document.getElementById('client-region');
    regionSelect.innerHTML = ''; 
    
    if (branch == '1') { 
        const options = ['Nyali', 'Mtwapa', 'Mombasa Cbd', 'Changamwe'];
        options.forEach(opt => {
            regionSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
    } else if (branch == '2') { 
        regionSelect.innerHTML += `<option value="Nairobi Cbd">Nairobi Cbd</option>`;
    } else {
        regionSelect.innerHTML = `<option value="">Select Branch First</option>`;
    }
}

function editClient(id) {
    const c = globalClients.find(x => x.id == id);
    if(!c) return;
    
    document.getElementById('client-edit-id').value = c.id;
    document.getElementById('client-modal-title').innerText = 'Edit Client';
    document.getElementById('submit-client-btn').innerText = 'Update Client';
    
    document.getElementById('client-name').value = c.company_name;
    document.getElementById('client-contact').value = c.contact_person;
    document.getElementById('client-phone').value = c.phone_number;
    document.getElementById('client-section').value = c.branch_id;
    updateClientRegionsDropdown();
    document.getElementById('client-region').value = c.region_name;
    
    document.getElementById('addClientModal').style.display = 'block';
}

async function submitClientForm(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-client-btn');
    const statusDiv = document.getElementById('client-submit-status');
    const editId = document.getElementById('client-edit-id').value;
    
    const data = {
        id: editId,
        company_name: document.getElementById('client-name').value,
        contact_person: document.getElementById('client-contact').value,
        phone_number: document.getElementById('client-phone').value,
        branch_id: document.getElementById('client-section').value,
        region_name: document.getElementById('client-region').value
    };

    btn.innerText = 'Saving...';
    btn.disabled = true;
    
    const endpoint = editId ? 'backend/api.php?action=update_client' : 'backend/api.php?action=add_client';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const result = await response.json();
        if(result.status === 'success') {
            statusDiv.innerHTML = `<span class="text-green"><i class="fa-solid fa-check"></i> ${result.message}</span>`;
            setTimeout(() => {
                closeAddClientModal();
                loadClients();
            }, 1000);
        } else {
            statusDiv.innerHTML = `<span style="color:red;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${result.message}</span>`;
        }
    } catch(err) {
        statusDiv.innerHTML = '<span style="color:red;">Failed to connect to server.</span>';
    } finally {
        btn.innerText = 'Save Client';
        btn.disabled = false;
    }
}

// ==========================================
// DELETION OVERFLOW / SECURITY ENGINE
// ==========================================
function promptDelete(type, id) {
    document.getElementById('pending-delete-type').value = type;
    document.getElementById('pending-delete-id').value = id;
    document.getElementById('admin-auth-password').value = '';
    document.getElementById('admin-auth-error').style.display = 'none';
    document.getElementById('adminAuthModal').style.display = 'block';
}

function closeAdminAuthModal() {
    document.getElementById('adminAuthModal').style.display = 'none';
}

async function submitAdminAuth() {
    const password = document.getElementById('admin-auth-password').value;
    const type = document.getElementById('pending-delete-type').value;
    const id = document.getElementById('pending-delete-id').value;
    const errorDiv = document.getElementById('admin-auth-error');
    const btn = document.getElementById('admin-auth-btn');
    
    if(!password) {
        errorDiv.innerText = "Password cannot be empty.";
        errorDiv.style.display = 'block';
        return;
    }
    
    btn.innerText = "Verifying...";
    btn.disabled = true;
    errorDiv.style.display = 'none';
    
    const endpoint = type === 'employee' ? 'backend/api.php?action=delete_employee' : 'backend/api.php?action=delete_client';
    
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, admin_password: password })
        });
        const result = await response.json();
        
        if(result.status === 'success') {
            closeAdminAuthModal();
            // Refresh specific tables dynamically
            if(type === 'employee') loadEmployees(document.getElementById('emp-section').value);
            if(type === 'client') loadClients();
        } else {
            errorDiv.innerText = result.message;
            errorDiv.style.display = 'block';
        }
    } catch(e) {
        errorDiv.innerText = "Connection Error to Server.";
        errorDiv.style.display = 'block';
    } finally {
        btn.innerText = "Verify & Delete";
        btn.disabled = false;
    }
}
