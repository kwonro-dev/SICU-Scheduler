// Modal management functions for the Workforce Schedule Manager
// Extracted from script.js for better organization and maintainability

/**
 * Modal Manager Class
 * Handles all modal operations for the Workforce Schedule Manager
 */
class ModalManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.editingEmployeeId = null;
        this.editingShiftId = null;
        this.editingRoleId = null;
    }

    /**
     * Setup event listeners for modal controls
     */
    setupModalControls() {
        // Employee modal controls
        document.getElementById('closeEmployeeModal').addEventListener('click', () => this.closeEmployeeModal());
        document.getElementById('cancelEmployee').addEventListener('click', () => this.closeEmployeeModal());

        // Shift modal controls
        document.getElementById('closeShiftModal').addEventListener('click', () => this.closeShiftModal());
        document.getElementById('cancelShift').addEventListener('click', () => this.closeShiftModal());

        // Role modal controls
        document.getElementById('closeRoleModal').addEventListener('click', () => this.closeRoleModal());
        document.getElementById('cancelRole').addEventListener('click', () => this.closeRoleModal());

        // Schedule modal controls
        document.getElementById('closeScheduleModal').addEventListener('click', () => this.closeScheduleModal());
        document.getElementById('cancelSchedule').addEventListener('click', () => this.closeScheduleModal());
    }

    // ============ EMPLOYEE MODAL FUNCTIONS ============

    /**
     * Edit an existing employee
     * @param {string} employeeId - ID of employee to edit
     */
    editEmployee(employeeId) {
        const employee = this.workforceManager.employees.find(e => e.id === employeeId);
        if (!employee) return;

        this.openEmployeeModal(employee);
    }

    /**
     * Open employee modal for add/edit
     * @param {Object|null} employee - Employee object to edit, null for new employee
     */
    openEmployeeModal(employee = null) {
        const modal = document.getElementById('employeeModal');
        const form = document.getElementById('employeeForm');
        const modalTitle = document.getElementById('employeeModalTitle');

        // Reset form
        form.reset();
        this.editingEmployeeId = employee ? employee.id : null;

        if (employee) {
            // Editing existing employee
            modalTitle.textContent = 'Edit Employee';
            document.getElementById('employeeName').value = employee.name;

            // Set role
            const roleSelect = document.getElementById('employeeRole');
            if (roleSelect) {
                roleSelect.value = employee.roleId || '';
            }

            // Set shift type classification
            const shiftTypeSelect = document.getElementById('employeeShiftType');
            if (shiftTypeSelect) {
                shiftTypeSelect.value = employee.shiftType || this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
            }

        } else {
            // Adding new employee
            modalTitle.textContent = 'Add New Employee';
            const now = new Date();
            document.getElementById('employeeHireDate').value = now.toISOString().split('T')[0];
            document.getElementById('employeeStatus').value = 'active';
        }

        // Populate role dropdown
        this.populateRoleDropdown();

        modal.classList.add('active');
        document.getElementById('employeeName').focus();
    }

    /**
     * Handle employee form submission
     * @param {Event} e - Form submit event
     */
    async handleEmployeeSubmit(e) {
        e.preventDefault();
        console.log('handleEmployeeSubmit called (async)');

        const formData = new FormData(e.target);
        const employeeData = {
            id: this.editingEmployeeId || this.workforceManager.generateId(),
            name: formData.get('name'),
            roleId: formData.get('roleId'),
            shiftType: formData.get('shiftType') || 'auto', // Default to auto-determination
        };

        // If shift type is set to 'auto', determine it automatically
        if (employeeData.shiftType === 'auto' || !employeeData.shiftType) {
            // For new employees, we'll determine this after they're added and schedules are assigned
            // For existing employees, determine based on current schedules
            if (this.editingEmployeeId) {
                const existingEmployee = this.workforceManager.employees.find(e => e.id === this.editingEmployeeId);
                if (existingEmployee) {
                    employeeData.shiftType = this.workforceManager.employeeManager.determineEmployeeShiftType(existingEmployee);
                }
            } else {
                // For new employees, set to 'Day' by default, will be updated when schedules are added
                employeeData.shiftType = 'Day';
            }
        }

        if (this.editingEmployeeId) {
            // Update existing employee
            await this.workforceManager.updateEmployee(this.editingEmployeeId, employeeData);
        } else {
            // Add new employee
            await this.workforceManager.addEmployee(employeeData);
        }

        // Update shift types for all employees based on their schedules
        await this.workforceManager.employeeManager.updateAllEmployeeShiftTypes();

        // Close modal and refresh views
        this.closeEmployeeModal();
        this.workforceManager.employeeManager.renderUsersView();
        this.workforceManager.calendarRenderer.renderScheduleMatrix();
    }

    /**
     * Close employee modal
     */
    closeEmployeeModal() {
        document.getElementById('employeeModal').classList.remove('active');
    }

    // ============ SHIFT MODAL FUNCTIONS ============

    /**
     * Edit an existing shift type
     * @param {string} shiftTypeId - ID of shift type to edit
     */
    editShiftType(shiftTypeId) {
        const shiftType = this.workforceManager.shiftTypes.find(s => s.id === shiftTypeId);
        if (!shiftType) return;

        this.openShiftModal(shiftType);
    }

    /**
     * Open shift modal for add/edit
     * @param {Object|null} shiftType - Shift type object to edit, null for new shift type
     */
    openShiftModal(shiftType = null) {
        const modal = document.getElementById('shiftModal');
        const form = document.getElementById('shiftForm');
        const modalTitle = document.getElementById('shiftModalTitle');

        // Reset form
        form.reset();
        this.editingShiftId = shiftType ? shiftType.id : null;

        if (shiftType) {
            // Editing existing shift type
            modalTitle.textContent = 'Edit Shift Type';
            document.getElementById('shiftName').value = shiftType.name || '';
            document.getElementById('shiftDescription').value = shiftType.description || '';

            // Set color if available
            if (shiftType.color) {
                const colorInput = document.querySelector(`input[name="color"][value="${shiftType.color}"]`);
                if (colorInput) {
                    colorInput.checked = true;
                }
                // Note: Custom color input doesn't exist in current HTML, so we just use the predefined colors
            }
        } else {
            // Adding new shift type
            modalTitle.textContent = 'Add New Shift Type';
            // Default color (blue) will be pre-selected due to checked attribute
        }

        modal.classList.add('active');
        document.getElementById('shiftName').focus();
    }

    /**
     * Handle shift form submission
     * @param {Event} e - Form submit event
     */
    async handleShiftSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const shiftName = formData.get('name');
        const shiftColor = formData.get('color');

        console.log('Shift form submission:', {
            shiftName,
            shiftColor,
            editingId: this.editingShiftId,
            allFormData: Object.fromEntries(formData.entries())
        });

        const shiftTypeData = {
            id: this.editingShiftId || this.workforceManager.generateId(),
            name: shiftName,
            description: formData.get('description'),
            color: shiftColor || ScheduleUtils.getDefaultShiftColor(shiftName)
        };

        console.log('Shift type data to save:', shiftTypeData);

        // Save changes using individual CRUD
        if (this.editingShiftId) {
            await this.workforceManager.updateShiftType(this.editingShiftId, shiftTypeData);
        } else {
            await this.workforceManager.addShiftType(shiftTypeData);
        }
        console.log('Shift types saved to localStorage');

        // Reset editing state
        this.editingShiftId = null;

        // Close modal and refresh views
        this.closeShiftModal();
        this.workforceManager.viewRenderer.renderShiftsView();
        this.workforceManager.calendarRenderer.renderScheduleMatrix();

        console.log('Shift modal closed and views refreshed');
    }

    /**
     * Close shift modal
     */
    closeShiftModal() {
        document.getElementById('shiftModal').classList.remove('active');
    }

    // ============ ROLE MODAL FUNCTIONS ============

    /**
     * Edit an existing job role
     * @param {string} roleId - ID of role to edit
     */
    editJobRole(roleId) {
        const role = this.workforceManager.jobRoles.find(r => r.id === roleId);
        if (!role) return;

        this.openRoleModal(role);
    }

    /**
     * Open role modal for add/edit
     * @param {Object|null} role - Role object to edit, null for new role
     */
    openRoleModal(role = null) {
        const modal = document.getElementById('roleModal');
        const form = document.getElementById('roleForm');
        const modalTitle = document.getElementById('roleModalTitle');

        // Reset form
        form.reset();
        this.editingRoleId = role ? role.id : null;

        if (role) {
            // Editing existing role
            modalTitle.textContent = 'Edit Job Role';
            document.getElementById('roleName').value = role.name || '';
            document.getElementById('roleDescription').value = role.description || '';
            document.getElementById('roleDepartment').value = role.department || '';
            document.getElementById('rolePayRate').value = role.payRate || '';

            // Set color if available
            if (role.color) {
                const colorInput = document.querySelector(`input[name="color"][value="${role.color}"]`);
                if (colorInput) {
                    colorInput.checked = true;
                }
                // Note: Custom color input doesn't exist in current HTML, so we just use the predefined colors
            }
        } else {
            // Adding new role
            modalTitle.textContent = 'Add New Job Role';
            // Default color (blue) will be pre-selected due to checked attribute
        }

        modal.classList.add('active');
        document.getElementById('roleName').focus();
    }

    /**
     * Handle role form submission
     * @param {Event} e - Form submit event
     */
    async handleRoleSubmit(e) {
        e.preventDefault();

        const formData = new FormData(e.target);
        const roleName = formData.get('name');
        const roleColor = formData.get('color');

        const roleData = {
            id: this.editingRoleId || this.workforceManager.generateId(),
            name: roleName,
            description: formData.get('description'),
            department: formData.get('department'),
            payRate: parseFloat(formData.get('payRate')) || 0,
            color: roleColor || ScheduleUtils.getDefaultRoleColor(roleName)
        };

        // Save changes using individual CRUD
        if (this.editingRoleId) {
            await this.workforceManager.updateJobRole(this.editingRoleId, roleData);
        } else {
            await this.workforceManager.addJobRole(roleData);
        }

        // Update role filters and badge styles
        this.workforceManager.updateRoleFilters();
        this.workforceManager.updateRoleBadgeStyles();

        // Close modal and refresh views
        this.closeRoleModal();
        this.workforceManager.viewRenderer.renderRolesView();
        this.workforceManager.employeeManager.renderUsersView();
    }

    /**
     * Close role modal
     */
    closeRoleModal() {
        document.getElementById('roleModal').classList.remove('active');
    }

    // ============ SCHEDULE MODAL FUNCTIONS ============

    /**
     * Close schedule modal
     */
    closeScheduleModal() {
        document.getElementById('scheduleModal').classList.remove('active');
    }

    // ============ UTILITY FUNCTIONS ============

    /**
     * Populate role dropdown in forms
     */
    populateRoleDropdown() {
        const roleSelect = document.getElementById('employeeRole');
        if (!roleSelect) return;

        // Clear existing options except the default
        roleSelect.innerHTML = '<option value="">Select a role</option>';

        // Add all job roles
        this.workforceManager.jobRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role.id;
            option.textContent = role.name;
            roleSelect.appendChild(option);
        });
    }
}

// Export the ModalManager class
window.ModalManager = ModalManager;
