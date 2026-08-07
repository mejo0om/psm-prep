# Deployment Checklist

1. Run `supabase_auth_progress_migration.sql` in Supabase SQL Editor.
2. Keep Email confirmation enabled.
3. Confirm Site URL: `https://mejo0om.github.io/psm-prep/`.
4. Confirm redirect URLs include the GitHub Pages URL and local development URL.
5. Upload all files in this ZIP to the repository root and publish GitHub Pages.
6. Register a test account and confirm the email.
7. Test login, logout, forgot password, reset password, protected-page return URL, one practice answer, and one completed mock exam.
8. In Supabase, confirm the new rows contain the signed-in user ID.

Real delivery of confirmation/recovery emails depends on Supabase email settings and cannot be fully verified offline.
