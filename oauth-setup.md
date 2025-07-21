# OAuth Configuration for Replit Sandbox

To enable OAuth authentication in the sandbox environment, update your Google Cloud Console OAuth settings:

## Current Redirect URI for this environment:
```
https://e5ecaba3-aabe-4238-ad4e-1aea6f02b424-00-2azxaqkfn00gs.worf.replit.dev/api/oauth/callback
```

## Steps to update Google Cloud Console:

1. Go to Google Cloud Console (console.cloud.google.com)
2. Navigate to APIs & Services > Credentials
3. Click on your OAuth 2.0 Client ID
4. In "Authorized redirect URIs", add the URL above
5. Save the changes

## Notes:
- The OAuth flow now returns a success/error page instead of redirecting
- The popup window will automatically close and notify the main application
- No manual page refresh is needed after successful authorization

## Test the OAuth flow:
1. Import a Google Calendar source
2. Click "Enable OAuth" button  
3. Complete authorization in the popup
4. The calendar should show "✓ OAuth Enabled" status
5. Create/edit events to test bidirectional sync