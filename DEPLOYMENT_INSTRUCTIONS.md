# Deployment Instructions - Unified AppScript Setup

This guide walks you through setting up **one-time** and **per-update** deployment workflows.

## Prerequisites

- Google Account
- Existing Google Sheet with ID in `code.gs` (CONFIG.SPREADSHEET_ID)
- Node.js installed

## One-Time Setup (First Deployment)

### Step 1: Verify Google Sheet Configuration
1. Open `client/backend-gas/code.gs`
2. Find this line (~line 7):
   ```javascript
   const CONFIG = {
     SPREADSHEET_ID: '1_Xx16PoEfU2fzrzlyhAQZERdTzGKaDFE96AIJx0eIBg', // ← Check this
   ```
3. If the SPREADSHEET_ID is incorrect, update it to your Google Sheet ID
4. Save the file

### Step 2: Deploy Backend Code to Google Apps Script
Choose ONE method:

#### Method A: Using Google Apps Script Web Editor (Easiest for First Time)

1. Go to [script.google.com](https://script.google.com)
2. Create a new project named "Globe RSC Data Manager"
3. In the left sidebar, you'll see `Code.gs` file
4. Delete all existing code and copy/paste contents of `client/backend-gas/code.gs`
5. Click the **Save** button (or Ctrl+S)
6. In the left sidebar, click "+" to add a new file
7. Select "HTML" and name it `index`
8. Add placeholder content (we'll replace this after building React):
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>Loading...</title>
   </head>
   <body>
     <p>Deploying...</p>
   </body>
   </html>
   ```
9. Save this file
10. Click the blue **Deploy** button
11. Select **"New deployment"**
12. Click the dropdown and select **"Web app"**
13. Set:
    - Execute as: **[Your Email]**
    - Who has access: **Anyone**
14. Click **Deploy**
15. **Copy the deployment URL** (it will look like: `https://script.google.com/macros/s/AKfycbxxx.../usercurrentappid`)
    - Keep this URL safe - you'll need it if reverting to fetch()-based API

#### Method B: Using clasp CLI (Recommended for Recurring Deployments)

First time only:
```bash
npm install -g @google/clasp
clasp login
clasp create --title "Globe RSC Data Manager" --type webapp
# Follow prompts and save your script ID
```

Then push code:
```bash
cd client/backend-gas
clasp push
clasp deploy
```

## Per-Update Deployment Workflow

### Every Time You Make Changes:

```bash
# From the react-main-GLOBE-RSC root directory:

# 1. Build React and copy to backend-gas folder
cd client
npm run build:gas

# This creates:
# - client/dist/ (React build)
# - client/backend-gas/index-react.html (the file to deploy)
# - client/backend-gas/assets/ (copied assets)
```

### Now Deploy (Choose One Method):

#### Option A: Web Editor (Copy/Paste)
1. Go to [script.google.com](https://script.google.com)
2. Open your "Globe RSC Data Manager" project
3. Click on `index` file in the left sidebar
4. Select ALL content (Ctrl+A)
5. Delete it
6. Open `client/backend-gas/index-react.html` on your computer
7. Copy ALL content
8. Paste into the GAS `index` file
9. Click **Save**
10. Click **Deploy** button → **New deployment**
11. Keep the settings same as before
12. Click **Deploy**
13. **Copy the NEW URL** if you want to bookmark it

#### Option B: clasp CLI (Automated)
```bash
cd client/backend-gas

# Push your changes (code.gs + index.html)
clasp push

# Deploy a new version
clasp deploy

# Copy the URL from the output
```

## Understanding the Deployment

### What Gets Deployed

- **code.gs**: Backend functions (data storage, user info, etc.)
- **index.html**: Frontend (your React app packaged as HTML)

When you visit the deployment URL, you get:
1. **Frontend**: React app loads and runs in your browser
2. **Backend**: All backend functions run on Google servers
3. **Communication**: React calls backend via `google.script.run` (direct function calls)

### What Happens After Deployment

1. Google generates a unique URL
2. Anyone with the URL can access your app
3. The app loads with your user's Google authentication
4. Data saves to your Google Sheet

## Troubleshooting

### "Error: google.script.run is undefined"
- Your app is not running inside GAS HTML Service
- In development (localhost), it should use fetch() instead
- This is normal - code auto-detects the environment

### Brand new deployment shows blank page
1. Wait 30 seconds for GAS to process
2. Refresh the page (Ctrl+F5)
3. Check browser console (F12 → Console tab) for errors
4. If error about "This app hasn't been authorized", click "Review" and approve

### Data not saving after deployment
1. Check Google Sheet ID in code.gs is correct
2. Verify sheet has proper columns (check code.gs initializeSpreadsheet function)
3. Check GAS execution logs:
   - Go to script.google.com → Apps Script Editor
   - Click Executions (left sidebar)
   - Look for failed executions

### Old deployment still showing in browser
- Browser cached the old version
- Clear cache: Ctrl+Shift+Delete
- Or use Incognito window (Ctrl+Shift+N)

## Development Workflow (Optional)

For local development without deploying every time:

```bash
cd client
npm run dev
# Opens http://localhost:5173

# Code front-end normally
# API calls automatically use fetch() in dev mode
```

When you're ready to deploy to production:
```bash
npm run build:gas
# Then deploy using Option A or Option B above
```

## Environment Detection

The `googleAppsScript.js` service automatically detects:
- **In GAS HTML Service** (production): Uses `google.script.run` ✓
- **In localhost** (development): Uses `fetch()` API calls ✓

No code changes needed - it just works!

