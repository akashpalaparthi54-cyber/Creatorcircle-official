# CreatorCircle — deployment-ready starter

A simple Node.js community MVP for Telugu + English YouTube creators.

## Deploy on Render (phone-friendly)
1. Create a NEW GitHub repository named `CreatorCircle`.
2. Upload the contents of this folder. The repository root must contain:
   - `package.json`
   - `server.js`
   - `render.yaml`
   - `public/index.html`
3. Commit the files.
4. Open https://render.com and sign in with GitHub.
5. Choose **New + → Blueprint** (recommended) and select this repository.
   - If Blueprint is unavailable, choose **New + → Web Service**, select the repo, set Runtime `Node`, Build Command `npm install`, Start Command `npm start`.
6. Set environment variables:
   - `ADMIN_PASSWORD` = a strong private password you choose
   - `UPI_ID` = your own UPI ID
7. Deploy. Open the generated `onrender.com` URL.

## Health check
Open `/health` on the deployed site. It should return `{"ok":true,"app":"CreatorCircle"}`.

## Important limitations
- This starter deliberately uses only Node's built-in modules and a single HTML file to keep deployment simple and avoid native dependencies.
- Data is held in server memory for this first demo. Users, sessions and payment requests reset when the server restarts/redeploys, and the free service may sleep. Before accepting real payments or launching publicly, connect a persistent database (such as Render PostgreSQL) and add proper payment verification.
- UPI payment is manual: users submit a transaction reference; an admin must verify the payment in their UPI app/bank before approving. Never approve based only on a typed reference.
- Default admin password is only a fallback for local testing. Set `ADMIN_PASSWORD` in Render before sharing the site.
- This is an MVP, not a production-secure paid-membership platform. Do not collect sensitive personal information.
- The app does not implement sub-for-sub.
