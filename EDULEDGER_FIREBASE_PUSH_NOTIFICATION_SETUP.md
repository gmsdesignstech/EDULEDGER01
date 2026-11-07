# EDULEDGER — FIREBASE CLOUD MESSAGING (WEB PUSH) SETUP GUIDE

This technical guide walks school administrators and DevOps engineers through setting up native web push notifications using **Firebase Cloud Messaging (FCM HTTP v1 API)**.

> [!NOTE]
> **Optional Configuration Guarantee**: Firebase Web Push is completely optional. If these environment variables are omitted, EduLedger operates normally without error—in-app notifications and WhatsApp broadcasts remain 100% active.

---

## 1. Firebase Project Setup

1. Open the [Firebase Console](https://console.firebase.google.com).
2. Click **Add project** (or select your existing EduLedger Google Cloud project).
3. Name your project (e.g., `eduledger-production`) and complete the creation steps.

---

## 2. Generate the Public Web Push VAPID Key

1. In the Firebase Console, click the gear icon ⚙️ next to **Project Overview** $\rightarrow$ select **Project settings**.
2. Switch to the **Cloud Messaging** tab.
3. Scroll down to the **Web configuration** section.
4. Under **Web Push certificates**, click **Generate key pair**.
5. Copy the generated **Key pair** string. This is your public VAPID key (`NEXT_PUBLIC_FIREBASE_VAPID_KEY`).

---

## 3. Generate Service Account Key (Server-Side Secret)

1. In **Project settings**, click the **Service accounts** tab.
2. Ensure **Firebase Admin SDK** is selected.
3. Click the blue **Generate new private key** button $\rightarrow$ confirm by clicking **Generate key**.
4. A JSON file will download to your computer. Open it in a text editor to view:
   * `project_id`
   * `client_email`
   * `private_key` (starts with `-----BEGIN PRIVATE KEY-----`)

---

## 4. Configure Vercel Environment Variables

In your Vercel Dashboard:
1. Navigate to your project: `eduledger` $\rightarrow$ **Settings** $\rightarrow$ **Environment Variables**.
2. Add the following environment variables for the **Production** (and Preview) environments:

| Variable Name | Exposure | Description / Source |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_FIREBASE_VAPID_KEY` | Public (Client) | The Web Push certificate key pair generated in Step 2. |
| `FIREBASE_PROJECT_ID` | Secret (Server only) | Value of `project_id` from the downloaded service account JSON. |
| `FIREBASE_CLIENT_EMAIL` | Secret (Server only) | Value of `client_email` from the downloaded service account JSON. |
| `FIREBASE_PRIVATE_KEY` | Secret (Server only) | Value of `private_key` (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`). |

> [!CAUTION]
> **Security Rules**:
> 1. Never add `NEXT_PUBLIC_` to `FIREBASE_PRIVATE_KEY` or `FIREBASE_CLIENT_EMAIL`.
> 2. Ensure newlines in `FIREBASE_PRIVATE_KEY` are either literal or escaped as `\n`—EduLedger handles both automatically.
> 3. Never commit the service account JSON file to Git.

---

## 5. Verifying Push Notification Health

1. Log into EduLedger as an administrator (`https://eduledger.co.in/dashboard/settings`).
2. Click **PWA & Push Diagnostics** (or navigate to `/dashboard/settings/pwa`).
3. Verify that item 6 shows:
   * **Firebase Credentials**: `PASS · Configured`
4. Use the **Test Service Worker Registration** and **Request Device Push Permission** buttons to test immediate device enrollment.
