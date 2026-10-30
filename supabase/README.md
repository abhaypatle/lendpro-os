# Supabase API key service

This app keeps API key administration and API-key verification on Supabase Edge
Functions. The browser only receives the Supabase project URL and publishable
(or legacy anon) key. Never add a service-role key, an API key, or other server
secret to a `VITE_` variable.

## Setup

1. Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and
   `VITE_SUPABASE_ANON_KEY`. These are public client configuration values.
2. Link this project to the intended Supabase project with the Supabase CLI and
   apply the migration:

   ```powershell
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   ```

3. Configure the exact browser origin that serves this app. For local Vite,
   this is commonly `http://localhost:5173`; use the deployed HTTPS origin in
   production:

   ```powershell
   supabase secrets set APP_ORIGIN=https://your-lendpro.example
   ```

   Supabase supplies `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to Edge
   Functions. Do not copy the service-role key into this repository or frontend
   environment.
4. Create an owner account in Supabase Auth. Set that user's
   `app_metadata.role` to `owner` using a trusted administrative process
   (`auth.admin.updateUserById` from a server using the service-role key).
   Never authorize based on editable `user_metadata`. The app's demo PIN login
   is separate and does not grant API-key administration rights.
5. Deploy the functions:

   ```powershell
   supabase functions deploy api-keys
   supabase functions deploy protected-resource
   ```

6. Restart/rebuild the Vite app, then open Admin → API keys and sign in with
   the Supabase Auth owner account.

## API

`api-keys` requires a valid Supabase Auth bearer token and checks the user's
server-controlled `app_metadata.role` on every request.

- `GET /functions/v1/api-keys` lists active key metadata only.
- `POST /functions/v1/api-keys` accepts `{ "client_name": "...", "role_scope":
  "read_only" | "agent" | "admin" }`. It returns the generated plain key once.
- `DELETE /functions/v1/api-keys` accepts `{ "id": "<uuid>" }` and revokes that
  key immediately.

The key management UI displays the returned value only in transient component
state and provides a copy button. The database stores only its SHA-256 digest.
Revoked keys are retained as inactive audit records.

`protected-resource` is a small example of protecting an API endpoint. Send
`x-api-key: devman_live_sk_<64 lowercase hex characters>`. The shared
`authenticateApiKey` helper validates the digest, active state, per-minute rate
limit, and last-used timestamp, then attaches `authRole` and `apiKeyId` to the
request object. Use that role on each protected route to authorize operations;
authentication alone is not authorization. Replace the sample response with
application endpoints and their resource-specific checks before production.

The SQL migration enables RLS without client policies, so the browser cannot
read or mutate key records. Edge Functions use the server-only service role
after performing owner authentication. Rate-limit counters are incremented
atomically in PostgreSQL with one-minute windows.
