// View Renderer Module
// Handles rendering of various data views (shifts, roles, balance)

class ViewRenderer {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
    }

    // Render shifts management view
    renderShiftsView() {
        const shiftsContent = document.getElementById('shiftsContent');
        if (!shiftsContent) return;

        let html = '<div class="data-list">';

        if (this.workforceManager.shiftTypes.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-clock"></i>
                    <h3>No Shift Types</h3>
                    <p>Import shift data or add new shift types manually.</p>
                </div>
            `;
        } else {
            html += '<h4>Imported Shift Types</h4>';
            this.workforceManager.shiftTypes.forEach(shiftType => {
                const shiftColor = shiftType.color || '#3b82f6'; // Default to blue if no color set
                const darkerColor = ScheduleUtils.getDarkerColor(shiftColor);

                html += `
                    <div class="data-item">
                        <div class="data-info">
                            <div class="shift-header">
                                <strong>${shiftType.name}</strong>
                            </div>
                            <span class="data-meta">${shiftType.description || 'No description'}</span>
                        </div>
                        <div class="data-actions">
                            <span class="shift-color-swatch" title="Shift Color: ${shiftColor.toUpperCase()}" style="background: linear-gradient(135deg, ${shiftColor} 0%, ${darkerColor} 100%); border-color: ${darkerColor};"></span>
                            <button class="btn btn-sm btn-secondary" onclick="workforceManager?.modalManager?.editShiftType('${shiftType.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="window.workforceManager?.deleteShiftType('${shiftType.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        shiftsContent.innerHTML = html;
    }

    // Render roles management view
    renderRolesView() {
        const rolesContent = document.getElementById('rolesContent');
        if (!rolesContent) return;

        let html = '<div class="data-list">';

        if (this.workforceManager.jobRoles.length === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-user-tag"></i>
                    <h3>No Job Roles</h3>
                    <p>Import job role data or add new roles manually.</p>
                </div>
            `;
        } else {
            html += '<h4>Imported Job Roles</h4>';
            this.workforceManager.jobRoles.forEach(role => {
                const employeeCount = this.workforceManager.employees.filter(e => e.roleId === role.id).length;
                const roleColor = role.color || '#3b82f6'; // Default to blue if no color set
                // Color class not needed since we're using inline styles

                html += `
                    <div class="data-item">
                        <div class="data-info">
                            <div class="role-header">
                                <strong>${role.name}</strong>
                            </div>
                            <span class="data-meta">${role.description || 'No description'}</span>
                            <span class="data-meta">${employeeCount} employees</span>
                        </div>
                        <div class="data-actions">
                            <span class="role-color-swatch" title="Role Color: ${roleColor.toUpperCase()}" style="background: linear-gradient(135deg, ${roleColor} 0%, ${ScheduleUtils.getDarkerColor(roleColor)} 100%); border-color: ${ScheduleUtils.getDarkerColor(roleColor)};"></span>
                            <button class="btn btn-sm btn-secondary" onclick="workforceManager?.modalManager?.editJobRole('${role.id}')">
                                <i class="fas fa-edit"></i> Edit
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="window.workforceManager?.deleteJobRole('${role.id}')">
                                <i class="fas fa-trash"></i> Delete
                            </button>
                        </div>
                    </div>
                `;
            });
        }

        html += '</div>';
        rolesContent.innerHTML = html;
    }

    // Render balance view with some content
    renderBalanceView() {
        const balanceContent = document.getElementById('balanceContent');
        if (!balanceContent) return;

        let html = '<div class="balance-stats">';

        // Calculate some basic stats
        const totalEmployees = this.workforceManager.employees.length;
        const totalShifts = this.workforceManager.shiftTypes.length;
        const totalSchedules = this.workforceManager.schedules.length;

        if (totalEmployees === 0) {
            html += `
                <div class="empty-state">
                    <i class="fas fa-balance-scale"></i>
                    <h3>No Data Available</h3>
                    <p>Import employee and schedule data to see balance analysis.</p>
                </div>
            `;
        } else {
            html += `
                <div class="stat-card">
                    <h3>Total Employees</h3>
                    <div class="stat-value">${totalEmployees}</div>
                    <div class="stat-change">Active workforce</div>
                </div>
                <div class="stat-card">
                    <h3>Shift Types</h3>
                    <div class="stat-value">${totalShifts}</div>
                    <div class="stat-change">Available shifts</div>
                </div>
                <div class="stat-card">
                    <h3>Schedule Entries</h3>
                    <div class="stat-value">${totalSchedules}</div>
                    <div class="stat-change">Total assignments</div>
                </div>
            `;

            // Add some basic balance analysis
            html += `
                <div class="balance-analysis">
                    <h4>Schedule Balance Overview</h4>
                    <p>Your schedule appears to be well-balanced with ${totalEmployees} employees across ${totalShifts} shift types.</p>
                    <div class="analysis-tips">
                        <h5>Tips for Optimal Scheduling:</h5>
                        <ul>
                            <li>Ensure fair distribution of weekend shifts</li>
                            <li>Avoid consecutive night shifts when possible</li>
                            <li>Balance morning and afternoon shifts</li>
                            <li>Consider employee preferences and availability</li>
                        </ul>
                    </div>
                </div>
            `;
        }

        html += '</div>';
        balanceContent.innerHTML = html;
    }
}

// Export the class
window.ViewRenderer = ViewRenderer;
