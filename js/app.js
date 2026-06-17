// Tab Switching Logic
function switchTab(tabId, el, sectionId = null) {
    // Update active class on sidebar items
    document.querySelectorAll('.sidebar ul li').forEach(li => li.classList.remove('active'));
    if (el) el.classList.add('active');

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

    if (tabId === 'employees') {
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

// Utility: escape text for safe HTML insertion
function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function toggleSectionsMenu() {
    const menu = document.getElementById('sections-submenu');
    menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

async function loadDashboard() {
    try {
        const response = await fetch('backend/api.php?action=get_dashboard_stats');
        const data = await response.json();
        if (data.status === 'success') {
            document.getElementById('dash-staff').innerText = data.data.total_staff;
            document.getElementById('dash-gross').innerText = 'Ksh ' + parseFloat(data.data.total_gross).toLocaleString();
            document.getElementById('dash-paye').innerText = 'Ksh ' + parseFloat(data.data.total_paye).toLocaleString();
            document.getElementById('dash-deductions').innerText = 'Ksh ' + parseFloat(data.data.total_deductions).toLocaleString();

            const list = document.getElementById('dash-section-list');
            list.innerHTML = '';
            if (data.data.sections && data.data.sections.length > 0) {
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
    } catch (e) {
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
        if (sectionId) url += '&section_id=' + sectionId;

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
    if (!month) return;

    statusDiv.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating preview...';
    document.getElementById('payroll-preview-section').style.display = 'none';

    try {
        const response = await fetch(`backend/api.php?action=generate_payroll_preview`);
        const data = await response.json();

        if (data.status === 'success') {
            payrollPreviewData = data.data.map(emp => {
                emp.basic_salary = parseFloat(emp.basic_salary) || 0;
                emp.days = 30;
                emp.payment_mode = emp.payment_mode || 'Bank';
                emp.payment_provider = emp.payment_provider || emp.bank_name || 'Equity';

                const saccoMapping = {
                    'Mombasa': {
                        'Nyali': 'CIA TABASURI SACCO',
                        'Mtwapa': 'CIA TABASURI SACCO',
                        'Mombasa Cbd': 'CIA TABASURI SACCO',
                        'Changamwe': 'CIA TABASURI SACCO'
                    },
                    'Nairobi': {
                        'Nairobi Cbd': 'IMARIKA SACCO'
                    }
                };
                if (emp.payment_mode === 'Sacco' && emp.branch_name && emp.region_name) {
                    const mappedProvider = saccoMapping[emp.branch_name] ? saccoMapping[emp.branch_name][emp.region_name] : null;
                    if (mappedProvider) emp.payment_provider = mappedProvider;
                }

                emp.account_number = emp.account_number || '';
                emp.sha_number = emp.sha_number || '';
                emp.nssf_number = emp.nssf_number || '';
                emp.kra_pin = emp.kra_pin || '';
                return calculatePayrollTaxes(emp);
            });

            renderPayrollPreviewTable();
            document.getElementById('payroll-preview-section').style.display = 'block';
            statusDiv.innerHTML = '';
        } else {
            statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: ${data.message}`;
        }
    } catch (e) {
        statusDiv.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error connecting to backend.';
    }
}

function calculatePayrollTaxes(emp) {
    emp.gross = (emp.basic_salary / 30) * emp.days;
    let gross = emp.gross;

    emp.nssf = Math.min(gross * 0.06, 2160);
    emp.sha = gross * 0.0275;
    emp.levy = gross * 0.015;

    let taxable = gross - emp.nssf - emp.levy;
    let paye = 0;
    if (taxable > 24000) {
        let tax = 24000 * 0.10;
        if (taxable > 32333) {
            tax += (32333 - 24000) * 0.25;
            if (taxable > 800000) {
                tax += (500000 - 32333) * 0.30;
                tax += 300000 * 0.325;
                tax += (taxable - 800000) * 0.35;
            } else if (taxable > 500000) {
                tax += (500000 - 32333) * 0.30;
                tax += (taxable - 500000) * 0.325;
            } else {
                tax += (taxable - 32333) * 0.30;
            }
        } else {
            tax += (taxable - 24000) * 0.25;
        }
        paye = Math.max(0, tax - 2400);
    }
    emp.paye = paye;

    emp.unif = (emp.payment_mode === 'Bank' && ['Equity', 'NCBA', 'DTB Bank'].includes(emp.payment_provider)) ? 300 : 0;
    emp.total_deduction = emp.nssf + emp.sha + emp.levy + emp.paye + emp.unif;
    emp.net = gross - emp.total_deduction;

    return emp;
}

function renderPayrollPreviewTable() {
    const list = document.getElementById('payroll-preview-list');
    list.innerHTML = '';

    if (payrollPreviewData.length === 0) {
        list.innerHTML = '<tr><td colspan="20" style="text-align:center;">No active employees found.</td></tr>';
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
                <td>${emp.payment_mode}</td>
                <td>${emp.payment_provider}</td>
                <td>
                    <input type="number" value="${emp.days}" min="0" max="31" 
                           style="width: 60px; padding: 0.2rem;" 
                           onchange="updatePayrollRow(${index}, this.value)">
                </td>
                <td>${emp.basic_salary.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-gross-${index}">${emp.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-nssf-${index}">${emp.nssf.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-sha-${index}">${emp.sha.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-levy-${index}">${emp.levy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-paye-${index}">${emp.paye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-unif-${index}">${emp.unif.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-total-${index}">${emp.total_deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                <td id="row-net-${index}" style="font-weight:bold; color:var(--csl-green);">${emp.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    });
}

function updatePayrollRow(index, newDays) {
    let days = parseFloat(newDays) || 0;
    if (days < 0) days = 0;

    payrollPreviewData[index].days = days;
    payrollPreviewData[index] = calculatePayrollTaxes(payrollPreviewData[index]);

    const emp = payrollPreviewData[index];
    document.getElementById(`row-gross-${index}`).innerText = emp.gross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById(`row-nssf-${index}`).innerText = emp.nssf.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById(`row-sha-${index}`).innerText = emp.sha.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById(`row-levy-${index}`).innerText = emp.levy.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById(`row-paye-${index}`).innerText = emp.paye.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById(`row-unif-${index}`).innerText = emp.unif.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById(`row-total-${index}`).innerText = emp.total_deduction.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    document.getElementById(`row-net-${index}`).innerText = emp.net.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function saveFinalPayroll() {
    const month = document.getElementById('payroll-month').value;
    const btn = document.getElementById('save-payroll-btn');
    const statusDiv = document.getElementById('payroll-status');

    if (!month || payrollPreviewData.length === 0) return;

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
            if (data.status === 'success') {
                statusDiv.innerHTML = `<i class="fa-solid fa-check"></i> Successfully saved payroll for ${data.count} employees.`;
                document.getElementById('payroll-preview-section').style.display = 'none';
            } else {
                statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Error: ${data.message}`;
            }
        } catch (jsonErr) {
            console.error("Backend Error:", rawText);
            statusDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Backend Error: Did you run the database alter script?`;
        }
    } catch (e) {
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
    } catch (e) {
        tree.innerHTML = '<div style="color:red; font-size: 0.9rem; padding: 1rem;">Error loading archives.</div>';
    }
}

async function toggleMonthFolder(month, el) {
    // Load monthly summary in the main content pane on month selection
    loadPayrollReport(month, 'summary_only', 'Executive Summary');

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
        if (!response.ok) {
            const rawText = await response.text();
            console.error('Failed to fetch payroll clients', response.status, rawText);
            sub.innerHTML = `<div style="font-size:0.8rem; color:red;">Error loading clients: ${response.status} ${response.statusText}. <a href="#" onclick="toggleMonthFolder('${month}', this); return false;">Retry</a><div style="font-size:0.75rem; color:#666; margin-top:6px;">${escapeHtml(rawText)}</div></div>`;
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            const raw = await response.text();
            console.error('Invalid JSON returned for payroll clients:', raw);
            sub.innerHTML = `<div style="font-size:0.8rem; color:red;">Invalid server response. <a href="#" onclick="loadPayrollArchives(); return false;">Retry</a><pre style="white-space:pre-wrap; font-size:0.75rem; color:#666;">${escapeHtml(raw)}</pre></div>`;
            return;
        }

        sub.innerHTML = '';
        if (data.status === 'success') {
            // Add "All Clients" option
            sub.innerHTML += `
                <div style="cursor: pointer; padding: 0.3rem 0; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; color: var(--csl-dark);" onclick="loadPayrollReport('${month}', 'all', 'All Active Guards')">
                    <i class="fa-solid fa-file-lines" style="color: var(--csl-green);"></i> All Clients Master Sheet
                </div>
            `;

            data.data.forEach(client => {
                const safeName = escapeHtml(client.company_name || 'Unknown');
                const clientId = escapeHtml(String(client.id));
                sub.innerHTML += `
                    <div style="cursor: pointer; padding: 0.3rem 0; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; color: #444;" onclick="loadPayrollReport('${month}', '${clientId}', '${(client.company_name || '').replace(/'/g, "\\'")}')">
                        <i class="fa-solid fa-file-invoice-dollar" style="color: #64748b;"></i> ${safeName}
                    </div>
                `;
            });
        } else {
            sub.innerHTML = `<div style="font-size:0.8rem; color:red;">Failed to load clients: ${escapeHtml(data.message || 'Unknown error')}</div>`;
        }
    } catch (e) {
        console.error('Error fetching payroll clients:', e);
        sub.innerHTML = '<div style="font-size:0.8rem; color:red;">Network Error. <a href="#" onclick="loadPayrollArchives(); return false;">Retry</a></div>';
    }
}

// Fetch Payroll Data for Reports
async function loadPayrollReport(month, clientId = 'all', clientName = 'All Guards') {
    const list = document.getElementById('payroll-report-list');
    list.innerHTML = '<tr><td colspan="23" style="text-align:center;">Loading records...</td></tr>';

    document.getElementById('report-content').style.display = 'block';
    document.getElementById('report-title-display').innerText = (clientId === 'summary_only') ? `Payroll Summary: ${month}` : `Payroll Report: ${month} - ${clientName}`;

    // Layout configuration: show summaries only on month folder click (summary_only)
    const saccoSummary = document.getElementById('payroll-sacco-summary');
    const companyBreakdown = document.getElementById('company-payment-breakdown');
    const reportTable = document.getElementById('payroll-report-table');

    if (clientId === 'summary_only') {
        if (saccoSummary) saccoSummary.style.display = 'flex';
        if (companyBreakdown) companyBreakdown.style.display = 'block';
        if (reportTable) reportTable.style.display = 'none';
    } else {
        if (saccoSummary) saccoSummary.style.display = 'none';
        if (companyBreakdown) companyBreakdown.style.display = 'none';
        if (reportTable) reportTable.style.display = 'table';
    }

    const fetchClientId = (clientId === 'summary_only') ? 'all' : clientId;

    try {
        const response = await fetch(`backend/api.php?action=get_payroll_report&month=${month}&client_id=${fetchClientId}`);
        if (!response.ok) {
            const raw = await response.text();
            console.error('Failed to fetch payroll report', response.status, raw);
            list.innerHTML = `<tr><td colspan="23" style="text-align:center; color:red;">Error loading payroll report: ${response.status} ${response.statusText}. See console for details.</td></tr>`;
            return;
        }

        let data;
        try {
            data = await response.json();
        } catch (parseErr) {
            const raw = await response.text();
            console.error('Invalid JSON for payroll report:', raw);
            list.innerHTML = `<tr><td colspan="23" style="text-align:center; color:red;">Invalid server response. Check console for details.</td></tr>`;
            return;
        }

        const tabasuriList = [];
        const imarikaList = [];
        let bankCount = 0;
        let saccoCount = 0;
        let bankTotalNet = 0;
        let saccoTotalNet = 0;
        let companyMap = {};
        list.innerHTML = '';
        if (data.status === 'success' && data.data.length > 0) {
            data.data.forEach((p, idx) => {
                const isOldRecord = parseFloat(p.basic_salary || 0) === 0;
                const daysDisplay = isOldRecord ? '' : (p.days_worked || 30);
                const basicDisplay = isOldRecord ? '' : parseFloat(p.basic_salary).toLocaleString(undefined, { minimumFractionDigits: 2 });
                const paymentMode = p.payment_mode || 'Bank';
                const paymentProvider = p.payment_provider || 'N/A';
                const companyName = p.company_name || 'Unassigned / Floating Guard';
                const branchName = p.branch_name || p.region_name || 'N/A';
                const unifAmount = paymentMode === 'Bank' ? 300 : 0;
                const totalDeduction = parseFloat(p.nssf_deduction || 0) + parseFloat(p.sha_deduction || 0) + parseFloat(p.housing_levy || 0) + parseFloat(p.paye_tax || 0) + unifAmount;
                const netAmount = parseFloat(p.net_pay || 0);

                // Track per-company aggregates (bank vs sacco)
                const compKey = companyName;
                if (!companyMap[compKey]) {
                    companyMap[compKey] = { bankCount: 0, saccoCount: 0, bankNet: 0, saccoNet: 0 };
                }
                if (paymentMode === 'Bank') {
                    companyMap[compKey].bankCount += 1;
                    companyMap[compKey].bankNet += netAmount;
                } else {
                    companyMap[compKey].saccoCount += 1;
                    companyMap[compKey].saccoNet += netAmount;
                }

                if (paymentMode === 'Bank') {
                    bankCount += 1;
                    bankTotalNet += netAmount;
                } else {
                    saccoCount += 1;
                    saccoTotalNet += netAmount;
                }

                if (paymentMode === 'Sacco' && paymentProvider === 'CIA TABASURI SACCO') {
                    tabasuriList.push(`${p.first_name} ${p.last_name} (${branchName}, ${companyName})`);
                }
                if (paymentMode === 'Sacco' && paymentProvider === 'IMARIKA SACCO') {
                    imarikaList.push(`${p.first_name} ${p.last_name} (${branchName}, ${companyName})`);
                }

                list.innerHTML += `
                    <tr>
                        <td>${idx + 1}</td>
                        <td>${p.first_name} ${p.last_name}</td>
                        <td>${p.id_number || 'N/A'}</td>
                        <td>${p.phone_number || 'N/A'}</td>
                        <td>${paymentMode}</td>
                        <td>${paymentProvider}</td>
                        <td>${companyName}</td>
                        <td>${branchName}</td>
                        <td>${p.account_number || 'N/A'}</td>
                        <td>${p.sha_number || 'N/A'}</td>
                        <td>${p.nssf_number || 'N/A'}</td>
                        <td>${p.kra_pin || 'N/A'}</td>
                        <td>${p.role || 'N/A'}</td>
                        <td>${daysDisplay}</td>
                        <td>${basicDisplay}</td>
                        <td>${parseFloat(p.gross_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>${parseFloat(p.paye_tax).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>${parseFloat(p.sha_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>${parseFloat(p.nssf_deduction).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>${unifAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>${parseFloat(p.housing_levy).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td>${totalDeduction.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                        <td style="font-weight:bold; color:var(--csl-green);">${parseFloat(p.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                `;
            });

            // Render per-company breakdown
            const breakdownEl = document.getElementById('company-breakdown-list');
            if (breakdownEl) {
                breakdownEl.innerHTML = '';
                Object.keys(companyMap).forEach(comp => {
                    const stats = companyMap[comp];
                    breakdownEl.innerHTML += `
                        <div style="min-width:220px; background:#f8fafc; border:1px solid #e2e8f0; padding:0.6rem; border-radius:8px;">
                            <div style="font-weight:700; color:var(--csl-dark); margin-bottom:0.25rem;">${comp}</div>
                            <div style="font-size:0.85rem; color:#334155;">Bank: ${stats.bankCount} (Ksh ${stats.bankNet.toLocaleString(undefined, { minimumFractionDigits: 2 })})</div>
                            <div style="font-size:0.85rem; color:#334155;">Sacco: ${stats.saccoCount} (Ksh ${stats.saccoNet.toLocaleString(undefined, { minimumFractionDigits: 2 })})</div>
                        </div>
                    `;
                });
                document.getElementById('company-payment-breakdown').style.display = 'block';
            }

            document.getElementById('tabasuri-sacco-list').innerHTML = tabasuriList.length > 0 ? tabasuriList.map(item => `<div style="margin-bottom:0.25rem;">• ${item}</div>`).join('') : '<span style="color:#64748b;">No CIA TABASURI SACCO payments in this report.</span>';
            document.getElementById('imarika-sacco-list').innerHTML = imarikaList.length > 0 ? imarikaList.map(item => `<div style="margin-bottom:0.25rem;">• ${item}</div>`).join('') : '<span style="color:#64748b;">No IMARIKA SACCO payments in this report.</span>';
            document.getElementById('bank-summary-count').innerText = `${bankCount} Bank payment(s)`;
            document.getElementById('bank-summary-total').innerText = `Total Net: Ksh ${bankTotalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
            document.getElementById('sacco-summary-count').innerText = `${saccoCount} Sacco payment(s)`;
            document.getElementById('sacco-summary-total').innerText = `Total Net: Ksh ${saccoTotalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
        } else {
            list.innerHTML = '<tr><td colspan="23" style="text-align:center;">No payroll records found for this month. Please Run Payroll first.</td></tr>';
            document.getElementById('tabasuri-sacco-list').innerHTML = '<span style="color:#64748b;">No CIA TABASURI SACCO payments in this report.</span>';
            document.getElementById('imarika-sacco-list').innerHTML = '<span style="color:#64748b;">No IMARIKA SACCO payments in this report.</span>';
            document.getElementById('bank-summary-count').innerText = '0 Bank payment(s)';
            document.getElementById('bank-summary-total').innerText = 'Total Net: Ksh 0.00';
            document.getElementById('sacco-summary-count').innerText = '0 Sacco payment(s)';
            document.getElementById('sacco-summary-total').innerText = 'Total Net: Ksh 0.00';
        }
    } catch (e) {
        list.innerHTML = '<tr><td colspan="23" style="text-align:center; color:red;">Backend connection failed.</td></tr>';
        document.getElementById('tabasuri-sacco-list').innerHTML = '<span style="color:#64748b;">No CIA TABASURI SACCO payments in this report.</span>';
        document.getElementById('imarika-sacco-list').innerHTML = '<span style="color:#64748b;">No IMARIKA SACCO payments in this report.</span>';
    }
}

// Load Company Taxes
async function loadCompanyTaxes() {
    const month = document.getElementById('company-tax-month').value;
    if (!month) return;

    try {
        const response = await fetch(`backend/api.php?action=get_company_taxes&month=${month}`);
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            document.getElementById('comp-nssf').innerText = 'Ksh ' + parseFloat(data.data.total_employer_nssf).toLocaleString(undefined, { minimumFractionDigits: 2 });
            document.getElementById('comp-levy').innerText = 'Ksh ' + parseFloat(data.data.total_employer_housing_levy).toLocaleString(undefined, { minimumFractionDigits: 2 });
            document.getElementById('comp-nita').innerText = 'Ksh ' + parseFloat(data.data.total_nita).toLocaleString(undefined, { minimumFractionDigits: 2 });
            document.getElementById('comp-paye').innerText = 'Ksh ' + parseFloat(data.data.total_paye_remitted).toLocaleString(undefined, { minimumFractionDigits: 2 });
        } else {
            document.getElementById('comp-nssf').innerText = 'Ksh 0.00';
            document.getElementById('comp-levy').innerText = 'Ksh 0.00';
            document.getElementById('comp-nita').innerText = 'Ksh 0.00';
            document.getElementById('comp-paye').innerText = 'Ksh 0.00';
        }
    } catch (e) {
        console.error("Failed to load taxes", e);
    }
}

// Export to Excel using SheetJS
function exportToExcel() {
    const table = document.getElementById("payroll-report-table");
    if (!table) return;

    // Helper functions for Excel column indexing
    function getColLetter(index) {
        let letter = "";
        while (index >= 0) {
            letter = String.fromCharCode((index % 26) + 65) + letter;
            index = Math.floor(index / 26) - 1;
        }
        return letter;
    }

    function getColIndex(colLetter) {
        let colIndex = 0;
        for (let i = 0; i < colLetter.length; i++) {
            colIndex = colIndex * 26 + (colLetter.charCodeAt(i) - 64);
        }
        return colIndex - 1; // 0-indexed
    }

    // Get report title
    const reportTitle = document.getElementById('report-title-display').innerText.trim();

    // Parse all table row data
    const rows = [];
    table.querySelectorAll("tbody tr").forEach(tr => {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 10) return; // Skip message/empty rows

        const parseNum = (val) => {
            const clean = val.replace(/,/g, '').trim();
            return (clean !== '' && !isNaN(clean) && isFinite(clean)) ? Number(clean) : 0;
        };

        const rowData = {
            name: tds[1].innerText.trim(),
            id: tds[2].innerText.trim(),
            phone: tds[3].innerText.trim(),
            payment_mode: tds[4].innerText.trim(),
            provider: tds[5].innerText.trim(),
            company: tds[6].innerText.trim(),
            branch: tds[7].innerText.trim(),
            acc_no: tds[8].innerText.trim(),
            sha_no: tds[9].innerText.trim(),
            nssf_no: tds[10].innerText.trim(),
            kra_pin: tds[11].innerText.trim(),
            role: tds[12].innerText.trim(),
            days: parseNum(tds[13].innerText),
            basic_salary: parseNum(tds[14].innerText),
            gross: parseNum(tds[15].innerText),
            paye: parseNum(tds[16].innerText),
            sha: parseNum(tds[17].innerText),
            nssf: parseNum(tds[18].innerText),
            unif: parseNum(tds[19].innerText),
            housing_levy: parseNum(tds[20].innerText),
            total_deductions: parseNum(tds[21].innerText),
            net_pay: parseNum(tds[22].innerText)
        };
        rows.push(rowData);
    });

    // Categorize rows
    const payrollReportRows = [];
    const wsRows = [];
    const bpRows = [];

    rows.forEach(p => {
        const isImarika = String(p.provider).toUpperCase().includes('IMARIKA');
        const isTabasuri = String(p.provider).toUpperCase().includes('TABASURI');
        
        const branchUpper = String(p.branch).toUpperCase();
        const isNairobi = branchUpper.includes('NAIROBI');

        if (p.payment_mode === 'Bank') {
            payrollReportRows.push(p);
        } else if (p.payment_mode === 'Sacco') {
            if (isImarika) {
                bpRows.push(p);
            } else if (isTabasuri) {
                if (isNairobi) {
                    payrollReportRows.push(p);
                } else {
                    wsRows.push(p);
                }
            } else {
                // Fallback for other Saccos
                payrollReportRows.push(p);
            }
        } else {
            // Fallback for other modes
            payrollReportRows.push(p);
        }
    });

    // Create a new workbook
    const wb = XLSX.utils.book_new();

    // Helper to generate a sheet
    function generateWorksheet(sheetDataRows, headers, sheetType) {
        // Map data rows to 2D array representation
        const dataRowsArray = sheetDataRows.map((p, index) => {
            if (sheetType === 'main') {
                return [
                    index + 1,
                    p.name,
                    p.id,
                    p.acc_no,
                    p.sha_no,
                    p.nssf_no,
                    p.kra_pin,
                    p.role,
                    p.days,
                    p.basic_salary,
                    p.gross,
                    p.paye,
                    p.sha,
                    p.nssf,
                    p.unif,
                    p.housing_levy,
                    p.total_deductions,
                    p.net_pay,
                    p.phone
                ];
            } else { // WS or BP
                return [
                    index + 1,
                    p.name,
                    p.id,
                    p.acc_no,
                    p.net_pay
                ];
            }
        });

        // Compute SUM formula rows
        const startRow = 5; // Rows are 1-indexed. Data starts on Row 5 (index 4 of array)
        const endRow = 4 + dataRowsArray.length;
        const totalsRow = [];

        for (let i = 0; i < headers.length; i++) {
            if (i === 0) {
                totalsRow.push("TOTAL");
            } else if (sheetType === 'main') {
                if (i >= 9 && i <= 17) {
                    const colLetter = getColLetter(i);
                    totalsRow.push({
                        t: 'n',
                        f: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
                        z: '#,##0.00'
                    });
                } else if (i === 8) {
                    const colLetter = getColLetter(i);
                    totalsRow.push({
                        t: 'n',
                        f: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
                        z: '0'
                    });
                } else {
                    totalsRow.push("");
                }
            } else { // WS or BP
                if (i === 4) {
                    const colLetter = getColLetter(i);
                    totalsRow.push({
                        t: 'n',
                        f: `SUM(${colLetter}${startRow}:${colLetter}${endRow})`,
                        z: '#,##0.00'
                    });
                } else {
                    totalsRow.push("");
                }
            }
        }

        // Construct excelData 2D array
        const signatureColIndex = sheetType === 'main' ? 17 : 4;
        const prepSigRow = ["Prepared By: ___________________________"];
        const dateSigRow = ["Date:        ___________________________"];
        
        for (let i = 1; i < signatureColIndex; i++) {
            prepSigRow.push("");
            dateSigRow.push("");
        }
        prepSigRow.push("Signature: ___________________________");
        dateSigRow.push("Date:        ___________________________");

        const excelData = [
            ["CATCH SECURITY LINKS LIMITED"],
            [reportTitle],
            [],
            headers,
            ...dataRowsArray,
            totalsRow,
            [],
            [],
            prepSigRow,
            dateSigRow
        ];

        const ws = XLSX.utils.aoa_to_sheet(excelData);

        // Set banner merges
        const numCols = headers.length;
        ws['!merges'] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: numCols - 1 } }, // Row 1 banner
            { s: { r: 1, c: 0 }, e: { r: 1, c: numCols - 1 } }  // Row 2 banner
        ];

        // Auto-fit column widths
        const colWidths = headers.map((header, colIndex) => {
            let maxLen = header.length;
            dataRowsArray.forEach(row => {
                const cellVal = row[colIndex];
                if (cellVal !== null && cellVal !== undefined) {
                    let str = String(cellVal);
                    if (typeof cellVal === 'number') {
                        str = cellVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                    if (str.length > maxLen) {
                        maxLen = str.length;
                    }
                }
            });
            return { wch: Math.max(maxLen + 4, 10) };
        });
        ws['!cols'] = colWidths;

        // Apply cell numbers and formats
        for (let key in ws) {
            if (key[0] === '!') continue;
            const cell = ws[key];
            if (cell.t === 'n') {
                const rowMatch = key.match(/\d+/);
                const colMatch = key.match(/[A-Z]+/);
                if (rowMatch && colMatch) {
                    const rowNum = parseInt(rowMatch[0]);
                    const colLetter = colMatch[0];
                    const colIndex = getColIndex(colLetter);

                    if (rowNum >= startRow && rowNum <= endRow + 1) {
                        if (sheetType === 'main') {
                            if (colIndex >= 9 && colIndex <= 17) {
                                cell.z = '#,##0.00';
                            } else if (colIndex === 8) {
                                cell.z = '0';
                            }
                        } else {
                            if (colIndex === 4) {
                                cell.z = '#,##0.00';
                            }
                        }
                    }
                }
            }
        }

        return ws;
    }

    // Sheet 1: Payroll Report Headers & Worksheet
    const mainHeaders = [
        "S/No", "Name", "ID No", "Account No", "SHA No", 
        "NSSF No", "KRA PIN", "Role", "Days Worked", "Basic Salary", 
        "Gross Pay", "PAYE", "SHA", "NSSF", "UNIF", 
        "Housing Levy", "Total Deductions", "Net Pay", "Phone"
    ];
    const mainWS = generateWorksheet(payrollReportRows, mainHeaders, 'main');
    XLSX.utils.book_append_sheet(wb, mainWS, "Payroll Report");

    // Sheet 2: WS Headers & Worksheet
    const wsHeaders = ["S/No", "Name", "ID No", "Account No", "Amount"];
    const wsWS = generateWorksheet(wsRows, wsHeaders, 'ws');
    XLSX.utils.book_append_sheet(wb, wsWS, "WS");

    // Sheet 3: BP Headers & Worksheet
    const bpHeaders = ["S/No", "Name", "ID No", "Account No", "Amount"];
    const bpWS = generateWorksheet(bpRows, bpHeaders, 'bp');
    XLSX.utils.book_append_sheet(wb, bpWS, "BP");

    // Save output workbook
    XLSX.writeFile(wb, "Catch_Security_Payroll_Report.xlsx");
}

// Export to PDF using html2pdf
function exportToPDF() {
    const element = document.getElementById('report-content');
    const companyBreakdown = document.getElementById('company-payment-breakdown');

    // Remember original display value
    const originalBreakdownDisplay = companyBreakdown ? companyBreakdown.style.display : 'none';

    // Hide company breakdown for the PDF export
    if (companyBreakdown) {
        companyBreakdown.style.display = 'none';
    }

    // Get the scroll container parent
    const parent = element.parentElement;
    const originalParentOverflow = parent.style.overflow;
    const originalParentOverflowX = parent.style.overflowX;
    const originalParentWidth = parent.style.width;

    // Temporarily disable clipping and overflow on the parent
    parent.style.overflow = 'visible';
    parent.style.overflowX = 'visible';
    parent.style.width = 'auto';

    // Temporarily remove overflow constraints so html2canvas doesn't clip the table
    element.classList.add('pdf-mode');
    element.classList.remove('table-container');
    element.style.overflow = 'visible';

    const opt = {
        margin: [0.15, 0.1], // [top/bottom, left/right] in inches
        filename: 'Catch_Security_Payroll_Report.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0 }, // useCORS prevents external logos from vanishing
        jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
    };

    html2pdf().set(opt).from(element).save().then(() => {
        // Restore properties after export
        element.classList.remove('pdf-mode');
        element.classList.add('table-container');
        element.style.overflow = '';

        // Restore parent styles
        parent.style.overflow = originalParentOverflow;
        parent.style.overflowX = originalParentOverflowX;
        parent.style.width = originalParentWidth;

        // Restore company breakdown display
        if (companyBreakdown) {
            companyBreakdown.style.display = originalBreakdownDisplay;
        }
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
        if (data.status === 'success') {
            globalClientListForForm = data.data;
            globalClientListForForm.forEach(c => {
                const regionText = c.region_name ? ` - ${c.region_name}` : '';
                const branchText = c.section_name ? ` (${c.section_name}${regionText})` : '';
                clientSelect.innerHTML += `<option value="${c.id}">${escapeHtml(c.company_name)}${branchText}</option>`;
            });
            if (selectedClientId) clientSelect.value = selectedClientId;
        }
    } catch (e) { console.error("Failed to fetch clients for dropdown", e); }
}

function editEmployee(id) {
    const emp = globalEmployees.find(e => e.id == id);
    if (!emp) return;

    document.getElementById('emp-edit-id').value = emp.id;
    document.getElementById('modal-title').innerText = 'Edit Employee';
    document.getElementById('submit-emp-btn').innerText = 'Update Employee';

    // Fill fields
    document.getElementById('emp-fname').value = emp.first_name;
    document.getElementById('emp-lname').value = emp.last_name;
    document.getElementById('emp-id').value = emp.id_number;
    document.getElementById('emp-phone').value = emp.phone_number || '';
    document.getElementById('emp-location').value = emp.home_location || '';
    document.getElementById('emp-next-of-kin').value = emp.next_of_kin || '';
    document.getElementById('emp-kra').value = emp.kra_pin || '';
    document.getElementById('emp-nssf').value = emp.nssf_number || '';
    document.getElementById('emp-sha').value = emp.sha_number || '';
    document.getElementById('emp-role').value = emp.role;
    populateClientDropdown(emp.client_id);
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
window.onclick = function (event) {
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

    const editId = document.getElementById('emp-edit-id').value;
    const data = {
        id: editId,
        first_name: document.getElementById('emp-fname').value,
        last_name: document.getElementById('emp-lname').value,
        id_number: document.getElementById('emp-id').value,
        phone_number: document.getElementById('emp-phone').value,
        home_location: document.getElementById('emp-location').value,
        next_of_kin: document.getElementById('emp-next-of-kin').value,
        kra_pin: document.getElementById('emp-kra').value,
        nssf_number: document.getElementById('emp-nssf').value,
        sha_number: document.getElementById('emp-sha').value,
        role: document.getElementById('emp-role').value,
        client_id: document.getElementById('emp-client').value,
        account_number: document.getElementById('emp-account').value,
        basic_salary: document.getElementById('emp-salary').value
    };

    btn.innerText = 'Saving...';
    btn.disabled = true;

    const endpoint = editId ? 'backend/api.php?action=update_employee' : 'backend/api.php?action=add_employee';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const rawText = await response.text();
        try {
            const result = JSON.parse(rawText);
            if (result.status === 'success') {
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

    } catch (err) {
        console.error(err);
        if (window.location.protocol === 'file:') {
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
        if (data.status === 'success' && data.data.length > 0) {
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
    } catch (e) {
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
    updateClientPaymentProviderOptions();
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

function updateClientPaymentProviderOptions() {
    const mode = document.getElementById('client-payment-mode').value;
    const providerSelect = document.getElementById('client-provider');
    const currentValue = providerSelect.value;

    const bankOptions = ['Equity', 'NCBA', 'DTB Bank', 'KCB', 'Co-operative Bank'];
    const saccoOptions = ['CIA TABASURI SACCO', 'IMARIKA SACCO'];

    providerSelect.innerHTML = '';

    if (mode === 'Sacco') {
        saccoOptions.forEach(s => {
            providerSelect.innerHTML += `<option value="${s}">${s}</option>`;
        });
        providerSelect.value = saccoOptions.includes(currentValue) ? currentValue : saccoOptions[0];
    } else {
        bankOptions.forEach(opt => {
            providerSelect.innerHTML += `<option value="${opt}">${opt}</option>`;
        });
        providerSelect.value = bankOptions.includes(currentValue) ? currentValue : bankOptions[0];
    }
}

function editClient(id) {
    const c = globalClients.find(x => x.id == id);
    if (!c) return;

    document.getElementById('client-edit-id').value = c.id;
    document.getElementById('client-modal-title').innerText = 'Edit Client';
    document.getElementById('submit-client-btn').innerText = 'Update Client';

    document.getElementById('client-name').value = c.company_name;
    document.getElementById('client-contact').value = c.contact_person;
    document.getElementById('client-phone').value = c.phone_number;
    document.getElementById('client-section').value = c.branch_id;
    updateClientRegionsDropdown();
    document.getElementById('client-region').value = c.region_name;
    document.getElementById('client-payment-mode').value = c.payment_mode || 'Bank';
    updateClientPaymentProviderOptions();
    document.getElementById('client-provider').value = c.payment_provider || 'Equity';

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
        region_name: document.getElementById('client-region').value,
        payment_mode: document.getElementById('client-payment-mode').value,
        payment_provider: document.getElementById('client-provider').value
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
        if (result.status === 'success') {
            statusDiv.innerHTML = `<span class="text-green"><i class="fa-solid fa-check"></i> ${result.message}</span>`;
            setTimeout(() => {
                closeAddClientModal();
                loadClients();
            }, 1000);
        } else {
            statusDiv.innerHTML = `<span style="color:red;"><i class="fa-solid fa-triangle-exclamation"></i> Error: ${result.message}</span>`;
        }
    } catch (err) {
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

    if (!password) {
        errorDiv.innerText = "Password cannot be empty.";
        errorDiv.style.display = 'block';
        return;
    }

    btn.innerText = "Verifying...";
    btn.disabled = true;
    errorDiv.style.display = 'none';

    if (type === 'import_payroll') {
        syncPayrollFromExcel(window.pendingImportFile, password, btn, errorDiv);
        return;
    }

    const endpoint = type === 'employee' ? 'backend/api.php?action=delete_employee' : 'backend/api.php?action=delete_client';

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id, admin_password: password })
        });
        const result = await response.json();

        if (result.status === 'success') {
            closeAdminAuthModal();
            // Refresh specific tables dynamically
            if (type === 'employee') loadEmployees(document.getElementById('emp-section').value);
            if (type === 'client') loadClients();
        } else {
            errorDiv.innerText = result.message;
            errorDiv.style.display = 'block';
        }
    } catch (e) {
        errorDiv.innerText = "Connection Error to Server.";
        errorDiv.style.display = 'block';
    } finally {
        btn.innerText = "Verify & Delete";
        btn.disabled = false;
    }
}

// ==========================================
// EXCEL IMPORTS & SYNCHRONIZATION ENGINE
// ==========================================

async function importEmployeesFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("The selected Excel sheet has no records.");
                return;
            }

            const employeeData = [];
            
            // Fetch client mappings
            const clientResponse = await fetch('backend/api.php?action=get_clients');
            const clientResult = await clientResponse.json();
            const clients = clientResult.status === 'success' ? clientResult.data : [];

            jsonData.forEach(row => {
                let client_id = null;
                const companyCol = row["Assigned Client"] || row["Company"] || row["Client"] || row["company_name"];
                if (companyCol) {
                    const match = clients.find(c => String(c.company_name).toLowerCase().trim() === String(companyCol).toLowerCase().trim());
                    if (match) client_id = match.id;
                }

                employeeData.push({
                    first_name: row["First Name"] || row["first_name"] || row["Name"] || "",
                    last_name: row["Last Name"] || row["last_name"] || "",
                    id_number: String(row["ID Number"] || row["id_number"] || row["ID"] || ""),
                    phone_number: String(row["Phone Number"] || row["phone_number"] || row["Phone"] || ""),
                    home_location: row["Home Location"] || row["home_location"] || row["Location"] || "",
                    next_of_kin: row["Next of Kin"] || row["next_of_kin"] || "",
                    kra_pin: row["KRA PIN"] || row["kra_pin"] || row["KRA"] || "",
                    nssf_number: String(row["NSSF Number"] || row["nssf_number"] || row["NSSF"] || ""),
                    sha_number: String(row["SHA Number"] || row["sha_number"] || row["SHA"] || ""),
                    role: row["Role"] || row["role"] || "Guard",
                    client_id: client_id,
                    account_number: String(row["Account Number"] || row["account_number"] || row["Acc No"] || ""),
                    basic_salary: parseFloat(row["Basic Salary"] || row["basic_salary"] || row["Salary"] || 0)
                });
            });

            const response = await fetch('backend/api.php?action=import_employees', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(employeeData)
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(result.message);
                loadEmployees();
            } else {
                alert("Import failed: " + result.message);
            }
        } catch (err) {
            console.error(err);
            alert("Error parsing Excel file. Make sure columns match standard template.");
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Reset uploader input
}

async function importClientsFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("The selected Excel sheet has no records.");
                return;
            }

            const clientData = [];
            jsonData.forEach(row => {
                let branch_id = 1;
                const branchCol = String(row["Branch"] || row["Branch Assignment"] || "").toUpperCase();
                if (branchCol.includes("NAIROBI") || branchCol === "2") {
                    branch_id = 2;
                }

                clientData.push({
                    company_name: row["Company Name"] || row["Company"] || row["Client Name"] || "",
                    contact_person: row["Contact Person"] || row["Contact"] || "",
                    phone_number: String(row["Phone Number"] || row["phone_number"] || row["Phone"] || ""),
                    branch_id: branch_id,
                    region_name: row["Region"] || row["Region Details"] || "",
                    payment_mode: row["Payment Mode"] || "Bank",
                    payment_provider: row["Payment Provider"] || row["Provider"] || "Equity"
                });
            });

            const response = await fetch('backend/api.php?action=import_clients', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clientData)
            });
            const result = await response.json();
            if (result.status === 'success') {
                alert(result.message);
                loadClients();
            } else {
                alert("Import failed: " + result.message);
            }
        } catch (err) {
            console.error(err);
            alert("Error parsing Excel file. Make sure columns match standard template.");
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ''; // Reset uploader input
}

function promptPayrollImportPassword(event) {
    const file = event.target.files[0];
    if (!file) return;

    window.pendingImportFile = file;
    event.target.value = ''; // Reset input

    // Open Admin authorization modal
    document.getElementById('pending-delete-type').value = 'import_payroll';
    document.getElementById('pending-delete-id').value = '';
    document.getElementById('admin-auth-password').value = '';
    document.getElementById('admin-auth-error').style.display = 'none';
    document.getElementById('admin-auth-btn').innerText = 'Verify & Sync';
    document.getElementById('adminAuthModal').style.display = 'block';
}

function syncPayrollFromExcel(file, password, modalBtn, modalErrorDiv) {
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const mainSheetName = workbook.SheetNames[0];
            const mainSheet = workbook.Sheets[mainSheetName];
            const a2Val = mainSheet['A2'] ? mainSheet['A2'].v : "";
            
            const monthMatch = String(a2Val).match(/\b\d{4}-\d{2}\b/);
            if (!monthMatch) {
                modalErrorDiv.innerText = "Error: Could not determine YYYY-MM month from Excel cell A2.";
                modalErrorDiv.style.display = 'block';
                modalBtn.innerText = 'Verify & Sync';
                modalBtn.disabled = false;
                return;
            }
            const month = monthMatch[0];

            // Fetch employees for ID validation and client references mapping
            const empResponse = await fetch('backend/api.php?action=get_employees');
            const empResult = await empResponse.json();
            const employees = empResult.status === 'success' ? empResult.data : [];

            if (employees.length === 0) {
                modalErrorDiv.innerText = "Error: System employees directory is empty.";
                modalErrorDiv.style.display = 'block';
                modalBtn.innerText = 'Verify & Sync';
                modalBtn.disabled = false;
                return;
            }

            const records = [];

            function parseSheet(sheetName, isMainSheet) {
                const sheet = workbook.Sheets[sheetName];
                if (!sheet) return;

                const rowsAoa = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                
                for (let r = 4; r < rowsAoa.length; r++) {
                    const row = rowsAoa[r];
                    if (!row || row.length === 0) continue;
                    
                    const firstCellVal = String(row[0]).trim();
                    if (firstCellVal.toUpperCase() === "TOTAL" || firstCellVal === "" || row[1] === undefined) {
                        break; 
                    }

                    let name, id_number, acc_no, net_pay;
                    let days_worked, basic_salary, gross_pay, nssf_deduction, sha_deduction, housing_levy, paye_tax, unif;

                    if (isMainSheet) {
                        name = row[1];
                        id_number = String(row[2]).trim();
                        acc_no = String(row[3]).trim();
                        days_worked = Number(row[8]) || 30;
                        basic_salary = Number(row[9]) || 0;
                        gross_pay = Number(row[10]) || 0;
                        paye_tax = Number(row[11]) || 0;
                        sha_deduction = Number(row[12]) || 0;
                        nssf_deduction = Number(row[13]) || 0;
                        unif = Number(row[14]) || 0;
                        housing_levy = Number(row[15]) || 0;
                        net_pay = Number(row[17]) || 0;
                    } else {
                        name = row[1];
                        id_number = String(row[2]).trim();
                        acc_no = String(row[3]).trim();
                        net_pay = Number(row[4]) || 0;
                    }

                    const emp = employees.find(e => String(e.id_number).trim() === id_number);
                    if (!emp) {
                        console.warn(`Guard ${name} (ID: ${id_number}) not matched in DB.`);
                        continue;
                    }

                    if (!isMainSheet) {
                        basic_salary = parseFloat(emp.basic_salary) || 0;
                        const payment_mode = emp.payment_mode || 'Bank';
                        const payment_provider = emp.payment_provider || 'Equity';

                        const mockEmp = {
                            basic_salary: basic_salary,
                            days: 30,
                            payment_mode: payment_mode,
                            payment_provider: payment_provider,
                            account_number: acc_no
                        };
                        const fullMonthResult = calculatePayrollTaxes(mockEmp);
                        const expectedNet = fullMonthResult.net;

                        if (expectedNet > 0 && net_pay !== expectedNet) {
                            days_worked = Math.round(30 * (net_pay / expectedNet));
                            days_worked = Math.max(0, Math.min(31, days_worked));
                        } else {
                            days_worked = 30;
                        }

                        const calcResult = calculatePayrollTaxes({
                            basic_salary: basic_salary,
                            days: days_worked,
                            payment_mode: payment_mode,
                            payment_provider: payment_provider,
                            account_number: acc_no
                        });

                        gross_pay = calcResult.gross;
                        nssf_deduction = calcResult.nssf;
                        sha_deduction = calcResult.sha;
                        housing_levy = calcResult.levy;
                        paye_tax = calcResult.paye;
                        unif = calcResult.unif;
                    }

                    records.push({
                        employee_id: emp.id,
                        days_worked: days_worked,
                        basic_salary: basic_salary,
                        gross_pay: gross_pay,
                        nssf_deduction: nssf_deduction,
                        sha_deduction: sha_deduction,
                        housing_levy: housing_levy,
                        paye_tax: paye_tax,
                        net_pay: net_pay,
                        payment_mode: emp.payment_mode,
                        payment_provider: emp.payment_provider,
                        branch_name: emp.section_name,
                        region_name: emp.region_name,
                        company_name: emp.company_name,
                        client_id: emp.client_id,
                        account_number: acc_no
                    });
                }
            }

            parseSheet(workbook.SheetNames[0], true);  
            parseSheet(workbook.SheetNames[1], false); 
            parseSheet(workbook.SheetNames[2], false); 

            if (records.length === 0) {
                modalErrorDiv.innerText = "Error: Found 0 matching employee rows in the sheets.";
                modalErrorDiv.style.display = 'block';
                modalBtn.innerText = 'Verify & Sync';
                modalBtn.disabled = false;
                return;
            }

            const syncResponse = await fetch('backend/api.php?action=import_excel_payroll', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    month: month,
                    records: records,
                    admin_password: password
                })
            });
            const syncResult = await syncResponse.json();

            if (syncResult.status === 'success') {
                closeAdminAuthModal();
                alert(`Successfully synchronized ${syncResult.count} payroll records for ${month}.`);
                loadPayrollArchives();
                loadDashboard();
            } else {
                modalErrorDiv.innerText = "Sync Failed: " + syncResult.message;
                modalErrorDiv.style.display = 'block';
                modalBtn.innerText = 'Verify & Sync';
                modalBtn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            modalErrorDiv.innerText = "Error: Failed to process sheets. Verify uploader format.";
            modalErrorDiv.style.display = 'block';
            modalBtn.innerText = 'Verify & Sync';
            modalBtn.disabled = false;
        }
    };
    reader.readAsArrayBuffer(file);
}
