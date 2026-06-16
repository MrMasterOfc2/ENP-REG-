# Firebase Realtime Database Setup

1. Create a Firebase project.
2. Add a Web App and copy the Firebase config.
3. Open `firebase-config.js`.
4. Paste the config values and set `enabled:true`.
5. Create a Realtime Database.
6. For public testing only, use these rules:

```json
{
  "rules": {
    "enp-system": {
      ".read": true,
      ".write": true
    }
  }
}
```

Public write access is not safe for production. Use authentication rules before using this with real student data online.
