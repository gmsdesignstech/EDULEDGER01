# EDULEDGER FIREBASE CONSOLE & VERCEL SECURE CONFIGURATION GUIDE

**Project:** EduLedger — School Management, Reimagined  
**Security Level:** Production Confidential (Zero Private Key Exposure)  
**Target Environment:** Vercel Production (`gmsdesignstechs-projects/eduledger`)  
**Date:** 2026-11-08  

> [!CAUTION]
> **NEVER PASTE PRIVATE KEYS INTO CHAT ASSISTANTS, FORUMS, OR PUBLIC REPOSITORIES.**  
> Follow the manual steps below to enter credentials directly into the secure Vercel Dashboard.

---

## 1. Firebase Console Configuration (Step-by-Step)

### Step 1: Access Your EduLedger Firebase Project
1. Navigate to the [Firebase Console](https://console.firebase.google.com/).
2. Select your existing **EduLedger** project (or create one named `eduledger-production`).
3. Under **Project Overview**, note down your **Project ID** (e.g. `eduledger-prod-12345`).

### Step 2: Generate Web Push VAPID Key Pair
1. Click the **Settings (gear icon)** $\rightarrow$ **Project settings**.
2. Select the **Cloud Messaging** tab.
3. Scroll to **Web configuration** $\rightarrow$ **Web Push certificates**.
4. Click **Generate key pair**.
5. Copy the generated **Public key** string (this is your `NEXT_PUBLIC_FIREBASE_VAPID_KEY`).

### Step 3: Generate Service Account Credentials
1. In **Project settings**, select the **Service accounts** tab.
2. Ensure **Firebase Admin SDK** is selected.
3. Confirm that the service account has the **Firebase Cloud Messaging API Admin** role.
4. Click **Generate new private key** $\rightarrow$ Confirm **Generate key**.
5. Save the downloaded JSON file securely on your local computer.

---

## 2. Secure Environment Variables for Vercel

In your [Vercel Dashboard](https://vercel.com/gmsdesignstechs-projects/eduledger/settings/environment-variables):

### Recommended Configuration (Option A: 4 Discrete Variables)

| Variable Name | Environment Scope | Secret / Value Source | Purpose |
| :--- | :--- | :--- | :--- |
| **`NEXT_PUBLIC_FIREBASE_VAPID_KEY`** | **Production** (and Preview/Dev) | Public VAPID key from Cloud Messaging tab | Used by client browser to subscribe to Web Push |
| **`FIREBASE_PROJECT_ID`** | **Production** | `project_id` from your service account JSON | Target project for FCM v1 REST API requests |
| **`FIREBASE_CLIENT_EMAIL`** | **Production** | `client_email` from your service account JSON | OAuth2 JWT issuer identity |
| **`FIREBASE_PRIVATE_KEY`** | **Production** | `private_key` from your service account JSON | RSA private key used to sign RS256 assertions |

> [!TIP]
> When entering `FIREBASE_PRIVATE_KEY` in the Vercel Dashboard, paste the entire block including:
> `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`. EduLedger automatically handles literal newlines and escaped `\n` characters.

---

### Alternative Configuration (Option B: All-in-One JSON)

If you prefer to enter a single variable:

| Variable Name | Environment Scope | Value Source | Purpose |
| :--- | :--- | :--- | :--- |
| **`NEXT_PUBLIC_FIREBASE_VAPID_KEY`** | **Production** | Public VAPID key | Client Web Push subscription |
| **`FIREBASE_SERVICE_ACCOUNT_KEY`** | **Production** | Entire content of the downloaded service account JSON | Auto-extracts project ID, client email, and private key |

---

## 3. Post-Configuration Activation Verification

Once the variables are saved in Vercel:
1. Log in to EduLedger as a School Administrator.
2. Go to **Institution Settings** $\rightarrow$ **PWA & Push Diagnostics** ([`/dashboard/settings/pwa`](https://eduledger.co.in/dashboard/settings/pwa)).
3. Verify that item 6 shows:
   * **Firebase Cloud Messaging**: `PASS · Configured`
4. Verify item 5 shows:
   * **OAuth Authentication Status**: `PASS`
5. Click **Request Device Push Permission** to register your current browser.
6. Click **Send Controlled Test Push** to confirm instant delivery to your device.

