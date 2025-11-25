// Data processing functions for the Workforce Schedule Manager
// Extracted from script.js for better organization and maintainability

/**
 * Read file as text
 * @param {File} file - File to read
 * @returns {Promise<string>} File content as text
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

/**
 * Read file as ArrayBuffer (for XLSX files)
 * @param {File} file - File to read
 * @returns {Promise<ArrayBuffer>} File content as ArrayBuffer
 */
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Parse CSV text with proper quoted field handling (supports multiline)
 * @param {string} csvText - CSV text to parse
 * @returns {Array<Array<string>>} Parsed CSV rows
 */
function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < csvText.length) {
        const char = csvText[i];
        const nextChar = csvText[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote within quoted field
                currentField += '"';
                i += 2; // Skip both quotes
                continue;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator
            currentRow.push(currentField.trim());
            currentField = '';
        } else if ((char === '\n' || char === '\r') && !inQuotes) {
            // Row separator (only if not in quotes)
            if (char === '\r' && nextChar === '\n') {
                i++; // Skip \r\n as one newline
            }

            // End current field and row
            currentRow.push(currentField.trim());
            currentField = '';

            // Only add row if it has content
            if (currentRow.length > 0 && currentRow.some(cell => cell.trim() !== '')) {
                rows.push(currentRow);
            }
            currentRow = [];
        } else if ((char === '\n' || char === '\r') && inQuotes) {
            // Newline inside quotes - preserve as part of field content
            currentField += char;
        } else {
            // Regular character
            currentField += char;
        }

        i++;
    }

    // Handle last field and row
    if (currentField.trim() !== '' || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        if (currentRow.some(cell => cell.trim() !== '')) {
            rows.push(currentRow);
        }
    }

    return rows;
}

/**
 * Check if string looks like a date
 * @param {string} str - String to check
 * @returns {boolean} True if string looks like a date
 */
function isDateString(str) {
    // Check if string looks like a date (various formats)
    if (!str || typeof str !== 'string') return false;

    const trimmed = str.trim();

    // Check for common date formats
    const datePatterns = [
        /^\d{4}-\d{2}-\d{2}$/,  // YYYY-MM-DD
        /^\d{1,2}\/\d{1,2}\/\d{4}$/,  // MM/DD/YYYY or M/D/YYYY
        /^\d{1,2}\/\d{1,2}\/\d{2}$/,  // MM/DD/YY or M/D/YY
        /^\d{1,2}-\d{1,2}-\d{4}$/,  // MM-DD-YYYY or M-D-YYYY
        /^\d{1,2}-\d{1,2}-\d{2}$/,  // MM-DD-YY or M-D-YY
        /^Day \d+$/i,  // Day X format (case insensitive)
    ];

    return datePatterns.some(pattern => pattern.test(trimmed));
}

/**
 * Parse actual date strings from CSV headers
 * @param {string} header - Date header to parse
 * @param {Date} currentWeekStart - Base date for "Day X" calculations
 * @returns {string|null} Parsed date in YYYY-MM-DD format or null if parsing fails
 */
function parseDayColumn(header, currentWeekStart) {
    if (!header || typeof header !== 'string') return null;

    const trimmed = header.trim();

    // Handle "Day X" format (with or without space)
    const dayMatch = trimmed.match(/^Day\s*(\d+)$/i);
    if (dayMatch) {
        const dayNumber = parseInt(dayMatch[1]);
        // Use the calendar's current start date as base
        const baseDate = new Date(currentWeekStart);
        // Day 1 should be the start date
        baseDate.setDate(baseDate.getDate() + dayNumber - 1);
        // Use local date methods to avoid timezone issues
        const year = baseDate.getFullYear();
        const month = String(baseDate.getMonth() + 1).padStart(2, '0');
        const day = String(baseDate.getDate()).padStart(2, '0');
        const result = `${year}-${month}-${day}`;
        return result;
    }

    // Try different date formats
    const dateFormats = [
        // YYYY-MM-DD
        () => {
            const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (match) {
                const [, year, month, day] = match;
                return `${year}-${month}-${day}`;
            }
            return null;
        },
        // MM/DD/YYYY or MM/DD/YY
        () => {
            const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/);
            if (match) {
                let [, month, day, year] = match;
                if (year.length === 2) {
                    year = `20${year}`; // Convert YY to YYYY
                }
                month = month.padStart(2, '0');
                day = day.padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            return null;
        },
        // MM-DD-YYYY or MM-DD-YY
        () => {
            const match = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4}|\d{2})$/);
            if (match) {
                let [, month, day, year] = match;
                if (year.length === 2) {
                    year = `20${year}`; // Convert YY to YYYY
                }
                month = month.padStart(2, '0');
                day = day.padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            return null;
        },
        // DD/MM/YYYY or DD/MM/YY
        () => {
            const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})$/);
            if (match) {
                let [, day, month, year] = match;
                if (year.length === 2) {
                    year = `20${year}`; // Convert YY to YYYY
                }
                month = month.padStart(2, '0');
                day = day.padStart(2, '0');
                return `${year}-${month}-${day}`;
            }
            return null;
        },
        // Month DD, YYYY (e.g., "January 15, 2024")
        () => {
            const match = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
            if (match) {
                const [, monthName, day, year] = match;
                const monthNames = {
                    'january': '01', 'february': '02', 'march': '03', 'april': '04',
                    'may': '05', 'june': '06', 'july': '07', 'august': '08',
                    'september': '09', 'october': '10', 'november': '11', 'december': '12'
                };
                const month = monthNames[monthName.toLowerCase()];
                if (month) {
                    return `${year}-${month}-${day.padStart(2, '0')}`;
                }
            }
            return null;
        },
        // DD Month YYYY (e.g., "15 January 2024")
        () => {
            const match = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
            if (match) {
                const [, day, monthName, year] = match;
                const monthNames = {
                    'january': '01', 'february': '02', 'march': '03', 'april': '04',
                    'may': '05', 'june': '06', 'july': '07', 'august': '08',
                    'september': '09', 'october': '10', 'november': '11', 'december': '12'
                };
                const month = monthNames[monthName.toLowerCase()];
                if (month) {
                    return `${year}-${month}-${day.padStart(2, '0')}`;
                }
            }
            return null;
        },
        // Short month names (e.g., "Jan 15, 2024")
        () => {
            const match = trimmed.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
            if (match) {
                const [, monthName, day, year] = match;
                const monthNames = {
                    'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04',
                    'may': '05', 'jun': '06', 'jul': '07', 'aug': '08',
                    'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
                };
                const month = monthNames[monthName.toLowerCase()];
                if (month) {
                    return `${year}-${month}-${day.padStart(2, '0')}`;
                }
            }
            return null;
        }
    ];

    for (const formatParser of dateFormats) {
        const result = formatParser();
        if (result) {
            return result;
        }
    }

    return null;
}

/**
 * Process the schedule data from CSV
 * @param {Array<Array<string>>} data - Parsed CSV data
 * @param {Function} generateId - Function to generate unique IDs
 * @param {Date} currentWeekStart - Base date for date calculations
 * @returns {Object} Processed data with employees, shiftTypes, schedules, etc.
 */
function processScheduleData(data, generateId, currentWeekStart) {

    if (!data || data.length < 3) {
        throw new Error('CSV file must have at least 3 rows (header row, date row, and data rows)');
    }


    // CSV format:
    // Row 0: Ignored (header/title row)
    // Row 1: Date headers (first two cells empty, rest are dates)
    // Row 2+: Employee data (name, job, shifts...)
    // Clean up the second row by removing all newlines and spaces
    const rawDateHeaders = data[1]; // Second row contains date headers

    // Join all cells, remove newlines and ALL spaces, then split back
    const cleanedDateRow = rawDateHeaders.join(',').replace(/\n/g, '').replace(/\s+/g, '').trim();

    // Split back into individual cells and clean each one
    const dateHeaders = cleanedDateRow.split(',').map(cell => cell.trim());

    const dataRows = data.slice(2); // Third row onwards contains employee data

    // Create headers array: first two are for name/job, rest from date headers
    const headers = ['Employee Name', 'Job Role'];
    // The second row has: ["", "Day 1", "Day 2", "Day 3", ...]
    // User said: "ignore the first two cells in the second row"
    // So skip dateHeaders[0] ("") and dateHeaders[1] ("Day 1")
    // Start from dateHeaders[2] ("Day 2") as the first date header
    for (let i = 2; i < dateHeaders.length; i++) {
        const headerValue = dateHeaders[i];
        headers.push(headerValue || `Day ${i - 1}`);
    }

    // For this format: Column 0 = Name, Column 1 = Job Type, Columns 2+ = Dates
    const employeeColIndex = 0; // First column is employee name
    const roleColIndex = 1;     // Second column is job type


    if (!headers[employeeColIndex] || !headers[roleColIndex]) {
        console.error('Column detection failed. Headers:', headers);
        throw new Error('Could not find required columns. Expected: Name, Job Type, then Day 1, Day 2, etc. Headers found: ' + headers.join(', '));
    }

    // Process employees and their shift assignments
    const employees = [];
    const shiftTypes = new Map();
    const schedules = [];

    dataRows.forEach((row, rowIndex) => {
        if (!row || row.length === 0) return;

        const employeeName = row[employeeColIndex];
        const jobRole = row[roleColIndex];

        // Skip rows where first cell is empty, null, undefined, or not a string
        if (!employeeName || typeof employeeName !== 'string' || employeeName.trim() === '') {
            return;
        }

        if (!jobRole || typeof jobRole !== 'string' || jobRole.trim() === '') {
            return;
        }

        // Create employee
        const employee = {
            id: generateId(),
            name: employeeName,
            role: jobRole,
            shifts: [], // Store actual shift assignments
            orderIndex: rowIndex // Preserve original order from data file
        };

        // Process shift assignments for each day column after name/job
        for (let colIndex = 2; colIndex < headers.length; colIndex++) {
            const dayHeader = headers[colIndex];
            const shiftValue = row[colIndex];

            if (!dayHeader) {
                continue;
            }

            // Check if header looks like "Day X" and convert to actual date
            if (isDateString(dayHeader)) {
                const actualDate = parseDayColumn(dayHeader, currentWeekStart);

                if (actualDate) {
                    // Handle blank entries as "Off" shifts, preserve other values
                    const finalShiftValue = shiftValue?.trim() || 'Off';

                    // Create shift assignment (including blank entries as "Off")
                    const shiftAssignment = {
                        id: generateId(),
                        employeeId: employee.id,
                        date: actualDate,
                        shiftType: finalShiftValue
                    };

                    employee.shifts.push(shiftAssignment);
                    schedules.push(shiftAssignment);

                    // Track unique shift types (including "Off" for blank entries)
                    if (!shiftTypes.has(finalShiftValue)) {
                        shiftTypes.set(finalShiftValue, {
                            name: finalShiftValue,
                            count: 0,
                            color: ScheduleUtils.getDefaultShiftColor(finalShiftValue)
                        });
                    }
                    shiftTypes.get(finalShiftValue).count++;
                }
            }
        }

        employees.push(employee);
    });

    return {
        employees: employees,
        shiftTypes: Array.from(shiftTypes.values()),
        schedules: schedules,
        headers: headers,
        totalRows: dataRows.length,
        totalEmployees: employees.length,
        totalShiftAssignments: schedules.length
    };
}

/**
 * Process XLSX schedule data
 * OPTIMIZED: Pre-calculate dates for each column ONCE instead of per-cell
 * @param {Array<Array<string>>} data - XLSX data rows
 * @param {Function} generateId - Function to generate unique IDs
 * @param {Date} currentWeekStart - Base date for date calculations
 * @param {string} xlsxMetadataRow - Processed metadata row for column headers
 * @param {Function} parseCsvRow - Function to parse CSV row (from utils)
 * @returns {Object} Processed XLSX data
 */
function processXlsxScheduleData(data, generateId, currentWeekStart, xlsxMetadataRow, parseCsvRow) {
    const employees = [];
    const schedules = [];
    const processedData = {
        employees: [],
        shiftTypes: [],
        schedules: [],
        totalRows: data.length,
        totalEmployees: 0,
        totalShiftAssignments: 0
    };

    // Get the column headers from the processed 8th row metadata
    let columnHeaders = [];
    if (xlsxMetadataRow) {
        // Parse the metadata row to get actual column headers
        columnHeaders = parseCsvRow(xlsxMetadataRow);
    }

    // OPTIMIZATION: Pre-calculate the date for each column index ONCE
    // This avoids calling parseDayColumn() for every cell (was O(rows × cols), now O(cols))
    const columnDateCache = new Map();
    const maxColumns = data.reduce((max, row) => Math.max(max, row.length), 0);
    
    for (let shiftIndex = 0; shiftIndex < maxColumns - 2; shiftIndex++) {
        let actualDate = null;
        
        // Try to use actual column header from 8th row first
        if (columnHeaders.length > shiftIndex + 2) {
            const columnHeader = columnHeaders[shiftIndex + 2]?.trim();
            if (columnHeader) {
                actualDate = parseDayColumn(columnHeader, currentWeekStart);
            }
        }
        
        // Fallback to generic "Day X" format if column header parsing fails
        if (!actualDate) {
            const dayHeader = `Day ${shiftIndex + 1}`;
            actualDate = parseDayColumn(dayHeader, currentWeekStart);
        }
        
        if (actualDate) {
            columnDateCache.set(shiftIndex, actualDate);
        }
    }

    // Process each row of XLSX data
    data.forEach((row, index) => {
        if (row.length >= 3) { // Need at least Name, Job, and some shift data
            const employeeName = row[0]?.trim() || '';
            const jobRole = row[1]?.trim() || '';
            const shiftData = row.slice(2); // Everything after job role

            if (employeeName && jobRole) {
                // Create employee
                const employeeId = generateId();
                const employee = {
                    id: employeeId,
                    name: employeeName,
                    role: jobRole,
                    shifts: [],
                    orderIndex: index // Preserve original order from data file
                };

                employees.push(employee);

                // Process shift assignments for each date column
                // OPTIMIZED: Use pre-calculated dates from cache
                shiftData.forEach((shift, shiftIndex) => {
                    if (shift && shift.trim()) {
                        const actualDate = columnDateCache.get(shiftIndex);

                        if (actualDate) {
                            const scheduleEntry = {
                                id: generateId(),
                                employeeId: employeeId,
                                shiftType: shift.trim(),
                                date: actualDate
                            };
                            schedules.push(scheduleEntry);
                        }
                    }
                });
            }
        }
    });

    processedData.employees = employees;
    processedData.schedules = schedules;
    processedData.totalEmployees = employees.length;
    processedData.totalShiftAssignments = schedules.length;

    return processedData;
}

/**
 * Convert data array to CSV format
 * @param {Array} data - Data array to convert
 * @returns {string} CSV formatted string
 */
function convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row => headers.map(header => row[header] || '').join(','))
    ].join('\n');

    return csvContent;
}

/**
 * Download CSV file
 * @param {string} csv - CSV content
 * @param {string} filename - Download filename
 */
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}

/**
 * Parse a single CSV row with proper quoted field handling
 * @param {string} row - CSV row to parse
 * @returns {Array<string>} Parsed row cells
 */
function parseCsvRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    let i = 0;

    while (i < row.length) {
        const char = row[i];
        const nextChar = row[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Escaped quote
                current += '"';
                i += 2;
                continue;
            } else {
                // Toggle quote state
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            // Field separator
            result.push(current);
            current = '';
        } else {
            current += char;
        }

        i++;
    }

    // Add the last field
    result.push(current);

    return result;
}

/**
 * XLSX-specific CSV parsing (separate from regular CSV import)
 * @param {string} csvText - CSV text to parse
 * @returns {Array<Array<string>>} Parsed CSV data
 */
function parseXlsxCsv(csvText) {
    const lines = csvText.trim().split('\n');
    const data = [];

    // Skip the first row (header) and parse the rest
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '') continue; // Skip empty lines

        const cells = parseCsvRow(lines[i]);
        if (cells.length > 0) {
            data.push(cells);
        }
    }

    return data;
}


/**
 * Remove columns that have all blank data from CSV text
 * OPTIMIZED: Parse each row only ONCE, then analyze columns from parsed data
 * @param {string} csvText - CSV text to process
 * @returns {string} CSV text with blank columns removed
 */
function removeColumnsWithAllBlankData(csvText) {
    const lines = csvText.trim().split('\n');

    if (lines.length === 0) {
        return '';
    }

    // OPTIMIZATION: Parse ALL rows ONCE upfront instead of repeatedly per column
    const parsedRows = lines.map(line => parseCsvRow(line));
    
    if (parsedRows.length === 0) {
        return '';
    }

    const columnCount = parsedRows[0].length;
    
    if (parsedRows.length === 1) {
        return csvText; // Only header row, nothing to filter
    }

    // OPTIMIZATION: Track non-blank columns in a single pass through all data
    const hasDataInColumn = new Array(columnCount).fill(false);
    
    // Single pass through all parsed rows to find non-blank columns
    for (let rowIndex = 0; rowIndex < parsedRows.length; rowIndex++) {
        const cells = parsedRows[rowIndex];
        for (let colIndex = 0; colIndex < columnCount; colIndex++) {
            if (!hasDataInColumn[colIndex] && cells[colIndex] && cells[colIndex].trim() !== '') {
                hasDataInColumn[colIndex] = true;
            }
        }
        
        // Early exit if all columns have data (no columns to remove)
        if (hasDataInColumn.every(Boolean)) {
            return csvText;
        }
    }

    // Build list of columns to keep
    const columnsToKeep = [];
    for (let i = 0; i < columnCount; i++) {
        if (hasDataInColumn[i]) {
            columnsToKeep.push(i);
        }
    }

    if (columnsToKeep.length === 0) {
        return '';
    }
    
    // If no columns were removed, return original
    if (columnsToKeep.length === columnCount) {
        return csvText;
    }

    // OPTIMIZATION: Use already-parsed data instead of re-parsing
    const cleanedLines = parsedRows.map(cells => {
        // Keep only non-blank columns
        const filteredCells = columnsToKeep.map(index => cells[index] || '');

        // Rebuild the row with proper CSV formatting
        return filteredCells.map(cell => {
            // Re-quote cells that contain commas or quotes
            if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                return '"' + cell.replace(/"/g, '""') + '"';
            }
            return cell;
        }).join(',');
    });

    return cleanedLines.join('\n');
}

// Export functions for use in other modules
window.DataProcessor = {
    readFileAsText,
    readFileAsArrayBuffer,
    parseCSV,
    parseCsvRow,
    parseXlsxCsv,
    isDateString,
    parseDayColumn,
    processScheduleData,
    processXlsxScheduleData,
    convertToCSV,
    downloadCSV,
    removeColumnsWithAllBlankData
};
