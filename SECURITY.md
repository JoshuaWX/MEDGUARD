# Security

MedGuard is a proprietary prototype handling sensitive account, location, and personal-health data. Please do not publish or disclose vulnerabilities publicly before we have had an opportunity to investigate.

Report a suspected issue privately to the repository owner through GitHub or the project’s private contact channel. Include the affected component, reproduction steps, impact, and a safe way to follow up. Do not include real user data, access tokens, service-role keys, or other credentials in an issue.

## Development rules

- Keep secrets in Supabase secrets, GitHub Actions secrets, or local ignored `.env` files.
- Treat Expo client keys as public identifiers; restrict them to the MedGuard package and signing certificate.
- Never commit service-role keys, database passwords, provider credentials, callback secrets, or private health exports.
- Keep RLS enabled and test anonymous, owner, and cross-user access before changing personal tables.
- Rotate any credential that appears in a terminal, screenshot, build artifact, or Git history.

The repository history was cleaned for the Release-4 publication. If you cloned an earlier copy, delete it and clone the rewritten history again.
