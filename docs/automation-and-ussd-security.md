# Automation and USSD security operations

## Required secrets

Keep the following values only in Supabase secrets/Vault. Never commit or paste
them into source code, logs, tickets, or the simulator file.

| Purpose | Supabase Edge Function secret | Supabase Vault secret |
| --- | --- | --- |
| Scheduled notification jobs | `NOTIFY_CRON_SECRET` | `notify_cron_secret` |
| Africa's Talking USSD callback | `USSD_CALLBACK_SECRET` | `ussd_callback_secret` (secure provider-config handoff only) |

Both values must be independently generated high-entropy strings of at least
32 characters. The notification secret must have the exact same value in the
Edge Function secret store and Vault.

## Deployment order

1. Generate new secrets in an approved password manager or local secure tool.
2. Set `NOTIFY_CRON_SECRET` for the four dispatch Edge Functions and update the
   Vault `notify_cron_secret` to the same value. Confirm only that both are set;
   do not reveal their values.
3. Set `USSD_CALLBACK_SECRET` for the `ussd` Edge Function and store the same
   value as Vault secret `ussd_callback_secret`. Retrieve it only in an
   administrator-controlled Supabase dashboard session when configuring the
   provider; do not paste it into chat or source control.
4. Deploy the five protected Edge Functions and apply migration
   `034_secure_automation_and_ussd.sql`.
5. Update the Africa's Talking callback URL immediately to:

   ```text
   https://cddfhyxlhtmrrtduwlqd.functions.supabase.co/ussd?callback_secret=<USSD_CALLBACK_SECRET>
   ```

6. Test one valid USSD session and the scheduled jobs. Use the complete URL in
   `tools/ussd-simulator.html`; treat it like a password.

## Rotation

For `NOTIFY_CRON_SECRET`, update the Edge Function secret and Vault value as a
single maintenance action, then verify the next scheduled job succeeds.

For `USSD_CALLBACK_SECRET`, set the new Edge Function secret first, then update
Africa's Talking’s callback URL immediately. A missed provider update will
cause USSD calls to fail closed rather than write data.

Do not use `supabase db push` until the production migration history has been
reconciled with this repository. Apply reviewed, targeted migrations only.
