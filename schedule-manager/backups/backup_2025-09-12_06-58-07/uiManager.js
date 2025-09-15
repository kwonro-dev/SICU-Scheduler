// UI Manager Module
// Handles all UI interactions including drag scrolling, context menus, and event binding

class UIManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;
        this.currentShiftContext = null;
    }

    // Bind drag scroll functionality for horizontal scrolling
    bindDragScroll() {
        console.log('Binding drag scroll functionality...');

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
            console.log(`❌ Container ${containerSelector} not found, will retry after render`);
            return;
        }

        // Check if container has content that would require scrolling
        console.log(`📏 ${containerSelector} dimensions:`, {
            clientWidth: container.clientWidth,
            scrollWidth: container.scrollWidth,
            clientHeight: container.clientHeight,
            scrollHeight: container.scrollHeight
        });

        if (container.scrollWidth <= container.clientWidth && container.scrollHeight <= container.clientHeight) {
            console.log(`⚠️ ${containerSelector}: No scrolling needed - content fits within container`);
        } else {
            console.log(`✅ ${containerSelector}: Scrolling available - content overflows container`);
            if (container.scrollWidth > container.clientWidth) {
                console.log('  ↔️ Horizontal scroll available');
            }
            if (container.scrollHeight > container.clientHeight) {
                console.log('  ↕️ Vertical scroll available');
            }
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
            console.log(`🖱️ Started dragging ${containerSelector} at position:`, { x: startX, y: startY }, 'scroll:', { left: scrollLeft, top: scrollTop });
        };

        const stopDragging = () => {
            if (isDragging) {
                isDragging = false;
                container.classList.remove('dragging');
                console.log(`🖱️ Stopped dragging ${containerSelector}`);
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

            // Only log occasionally to avoid console spam
            if (Math.abs(walkX) > 5 || Math.abs(walkY) > 5) {
                console.log(`🖱️ Dragging ${containerSelector} - position:`, { x, y }, 'walk:', { x: walkX, y: walkY });
            }
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
            console.log(`📱 Touch started ${containerSelector} at position:`, { x: startX, y: startY });
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

            console.log(`📱 Touch moving ${containerSelector} - position:`, { x, y }, 'walk:', { x: walkX, y: walkY });
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

        // Function to sync summary scroll when calendar scrolls
        const syncSummaryFromCalendar = () => {
            if (isSyncingSummary) return; // Prevent infinite loop
            isSyncingCalendar = true;
            summaryContainer.scrollLeft = calendarContainer.scrollLeft;
            isSyncingCalendar = false;
        };

        // Function to sync calendar scroll when summary scrolls
        const syncCalendarFromSummary = () => {
            if (isSyncingCalendar) return; // Prevent infinite loop
            isSyncingSummary = true;
            calendarContainer.scrollLeft = summaryContainer.scrollLeft;
            isSyncingSummary = false;
        };

        // Add scroll event listeners
        calendarContainer.addEventListener('scroll', syncSummaryFromCalendar);
        summaryContainer.addEventListener('scroll', syncCalendarFromSummary);

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
                isDragging = false;
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

        // Use a much simpler approach - just show the most common shifts
        const commonShifts = this.workforceManager.shiftTypes.slice(0, 6); // Limit to 6 for speed
        
        let optionsHTML = '';

        // Add "Off" option first
        optionsHTML += `
            <button class="shift-option-btn ${!this.currentShiftContext.currentShiftId ? 'active' : ''}" data-shift-id="">
                <span class="shift-option-color" style="background-color: #f3f4f6;"></span>
                <span class="shift-option-name">Off</span>
            </button>
        `;

        // Add common shifts
        commonShifts.forEach(shiftType => {
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
            if (btn) {
                const shiftId = btn.dataset.shiftId;
                this.workforceManager.employeeManager.assignShiftToEmployee(this.currentShiftContext.employeeId, this.currentShiftContext.date, shiftId);
                this.hideContextMenu();
            }
        });
    }


    // Bind right-click events to shift cells
    bindShiftCellEvents() {
        const shiftCells = document.querySelectorAll('.shift-cell');

        if (!shiftCells || shiftCells.length === 0) {
            console.log('No shift cells found to bind events to');
            return;
        }

        shiftCells.forEach(cell => {
            // Use mousedown for immediate response
            cell.addEventListener('mousedown', (e) => {
                // Only respond to right mouse button (button 2)
                if (e.button !== 2) return;
                
                try {
                    e.preventDefault();
                    e.stopPropagation();
                    const employeeId = cell.dataset.employeeId;
                    const date = cell.dataset.date;
                    const currentShiftId = cell.dataset.shiftId;

                    if (!employeeId || !date) {
                        console.error('Missing required data attributes on shift cell');
                        return;
                    }

                    // Show context menu
                    this.showContextMenu(e, employeeId, date, currentShiftId, cell);
                } catch (error) {
                    console.error('Error handling shift cell context menu:', error);
                }
            });

            // Also prevent contextmenu event to stop browser menu
            cell.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
        });
    }

    // Update grid template based on visible columns
    updateGridTemplate() {
        const matrixContainer = document.getElementById('scheduleMatrix');
        if (!matrixContainer) return;

        const timeInterval = parseInt(localStorage.getItem('timeInterval')) || 48;
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
}

// Export the class
window.UIManager = UIManager;
