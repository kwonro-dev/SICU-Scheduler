# Workforce Schedule Manager

A comprehensive, enterprise-ready workforce scheduling and management application built with vanilla JavaScript, HTML, and CSS. Features Firebase integration, custom rule-based validation, real-time collaboration, and advanced data consistency testing.

## Features

### Core Functionality
- 📅 **Interactive Calendar View** - Visual schedule management with drag-and-drop support
- 👥 **Employee Management** - Add, edit, and manage employee records
- ⏰ **Shift Management** - Create and manage different shift types with custom colors
- 🏢 **Job Role Management** - Define job roles and departments
- 📊 **Schedule Balance Analysis** - Analyze schedule distribution and fairness
- 📥 **CSV Import/Export** - Import schedules from CSV files, export data
- 📱 **Responsive Design** - Works on desktop and mobile devices

### Advanced Features
- 🔥 **Firebase Integration** - Real-time database, authentication, and offline persistence
- 📋 **Custom Rule System** - User-defined staffing validation rules with templates
- 📈 **Activity Logging** - Comprehensive audit trail for all user actions
- 🔄 **Data Consistency Testing** - Automated validation and conflict resolution
- 💾 **Hybrid Data Management** - Local caching with cloud synchronization
- 🚀 **Performance Monitoring** - Load times, cache metrics, and offline capabilities
- 🧪 **Testing Framework** - Comprehensive data validation and consistency tests
- 🔧 **Modular Architecture** - Clean, maintainable codebase with focused modules

## Files Structure

```
schedule-manager/
├── index.html                    # Main HTML file
├── styles.css                   # Application styling
├── script.js                    # Main application entry point
├── firebase-config.js           # Firebase configuration and initialization
├── vercel.json                  # Vercel deployment configuration
├── favicon.ico                  # Application icon
├── favicon.svg                  # SVG version of application icon
│
├── Core Modules/
│   ├── dataManager.js           # Data management and persistence
│   ├── uiManager.js             # User interface management
│   ├── modalManager.js          # Modal dialog management
│   ├── filterManager.js         # Data filtering logic
│   ├── calendarRenderer.js      # Calendar view rendering
│   ├── viewRenderer.js          # General view rendering
│   ├── EmployeeManager.js       # Employee data management
│   ├── dataProcessor.js         # CSV import/export processing
│   └── utils.js                 # Utility functions
│
├── Firebase Integration/
│   ├── firebaseManager.js       # Firebase database operations
│   ├── hybridDataManager.js     # Hybrid local/cloud data management
│   ├── authManager.js           # Authentication management
│   └── incrementalLoader.js     # Incremental data loading
│
├── Rule System/
│   ├── ruleEngine.js            # Rule evaluation engine
│   ├── ruleManager.js           # Rule management UI
│   └── ruleSystemTest.js        # Rule system testing
│
├── Data Management/
│   ├── dataConsistencyManager.js    # Data validation and consistency
│   ├── dataConsistencyTests.js      # Data consistency testing
│   ├── safeDataConsistencyTests.js  # Safe (non-destructive) testing
│   ├── cacheManager.js              # Data caching management
│   ├── snapshotManager.js           # Data snapshots and backups
│   └── dataCompression.js           # Data compression utilities
│
├── Monitoring & Logging/
│   ├── activityLogger.js        # Activity logging system
│   ├── activityManager.js       # Activity management UI
│   ├── performanceMonitor.js    # Performance monitoring
│   ├── debugLoopDetector.js     # Debug loop detection
│   └── stopLoop.js              # Loop control utilities
│
├── Testing & Validation/
│   ├── testManager.js           # Test management interface
│   └── initializationManager.js # Application initialization
│
├── Import/Export/
│   ├── importManager.js         # Data import management
│   └── migrateToSharedOrg.js    # Organization migration
│
├── Documentation/
│   ├── README.md                # This file
│   ├── DEPLOYMENT.md            # Deployment guide
│   ├── REFACTORING_GUIDE.md     # Code refactoring guide
│   ├── REFACTORING_NOTES.md     # Refactoring notes
│   ├── DATA_CONSISTENCY_GUIDE.md # Data consistency guide
│   ├── RULE_SYSTEM_GUIDE.md     # Rule system guide
│   └── ACTIVITY_LOGGING_GUIDE.md # Activity logging guide
│
└── Backups/
    └── backup_YYYY-MM-DD_HH-MM-SS/  # Timestamped backups
```

## Local Development

1. **Clone/Download** the files to your local machine
2. **Open `index.html`** in any modern web browser
3. **Start using** the application immediately - no server required!

The application uses local storage to persist data between sessions, with optional Firebase integration for cloud synchronization.

## Firebase Setup (Optional)

For real-time collaboration and cloud data synchronization:

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Create a project" (or select existing)
3. Enable Authentication and Firestore Database

### 2. Configure Authentication
1. Go to **Authentication** → **Sign-in method**
2. Enable **Email/Password** provider
3. Configure authorized domains (include your deployment domain)

### 3. Configure Firestore Database
1. Go to **Firestore Database** → **Create database**
2. Choose "Start in test mode" or configure security rules
3. Set up collections for your organization data

### 4. Update Firebase Configuration
1. Get your Firebase config from **Project Settings** → **General** → **Your apps**
2. Update `firebase-config.js` with your project credentials:
```javascript
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "your-sender-id",
    appId: "your-app-id"
};
```

### 5. Security Rules (Production)
Set up Firestore security rules to protect your data:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow authenticated users to read/write their organization's data
    match /organizations/{orgId} {
      allow read, write: if request.auth != null &&
        request.auth.token.email_verified == true;
    }
  }
}
```

## Quick Start Options

### Option 1: Local Only (No Setup Required)
- Open `index.html` in any modern browser
- Data is stored locally in browser storage
- No internet connection required

### Option 2: Firebase Enabled (Cloud Sync)
- Complete Firebase setup above
- Data syncs across devices in real-time
- Requires internet connection for sync
- Includes user authentication and activity logging

## Web Hosting Options

### Option 1: Static Hosting (Recommended)

#### GitHub Pages (Free)
1. Create a GitHub repository
2. Upload all files (`index.html`, `script.js`, `styles.css`, `sample_schedule.csv`)
3. Go to Settings → Pages
4. Select "Deploy from a branch" → Choose `main` branch
5. Your site will be live at: `https://yourusername.github.io/repository-name/`

#### Netlify (Free with Custom Domain)
1. Go to [netlify.com](https://netlify.com)
2. Drag & drop your files or connect GitHub repository
3. Site deploys automatically
4. Get a free subdomain or use custom domain

#### Vercel (Recommended for Firebase Integration)
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository or upload files
3. Automatic deployment with `vercel.json` configuration
4. Free subdomain available
5. Enhanced security headers automatically applied

**Note**: Vercel is recommended when using Firebase features due to proper CORS handling and security headers.

#### Other Free Options:
- **GitLab Pages**: Similar to GitHub Pages
- **Render**: Free static site hosting
- **Surge**: `npm install -g surge` then `surge`

### Option 2: Traditional Web Hosting

Upload files to any web hosting service:
- **Hostinger**, **Bluehost**, **SiteGround**
- **AWS S3 + CloudFront**
- **DigitalOcean Spaces**

### Option 3: Backend-Enabled Hosting (For Advanced Features)

For persistent data storage across users, consider:
- **Firebase Hosting + Firestore**
- **Supabase**
- **PlanetScale + Vercel**
- **Railway** or **Render** with database

## CSV Data Format

Your CSV files should follow this format:
```csv
Header Row 1,Ignore this row
,Day 1,Day 2,Day 3,Day 4,Day 5,...
Employee Name,Job Role,Morning,Afternoon,Off,...
```

- **First row**: Ignored (header)
- **Second row**: Date headers (first two cells ignored)
- **Third row+**: Employee data (Name, Job Role, Shift assignments)

## Custom Rule System

The application includes a powerful rule system for custom staffing validation. Create flexible rules to ensure your schedules meet organizational requirements.

### Rule Types
- **Count by Role**: Validate minimum/maximum staff counts for specific roles
- **Count by Shift**: Ensure proper coverage for different shift types
- **Complex Conditions**: Advanced IF-THEN logic for sophisticated scenarios
- **Day-specific Rules**: Different rules for weekdays vs weekends

### Example Rules
```javascript
// Daily charge nurse requirement
{
  "name": "Daily Charge Nurse",
  "type": "count_by_role",
  "role": "Charge Nurse",
  "operator": "equals",
  "value": 1,
  "severity": "error"
}

// Weekend manager requirement
{
  "name": "Weekend Manager",
  "type": "count_by_role",
  "role": "Manager",
  "operator": "at_least",
  "value": 1,
  "dayFilter": ["Saturday", "Sunday"],
  "severity": "warning"
}
```

### Using the Rule System
1. Click **"Data"** menu → **"Manage staffing rules"**
2. Click **"Add New Rule"** to create a rule
3. Choose from templates or build custom rules
4. Test rules against current data
5. Save and activate rules for automatic validation

See `RULE_SYSTEM_GUIDE.md` for comprehensive documentation.

## Data Consistency & Testing

The application includes comprehensive data validation and testing capabilities to ensure data integrity, especially when using Firebase for multi-user collaboration.

### Data Consistency Features
- **Automatic Validation**: Real-time data integrity checks
- **Conflict Resolution**: Handles concurrent edits from multiple users
- **Orphaned Data Detection**: Identifies and fixes broken references
- **Data Migration Support**: Safe upgrades between versions

### Testing Framework
Access data consistency testing through:
- **Data** menu → **"Test data consistency"**
- Automated testing on data sync events
- Safe/non-destructive testing options

### Test Categories
- **Basic Data Validation**: Structure and field validation
- **Reference Integrity**: Cross-collection reference checks
- **Real-time Sync**: Live synchronization testing
- **Offline/Online**: Network state transition testing
- **Performance**: Load testing and optimization

### Using Data Testing
1. Click **"Data"** menu → **"Test data consistency"**
2. Review test results and any issues found
3. Use **"Auto-fix"** for common problems
4. Manual intervention for complex issues

See `DATA_CONSISTENCY_GUIDE.md` for comprehensive documentation.

## Activity Logging & Audit Trail

Track all user actions with a comprehensive activity logging system for accountability and audit purposes.

### Activity Tracking
- **Employee Management**: Create, update, delete operations
- **Shift Assignments**: Schedule changes and modifications
- **Data Imports**: Track when data is imported
- **System Events**: Application initialization and errors

### Activity Feed
- **Real-time Display**: Live activity feed in the UI
- **Filtering**: Filter by activity type and user
- **Search**: Find specific activities quickly
- **Statistics**: Activity counts and participation metrics

### Using Activity Logging
1. Click **"Activity Log"** tab to view recent activities
2. Use filter dropdown to focus on specific types
3. Click **"Refresh"** to load latest activities
4. Activities are automatically stored in Firebase (when enabled)

See `ACTIVITY_LOGGING_GUIDE.md` for comprehensive documentation.

## Browser Compatibility

- ✅ Chrome 70+
- ✅ Firefox 65+
- ✅ Safari 12+
- ✅ Edge 79+
- ✅ Modern mobile browsers

## Features Overview

### Calendar View
- Visual grid showing employee schedules
- Color-coded shifts
- Today/weekend highlighting
- Adjustable time intervals (7-90 days)

### Data Import
- CSV file upload
- Automatic data parsing
- Preview before import
- Error handling and validation

### Data Export
- Export employees, shifts, and schedules
- CSV format
- One-click download

### Responsive Design
- Desktop and mobile optimized
- Touch-friendly interface
- Adaptive layouts

## Troubleshooting

### Data Not Saving
- Check browser local storage permissions
- Try clearing browser cache
- Use incognito/private mode

### CSV Import Issues
- Ensure proper CSV format
- Check date header format ("Day X" or actual dates)
- Verify no special characters in employee names

### Performance Issues
- Reduce time interval in calendar view
- Clear old data periodically
- Use modern browser

### Firebase Connection Issues
- Check Firebase configuration in `firebase-config.js`
- Verify project API keys are correct
- Ensure authorized domains include your deployment URL
- Check browser console for Firebase errors

### Rule System Issues
- Rules not validating: Check rule is enabled and conditions are correct
- Rule conflicts: Review rule priorities and overlapping conditions
- Performance issues: Limit number of active complex rules

### Data Consistency Issues
- Sync conflicts: Check conflict resolution logs
- Data not syncing: Verify Firebase permissions and network connection
- Orphaned data: Run data consistency tests and auto-fix

### Activity Logging Issues
- Activities not showing: Check Firebase connection and permissions
- Missing activities: Activities may take time to sync across devices
- Performance issues: Activities are limited to recent entries

## Documentation

For detailed information about advanced features:

- 📋 **[Rule System Guide](RULE_SYSTEM_GUIDE.md)** - Complete rule creation and management
- 🔄 **[Data Consistency Guide](DATA_CONSISTENCY_GUIDE.md)** - Testing and validation framework
- 📈 **[Activity Logging Guide](ACTIVITY_LOGGING_GUIDE.md)** - Audit trail and monitoring
- 🔧 **[Refactoring Guide](REFACTORING_GUIDE.md)** - Code architecture and best practices
- 🚀 **[Deployment Guide](DEPLOYMENT.md)** - Vercel deployment instructions

## Contributing

Feel free to fork and improve this application! The codebase is now modular and well-documented for easy contributions.

### Development Guidelines
- Follow the modular architecture (see `REFACTORING_GUIDE.md`)
- Add comprehensive documentation for new features
- Include tests for data consistency features
- Update this README when adding major features

## License

MIT License - Free to use and modify.

---

**Ready to deploy?** Choose between local-only or Firebase-enabled deployment. Upload the files to any static hosting service and you're live! 🚀