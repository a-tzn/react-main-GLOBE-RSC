# Google Apps Script Backend Setup Guide

## Overview
This project now includes a Google Apps Script backend that uses Google Sheets as a database for storing and retrieving uploaded data. The backend handles OAuth authentication and data persistence.

## Features
- **OAuth Authentication**: Automatic Google sign-in
- **User Tracking**: Shows current logged-in user
- **Data Persistence**: Stores processed data in Google Sheets
- **Last Modified Tracking**: Shows who last modified the data
- **User Isolation**: Each user sees only their own data

## Setup Steps

### 1. Create a Google Sheet
1. Go to [Google Sheets](https://sheets.google.com)
2. Create a new spreadsheet
3. Copy the spreadsheet ID from the URL (the long string between `/d/` and `/edit`)
4. Keep this ID for the next step

### 2. Deploy Google Apps Script
1. Go to [Google Apps Script](https://script.google.com)
2. Create a new project
3. Copy the code from `client/backend-gas/code.gs` into the script editor
4. Copy the manifest from `client/backend-gas/appsscript.json` into the project settings
5. **Important**: Replace `YOUR_SPREADSHEET_ID_HERE` in `code.gs` with your actual spreadsheet ID
6. Save the project

### 3. Deploy as Web App
1. Click "Deploy" > "New deployment"
2. Select type "Web app"
3. Set "Execute as" to "User accessing the web app"
4. Set "Who has access" to "Anyone" (for development) or "Anyone with Google account"
5. Deploy and copy the web app URL

### 4. Update Frontend Configuration
1. Open `client/src/services/googleAppsScript.js`
2. Replace `YOUR_SCRIPT_ID` in the `API_BASE_URL` with your deployed script ID
   - The script ID is the long string in your deployment URL between `/s/` and `/exec`

### 5. Enable Google APIs
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Google Sheets API for your project
3. Make sure OAuth consent screen is configured

## File Structure
```
client/backend-gas/
├── code.gs           # Main Apps Script code
├── appsscript.json   # Manifest file
└── index.html        # Web app interface (optional)
```

## Authentication
- **No Login Page Needed**: Google OAuth handles authentication automatically
- When users access the app, Google will prompt them to sign in
- User info is displayed in the header bar
- Each user can only see their own uploaded data

## Database Structure
The Google Sheet contains three sheets:
- **UploadedData**: Stores processed alarm data
- **Users**: Tracks user statistics
- **LastModified**: Logs all data modifications

## API Endpoints
- `POST /exec` - Main API endpoint for all operations
- Actions: `storeData`, `getData`, `deleteData`, `getUserInfo`, `getLastModified`, `initialize`

## User Interface Features
- **User Bar**: Shows current logged-in user in the header
- **Last Modified Info**: Displays who last uploaded/modified data
- **History Tab**: View and reload previous analyses
- **Data Persistence**: All processed data is automatically saved

## Security Notes
- The backend uses Google OAuth for authentication
- Data is stored per user (filtered by email)
- Consider restricting web app access in production
- Enable appropriate OAuth scopes in the manifest

## Troubleshooting
- **"Script not found"**: Check that the script ID is correct in the frontend
- **"Access denied"**: Verify OAuth scopes and web app permissions
- **"Spreadsheet not found"**: Ensure the spreadsheet ID is correct and accessible
- **CORS errors**: Make sure the web app is deployed with "Anyone" access for development

## Development
- Test the backend directly at: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec?action=testConnection`
- Use the `index.html` file to test API calls manually
- Check Apps Script execution logs for debugging