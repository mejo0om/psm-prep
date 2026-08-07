# Password Recovery Setup

The website includes:

- `forgot-password.html` — sends the recovery email.
- `reset-password.html` — accepts the recovery session and saves a new password.
- A **Forgot password?** link on `login.html`.

## Required Supabase URL configuration

In Supabase, open **Authentication → URL Configuration**.

Set the production Site URL to:

```text
https://mejo0om.github.io/psm-prep/
```

Add this Redirect URL:

```text
https://mejo0om.github.io/psm-prep/reset-password.html
```

For local testing, optionally add:

```text
http://localhost:5500/reset-password.html
http://127.0.0.1:5500/reset-password.html
```

No SQL migration is required for password recovery because it uses Supabase Authentication.
