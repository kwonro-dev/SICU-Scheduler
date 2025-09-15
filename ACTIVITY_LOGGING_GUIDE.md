# Activity Logging Guide

## Overview
The SICU Schedule Manager now includes comprehensive activity logging to track user actions and provide an audit trail. This feature helps monitor system usage, track changes, and maintain accountability.

## Features

### 1. **Activity Tracking**
- **Employee Management**: Create, update, delete employees
- **Shift Assignments**: Assign/unassign shifts to employees
- **Data Import**: Track when data is imported from files
- **System Events**: App initialization and other system activities

### 2. **Activity Feed UI**
- **Real-time Display**: View recent activities in a clean, organized feed
- **Filtering**: Filter activities by type (employees, shifts, roles, imports)
- **Statistics**: See activity counts and user participation
- **Search**: Find specific activities quickly

### 3. **Data Storage**
- **Firebase Integration**: Activities are stored in Firestore for persistence
- **Local Caching**: Recent activities are cached locally for performance
- **Automatic Sync**: Activities sync across all users in real-time

## How to Use

### Viewing Activities
1. Click the **"Activity Log"** tab in the navigation
2. View recent activities in the feed
3. Use the filter dropdown to focus on specific activity types
4. Click **"Refresh"** to load the latest activities

### Activity Types

#### Employee Activities
- `create_employee`: New employee added
- `update_employee`: Employee information modified
- `delete_employee`: Employee removed

#### Shift Activities
- `assign_shift`: Shift assigned to employee
- `unassign_shift`: Shift removed from employee

#### System Activities
- `import_data`: Data imported from file
- `app_initialized`: Application started

### Activity Details
Each activity log entry includes:
- **Timestamp**: When the action occurred
- **User**: Who performed the action
- **Action**: What was done
- **Entity**: What was affected
- **Details**: Additional context about the change

## Technical Implementation

### ActivityLogger Class
The `ActivityLogger` class handles all activity tracking:

```javascript
// Log an activity
await activityLogger.logActivity(
    'create_employee',    // Action type
    'employee',           // Entity type
    employeeId,           // Entity ID
    { name: 'John Doe' }, // Details
    { before: old, after: new } // Changes (optional)
);
```

### Firebase Storage
Activities are stored in Firestore under:
```
organizations/{orgId}/activities/{activityId}
```

### UI Components
- **Activity Feed**: Displays recent activities
- **Statistics Cards**: Shows activity counts
- **Filter Controls**: Allows filtering by activity type

## Benefits

### For Administrators
- **Audit Trail**: Complete record of all changes
- **User Activity**: Monitor who is doing what
- **Change Tracking**: See what was modified and when
- **Compliance**: Meet audit requirements

### For Users
- **Transparency**: See what others are doing
- **Accountability**: Know your actions are tracked
- **History**: Review past changes
- **Collaboration**: Stay informed about team activities

## Configuration

### Activity Retention
- **Local Storage**: Last 100 activities kept in memory
- **Firebase Storage**: All activities stored permanently
- **Performance**: Activities load on-demand for better performance

### Privacy
- **User Information**: Only email addresses are logged (no personal data)
- **Change Details**: Only relevant change information is stored
- **IP Tracking**: Basic IP logging for security (currently disabled)

## Future Enhancements

### Planned Features
- **Export Activities**: Download activity logs as CSV/PDF
- **Advanced Filtering**: Date ranges, user filters, action filters
- **Activity Notifications**: Real-time notifications for important changes
- **Activity Reports**: Generate usage and activity reports

### Integration Points
- **Email Notifications**: Alert on important activities
- **Slack Integration**: Post activity summaries to Slack
- **API Access**: Programmatic access to activity data

## Troubleshooting

### Common Issues

#### Activities Not Showing
1. Check if Firebase is properly initialized
2. Verify user authentication
3. Check browser console for errors
4. Try refreshing the activity feed

#### Performance Issues
1. Activities are limited to 50 per page
2. Use filters to reduce displayed activities
3. Clear browser cache if needed

#### Missing Activities
1. Some activities may take time to sync
2. Check Firebase connection
3. Verify activity logging is enabled

## Security Considerations

### Data Protection
- Activities are stored securely in Firebase
- User authentication required to view activities
- No sensitive data is logged in activity details

### Access Control
- Only authenticated users can view activities
- Activities are scoped to organization
- Admin users have full access to all activities

## Support

For issues or questions about activity logging:
1. Check the browser console for error messages
2. Verify Firebase connection and authentication
3. Contact your system administrator
4. Review this guide for common solutions

---

*Activity logging is automatically enabled and requires no additional configuration. All user actions are tracked by default to provide comprehensive audit capabilities.*
