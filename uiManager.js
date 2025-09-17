// UI Manager Module
// Handles all UI interactions including drag scrolling, context menus, and event binding

class UIManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.currentShiftContext = null;
    }

    // Bind drag scroll functionality for horizontal scrolling
    bindDragScroll() {

        // Bind drag scroll for both schedule matrix and worker count summary
        this.bindContainerDragScroll('.schedule-matrix-container');
        this.bindContainerDragScroll('.worker-count-summary-container');

        // Bind synchronized scrolling between calendar and summary
        this.bindSynchronizedScrolling();
    }

    // Helper method to bind drag scroll to a specific container
    bindContainerDragScroll(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) {
            return;
        }


        let isDragging = false;
        let startX, startY;
        let scrollLeft, scrollTop;

        const startDragging = (e) => {
            isDragging = true;
            startX = e.pageX - container.offsetLeft;
            startY = e.pageY - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
            container.classList.add('dragging');
        };

        const stopDragging = () => {
            if (isDragging) {
                isDragging = false;
                container.classList.remove('dragging');
            }
        };

        const drag = (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const y = e.pageY - container.offsetTop;

            // Handle horizontal scrolling
            const walkX = (x - startX) * 2; // Scroll speed multiplier
            const newScrollLeft = scrollLeft - walkX;
            container.scrollLeft = newScrollLeft;

            // Handle vertical scrolling
            const walkY = (y - startY) * 2; // Scroll speed multiplier
            const newScrollTop = scrollTop - walkY;
            container.scrollTop = newScrollTop;

        };

        // Mouse events
        container.addEventListener('mousedown', startDragging);
        container.addEventListener('mouseleave', stopDragging);
        container.addEventListener('mouseup', stopDragging);
        container.addEventListener('mousemove', drag);

        // Touch events for mobile
        container.addEventListener('touchstart', (e) => {
            isDragging = true;
            startX = e.touches[0].pageX - container.offsetLeft;
            startY = e.touches[0].pageY - container.offsetTop;
            scrollLeft = container.scrollLeft;
            scrollTop = container.scrollTop;
            container.classList.add('dragging');
        });

        container.addEventListener('touchend', stopDragging);
        container.addEventListener('touchmove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            const x = e.touches[0].pageX - container.offsetLeft;
            const y = e.touches[0].pageY - container.offsetTop;

            // Handle horizontal scrolling
            const walkX = (x - startX) * 2;
            const newScrollLeft = scrollLeft - walkX;
            container.scrollLeft = newScrollLeft;

            // Handle vertical scrolling
            const walkY = (y - startY) * 2;
            const newScrollTop = scrollTop - walkY;
            container.scrollTop = newScrollTop;
        });

        console.log(`✅ Drag scroll functionality bound successfully for ${containerSelector}`);
    }

    // Bind synchronized scrolling between calendar and summary containers
    bindSynchronizedScrolling() {
        console.log('🔄 Binding synchronized scrolling between calendar and summary...');

        const calendarContainer = document.querySelector('.schedule-matrix-container');
        const summaryContainer = document.querySelector('.worker-count-summary-container');

        if (!calendarContainer || !summaryContainer) {
            console.log('❌ Calendar or summary container not found for scroll synchronization');
            return;
        }

        let isSyncingCalendar = false;
        let isSyncingSummary = false;

        // Throttle function for better scroll performance
        const throttle = (func, delay) => {
            let timeoutId;
            let lastExecTime = 0;
            return function (...args) {
                const currentTime = Date.now();
                if (currentTime - lastExecTime > delay) {
                    func.apply(this, args);
                    lastExecTime = currentTime;
                } else {
                    clearTimeout(timeoutId);
                    timeoutId = setTimeout(() => {
                        func.apply(this, args);
                        lastExecTime = Date.now();
                    }, delay - (currentTime - lastExecTime));
                }
            };
        };

        // Function to sync summary scroll when calendar scrolls (throttled)
        const syncSummaryFromCalendar = throttle(() => {
            if (isSyncingSummary) return; // Prevent infinite loop
            isSyncingCalendar = true;
            summaryContainer.scrollLeft = calendarContainer.scrollLeft;
            isSyncingCalendar = false;
        }, 16); // ~60fps

        // Function to sync calendar scroll when summary scrolls (throttled)
        const syncCalendarFromSummary = throttle(() => {
            if (isSyncingCalendar) return; // Prevent infinite loop
            isSyncingSummary = true;
            calendarContainer.scrollLeft = summaryContainer.scrollLeft;
            isSyncingSummary = false;
        }, 16); // ~60fps

        // Add scroll event listeners with passive option for better performance
        calendarContainer.addEventListener('scroll', syncSummaryFromCalendar, { passive: true });
        summaryContainer.addEventListener('scroll', syncCalendarFromSummary, { passive: true });

        console.log('✅ Synchronized scrolling bound successfully');
    }

    // Bind staffing issues panel controls
    bindStaffingPanelControls() {
        console.log('Binding staffing panel controls...');

        const panel = document.getElementById('staffingIssuesPanel');
        const toggleBtn = document.getElementById('togglePanel');
        const closeBtn = document.getElementById('closePanel');
        const panelHeader = document.querySelector('.panel-header');

        if (!panel || !toggleBtn || !closeBtn) {
            console.error('Staffing panel controls not found');
            return;
        }

        // Toggle panel collapse/expand
        toggleBtn.addEventListener('click', () => {
            const isCollapsed = panel.classList.contains('collapsed');
            const icon = toggleBtn.querySelector('i');

            if (isCollapsed) {
                panel.classList.remove('collapsed');
                icon.className = 'fas fa-chevron-down';
            } else {
                panel.classList.add('collapsed');
                icon.className = 'fas fa-chevron-up';
            }
        });

        // Start panel collapsed by default
        panel.classList.add('collapsed');
        const icon = toggleBtn.querySelector('i');
        if (icon) {
            icon.className = 'fas fa-chevron-up';
        }

        // Close/hide panel
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
        });

        // Make panel header draggable
        if (panelHeader) {
            let isDragging = false;
            let startX, startY, initialX, initialY;

            panelHeader.addEventListener('mousedown', (e) => {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                initialX = panel.offsetLeft;
                initialY = panel.offsetTop;
                panel.style.position = 'fixed';
                panel.style.zIndex = '1000';
                // Maintain width constraints during dragging
                panel.style.width = '380px';
                panel.style.minWidth = '380px';
                panel.style.maxWidth = '380px';
                e.preventDefault();
            });

            document.addEventListener('mousemove', (e) => {
                if (!isDragging) return;
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                panel.style.left = `${initialX + deltaX}px`;
                panel.style.top = `${initialY + deltaY}px`;
            });

            document.addEventListener('mouseup', () => {
                if (isDragging) {
                    isDragging = false;
                    panel.classList.remove('dragging');
                    // Ensure width constraints are maintained after dragging
                    panel.style.width = '380px';
                    panel.style.minWidth = '380px';
                    panel.style.maxWidth = '380px';
                }
            });
        }

        console.log('✅ Staffing panel controls bound successfully');
    }

    // Bind calendar filter controls
    bindCalendarFilters() {
        console.log('Binding calendar filter controls...');

        // Shift filter buttons
        const allShiftsBtn = document.getElementById('filterAllShifts');
        const dayShiftsBtn = document.getElementById('filterDayShifts');
        const nightShiftsBtn = document.getElementById('filterNightShifts');

        if (allShiftsBtn) {
            allShiftsBtn.addEventListener('click', () => this.workforceManager.filterManager.toggleShiftFilter('all-shifts'));
        }
        if (dayShiftsBtn) {
            dayShiftsBtn.addEventListener('click', () => this.workforceManager.filterManager.toggleShiftFilter('day'));
        }
        if (nightShiftsBtn) {
            nightShiftsBtn.addEventListener('click', () => this.workforceManager.filterManager.toggleShiftFilter('night'));
        }

        // Role filter buttons (will be dynamically created)
        const allRolesBtn = document.getElementById('filterAllRoles');
        if (allRolesBtn) {
            allRolesBtn.addEventListener('click', () => this.workforceManager.filterManager.toggleRoleFilter('all-roles'));
        }

        // Charge shifts filter button
        const chargeShiftsBtn = document.getElementById('filterChargeShifts');
        if (chargeShiftsBtn) {
            chargeShiftsBtn.addEventListener('click', () => this.workforceManager.filterManager.toggleRoleFilter('charge-shifts'));
        }

        // Sort select removed; using compact Sort dropdown instead

        // Initialize filter states and create role filter buttons
        this.workforceManager.filterManager.initializeCalendarFilters();
        this.workforceManager.filterManager.createRoleFilterButtons();

        console.log('Calendar filter controls bound successfully');
    }

    // Bind shift editing functionality
    bindShiftEditing() {
        console.log('🔧 Binding shift editing functionality...');

        // Create context menu element
        this.createContextMenu();

        // Bind context menu events will be handled in renderScheduleMatrix
    }

    // Create context menu for shift editing (optimized)
    createContextMenu() {
        // Check if context menu already exists
        if (document.getElementById('shiftContextMenu')) {
            return;
        }

        // Create the context menu HTML
        const contextMenuHTML = `
            <div id="shiftContextMenu" class="shift-context-menu" style="display: none;">
                <div class="context-menu-header">
                    <span class="context-menu-title">Edit Shift</span>
                    <button id="closeContextMenu" class="context-menu-close">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="context-menu-content">
                    <div class="context-menu-section">
                        <div class="context-menu-label">Custom Shift:</div>
                        <div class="custom-shift-input-container">
                            <input type="text" id="customShiftInput" class="custom-shift-input" placeholder="Type custom shift name..." maxlength="50">
                            <button id="addCustomShiftBtn" class="add-custom-shift-btn">
                                <i class="fas fa-plus"></i>
                            </button>
                        </div>
                    </div>
                    <div class="context-menu-divider"></div>
                    <div class="context-menu-section">
                        <div class="context-menu-label">Suggested Shifts:</div>
                        <div id="shiftOptions" class="shift-options"></div>
                    </div>
                </div>
            </div>
        `;

        // Add to body
        document.body.insertAdjacentHTML('beforeend', contextMenuHTML);

        // Bind events
        this.bindContextMenuEvents();
    }

    // Bind context menu events
    bindContextMenuEvents() {
        const contextMenu = document.getElementById('shiftContextMenu');
        const closeBtn = document.getElementById('closeContextMenu');
        const customShiftInput = document.getElementById('customShiftInput');
        const addCustomShiftBtn = document.getElementById('addCustomShiftBtn');

        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideContextMenu());
        }


        if (customShiftInput) {
            customShiftInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    this.workforceManager.employeeManager.addCustomShift();
                }
            });
        }

        if (addCustomShiftBtn) {
            addCustomShiftBtn.addEventListener('click', () => this.workforceManager.employeeManager.addCustomShift());
        }

        // Close context menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!contextMenu.contains(e.target)) {
                this.hideContextMenu();
            }
        });

        // Prevent context menu from closing when clicking inside
        contextMenu.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Show context menu for a shift cell
    showContextMenu(event, employeeId, date, currentShiftId, shiftCell) {
        event.preventDefault();

        const contextMenu = document.getElementById('shiftContextMenu');
        if (!contextMenu) return;

        // Store current shift info
        this.currentShiftContext = {
            employeeId,
            date,
            currentShiftId,
            shiftCell
        };

        // Position the menu (optimized height)
        const rect = shiftCell.getBoundingClientRect();
        const menuWidth = 280;
        const menuHeight = 280;

        let left = event.clientX;
        let top = event.clientY;

        // Adjust position if menu would go off screen
        if (left + menuWidth > window.innerWidth) {
            left = window.innerWidth - menuWidth - 10;
        }
        if (top + menuHeight > window.innerHeight) {
            top = window.innerHeight - menuHeight - 10;
        }

        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
        contextMenu.style.display = 'block';

        // Clear custom shift input
        const customShiftInput = document.getElementById('customShiftInput');
        if (customShiftInput) {
            customShiftInput.value = '';
            customShiftInput.focus();
        }

        // Populate shift options
        this.populateShiftOptions();

    }

    // Hide context menu
    hideContextMenu() {
        const contextMenu = document.getElementById('shiftContextMenu');
        if (contextMenu) {
            contextMenu.style.display = 'none';
        }
        this.currentShiftContext = null;
    }

    // Populate shift options in context menu (optimized)
    populateShiftOptions() {
        const shiftOptionsContainer = document.getElementById('shiftOptions');
        if (!shiftOptionsContainer || !this.currentShiftContext) return;

        // Get the employee to find their preferred shifts
        const employee = this.workforceManager.employees.find(e => e.id === this.currentShiftContext.employeeId);
        if (!employee) return;

        // Get available shifts for this employee (prioritizes shifts they've worked before)
        const availableShifts = this.workforceManager.employeeManager.getAvailableShiftsForEmployee(employee);
        
        let optionsHTML = '';

        // Add "Off" option first
        optionsHTML += `
            <button class="shift-option-btn ${!this.currentShiftContext.currentShiftId ? 'active' : ''}" data-shift-id="">
                <span class="shift-option-color" style="background-color: #f3f4f6;"></span>
                <span class="shift-option-name">Off</span>
            </button>
        `;

        // Add available shifts (prioritized by employee's history)
        availableShifts.forEach(shiftType => {
            const isActive = this.currentShiftContext.currentShiftId === shiftType.id;
            optionsHTML += `
                <button class="shift-option-btn ${isActive ? 'active' : ''}" data-shift-id="${shiftType.id}">
                    <span class="shift-option-color" style="background-color: ${shiftType.color || '#3b82f6'};"></span>
                    <span class="shift-option-name">${shiftType.name}</span>
                </button>
            `;
        });

        shiftOptionsContainer.innerHTML = optionsHTML;

        // Use event delegation for better performance
        shiftOptionsContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('.shift-option-btn');
            if (btn && this.currentShiftContext) {
                const shiftId = btn.dataset.shiftId;
                this.workforceManager.employeeManager.assignShiftToEmployee(this.currentShiftContext.employeeId, this.currentShiftContext.date, shiftId);
                this.hideContextMenu();
            }
        });
    }


    // Bind right-click events to shift cells
    bindShiftCellEvents() {
        // Target both existing shift cells AND empty cells that can become shift cells
        const allShiftCells = document.querySelectorAll('.shift-cell, .matrix-cell[data-employee-id][data-date]');

        if (!allShiftCells || allShiftCells.length === 0) {
            console.log('No shift cells found to bind events to');
            return;
        }

        console.log(`🔧 Binding events to ${allShiftCells.length} shift cells (including empty cells)`);

        // Add global context menu prevention for the schedule matrix
        const scheduleMatrix = document.getElementById('scheduleMatrix');
        if (scheduleMatrix) {
            // Remove any existing global context menu listener
            if (this.globalContextMenuHandler) {
                scheduleMatrix.removeEventListener('contextmenu', this.globalContextMenuHandler);
            }

            // Add new global context menu prevention
            this.globalContextMenuHandler = (e) => {
                // Only prevent if it's on a shift cell or matrix cell
                if (e.target.closest('.shift-cell, .matrix-cell[data-employee-id]')) {
                    console.log('🛡️ GLOBAL CONTEXT MENU: Preventing on schedule matrix cell');
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            };

            scheduleMatrix.addEventListener('contextmenu', this.globalContextMenuHandler, true); // Capture phase
        }

        allShiftCells.forEach(cell => {
            // Remove any existing event listeners by cloning the element
            const newCell = cell.cloneNode(true);
            cell.parentNode.replaceChild(newCell, cell);
            
            // Now bind events to the clean cell
            // Use mousedown for immediate response
            newCell.addEventListener('mousedown', (e) => {
                // Only respond to right mouse button (button 2)
                if (e.button !== 2) return;

                console.log('🖱️ MOUSEDOWN EVENT: Right-click detected on shift cell');
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    console.log('🛡️ MOUSEDOWN: Prevented default and propagation');
                    const employeeId = cell.dataset.employeeId;
                    const date = cell.dataset.date;
                    const currentShiftId = cell.dataset.shiftId;

                    if (!employeeId || !date) {
                        console.error('Missing required data attributes on shift cell');
                        return;
                    }

                    // Check if editing is locked for this employee's shift type
                    const employee = this.workforceManager.employees.find(emp => emp.id === employeeId);
                    if (employee) {
                        const employeeShiftType = this.workforceManager.employeeManager.determineEmployeeShiftType(employee);
                        const shiftTypeKey = employeeShiftType.toLowerCase();
                        
                        console.log(`🔍 EDITING CHECK: Employee ${employee.name} is ${employeeShiftType} shift type`);
                        console.log(`🔍 EDITING CHECK: Checking if ${shiftTypeKey} editing is locked...`);
                        
                        const isLocked = this.workforceManager.calendarRenderer.isShiftEditingLocked(shiftTypeKey);
                        console.log(`🔍 EDITING CHECK: ${shiftTypeKey} shift locked = ${isLocked}`);
                        
                        if (isLocked) {
                            console.log(`🚫 EDITING BLOCKED: ${shiftTypeKey} shift editing is locked, showing message`);
                            // Show locked message instead of context menu
                            this.showLockedMessage(e, shiftTypeKey);
                            return;
                        } else {
                            console.log(`✅ EDITING ALLOWED: ${shiftTypeKey} shift editing is not locked, showing context menu`);
                        }
                    } else {
                        console.log(`⚠️ EDITING CHECK: Employee not found for ID ${employeeId}`);
                    }

                    // Show context menu
                    this.showContextMenu(e, employeeId, date, currentShiftId, newCell);
                } catch (error) {
                    console.error('Error handling shift cell context menu:', error);
                }
            });

            // Also prevent contextmenu event to stop browser menu
            newCell.addEventListener('contextmenu', (e) => {
                console.log('🛡️ CONTEXT MENU EVENT: Preventing default browser menu');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            });

            // Additional safety: use capture phase for contextmenu
            newCell.addEventListener('contextmenu', (e) => {
                console.log('🛡️ CONTEXT MENU CAPTURE: Preventing default browser menu');
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true); // Capture phase
        });
    }

    // Cleanup global context menu handler
    cleanupGlobalContextMenu() {
        const scheduleMatrix = document.getElementById('scheduleMatrix');
        if (scheduleMatrix && this.globalContextMenuHandler) {
            scheduleMatrix.removeEventListener('contextmenu', this.globalContextMenuHandler);
            this.globalContextMenuHandler = null;
        }
    }

    // Update grid template based on visible columns
    updateGridTemplate() {
        const matrixContainer = document.getElementById('scheduleMatrix');
        if (!matrixContainer) return;

        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 42;
        const baseColumns = 2; // Employee name + role columns
        const dateColumns = timeInterval; // Date columns
        const totalCountColumns = 7; // Always 7 count columns (Fri, Sat, Sun, Vac, Req, CHA, MOV)
        const visibleCountColumns = this.workforceManager.filterManager.getVisibleCountColumns(); // Count columns based on visibility
        const totalColumns = baseColumns + dateColumns + totalCountColumns;

        // Build grid template to match HTML structure exactly (all columns always present)
        let gridTemplate = `130px 120px repeat(${timeInterval}, 50px)`; // Base columns + date columns

        // Always include all count columns in grid template (HTML always has them)
        gridTemplate += ' 40px 40px 40px 40px 40px 40px 40px'; // Fri, Sat, Sun, Vac, Req, CHA, MOV

        matrixContainer.style.gridTemplateColumns = gridTemplate;
        console.log(`Updated grid template: ${gridTemplate} (${totalColumns} total columns, ${visibleCountColumns} visible count columns)`);
    }

    /**
     * Show locked message when trying to edit locked shift
     */
    showLockedMessage(e, shiftType) {
        // Remove any existing tooltip
        const existingTooltip = document.getElementById('lockedShiftTooltip');
        if (existingTooltip) {
            existingTooltip.remove();
        }

        // Create new locked message tooltip
        const tooltip = document.createElement('div');
        tooltip.id = 'lockedShiftTooltip';
        tooltip.className = 'locked-shift-tooltip';
        tooltip.textContent = `${shiftType.charAt(0).toUpperCase() + shiftType.slice(1)} shift editing is locked`;
        
        document.body.appendChild(tooltip);

        // Position tooltip
        const rect = tooltip.getBoundingClientRect();
        tooltip.style.left = (e.pageX + 10) + 'px';
        tooltip.style.top = (e.pageY - 30) + 'px';
        tooltip.style.display = 'block';

        console.log(`Showing locked message for ${shiftType} shift`);

        // Hide tooltip after 3 seconds
        setTimeout(() => {
            if (tooltip && tooltip.parentNode) {
                tooltip.remove();
            }
        }, 3000);
    }
}

// Export the class
window.UIManager = UIManager;
