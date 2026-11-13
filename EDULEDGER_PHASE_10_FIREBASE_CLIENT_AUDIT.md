# EduLedger Phase 10 — Firebase Client Configuration Audit

**Project**: EduLedger — School Management, Reimagined  
**Phase**: Phase 10 — Client Configuration Security & Runtime Audit  
**Date**: November 8, 2026  
**Status**: AUDITED & PASS  

---

## 1. Modular Firebase Client Architecture

The browser client initialization is isolated in `src/lib/firebase-client.ts`:

```typescript
import { initializeApp, getApps, type FirebaseApp } from "firebase/app";
import { getMessaging, getToken, isSupported, type Messaging } from "firebase/messaging";
```

### Safety Controls Implemented
1. **Zero Hardcoded Credentials**: All values are read from `process.env.NEXT_PUBLIC_FIREBASE_*`. No fallback API keys or app IDs exist in source code.
2. **Safe Missing Configuration Handling**: If required variables (`apiKey`, `projectId`, `appId`, `messagingSenderId`) are absent, `getClientFirebaseConfig()` returns `null` safely without throwing unhandled exceptions.
3. **Singleton Pattern**: Prevents duplicate Firebase app initialization:
   ```typescript
   if (!clientApp) {
     const existing = getApps();
     clientApp = existing.length > 0 ? existing[0] : initializeApp(config);
   }
   ```
4. **SSR Safety Boundary**:
   - `getClientFirebaseApp()` immediately returns `null` if `typeof window === "undefined"`.
   - `requestClientFcmToken()` immediately returns `{ token: null, error: "Cannot request token during server-side rendering." }` if executed during SSR.
5. **Browser Capability Check**:
   - Executes `await isSupported()` before attempting to access `getMessaging(app)`.
   - Protects unsupported desktop or mobile browsers from throwing fatal exceptions.

