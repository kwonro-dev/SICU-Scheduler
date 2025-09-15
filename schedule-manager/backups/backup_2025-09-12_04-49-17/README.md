# Workforce Schedule Manager

A professional web-based workforce scheduling and management application built with vanilla JavaScript, HTML, and CSS.

## Features

- 📅 **Interactive Calendar View** - Visual schedule management with drag-and-drop support
- 👥 **Employee Management** - Add, edit, and manage employee records
- ⏰ **Shift Management** - Create and manage different shift types with custom colors
- 🏢 **Job Role Management** - Define job roles and departments
- 📊 **Schedule Balance Analysis** - Analyze schedule distribution and fairness
- 📥 **CSV Import/Export** - Import schedules from CSV files, export data
- 💾 **Local Storage** - Automatic data persistence in browser
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Files Structure

```
schedule-manager/
├── index.html          # Main HTML file
├── script.js          # Application logic (JavaScript)
├── styles.css         # Styling (CSS)
├── sample_schedule.csv # Sample data file
└── README.md          # This file
```

## Local Development

1. **Clone/Download** the files to your local machine
2. **Open `index.html`** in any modern web browser
3. **Start using** the application immediately - no server required!

The application uses local storage to persist data between sessions.

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

#### Vercel (Free)
1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repository or upload files
3. Automatic deployment
4. Free subdomain available

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

## Contributing

Feel free to fork and improve this application!

## License

MIT License - Free to use and modify.

---

**Ready to deploy?** Just upload the files to any static hosting service and you're live! 🚀