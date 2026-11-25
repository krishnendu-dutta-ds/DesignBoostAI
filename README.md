# DesignBoost AI

A browser-based workspace for creating and managing design systems, including color palettes, typography, spacing, components, and design tokens.

Live site: https://design-boost-ai.vercel.app/

Sign in with Google to store projects in Firebase Cloud Firestore. A local browser copy is retained, and projects already saved in the browser are migrated to your account the first time the workspace connects. Projects can also be imported from or exported to JSON.

## Getting started

Requires Node.js.

```bash
npm install
npm run dev
```

## Firebase setup

1. In Firebase project `designboostai-8225e`, enable Google under **Authentication → Sign-in method** and add `design-boost-ai.vercel.app` under **Authorized domains**.
2. Register a Firebase Web App and copy its web configuration.
3. Add these environment variables in the Vercel project settings for Production, Preview, and Development:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_APP_ID`
4. For local development, copy `.env.example` to `.env.local` and fill in the same values.
5. Deploy the rules in `firestore.rules` with the Firebase CLI: `firebase deploy --only firestore:rules --project designboostai-8225e`.

The existing Firestore database is in `eur3` (Europe multi-region). Documents are stored at `users/{uid}/projects/{projectId}`. Rules restrict access to the signed-in owner. When Firebase first loads, remote projects take precedence for matching IDs and unique projects from the local browser are copied to Firestore.

## Vercel deployment

Vercel detects the Vite app and builds it with `npm run build`, serving the `dist` directory. The `vercel.json` rewrite supports direct visits to client-side routes.

Create a production build with:

```bash
npm run build
```
