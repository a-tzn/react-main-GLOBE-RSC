# Unified Google Apps Script Deployment

## Overview
Both frontend (React) and backend (Google Apps Script) now deploy as a single AppScript project. No more managing separate deployments!

## Workflow

### 1. Build the React Frontend
```bash
cd client
npm run build
```
This creates `client/dist/` with the compiled React app.

### 2. Copy React Build to GAS
```bash
cd client
npm run build:gas
```
Or manually copy:
- Copy everything from `client/dist/` to `client/backend-gas/`
- Rename `dist/index.html` to `backend-gas/index.html`

### 3. Deploy to Google Apps Script
You have two options:

#### Option A: Using Google Apps Script Editor (Web UI)
1. Go to [script.google.com](https://script.google.com)
2. Open your "Globe RSC Data Manager" project
3. In the Files sidebar, delete the old `index.html`
4. Click "+" and select "HTML", name it `index.html`
5. Copy the contents of `client/backend-gas/index.html` and paste it
6. Save and close the file
7. Click the blue "Deploy" button → "New deployment"
8. Select "Web app" type
9. Execute as: [Your Google Account]
10. Allow access: Anyone
11. Click "Deploy"
12. Copy the deployment URL (it looks like: `https://script.google.com/macros/s/AKfycby.../usercurrentappid`)

#### Option B: Using clasp CLI (Recommended for Automation)
```bash
# Install clasp if you haven't
npm install -g @google/clasp

# Authenticate
clasp login

# Create/clone your project
clasp clone <script_id>  # or cd to your project directory

# Deploy
clasp push  # Uploads code.gs, index.html, etc.
clasp deploy
```

### 4. Update API Endpoint (if needed)
If you create a NEW deployment, the URL changes. Components already handle this by detecting `google.script.run`.

**You only update the API URL if you're still using the old fetch() method in development.**

## Architecture

### Frontend (React)
- **Location**: `client/src/`
- **Build output**: `client/dist/`
- **Deployment**: Served by GAS via `doGet()` handler
- **Communication**: Uses `google.script.run` to call backend functions directly

### Backend (Google Apps Script)
- **Location**: `client/backend-gas/code.gs`
- **Functions**: 
  - `storeUploadedData()`
  - `getUserUploadedData()`
  - `deleteUploadedData()`
  - `getUserInfo()`
  - `getLastModifiedInfo()`
- **Database**: Google Sheets (CONFIG.SPREADSHEET_ID)

### Database
- **Sheet 1**: `UploadedData` - Stores all file uploads
- **Sheet 2**: `Users` - Tracks user info and stats
- **Sheet 3**: `LastModified` - Audit log of changes

## How It Works

### In GAS Environment (Live Deployment)
```javascript
import { storeUploadedData } from '@/services/googleAppsScript.js';

// Frontend code automatically detects google.script.run
// and calls backend directly
storeUploadedData(fileName, dataType, rawData, processedData);
```

The service layer detects `google.script.run` and:
1. Uses `google.script.run.functionName()` to call backend
2. Handles async responses with `.withSuccessHandler()` and `.withFailureHandler()`
3. Returns Promises for compatibility

### In Development (localhost)
- Same code automatically falls back to fetch()
- Calls the GAS API endpoint
- No changes needed to your React code

## First-Time Setup

1. **One-time**: Ensure the Google Sheet exists and has the correct ID in `code.gs`:
   ```javascript
   const CONFIG = {
     SPREADSHEET_ID: '1_Xx16PoEfU2fzrzlyhAQZERdTzGKaDFE96AIJx0eIBg', // ← Replace this
     // ...
   };
   ```

2. **One-time**: Deploy the GAS script with the initial `code.gs`

3. **Each update**: 
   - Make changes to React or `code.gs`
   - Run `npm run build` in `client/`
   - Copy dist to backend-gas/
   - Deploy via clasp or GAS editor

## Troubleshooting

### "google.script.run is not defined"
- You're trying to use the app outside of GAS HTML Service
- In dev mode, it should use fetch() instead
- Check: `hasGoogleScriptRuntime()` returns `false` in dev

### Blank page after deployment
- Check browser console (F12) for errors
- Verify `index.html` is uploaded to GAS project
- Ensure you deployed as "Web app" with "Execute as" as your account

### Data not saving
- Check Google Sheet ID in `code.gs` is correct
- Verify Sheet has proper column headers (see code.gs)
- Check GAS error logs: Apps Script → Executions tab

### Old deployment still active
- GAS creates a new URL each time you deploy
- Update bookmarks/links to use the new URL
- Old deployments automatically archive

## Key Benefits of Unified Deployment

✅ **Single source of truth**: One GAS project  
✅ **No deployment complexity**: Just `npm run build` + deploy  
✅ **No API URL management**: Uses direct function calls  
✅ **Better performance**: No network latency for API calls  
✅ **Free hosting**: Everything runs on Google's servers  
✅ **Simple updates**: No separate frontend/backend deploys  

## Going Back to Separate Deployment (if needed)

If you want to use fetch() API again instead of google.script.run:
1. Update [API_BASE_URL](client/src/services/googleAppsScript.js:L26) to your GAS API endpoint
2. The code automatically falls back if google.script.run is not available

