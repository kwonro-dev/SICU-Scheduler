// Import Manager - Handles all import functionality

class ImportManager {
    constructor(workforceManager) {
        this.workforceManager = workforceManager;

        // Import state
        this.rawCsvData = null;
        this.cleanedCsvData = null;
        this.xlsxFileName = null;
        this.xlsxMetadataRow = null;
        this.xlsxImportData = null;
        this.importData = null;
    }

    // Render import view
    renderImportView() {
        const importContent = document.getElementById('importContent');
        if (!importContent) return;

        // The import view HTML is already in the page, so we just need to make sure it's visible
        // The view switching will handle showing/hiding the correct view
    }

    // Handle XLSX file import
    async handleXLSXImport(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        // BUG FIX: Clear ALL previous import state to prevent stale data issues
        this.rawCsvData = null;
        this.cleanedCsvData = null;
        this.xlsxFileName = null;
        this.xlsxMetadataRow = null;
        this.xlsxImportData = null;
        
        const progressDiv = document.getElementById('xlsxProgress');
        const progressFill = document.getElementById('xlsxProgressFill');
        const progressText = document.getElementById('xlsxProgressText');

        progressDiv.style.display = 'block';
        progressText.textContent = 'Loading XLSX file...';
        progressFill.style.width = '20%';

        try {
            // Read the file as ArrayBuffer for XLSX processing
            const arrayBuffer = await DataProcessor.readFileAsArrayBuffer(file);

            progressText.textContent = 'Parsing XLSX data...';
            progressFill.style.width = '40%';

            // Check if XLSX library is available
            if (typeof XLSX === 'undefined') {
                throw new Error('XLSX library not loaded. Please check if the SheetJS library is properly included.');
            }

            // Parse XLSX using SheetJS
            const workbook = XLSX.read(arrayBuffer, { type: 'array' });

            // Get the first worksheet
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];

            // Convert to CSV format
            const csvData = XLSX.utils.sheet_to_csv(worksheet);

            progressText.textContent = 'Converting to CSV format...';
            progressFill.style.width = '60%';

            // Store the raw CSV data for debugging display
            this.rawCsvData = csvData;
            this.xlsxFileName = file.name;

            // OPTIMIZATION: Process data ONCE here and store results
            // This prevents duplicate processing in showCsvPreview() and processCsvImport()
            const fullCsvWithCleanedContent = this.cleanCsvNewlines(csvData);
            const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
            
            // Save the 8th row as metadata (before removing header rows)
            const rawMetadataRow = cleanedLines[7] || '';
            this.xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);
            
            // Remove first 8 header rows
            const dataLines = cleanedLines.slice(8);
            const csvWithoutHeaders = dataLines.join('\n');
            this.cleanedCsvData = DataProcessor.removeColumnsWithAllBlankData(csvWithoutHeaders);

            progressText.textContent = 'Conversion complete!';
            progressFill.style.width = '100%';

            // Show CSV preview
            setTimeout(() => {
                // Skip preview: go straight to processing and success page
                this.processCsvImport();
            }, 500);

        } catch (error) {
            console.error('XLSX import error:', error);
            progressText.textContent = 'Import failed: ' + error.message;
            progressFill.style.backgroundColor = '#ef4444';
            setTimeout(() => {
                progressDiv.style.display = 'none';
                document.getElementById('dataPreview').innerHTML = '<p style="color: red;">Import failed. Please check your file format.</p>';
            }, 2000);
        }
    }

    // Show CSV preview before import
    // OPTIMIZED: Uses pre-processed data when available to avoid duplicate work
    showCsvPreview(csvData, fileName) {

        const dataPreview = document.getElementById('dataPreview');

        if (!dataPreview) {
            console.error('dataPreview element not found!');
            return;
        }

        console.log('dataPreview element found:', dataPreview);

        // OPTIMIZATION: Use pre-processed data if available (from handleXLSXImport)
        let fullyCleanedCsv;
        let fullCsvWithCleanedContent;
        let cleanedLines;
        
        if (this.cleanedCsvData && this.xlsxMetadataRow !== null) {
            // Data was already processed in handleXLSXImport, reuse it
            fullyCleanedCsv = this.cleanedCsvData;
            fullCsvWithCleanedContent = this.cleanCsvNewlines(csvData); // Still need for stats
            cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
        } else {
            // Fallback: process data if not pre-processed
            fullCsvWithCleanedContent = this.cleanCsvNewlines(csvData);
            cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
            
            console.log('Original CSV lines:', csvData.trim().split('\n').length);
            console.log('Cleaned CSV lines:', cleanedLines.length);

            const rawMetadataRow = cleanedLines[7] || '';
            this.xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);
            console.log('Processed metadata row:', this.xlsxMetadataRow);

            const dataLines = cleanedLines.slice(8);
            const csvWithoutHeaders = dataLines.join('\n');
            fullyCleanedCsv = DataProcessor.removeColumnsWithAllBlankData(csvWithoutHeaders);
            this.cleanedCsvData = fullyCleanedCsv;
        }
        
        const dataLines = cleanedLines.slice(8);

        // Get statistics for display
        const originalLines = csvData.trim().split('\n');
        const fullCleanedLines = fullCsvWithCleanedContent.trim().split('\n');

        // Split cleaned CSV into lines for display
        const allLines = fullyCleanedCsv.trim().split('\n');

        // Get column count from data after headers removed vs final cleaned data
        const afterHeadersColumns = dataLines.length > 0 ? DataProcessor.parseCsvRow(dataLines[0]).length : 0;
        const finalColumns = allLines.length > 0 ? DataProcessor.parseCsvRow(allLines[0]).length : 0;
        const totalLines = allLines.length;
        const originalChars = csvData.length;
        const cleanedChars = fullyCleanedCsv.length;

        const contentCleaned = (originalChars !== fullCsvWithCleanedContent.length);
        const columnsRemoved = afterHeadersColumns - finalColumns;
        const headersRemoved = 8; // Always removing first 8 rows now

        // Headers have already been removed, so allLines contains only data rows
        const processedLines = allLines.length;

        // Store the cleaned CSV data for import processing
        this.cleanedCsvData = fullyCleanedCsv;

        // Create preview with saved 8th row as first line, then first 9 data lines and last 5 data lines
        let previewContent = '';
        const maxPreviewLines = 15;

        // Add the saved 8th row (metadata) as the first line if it exists
        console.log('Checking metadata row for preview:', this.xlsxMetadataRow);
        if (this.xlsxMetadataRow && this.xlsxMetadataRow.trim()) {
            console.log('Adding metadata row to preview');
            previewContent = this.xlsxMetadataRow + '\n';
            const remainingPreviewLines = maxPreviewLines - 1;

            if (allLines.length <= remainingPreviewLines) {
                previewContent += allLines.join('\n');
            } else {
                const firstLines = allLines.slice(0, remainingPreviewLines - 1);
                const lastLines = allLines.slice(-5);
                previewContent += firstLines.join('\n') + '\n...\n' + lastLines.join('\n');
            }
        } else {
            console.log('No metadata row found, showing regular preview');
            // No metadata row, show regular preview
            if (allLines.length <= maxPreviewLines) {
                previewContent = allLines.join('\n');
            } else {
                const firstLines = allLines.slice(0, maxPreviewLines - 1);
                const lastLines = allLines.slice(-5);
                previewContent = firstLines.join('\n') + '\n...\n' + lastLines.join('\n');
            }
        }
        console.log('Final preview content length:', previewContent.length);
        console.log('Preview content first 200 chars:', previewContent.substring(0, 200));

        // Create the preview HTML
        let html = `
            <div class="import-preview">
                <h4>📄 CSV Preview - ${fileName}</h4>
                <div class="preview-stats">
                    <div class="stat-item">📊 <strong>${originalLines.length}</strong> original lines</div>
                    <div class="stat-item">🧹 <strong>${fullCleanedLines.length}</strong> after cleaning</div>
                    <div class="stat-item">📋 <strong>${processedLines}</strong> data rows</div>
                    <div class="stat-item">📈 <strong>${afterHeadersColumns}</strong> → <strong>${finalColumns}</strong> columns</div>
                </div>

                ${contentCleaned ? '<div class="processing-note">✅ Content within quotes cleaned</div>' : ''}
                ${headersRemoved > 0 ? `<div class="processing-note">✅ ${headersRemoved} header rows removed</div>` : ''}
                ${columnsRemoved > 0 ? `<div class="processing-note">✅ ${columnsRemoved} blank columns removed</div>` : ''}

                <div class="csv-preview">
                    ${this.xlsxMetadataRow && this.xlsxMetadataRow.trim() ? '<div class="metadata-indicator">📋 <strong>Metadata Row:</strong></div>' : ''}
                    <pre>${this.escapeHtml(previewContent)}</pre>
                </div>

                <div class="import-actions">
                    <button class="btn btn-primary" onclick="window.workforceManager?.importManager?.processCsvImport()">
                        <i class="fas fa-upload"></i> Process XLSX Import
                    </button>
                    <button class="btn btn-secondary" onclick="window.workforceManager?.importManager?.cancelCsvPreview()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            </div>
        `;

        console.log('Setting dataPreview.innerHTML with length:', html.length);
        console.log('HTML preview (first 500 chars):', html.substring(0, 500));
        dataPreview.innerHTML = html;
        console.log('showCsvPreview completed successfully');

        // Auto-scroll to make the preview visible
        setTimeout(() => {
            dataPreview.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }

    // Process the CSV import after user confirms
    // OPTIMIZED: Uses pre-processed data from handleXLSXImport when available
    processCsvImport() {
        if (!this.rawCsvData) {
            alert('No CSV data available. Please upload a file first.');
            return;
        }

        const progressDiv = document.getElementById('xlsxProgress');
        const progressFill = document.getElementById('xlsxProgressFill');
        const progressText = document.getElementById('xlsxProgressText');

        progressDiv.style.display = 'block';
        progressText.textContent = 'Processing CSV data...';
        progressFill.style.width = '20%';

        try {
            // OPTIMIZATION: Data should already be cleaned in handleXLSXImport
            // Only process if somehow we got here without pre-processing (edge case)
            if (!this.cleanedCsvData) {
                console.warn('CSV data was not pre-processed, processing now...');
                const fullCsvWithCleanedContent = this.cleanCsvNewlines(this.rawCsvData);
                const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
                
                // Process metadata row if not already done
                if (!this.xlsxMetadataRow) {
                    const rawMetadataRow = cleanedLines[7] || '';
                    this.xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);
                }

                const dataLines = cleanedLines.slice(8);
                const csvWithoutHeaders = dataLines.join('\n');
                this.cleanedCsvData = DataProcessor.removeColumnsWithAllBlankData(csvWithoutHeaders);
            }

            // Use the pre-processed cleaned data
            const filteredCsvData = this.cleanedCsvData;

            // Parse the filtered CSV data using XLSX-specific parsing logic
            const data = DataProcessor.parseXlsxCsv(filteredCsvData);

            // Process the schedule data for XLSX
            progressText.textContent = 'Processing XLSX schedule data...';
            progressFill.style.width = '60%';

            const processedData = DataProcessor.processXlsxScheduleData(data, generateId, this.workforceManager.currentWeekStart, this.xlsxMetadataRow, DataProcessor.parseCsvRow);

            progressText.textContent = 'Preparing XLSX import results...';
            progressFill.style.width = '100%';

            // Show XLSX import results
            setTimeout(() => {
                progressDiv.style.display = 'none';
                this.showXlsxImportResults(processedData);
            }, 500);

        } catch (error) {
            console.error('CSV processing error:', error);
            progressText.textContent = 'Processing failed: ' + error.message;
            progressFill.style.backgroundColor = '#ef4444';
            setTimeout(() => {
                progressDiv.style.display = 'none';
                document.getElementById('dataPreview').innerHTML = '<p style="color: red;">Processing failed. Please check your file format.</p>';
            }, 2000);
        }
    }

    // XLSX-specific import results display
    showXlsxImportResults(processedData) {
        const dataPreview = document.getElementById('dataPreview');

        const { employees, schedules, totalRows, totalEmployees, totalShiftAssignments } = processedData;

        // Count unique shift types from the schedules
        const uniqueShiftTypes = new Set();
        schedules.forEach(schedule => {
            if (schedule.shiftType && schedule.shiftType.trim()) {
                uniqueShiftTypes.add(schedule.shiftType.trim());
            }
        });
        const totalShiftTypes = uniqueShiftTypes.size;

        dataPreview.innerHTML = `
            <div class="import-results">
                <h4>✅ XLSX Import Successful!</h4>
                <div class="stats-grid">
                    <div class="stat-item">
                        <strong>${totalEmployees}</strong> Employees imported
                    </div>
                    <div class="stat-item">
                        <strong>${totalShiftTypes}</strong> Shift types
                    </div>
                    <div class="stat-item">
                        <strong>${totalShiftAssignments}</strong> Shift assignments
                    </div>
                    <div class="stat-item">
                        <strong>${totalRows}</strong> Total rows processed
                    </div>
                </div>

                ${employees.length > 0 ? `
                <div class="preview-table">
                    <h5>Imported Employees:</h5>
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Job Role</th>
                                <th>Shifts Assigned</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${employees.slice(0, 5).map(employee => `
                                <tr>
                                    <td>${employee.name}</td>
                                    <td>${employee.role}</td>
                                    <td>${schedules.filter(s => s.employeeId === employee.id).length} shifts</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                ` : ''}

                <div class="import-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="window.workforceManager?.importManager?.confirmXlsxImport()">
                        <i class="fas fa-save"></i> Save XLSX Import
                    </button>
                    <button class="btn btn-secondary" onclick="window.workforceManager?.importManager?.cancelXlsxImport()">
                        <i class="fas fa-times"></i> Cancel Import
                    </button>
                </div>
            </div>
        `;

        // Store the processed data for confirmation
        this.xlsxImportData = processedData;
    }

    // Confirm and save XLSX import data
    // OPTIMIZED: Uses Map/Set for O(1) lookups instead of O(n) .find() calls
    async confirmXlsxImport() {
        if (!this.xlsxImportData) {
            alert('No XLSX import data available. Please upload a file first.');
            return;
        }

        const { employees, schedules } = this.xlsxImportData;

        try {
            // OPTIMIZATION: Build lookup maps ONCE for O(1) access
            const existingShiftTypeMap = new Map(
                this.workforceManager.shiftTypes.map(st => [st.name, st])
            );
            const existingJobRoleMap = new Map(
                this.workforceManager.jobRoles.map(jr => [jr.name, jr])
            );
            const existingEmployeeMap = new Map(
                this.workforceManager.employees.map(e => [e.name, e])
            );
            // For schedules, create composite key: "employeeId|date|shiftType"
            const existingScheduleSet = new Set(
                this.workforceManager.schedules.map(s => `${s.employeeId}|${s.date}|${s.shiftType}`)
            );

            // First, extract and create shift types from the schedule data
            const uniqueShiftTypes = new Set();
            schedules.forEach(schedule => {
                if (schedule.shiftType && schedule.shiftType.trim()) {
                    uniqueShiftTypes.add(schedule.shiftType.trim());
                }
            });

            // Create shift types that don't already exist - O(1) lookup now
            let newShiftTypesCount = 0;
            uniqueShiftTypes.forEach(shiftTypeName => {
                if (!existingShiftTypeMap.has(shiftTypeName)) {
                    const newShiftType = {
                        id: generateId(),
                        name: shiftTypeName,
                        color: ScheduleUtils.getDefaultShiftColor(shiftTypeName),
                        created: new Date().toISOString()
                    };
                    this.workforceManager.shiftTypes.push(newShiftType);
                    existingShiftTypeMap.set(shiftTypeName, newShiftType); // Update map for linking step
                    newShiftTypesCount++;
                }
            });

            // Extract and create unique job roles from employee data
            const uniqueJobRoles = new Set();
            employees.forEach(employee => {
                if (employee.role && employee.role.trim()) {
                    uniqueJobRoles.add(employee.role.trim());
                }
            });

            // Create job roles that don't already exist - O(1) lookup now
            let newJobRolesCount = 0;
            uniqueJobRoles.forEach(jobRoleName => {
                if (!existingJobRoleMap.has(jobRoleName)) {
                    const newJobRole = {
                        id: generateId(),
                        name: jobRoleName,
                        color: ScheduleUtils.getDefaultRoleColor(jobRoleName),
                        created: new Date().toISOString()
                    };
                    this.workforceManager.jobRoles.push(newJobRole);
                    existingJobRoleMap.set(jobRoleName, newJobRole); // Update map for linking step
                    newJobRolesCount++;
                }
            });

            // Link schedules to shift type IDs - O(1) lookup now
            // OPTIMIZATION: Avoid multiple .trim() calls, collect warnings
            let shiftTypeMisses = 0;
            schedules.forEach(schedule => {
                const shiftTypeName = schedule.shiftType?.trim();
                if (shiftTypeName) {
                    const shiftType = existingShiftTypeMap.get(shiftTypeName);
                    if (shiftType) {
                        schedule.shiftId = shiftType.id;
                    } else {
                        shiftTypeMisses++;
                    }
                }
            });
            if (shiftTypeMisses > 0) {
                console.warn(`Could not find shift type for ${shiftTypeMisses} schedules`);
            }

            // Link employees to job role IDs - O(1) lookup now
            let jobRoleMisses = 0;
            employees.forEach(employee => {
                const roleName = employee.role?.trim();
                if (roleName) {
                    const jobRole = existingJobRoleMap.get(roleName);
                    if (jobRole) {
                        employee.roleId = jobRole.id;
                    } else {
                        jobRoleMisses++;
                    }
                }
            });
            if (jobRoleMisses > 0) {
                console.warn(`Could not find job role for ${jobRoleMisses} employees`);
            }

            // Now add the employees and schedules (with duplicate prevention) - O(1) lookup now
            let newEmployeesCount = 0;
            let skippedEmployees = 0;
            employees.forEach(employee => {
                const existingEmployee = existingEmployeeMap.get(employee.name);
                if (!existingEmployee) {
                    this.workforceManager.employees.push(employee);
                    existingEmployeeMap.set(employee.name, employee); // Track for future lookups
                    newEmployeesCount++;
                } else {
                    skippedEmployees++;
                    Object.assign(existingEmployee, employee);
                }
            });
            // Log summary instead of per-item (avoids 1000s of console.log calls)
            if (skippedEmployees > 0) {
                console.log(`⏭️ Skipped ${skippedEmployees} duplicate employees`);
            }

            // Add schedules (with duplicate prevention) - O(1) lookup now
            let newSchedulesCount = 0;
            let skippedSchedules = 0;
            schedules.forEach(schedule => {
                const scheduleKey = `${schedule.employeeId}|${schedule.date}|${schedule.shiftType}`;
                if (!existingScheduleSet.has(scheduleKey)) {
                    this.workforceManager.schedules.push(schedule);
                    existingScheduleSet.add(scheduleKey); // Track for future lookups
                    newSchedulesCount++;
                } else {
                    skippedSchedules++;
                }
            });
            // Log summary instead of per-item
            if (skippedSchedules > 0) {
                console.log(`⏭️ Skipped ${skippedSchedules} duplicate schedules`);
            }

            // OPTIMISTIC UI: Show calendar immediately, sync to Firebase in background
            // This makes the import feel instant!
            
            // Set flag to prevent real-time listener conflicts during bulk import
            this.workforceManager.isResetting = true;
            
            // Update role badge styles for new job roles (fast, local operation)
            this.workforceManager.updateRoleBadgeStyles();

            // Set calendar start date to the first (earliest) imported date
            if (schedules.length > 0) {
                const importedDates = schedules.map(s => s.date).filter(Boolean);
                if (importedDates.length > 0) {
                    const firstDate = importedDates.reduce((min, d) => d < min ? d : min, importedDates[0]);
                    const [year, month, day] = firstDate.split('-').map(Number);
                    this.workforceManager.currentWeekStart = new Date(year, month - 1, day);
                    localStorage.setItem('calendarStartDate', firstDate);
                    
                    const startDateInput = document.getElementById('calendarStartDate');
                    if (startDateInput) {
                        startDateInput.value = firstDate;
                    }
                }
            }

            // Clear import data early to free memory
            this.xlsxImportData = null;
            this.xlsxMetadataRow = null;

            // Switch to calendar view IMMEDIATELY (optimistic UI)
            this.workforceManager.switchView('calendar');
            
            // Re-initialize filters
            this.workforceManager.filterManager.initializeCalendarFilters();
            this.workforceManager.filterManager.createRoleFilterButtons();

            // Show persistent warning toast - don't refresh until sync completes!
            this.showImportToast(`${employees.length} employees, ${schedules.length} shifts`, 'warning', false);

            // IMMEDIATE BACKUP: Save to localStorage first so data isn't lost on refresh
            console.log('💾 Saving data to localStorage as immediate backup...');
            try {
                localStorage.setItem('workforce_shiftTypes', JSON.stringify(this.workforceManager.shiftTypes));
                localStorage.setItem('workforce_jobRoles', JSON.stringify(this.workforceManager.jobRoles));
                localStorage.setItem('workforce_employees', JSON.stringify(this.workforceManager.employees));
                localStorage.setItem('workforce_schedules', JSON.stringify(this.workforceManager.schedules));
                console.log('✅ localStorage backup complete');
            } catch (localStorageError) {
                console.error('❌ localStorage backup failed:', localStorageError);
            }

            // BACKGROUND SYNC: Save to Firebase without blocking the UI
            const syncStartTime = performance.now();
            console.log('📊 Starting background Firebase sync...');
            
            // Store references for the async closure
            const employeesCount = employees.length;
            const schedulesCount = schedules.length;
            const shiftTypesCount = newShiftTypesCount;
            const jobRolesCount = newJobRolesCount;
            
            // Run Firebase sync in background (non-blocking) with timeout protection
            const syncWithTimeout = async () => {
                const SYNC_TIMEOUT = 60000; // 60 second timeout
                
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Sync timeout after 60s')), SYNC_TIMEOUT);
                });
                
                const syncPromise = Promise.all([
                    this.workforceManager.dataManager.saveData('shiftTypes', this.workforceManager.shiftTypes, true),
                    this.workforceManager.dataManager.saveData('jobRoles', this.workforceManager.jobRoles, true),
                    this.workforceManager.dataManager.saveData('employees', this.workforceManager.employees, true),
                    this.workforceManager.dataManager.saveData('schedules', this.workforceManager.schedules, true)
                ]);
                
                return Promise.race([syncPromise, timeoutPromise]);
            };
            
            syncWithTimeout().then(() => {
                const syncTime = performance.now() - syncStartTime;
                console.log(`✅ Background Firebase sync completed in ${syncTime.toFixed(0)}ms`);
                this.workforceManager.isResetting = false;
                this.showImportToast(`✅ Sync complete! ${employeesCount} employees, ${schedulesCount} shifts saved.`, 'success');
                
                // Save snapshot after successful sync
                try {
                    if (!this.workforceManager.snapshotManager && typeof SnapshotManager !== 'undefined') {
                        this.workforceManager.snapshotManager = new SnapshotManager(this.workforceManager);
                    }
                    if (this.workforceManager.snapshotManager) {
                        this.workforceManager.snapshotManager.saveSnapshot();
                        if (this.workforceManager.updateSnapshotUI) {
                            this.workforceManager.updateSnapshotUI();
                        }
                    }
                } catch (e) {
                    console.warn('Failed to save snapshot after import:', e);
                }
            }).catch(error => {
                console.error('❌ Background Firebase sync failed:', error);
                this.workforceManager.isResetting = false;
                this.showImportToast('⚠️ Cloud sync failed. Data saved locally - will retry on next action.', 'error');
            });

        } catch (error) {
            console.error('XLSX import confirmation error:', error);
            
            // Remove progress indicator on error
            const progressEl = document.getElementById('importProgress');
            if (progressEl) progressEl.remove();
            
            // Clear the resetting flag on error
            this.workforceManager.isResetting = false;
            
            alert('XLSX import failed: ' + error.message);
        }
    }

    // Cancel XLSX import
    cancelXlsxImport() {
        this.xlsxImportData = null;
        this.xlsxMetadataRow = null;
        document.getElementById('dataPreview').innerHTML = '<p>XLSX import cancelled. Upload another file to try again.</p>';
    }

    // Helper function to get the XLSX metadata row (8th row)
    getXlsxMetadataRow() {
        return this.xlsxMetadataRow || '';
    }

    // Helper function to process the 8th row metadata: remove blanks and add placeholder blanks
    processMetadataRow(rowText) {
        console.log('processMetadataRow called with:', rowText);
        if (!rowText || !rowText.trim()) {
            console.log('Row is empty, returning default');
            return ',,'; // Return just the two placeholder blanks if row is empty
        }

        // Parse the row as CSV
        const cells = DataProcessor.parseCsvRow(rowText);
        console.log('Parsed cells from metadata row:', cells);

        // Filter out blank entries (empty strings, whitespace-only strings)
        const nonBlankCells = cells.filter(cell => cell && cell.trim() !== '');
        console.log('Non-blank cells:', nonBlankCells);

        // Add two blank placeholders at the front
        const processedCells = ['', ''].concat(nonBlankCells);
        console.log('Processed cells with placeholders:', processedCells);

        // Rejoin as CSV string
        const result = processedCells.map(cell => {
            // Re-quote cells that contain commas or quotes
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return '"' + cell.replace(/"/g, '""') + '"';
            }
            return cell;
        }).join(',');

        console.log('Final metadata row result:', result);
        return result;
    }

    // Helper function to remove newlines, carriage returns, and spaces within quotes
    // OPTIMIZED: Uses array.join() instead of string concatenation for O(n) performance
    cleanCsvNewlines(csvText) {
        console.log('cleanCsvNewlines called with text length:', csvText.length);
        
        // OPTIMIZATION: Use array and join instead of string concatenation
        // String += is O(n²) due to immutable strings, array.join is O(n)
        const resultChunks = [];
        let inQuotes = false;
        let i = 0;
        let chunkStart = 0;

        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote within quoted field - keep both
                    i += 2;
                    continue;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    i++;
                }
            } else if ((char === '\n' || char === '\r' || char === ' ') && inQuotes) {
                // Skip newlines, carriage returns, and spaces within quotes
                // Save chunk before this character
                if (i > chunkStart) {
                    resultChunks.push(csvText.substring(chunkStart, i));
                }
                chunkStart = i + 1;
                i++;
            } else {
                i++;
            }
        }

        // Add final chunk
        if (chunkStart < csvText.length) {
            resultChunks.push(csvText.substring(chunkStart));
        }

        const result = resultChunks.join('');
        console.log('cleanCsvNewlines returning result length:', result.length);
        return result;
    }


    // Cancel CSV preview
    cancelCsvPreview() {
        this.rawCsvData = null;
        this.cleanedCsvData = null;
        this.xlsxFileName = null;
        this.xlsxMetadataRow = null;
        document.getElementById('dataPreview').innerHTML = '<p>Import cancelled. Upload another file to try again.</p>';
    }

    // Utility function to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Show a non-blocking toast notification for import status
    // autoDismiss: if false, toast stays until manually removed or replaced
    showImportToast(message, type = 'info', autoDismiss = true) {
        // Remove any existing toast
        const existingToast = document.getElementById('importToast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'importToast';
        
        const isWarning = type === 'warning';
        const isSuccess = type === 'success';
        const isError = type === 'error';
        
        // Add animation keyframes if not already added
        if (!document.getElementById('toastAnimationStyles')) {
            const style = document.createElement('style');
            style.id = 'toastAnimationStyles';
            style.textContent = `
                @keyframes toastSlideIn {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes toastSlideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(120%); opacity: 0; }
                }
                @keyframes spinnerRotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes progressPulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.6; }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Base styles for all toasts
        toast.style.cssText = `
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: ${isSuccess ? 'linear-gradient(135deg, #059669 0%, #10b981 100%)' : 
                         isError ? 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)' : 
                         isWarning ? 'linear-gradient(135deg, #1e293b 0%, #334155 100%)' : 
                         'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)'};
            color: white;
            padding: ${isWarning ? '16px 20px' : '14px 18px'};
            border-radius: 12px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.2), 0 2px 10px rgba(0,0,0,0.1);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
            animation: toastSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            max-width: 420px;
            border: 1px solid ${isWarning ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'};
        `;
        
        if (isWarning) {
            // Special layout for warning/syncing toast
            toast.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 14px;">
                    <div style="
                        width: 36px; 
                        height: 36px; 
                        border: 3px solid rgba(251, 191, 36, 0.3); 
                        border-top-color: #fbbf24; 
                        border-radius: 50%; 
                        animation: spinnerRotate 1s linear infinite;
                        flex-shrink: 0;
                    "></div>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px; color: #fbbf24;">
                            Syncing to Cloud
                        </div>
                        <div style="font-size: 13px; color: rgba(255,255,255,0.8); line-height: 1.4;">
                            ${message.replace(/⏳\s*/g, '').replace(/DO NOT REFRESH.*$/i, '')}
                        </div>
                        <div style="
                            margin-top: 10px; 
                            padding: 8px 12px; 
                            background: rgba(251, 191, 36, 0.15); 
                            border-radius: 6px; 
                            font-size: 12px; 
                            color: #fcd34d;
                            display: flex;
                            align-items: center;
                            gap: 6px;
                            animation: progressPulse 2s ease-in-out infinite;
                        ">
                            <span style="font-size: 14px;">⚠️</span>
                            <span>Please don't refresh until complete</span>
                        </div>
                    </div>
                </div>
            `;
        } else {
            // Standard layout for success/error/info
            const icon = isSuccess ? '✓' : isError ? '✕' : 'ℹ';
            const iconBg = isSuccess ? 'rgba(255,255,255,0.2)' : 
                          isError ? 'rgba(255,255,255,0.2)' : 
                          'rgba(255,255,255,0.2)';
            
            toast.innerHTML = `
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div style="
                        width: 28px; 
                        height: 28px; 
                        background: ${iconBg}; 
                        border-radius: 50%; 
                        display: flex; 
                        align-items: center; 
                        justify-content: center;
                        font-weight: bold;
                        font-size: 14px;
                        flex-shrink: 0;
                    ">${icon}</div>
                    <div style="font-size: 14px; font-weight: 500; line-height: 1.4;">
                        ${message.replace(/^[✅❌⚠️📊🔄]\s*/g, '')}
                    </div>
                </div>
            `;
        }
        
        document.body.appendChild(toast);
        
        // Auto-remove after delay (unless autoDismiss is false)
        if (autoDismiss) {
            const delay = isSuccess ? 4000 : isError ? 6000 : 3000;
            setTimeout(() => {
                toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
                setTimeout(() => toast.remove(), 300);
            }, delay);
        }
    }

    // Utility function to get random color for shift types
    getRandomColor() {
        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }


    // Confirm general import
    // OPTIMIZED: Uses Map/Set for O(1) lookups and parallel Firebase saves
    async confirmImport() {
        if (!this.importData) {
            alert('No import data available. Please upload a file first.');
            return;
        }

        const { employees, shiftTypes, schedules, headers } = this.importData;

        try {
            // OPTIMIZATION: Build lookup maps ONCE for O(1) access
            const existingShiftTypeMap = new Map(
                this.workforceManager.shiftTypes.map(st => [st.name, st])
            );
            const existingJobRoleMap = new Map(
                this.workforceManager.jobRoles.map(jr => [jr.name, jr])
            );
            const existingEmployeeMap = new Map(
                this.workforceManager.employees.map(e => [e.name, e])
            );
            const existingScheduleSet = new Set(
                this.workforceManager.schedules.map(s => `${s.employeeId}|${s.date}|${s.shiftType}`)
            );

            // Add shift types with proper colors - O(1) lookup now
            shiftTypes.forEach(shiftType => {
                if (!existingShiftTypeMap.has(shiftType.name)) {
                    if (!shiftType.color) {
                        shiftType.color = ScheduleUtils.getDefaultShiftColor(shiftType.name);
                    }
                    this.workforceManager.shiftTypes.push(shiftType);
                    existingShiftTypeMap.set(shiftType.name, shiftType);
                }
            });

            // Extract and create unique job roles from employee data
            const uniqueJobRoles = new Set();
            employees.forEach(employee => {
                if (employee.role && employee.role.trim()) {
                    uniqueJobRoles.add(employee.role.trim());
                }
            });

            // Create job roles that don't already exist - O(1) lookup now
            let newJobRolesCount = 0;
            uniqueJobRoles.forEach(jobRoleName => {
                if (!existingJobRoleMap.has(jobRoleName)) {
                    const newJobRole = {
                        id: generateId(),
                        name: jobRoleName,
                        color: ScheduleUtils.getDefaultRoleColor(jobRoleName),
                        created: new Date().toISOString()
                    };
                    this.workforceManager.jobRoles.push(newJobRole);
                    existingJobRoleMap.set(jobRoleName, newJobRole);
                    newJobRolesCount++;
                }
            });

            // Link schedules to shift type IDs - O(1) lookup now
            let shiftMisses = 0;
            schedules.forEach(schedule => {
                const shiftName = schedule.shiftType?.trim();
                if (shiftName) {
                    const shiftType = existingShiftTypeMap.get(shiftName);
                    if (shiftType) {
                        schedule.shiftId = shiftType.id;
                    } else {
                        shiftMisses++;
                    }
                }
            });
            if (shiftMisses > 0) {
                console.warn(`Could not find shift type for ${shiftMisses} schedules`);
            }

            // Link employees to job role IDs - O(1) lookup now
            let roleMisses = 0;
            employees.forEach(employee => {
                const roleName = employee.role?.trim();
                if (roleName) {
                    const jobRole = existingJobRoleMap.get(roleName);
                    if (jobRole) {
                        employee.roleId = jobRole.id;
                    } else {
                        roleMisses++;
                    }
                }
            });
            if (roleMisses > 0) {
                console.warn(`Could not find job role for ${roleMisses} employees`);
            }

            // Add employees (with duplicate prevention) - O(1) lookup now
            let newEmployeesCount = 0;
            let skippedEmployeesCount = 0;
            employees.forEach(employee => {
                if (!existingEmployeeMap.has(employee.name)) {
                    this.workforceManager.employees.push(employee);
                    existingEmployeeMap.set(employee.name, employee);
                    newEmployeesCount++;
                } else {
                    skippedEmployeesCount++;
                }
            });
            if (skippedEmployeesCount > 0) {
                console.log(`⏭️ Skipped ${skippedEmployeesCount} duplicate employees`);
            }

            // Add schedules (with duplicate prevention) - O(1) lookup now
            let newSchedulesCount = 0;
            let skippedSchedulesCount = 0;
            schedules.forEach(schedule => {
                const scheduleKey = `${schedule.employeeId}|${schedule.date}|${schedule.shiftType}`;
                if (!existingScheduleSet.has(scheduleKey)) {
                    this.workforceManager.schedules.push(schedule);
                    existingScheduleSet.add(scheduleKey);
                    newSchedulesCount++;
                } else {
                    skippedSchedulesCount++;
                }
            });
            if (skippedSchedulesCount > 0) {
                console.log(`⏭️ Skipped ${skippedSchedulesCount} duplicate schedules`);
            }

            // Set flag to prevent real-time listener conflicts during bulk import
            this.workforceManager.isResetting = true;

            // OPTIMIZATION: Save all data in PARALLEL (bulk mode to minimize real-time conflicts)
            await Promise.all([
                this.workforceManager.dataManager.saveData('jobRoles', this.workforceManager.jobRoles, true),
                this.workforceManager.dataManager.saveData('shiftTypes', this.workforceManager.shiftTypes, true),
                this.workforceManager.dataManager.saveData('employees', this.workforceManager.employees, true),
                this.workforceManager.dataManager.saveData('schedules', this.workforceManager.schedules, true)
            ]);

            // Wait for operations to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Clear the resetting flag
            this.workforceManager.isResetting = false;

            // Update role badge styles for new job roles
            this.workforceManager.updateRoleBadgeStyles();

            // Show import summary
            console.log('📊 Import Summary:', {
                newShiftTypes: shiftTypes.filter(st => !this.workforceManager.shiftTypes.find(existing => existing.name === st.name)).length,
                newJobRoles: newJobRolesCount,
                newEmployees: newEmployeesCount,
                newSchedules: newSchedulesCount
            });

            // Set calendar start date to the first (earliest) imported date
            // OPTIMIZATION: Use string comparison instead of creating Date objects
            if (schedules.length > 0) {
                const importedDates = schedules.map(s => s.date).filter(Boolean);
                if (importedDates.length > 0) {
                    // String comparison works for YYYY-MM-DD format
                    const firstDate = importedDates.reduce((min, d) => d < min ? d : min, importedDates[0]);
                    const [year, month, day] = firstDate.split('-').map(Number);
                    this.workforceManager.currentWeekStart = new Date(year, month - 1, day);
                    localStorage.setItem('calendarStartDate', firstDate);
                    
                    const startDateInput = document.getElementById('calendarStartDate');
                    if (startDateInput) {
                        startDateInput.value = firstDate;
                    }
                }
            }

            // Clear the import data early to free memory
            this.importData = null;

            // Switch to calendar view (this renders the calendar)
            this.workforceManager.switchView('calendar');
            
            // OPTIMIZATION: Removed duplicate renderScheduleMatrix() - switchView already does this
            
            // Re-initialize filters after calendar refresh
            this.workforceManager.filterManager.initializeCalendarFilters();
            this.workforceManager.filterManager.createRoleFilterButtons();

            // OPTIMIZATION: Defer snapshot save and activity logging to not block UI
            setTimeout(async () => {
                try {
                    if (!this.workforceManager.snapshotManager && typeof SnapshotManager !== 'undefined') {
                        this.workforceManager.snapshotManager = new SnapshotManager(this.workforceManager);
                    }
                    if (this.workforceManager.snapshotManager) {
                        this.workforceManager.snapshotManager.saveSnapshot();
                        console.log('Snapshot saved after CSV import');
                        if (this.workforceManager.updateSnapshotUI) {
                            this.workforceManager.updateSnapshotUI();
                        }
                    }
                } catch (e) {
                    console.warn('Failed to save snapshot after import:', e);
                }
                
                // Log import activity (deferred)
                try {
                    await this.workforceManager.activityManager.ensureActivityLogger();
                    if (this.workforceManager.activityManager.activityLogger) {
                        await this.workforceManager.activityManager.activityLogger.logActivity(
                            'import_data',
                            'system',
                            'import_' + Date.now(),
                            { 
                                recordCount: employees.length + schedules.length,
                                employeeCount: employees.length,
                                scheduleCount: schedules.length,
                                shiftTypeCount: shiftTypes.length
                            }
                        );
                    }
                } catch (e) {
                    console.warn('Failed to log import activity:', e);
                }
            }, 100);

            // Show success message after rendering
            alert(`Import completed successfully!\n\nImported:\n• ${employees.length} employees\n• ${newJobRolesCount} job roles\n• ${shiftTypes.length} shift types\n• ${schedules.length} shift assignments`);

        } catch (error) {
            console.error('Import confirmation error:', error);
            alert('Import failed: ' + error.message);
        }
    }

    // Cancel general import
    cancelImport() {
        this.importData = null;
        document.getElementById('dataPreview').innerHTML = '<p>Import cancelled. Upload another file to try again.</p>';
    }
}

console.log('ImportManager class defined:', typeof ImportManager);

// Export the class
window.ImportManager = ImportManager;
