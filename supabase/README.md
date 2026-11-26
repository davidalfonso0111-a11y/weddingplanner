# Belles Creators · Atelier server (Supabase)

The atelier (`/atelier.html`) runs as a local demo until `assets/config.js` holds a Supabase URL and anon key. Then it switches to real accounts.

## Setup

1. Auth → Providers → Email: turn **off** "Allow new users to sign up". Accounts are created by the owner only.
2. Auth → URL Configuration: add the atelier URLs (Vercel and GitHub Pages, path `/atelier.html`) as redirect URLs, for "Wachtwoord vergeten".
3. Run `migrations/20261126000000_atelier.sql` (SQL editor or `supabase db push`).
4. Deploy the edge function: `supabase functions deploy invite-staff`.
5. Create the owner: Auth → Users → Add user (auto-confirm). The **first** user always becomes owner.
6. Fill `url` and `anonKey` in `assets/config.js` (the anon key is public; security comes from Row Level Security).

## How it works

- Login: e-mail + wachtwoord, then the person chooses a 4-digit PIN. Next time on that device the atelier opens with the PIN (stored only as a bcrypt hash on the server). 5 wrong PINs remove the PIN; then e-mail + wachtwoord again. "Afmelden" locks the atelier (PIN next time); "Inloggen met e-mail en wachtwoord" signs out fully.
- The "Gouden glans" intro plays after every successful login and PIN unlock.
- Owner adds team members (name, e-mail, department, temporary password) in Team & toegang; can deactivate accounts and reset PINs.
- Shared atelier data (weddings, tasks, planning, catering, …) lives in one row `atelier_state`, readable and writable by every active team member, with a version check against overwrites.
- Atelier (maquette-studio): table `maquettes` (pages as JSON) and private bucket `maquettes` (photos and painted layers), owner only (not admin). Run `migrations/20261127010000_maquettes_owner_only.sql` (it also covers the earlier maquettes file).
- Documents (contracts, NDA's, agreements, policies) are in the private storage bucket `documents`, readable only by the owner; files open through 60-second signed links.

## Known limits

- Department access toggles hide pages in the app but all staff can read the shared data through the API. Finance and client data are not yet split per department on the server.
