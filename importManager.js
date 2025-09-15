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

            // Pre-clean to avoid duplicate work and ensure immediate processing has data
            if (!this.cleanedCsvData) {
                const fullCsvWithCleanedContent = this.cleanCsvNewlines(csvData);
                const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
                const dataLines = cleanedLines.slice(8);
                const csvWithoutHeaders = dataLines.join('\n');
                this.cleanedCsvData = DataProcessor.removeColumnsWithAllBlankData(csvWithoutHeaders);
            }

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
    showCsvPreview(csvData, fileName) {

        const dataPreview = document.getElementById('dataPreview');

        if (!dataPreview) {
            console.error('dataPreview element not found!');
            return;
        }

        console.log('dataPreview element found:', dataPreview);

        // First clean content within quotes, then save 8th row, remove first 8 rows, then remove blank columns
        const lines = csvData.trim().split('\n');

        // First clean content within quotes on the entire data (including headers)
        const fullCsvWithCleanedContent = this.cleanCsvNewlines(csvData);

        // Now split the cleaned data and save the 8th row as metadata
        const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
        console.log('Original CSV lines:', csvData.trim().split('\n').length);
        console.log('Cleaned CSV lines:', cleanedLines.length);
        console.log('First 10 lines of cleaned CSV:');
        cleanedLines.slice(0, 10).forEach((line, i) => console.log(`Line ${i}: ${line.substring(0, 100)}${line.length > 100 ? '...' : ''}`));

        let rawMetadataRow = cleanedLines[7] || '';
        console.log('Raw metadata row (8th row):', rawMetadataRow);
        console.log('Metadata row exists:', !!rawMetadataRow);
        console.log('Metadata row trimmed:', rawMetadataRow.trim());

        // Process the 8th row: remove blank entries and add two blank placeholders at the front
        this.xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);
        console.log('Processed metadata row:', this.xlsxMetadataRow);

        // Remove first 8 header rows from the cleaned data
        const dataLines = cleanedLines.slice(8); // Remove first 8 header rows
        const csvWithoutHeaders = dataLines.join('\n');

        // Now remove columns that have all blank data from the remaining data (not entire file)
        const fullyCleanedCsv = DataProcessor.removeColumnsWithAllBlankData(csvWithoutHeaders);

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
            // Use the cleaned CSV data (content and empty cells already cleaned)
            let csvDataToProcess = this.cleanedCsvData || this.rawCsvData;

            // Ensure it's fully cleaned (in case user bypassed preview)
            if (!this.cleanedCsvData) {
                // First clean content within quotes, then save 8th row, remove first 8 rows, then remove blank columns
                const lines = csvDataToProcess.trim().split('\n');

                // First clean content within quotes on the entire data (including headers)
                const fullCsvWithCleanedContent = this.cleanCsvNewlines(csvDataToProcess);

                // Now split the cleaned data and save the 8th row as metadata
                const cleanedLines = fullCsvWithCleanedContent.trim().split('\n');
                let rawMetadataRow = cleanedLines[7] || '';

                // Process the 8th row: remove blank entries and add two blank placeholders at the front
                this.xlsxMetadataRow = this.processMetadataRow(rawMetadataRow);

                // Remove first 8 header rows from the cleaned data
                const dataLines = cleanedLines.slice(8); // Remove first 8 header rows
                const csvWithoutHeaders = dataLines.join('\n');

                // Now remove columns that have all blank data from the remaining data (not entire file)
                csvDataToProcess = DataProcessor.removeColumnsWithAllBlankData(csvWithoutHeaders);
            }

            // Headers have been removed and blank columns removed, csvDataToProcess contains processed data
            const filteredCsvData = csvDataToProcess;


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
    async confirmXlsxImport() {
        if (!this.xlsxImportData) {
            alert('No XLSX import data available. Please upload a file first.');
            return;
        }

        const { employees, schedules } = this.xlsxImportData;

        try {
            // First, extract and create shift types from the schedule data
            const uniqueShiftTypes = new Set();
            schedules.forEach(schedule => {
                if (schedule.shiftType && schedule.shiftType.trim()) {
                    uniqueShiftTypes.add(schedule.shiftType.trim());
                }
            });

            // Create shift types that don't already exist
            let newShiftTypesCount = 0;
            uniqueShiftTypes.forEach(shiftTypeName => {
                const existingShiftType = this.workforceManager.shiftTypes.find(st => st.name === shiftTypeName);
                if (!existingShiftType) {
                    const newShiftType = {
                        id: generateId(),
                        name: shiftTypeName,
                        color: ScheduleUtils.getDefaultShiftColor(shiftTypeName),
                        created: new Date().toISOString()
                    };
                    this.workforceManager.shiftTypes.push(newShiftType);
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

            // Create job roles that don't already exist
            let newJobRolesCount = 0;
            uniqueJobRoles.forEach(jobRoleName => {
                const existingJobRole = this.workforceManager.jobRoles.find(jr => jr.name === jobRoleName);
                if (!existingJobRole) {
                    const newJobRole = {
                        id: generateId(),
                        name: jobRoleName,
                        color: ScheduleUtils.getDefaultRoleColor(jobRoleName),
                        created: new Date().toISOString()
                    };
                    this.workforceManager.jobRoles.push(newJobRole);
                    newJobRolesCount++;
                }
            });

            // Link schedules to shift type IDs
            schedules.forEach(schedule => {
                if (schedule.shiftType && schedule.shiftType.trim()) {
                    const shiftType = this.workforceManager.shiftTypes.find(st => st.name === schedule.shiftType.trim());
                    if (shiftType) {
                        schedule.shiftId = shiftType.id;
                        // Keep the shiftType name for backward compatibility
                    } else {
                        console.warn(`Could not find shift type for schedule: ${schedule.shiftType}`);
                    }
                }
            });

            // Link employees to job role IDs
            employees.forEach(employee => {
                if (employee.role && employee.role.trim()) {
                    const jobRole = this.workforceManager.jobRoles.find(jr => jr.name === employee.role.trim());
                    if (jobRole) {
                        employee.roleId = jobRole.id;
                        // Keep the role name for backward compatibility
                    } else {
                        console.warn(`Could not find job role for employee: ${employee.role}`);
                    }
                }
            });

            // Now add the employees and schedules (with duplicate prevention)
            let newEmployeesCount = 0;
            employees.forEach(employee => {
                // Check if employee already exists (by name)
                const existingEmployee = this.workforceManager.employees.find(e => e.name === employee.name);
                if (!existingEmployee) {
                    this.workforceManager.employees.push(employee);
                    newEmployeesCount++;
                } else {
                    console.log(`⏭️ Skipping duplicate employee: ${employee.name}`);
                    // Update existing employee with new data if needed
                    Object.assign(existingEmployee, employee);
                }
            });

            // Add schedules (with duplicate prevention)
            let newSchedulesCount = 0;
            schedules.forEach(schedule => {
                // Check for duplicate schedule: same employee, same date, same shift type
                const existingSchedule = this.workforceManager.schedules.find(s => 
                    s.employeeId === schedule.employeeId && 
                    s.date === schedule.date && 
                    s.shiftType === schedule.shiftType
                );
                
                if (!existingSchedule) {
                    this.workforceManager.schedules.push(schedule);
                    newSchedulesCount++;
                } else {
                    console.log(`⏭️ Skipping duplicate schedule: ${schedule.employeeId} on ${schedule.date} for ${schedule.shiftType}`);
                }
            });

            // Show progress indicator
            const progressDiv = document.createElement('div');
            progressDiv.id = 'importProgress';
            progressDiv.style.cssText = `
                position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
                background: #333; color: white; padding: 20px; border-radius: 8px;
                z-index: 10000; font-family: Arial, sans-serif; text-align: center;
            `;
            progressDiv.innerHTML = `
                <div style="margin-bottom: 10px;">📊 Importing data...</div>
                <div style="font-size: 12px; color: #ccc;">This may take a few seconds</div>
            `;
            document.body.appendChild(progressDiv);

            // Set flag to prevent real-time listener conflicts during bulk import
            this.workforceManager.isResetting = true;

            // Save all data (bulk mode to minimize real-time conflicts)
            await this.workforceManager.dataManager.saveData('shiftTypes', this.workforceManager.shiftTypes, true);
            await this.workforceManager.dataManager.saveData('jobRoles', this.workforceManager.jobRoles, true);
            await this.workforceManager.dataManager.saveData('employees', this.workforceManager.employees, true);
            await this.workforceManager.dataManager.saveData('schedules', this.workforceManager.schedules, true);

            // Update role badge styles for new job roles
            this.workforceManager.updateRoleBadgeStyles();

            // Show import summary
            console.log('📊 XLSX Import Summary:', {
                newEmployees: newEmployeesCount,
                newSchedules: newSchedulesCount
            });

            // Set calendar start date to the first (earliest) imported date
            if (schedules.length > 0) {
                const importedDates = schedules.map(s => s.date).filter(Boolean);
                if (importedDates.length > 0) {
                    const firstDate = importedDates.reduce((min, d) => (new Date(d) < new Date(min) ? d : min), importedDates[0]);
                    // Create date at local midnight to avoid timezone issues
                    const [year, month, day] = firstDate.split('-').map(Number);
                    this.workforceManager.currentWeekStart = new Date(year, month - 1, day);
                    localStorage.setItem('calendarStartDate', firstDate);
                    
                    // Update the calendar start date input field
                    const startDateInput = document.getElementById('calendarStartDate');
                    if (startDateInput) {
                        startDateInput.value = firstDate;
                    }
                }
            }

            // Wait for operations to complete
            await new Promise(resolve => setTimeout(resolve, 200));

            // Clear the resetting flag
            this.workforceManager.isResetting = false;

            // Remove progress indicator
            const progressEl = document.getElementById('importProgress');
            if (progressEl) progressEl.remove();

            // Count how many shift types were created during this import
            const finalShiftTypesCount = this.workforceManager.shiftTypes.length;

            alert(`XLSX import completed successfully!\n\nImported:\n• ${employees.length} employees\n• ${newJobRolesCount} job roles\n• ${newShiftTypesCount} shift types\n• ${schedules.length} shift assignments`);

            // Switch to calendar view to show imported data
            this.workforceManager.switchView('calendar');
            
            // Force refresh the calendar view to show the new start date
            this.workforceManager.calendarRenderer.renderScheduleMatrix();
            
            // Re-initialize filters after calendar refresh
            this.workforceManager.filterManager.initializeCalendarFilters();
            this.workforceManager.filterManager.createRoleFilterButtons();

            // Save a snapshot immediately after import so change tracking works properly
            try {
                if (!this.workforceManager.snapshotManager && typeof SnapshotManager !== 'undefined') {
                    this.workforceManager.snapshotManager = new SnapshotManager(this.workforceManager);
                }
                if (this.workforceManager.snapshotManager) {
                    this.workforceManager.snapshotManager.saveSnapshot();
                    console.log('Snapshot saved after XLSX import');
                    if (this.workforceManager.updateSnapshotUI) {
                        this.workforceManager.updateSnapshotUI();
                    }
                }
            } catch (e) {
                console.warn('Failed to save snapshot after import:', e);
            }

            // Clear the import data
            this.xlsxImportData = null;
            this.xlsxMetadataRow = null;

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
    cleanCsvNewlines(csvText) {
        console.log('cleanCsvNewlines called with text length:', csvText.length);
        let result = '';
        let inQuotes = false;
        let i = 0;

        while (i < csvText.length) {
            const char = csvText[i];
            const nextChar = csvText[i + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    // Escaped quote within quoted field
                    result += '""';
                    i += 2; // Skip both quotes
                    continue;
                } else {
                    // Toggle quote state
                    inQuotes = !inQuotes;
                    result += char;
                }
            } else if ((char === '\n' || char === '\r' || char === ' ') && inQuotes) {
                // Skip newlines, carriage returns, and spaces within quotes
                // Don't add anything to result - completely remove them
                // This will concatenate words together
            } else {
                result += char;
            }

            i++;
        }

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

    // Utility function to get random color for shift types
    getRandomColor() {
        const colors = [
            '#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6',
            '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6B7280'
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    }


    // Confirm general import
    async confirmImport() {
        if (!this.importData) {
            alert('No import data available. Please upload a file first.');
            return;
        }

        const { employees, shiftTypes, schedules, headers } = this.importData;

        try {
            // Add shift types with proper colors
            shiftTypes.forEach(shiftType => {
                const existingShiftType = this.workforceManager.shiftTypes.find(st => st.name === shiftType.name);
                if (!existingShiftType) {
                    // Ensure shift type has proper color
                    if (!shiftType.color) {
                        shiftType.color = ScheduleUtils.getDefaultShiftColor(shiftType.name);
                    }
                    this.workforceManager.shiftTypes.push(shiftType);
                }
            });

            // Extract and create unique job roles from employee data
            const uniqueJobRoles = new Set();
            employees.forEach(employee => {
                if (employee.role && employee.role.trim()) {
                    uniqueJobRoles.add(employee.role.trim());
                }
            });

            // Create job roles that don't already exist
            let newJobRolesCount = 0;
            uniqueJobRoles.forEach(jobRoleName => {
                const existingJobRole = this.workforceManager.jobRoles.find(jr => jr.name === jobRoleName);
                if (!existingJobRole) {
                    const newJobRole = {
                        id: generateId(),
                        name: jobRoleName,
                        color: ScheduleUtils.getDefaultRoleColor(jobRoleName),
                        created: new Date().toISOString()
                    };
                    this.workforceManager.jobRoles.push(newJobRole);
                    newJobRolesCount++;
                }
            });

            // Link schedules to shift type IDs
            schedules.forEach(schedule => {
                if (schedule.shiftType && schedule.shiftType.trim()) {
                    const shiftType = this.workforceManager.shiftTypes.find(st => st.name === schedule.shiftType.trim());
                    if (shiftType) {
                        schedule.shiftId = shiftType.id;
                        // Keep the shiftType name for backward compatibility
                    } else {
                        console.warn(`Could not find shift type for schedule: ${schedule.shiftType}`);
                    }
                }
            });

            // Link employees to job role IDs
            employees.forEach(employee => {
                if (employee.role && employee.role.trim()) {
                    const jobRole = this.workforceManager.jobRoles.find(jr => jr.name === employee.role.trim());
                    if (jobRole) {
                        employee.roleId = jobRole.id;
                        // Keep the role name for backward compatibility
                    } else {
                        console.warn(`Could not find job role for employee: ${employee.role}`);
                    }
                }
            });

            // Add employees (with duplicate prevention)
            let newEmployeesCount = 0;
            employees.forEach(employee => {
                const existingEmployee = this.workforceManager.employees.find(e => e.name === employee.name);
                if (!existingEmployee) {
                    this.workforceManager.employees.push(employee);
                    newEmployeesCount++;
                } else {
                    console.log(`⏭️ Skipping duplicate employee: ${employee.name}`);
                }
            });

            // Add schedules (with duplicate prevention)
            let newSchedulesCount = 0;
            schedules.forEach(schedule => {
                // Check for duplicate schedule: same employee, same date, same shift type
                const existingSchedule = this.workforceManager.schedules.find(s => 
                    s.employeeId === schedule.employeeId && 
                    s.date === schedule.date && 
                    s.shiftType === schedule.shiftType
                );
                
                if (!existingSchedule) {
                    this.workforceManager.schedules.push(schedule);
                    newSchedulesCount++;
                } else {
                    console.log(`⏭️ Skipping duplicate schedule: ${schedule.employeeId} on ${schedule.date} for ${schedule.shiftType}`);
                }
            });

            // Set flag to prevent real-time listener conflicts during bulk import
            this.workforceManager.isResetting = true;

            // Save all data (bulk mode to minimize real-time conflicts)
            await this.workforceManager.dataManager.saveData('jobRoles', this.workforceManager.jobRoles, true);
            await this.workforceManager.dataManager.saveData('shiftTypes', this.workforceManager.shiftTypes, true);
            await this.workforceManager.dataManager.saveData('employees', this.workforceManager.employees, true);
            await this.workforceManager.dataManager.saveData('schedules', this.workforceManager.schedules, true);

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
            if (schedules.length > 0) {
                const importedDates = schedules.map(s => s.date).filter(Boolean);
                if (importedDates.length > 0) {
                    const firstDate = importedDates.reduce((min, d) => (new Date(d) < new Date(min) ? d : min), importedDates[0]);
                    // Create date at local midnight to avoid timezone issues
                    const [year, month, day] = firstDate.split('-').map(Number);
                    this.workforceManager.currentWeekStart = new Date(year, month - 1, day);
                    localStorage.setItem('calendarStartDate', firstDate);
                    
                    // Update the calendar start date input field
                    const startDateInput = document.getElementById('calendarStartDate');
                    if (startDateInput) {
                        startDateInput.value = firstDate;
                    }
                }
            }

            alert(`Import completed successfully!\n\nImported:\n• ${employees.length} employees\n• ${newJobRolesCount} job roles\n• ${shiftTypes.length} shift types\n• ${schedules.length} shift assignments`);

            // Switch to calendar view
            this.workforceManager.switchView('calendar');
            
            // Refresh the calendar view to show the new start date
            this.workforceManager.calendarRenderer.renderScheduleMatrix();
            
            // Re-initialize filters after calendar refresh
            this.workforceManager.filterManager.initializeCalendarFilters();
            this.workforceManager.filterManager.createRoleFilterButtons();

            // Save a snapshot immediately after import so change tracking works properly
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

            // Log import activity
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

            // Clear the import data
            this.importData = null;

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
