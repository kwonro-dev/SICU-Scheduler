# SICU Schedule Manager - Vercel Deployment

## Quick Deploy to Vercel

### Option 1: Deploy via Vercel CLI
1. Install Vercel CLI: `npm i -g vercel`
2. Run: `vercel`
3. Follow the prompts to link your project

### Option 2: Deploy via Vercel Dashboard
1. Go to [vercel.com](https://vercel.com)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect this as a static site

## Configuration

- **Framework**: Static HTML/CSS/JS
- **Build Command**: Not needed (static files)
- **Output Directory**: Root directory
- **Install Command**: Not needed

## Environment Variables

No environment variables needed - all configuration is in `firebase-config.js`

## Features

- ✅ Firebase Authentication
- ✅ Firestore Database
- ✅ Offline persistence
- ✅ Excel file import/export
- ✅ Responsive design
- ✅ Real-time updates

## File Structure

```
/
├── index.html          # Main application
├── styles.css          # Styling
├── script.js           # Main application logic
├── firebase-config.js  # Firebase configuration
├── vercel.json         # Vercel deployment config
└── [other JS modules]  # Application modules
```

## Notes

- All external dependencies are loaded via CDN
- Firebase configuration is already set up
- No build process required
- Ready for immediate deployment

