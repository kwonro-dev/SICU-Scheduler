// SnapshotManager - handles saving a reference snapshot of the current schedule and restoring it later
class SnapshotManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.snapshotKey = 'workforce_schedule_snapshot_v1';
        this.isFiltering = false;
    }

    // Create a deep snapshot of current active data
    saveSnapshot() {
        const snapshot = {
            createdAt: new Date().toISOString(),
            employees: JSON.parse(JSON.stringify(this.workforceManager.employees || [])),
            shiftTypes: JSON.parse(JSON.stringify(this.workforceManager.shiftTypes || [])),
            jobRoles: JSON.parse(JSON.stringify(this.workforceManager.jobRoles || [])),
            schedules: JSON.parse(JSON.stringify(this.workforceManager.schedules || [])),
            currentWeekStart: this._formatDateForStorage(this.workforceManager.currentWeekStart)
        };
        localStorage.setItem(this.snapshotKey, JSON.stringify(snapshot));
        return snapshot;
    }

    // Load snapshot object from storage
    loadSnapshot() {
        const raw = localStorage.getItem(this.snapshotKey);
        return raw ? JSON.parse(raw) : null;
    }

    // Restore snapshot into active state
    restoreSnapshot() {
        const snapshot = this.loadSnapshot();
        if (!snapshot) {
            return false;
        }

        this.workforceManager.employees = JSON.parse(JSON.stringify(snapshot.employees || []));
        this.workforceManager.shiftTypes = JSON.parse(JSON.stringify(snapshot.shiftTypes || []));
        this.workforceManager.jobRoles = JSON.parse(JSON.stringify(snapshot.jobRoles || []));
        this.workforceManager.schedules = JSON.parse(JSON.stringify(snapshot.schedules || []));

        // persist
        this.workforceManager.saveData('employees', this.workforceManager.employees);
        this.workforceManager.saveData('shiftTypes', this.workforceManager.shiftTypes);
        this.workforceManager.saveData('jobRoles', this.workforceManager.jobRoles);
        this.workforceManager.saveData('schedules', this.workforceManager.schedules);

        // restore calendar start
        if (snapshot.currentWeekStart) {
            const [y, m, d] = snapshot.currentWeekStart.split('-').map(Number);
            this.workforceManager.currentWeekStart = new Date(y, m - 1, d);
            localStorage.setItem('calendarStartDate', snapshot.currentWeekStart);
            const startDateInput = document.getElementById('calendarStartDate');
            if (startDateInput) startDateInput.value = snapshot.currentWeekStart;
        }

        // update derived UI/state
        this.workforceManager.updateRoleBadgeStyles();
        this.workforceManager.filterManager.updateRoleFilters();
        this.workforceManager.calendarRenderer.renderScheduleMatrix();
        if (this.workforceManager.viewRenderer) {
            this.workforceManager.viewRenderer.renderRolesView();
        }
        if (this.workforceManager.employeeManager) {
            this.workforceManager.employeeManager.renderUsersView();
        }
        return true;
    }

    hasSnapshot() {
        return !!localStorage.getItem(this.snapshotKey);
    }

    _formatDateForStorage(date) {
        if (!(date instanceof Date) || isNaN(date)) return null;
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // Toggle filtering mode to show only changed shifts
    toggleFiltering() {
        this.isFiltering = !this.isFiltering;
        this.workforceManager.calendarRenderer.toggleShiftFiltering(this.isFiltering);
        
        // Update badge appearance
        const badge = document.getElementById('snapshotBadge');
        if (badge) {
            if (this.isFiltering) {
                badge.classList.add('filtering');
            } else {
                badge.classList.remove('filtering');
            }
            // Trigger mouseenter event to update tooltip
            badge.dispatchEvent(new Event('mouseenter'));
        }
    }
}

window.SnapshotManager = SnapshotManager;


