# User-Generated Staffing Rules System

## Overview

The Workforce Schedule Manager now includes a powerful rule system that allows users to create custom staffing validation rules. This system replaces the hardcoded staffing analysis with flexible, user-defined rules that can be easily created, modified, and managed through an intuitive interface.

## Features

### 🎯 **Core Capabilities**
- **Custom Rule Creation**: Create rules using a simple, wizard-like interface
- **Rule Templates**: Pre-built templates for common staffing scenarios
- **Real-time Validation**: Rules are evaluated in real-time as schedules change
- **Severity Levels**: Error, Warning, and Info levels for different rule violations
- **Rule Management**: Enable/disable, edit, duplicate, and delete rules
- **Rule Testing**: Test rules against current data before saving

### 🏗️ **Rule Types**

#### **Basic Rules**
- **Count by Role**: Check if specific roles have the right number of people
- **Count by Shift**: Validate shift coverage requirements
- **Total Staff Count**: Ensure overall staffing levels are appropriate

#### **Advanced Rules**
- **Complex Conditions**: IF-THEN logic for sophisticated scenarios
- **Day-specific Rules**: Different rules for weekdays vs weekends
- **Exception Handling**: Override rules for special circumstances

### 📊 **Example Rules**

#### **Daily Charge Nurse Requirement**
```
Rule: Every day should have exactly 1 charge nurse
Type: Count by Role
Role: Charge Nurse
Operator: Equals
Value: 1
Severity: Error
```

#### **Shift Coverage Requirements**
```
Rule: Each shift needs minimum staff levels
Type: Count by Shift
Shift: Morning
Operator: At least
Value: 2
Severity: Error
```

#### **Weekend Manager Requirement**
```
Rule: Weekends need at least one manager on duty
Type: Count by Role
Role: Manager
Operator: At least
Value: 1
Day Filter: Saturday, Sunday
Severity: Warning
```

## User Interface

### 🎨 **Rule Management**
Access the rule management interface through:
- **Data Menu** → **Manage staffing rules**

### 📝 **Rule Builder**
The rule builder provides two modes:

#### **Simple Mode (Recommended)**
- Step-by-step rule creation
- Dropdown selectors for easy configuration
- Real-time rule testing
- Visual condition builder

#### **Advanced Mode**
- JSON-based rule definition
- For power users who need complex rules
- Full control over rule structure

### 🔧 **Rule Templates**
Pre-built templates include:
- Daily Charge Nurse Requirement
- Charge Nurse Range (0-2)
- Shift Coverage Requirements
- Weekend Manager Requirement

## Technical Implementation

### 🏗️ **Architecture**

#### **RuleEngine Class**
- Core rule evaluation logic
- Rule storage and retrieval
- Template management
- Performance optimization

#### **RuleManager Class**
- User interface management
- Rule creation and editing
- Modal management
- Event handling

#### **Integration Points**
- **CalendarRenderer**: Uses rules for staffing analysis
- **Staffing Issues Panel**: Displays rule violations
- **Data Menu**: Access point for rule management

### 📁 **File Structure**
```
ruleEngine.js          # Core rule evaluation engine
ruleManager.js         # User interface management
ruleSystemTest.js      # Testing utilities
RULE_SYSTEM_GUIDE.md   # This documentation
```

### 🔄 **Data Flow**
1. User creates/edits rules through RuleManager UI
2. Rules are stored in localStorage
3. CalendarRenderer calls RuleEngine.evaluateRules()
4. Rule violations are displayed in staffing issues panel
5. Real-time updates as schedule changes

## Usage Examples

### 🚀 **Getting Started**

1. **Access Rule Management**
   - Click the "Data" menu in the top toolbar
   - Select "Manage staffing rules"

2. **Create Your First Rule**
   - Click "Add New Rule"
   - Fill in rule name and description
   - Select condition type (e.g., "Count by Role")
   - Choose target (e.g., "Charge Nurse")
   - Set operator (e.g., "Exactly")
   - Enter value (e.g., "1")
   - Select severity (e.g., "Error")
   - Click "Add Condition"
   - Click "Create Rule"

3. **Test Your Rule**
   - Click "Test Rule" to see how it performs
   - Review test results
   - Adjust rule if needed

4. **Save and Activate**
   - Click "Create Rule" to save
   - Rule will immediately start monitoring your schedule

### 📋 **Common Rule Scenarios**

#### **Scenario 1: Daily Charge Nurse**
```
Problem: Need exactly 1 charge nurse every day
Solution: 
- Type: Count by Role
- Role: Charge Nurse
- Operator: Equals
- Value: 1
- Severity: Error
```

#### **Scenario 2: Shift Coverage**
```
Problem: Morning shift needs 2-4 people
Solution:
- Type: Count by Shift
- Shift: Morning
- Operator: At least
- Value: 2
- Severity: Error

- Type: Count by Shift
- Shift: Morning
- Operator: At most
- Value: 4
- Severity: Warning
```

#### **Scenario 3: Weekend Requirements**
```
Problem: Weekends need manager on duty
Solution:
- Type: Count by Role
- Role: Manager
- Operator: At least
- Value: 1
- Day Filter: Saturday, Sunday
- Severity: Warning
```

## Best Practices

### ✅ **Do's**
- Start with simple rules and build complexity gradually
- Use descriptive rule names and descriptions
- Test rules before saving
- Use appropriate severity levels
- Group related conditions in the same rule
- Regularly review and update rules

### ❌ **Don'ts**
- Don't create too many overlapping rules
- Don't use "Error" severity for minor issues
- Don't forget to test rules with real data
- Don't create rules that conflict with each other
- Don't ignore rule performance impact

## Troubleshooting

### 🔧 **Common Issues**

#### **Rule Not Working**
- Check if rule is enabled
- Verify rule conditions are correct
- Test rule with current data
- Check console for errors

#### **Performance Issues**
- Limit number of active rules
- Use specific conditions rather than broad ones
- Consider rule complexity

#### **UI Issues**
- Refresh page if modals don't close
- Check browser console for errors
- Ensure all required fields are filled

### 🐛 **Debugging**
- Use browser console to check rule evaluation
- Test individual rules in isolation
- Check rule data structure
- Verify employee and role data

## Future Enhancements

### 🚀 **Planned Features**
- **Rule Import/Export**: Share rules between users
- **Rule Analytics**: Track rule performance and effectiveness
- **Advanced Templates**: More complex rule templates
- **Rule Scheduling**: Time-based rule activation
- **Rule Notifications**: Email alerts for rule violations
- **Rule History**: Track rule changes over time

### 💡 **Ideas for Advanced Users**
- **Custom Rule Functions**: JavaScript-based rule logic
- **Rule Dependencies**: Rules that depend on other rules
- **Rule Optimization**: Automatic rule performance tuning
- **Rule Machine Learning**: AI-suggested rules based on patterns

## Support

### 📚 **Resources**
- This guide provides comprehensive documentation
- Browser console shows detailed error messages
- Test functions are available for debugging

### 🆘 **Getting Help**
- Check the troubleshooting section above
- Review rule examples and templates
- Test with simple rules first
- Use browser developer tools for debugging

---

**Note**: The rule system is designed to be intuitive for novices while powerful enough for advanced users. Start simple and gradually build more complex rules as you become comfortable with the system.
