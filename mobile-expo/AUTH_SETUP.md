# MedGuard Authentication Setup

This guide completes the external dashboard setup required by MedGuard's
Supabase email/password, password recovery, and Google sign-in code.

MedGuard uses Supabase Auth with PKCE and the `medguard` deep-link scheme.
Never put a Google client secret, SMTP password, Supabase secret key, or
service-role key in the Expo app or an `EXPO_PUBLIC_*` variable.

## What you need

- Access to the MedGuard Supabase project.
- A Google account for Google Cloud.
- A domain you control for production email, such as `yourdomain.com`.
- About 20-40 minutes. DNS verification can take longer.

## Part 1: Configure Supabase redirect URLs

1. Open the [MedGuard Supabase project](https://supabase.com/dashboard/project/cddfhyxlhtmrrtduwlqd).
2. In the left sidebar, select **Authentication**.
3. Open **URL Configuration**. You can also use the direct
   [URL Configuration page](https://supabase.com/dashboard/project/cddfhyxlhtmrrtduwlqd/auth/url-configuration).
4. For the current Android-only app, set **Site URL** to:

   ```text
   medguard://signin
   ```

5. Under **Redirect URLs**, add these three entries separately:

   ```text
   medguard://signin
   medguard://auth/callback
   medguard://google-auth
   ```

6. Save the changes.

Do not add the Supabase callback URL here. The URLs above are where Supabase is
allowed to return users inside the installed MedGuard app.

If MedGuard later gets a production website, use its HTTPS URL as the Site URL
and keep all three mobile URLs in the redirect allow list.

## Part 2: Create the Google Cloud project

1. Open the [Google Cloud Console](https://console.cloud.google.com/home/dashboard)
   and sign in.
2. Click the project selector at the top of the page.
3. Click **New Project**.
4. Enter `MedGuard` as the project name, create it, and make sure the new
   project is selected.
5. Open the [Google Auth Platform overview](https://console.cloud.google.com/auth/overview).
   Google may show a **Get started** button the first time.

### Configure Branding

Open [Google Auth Platform > Branding](https://console.cloud.google.com/auth/branding)
and fill in:

- **App name:** `MedGuard`
- **User support email:** an email you monitor
- **App logo:** optional during testing, recommended before release
- **Application home page:** your real website when available
- **Privacy policy:** a public HTTPS privacy-policy page before production
- **Terms of service:** a public HTTPS terms page before production
- **Developer contact email:** an email you monitor

Save the page. Google may require the domain used by the website/privacy links
to be listed under authorized domains and verified before publishing.

### Configure Audience

1. Open [Google Auth Platform > Audience](https://console.cloud.google.com/auth/audience).
2. Choose **External** because MedGuard users are not members of one Google
   Workspace organization.
3. Keep the app in **Testing** while setting it up.
4. Add your Gmail address and every tester's Google email under **Test users**.

While the app is in Testing, Google sign-in works only for listed test users.
Publish the app to Production later, after the consent screen and public policy
links are ready.

### Configure Data Access

Open [Google Auth Platform > Data Access](https://console.cloud.google.com/auth/scopes).
MedGuard needs only these basic identity scopes:

```text
openid
.../auth/userinfo.email
.../auth/userinfo.profile
```

The email and profile scopes are normally present already. Add `openid`
manually if it is missing. Do not add Gmail, Drive, health, or other sensitive
Google scopes; MedGuard only needs the user's identity.

### Make the consent screen show MedGuard

If Google displays `Sign in to <project-ref>.supabase.co`, complete the
**Branding** page with the MedGuard app name, logo, support email, homepage,
privacy policy, terms, and developer contact email. Add `medguardng.me` as the
authorized domain, then open **Verification Center** and submit the brand for
verification when the public pages are live. Google may take several business
days to approve branding changes.

Branding makes Google identify the app as MedGuard. Completely replacing the
random Supabase hostname in OAuth consent text requires a Supabase custom
domain. Custom domains are a paid add-on for projects on a paid Supabase plan.
Use:

```text
api.medguardng.me
```

Do not use `auth.medguardng.me` for Supabase because that subdomain is reserved
for Resend email authentication. Configure the custom domain under Supabase
**Project Settings > General > Custom Domains** and add the CNAME/TXT records
Supabase provides to Namecheap.

Before activating it, add both callback URLs to the Google Web OAuth client:

```text
https://cddfhyxlhtmrrtduwlqd.supabase.co/auth/v1/callback
https://api.medguardng.me/auth/v1/callback
```

After Supabase activates the custom domain, Auth advertises the branded callback
to Google. The original Supabase project domain remains operational.

## Part 3: Create Google OAuth clients

MedGuard should have a Web client and an Android client. The Web client owns
the secret and the Supabase callback. The Android client binds Google sign-in
to MedGuard's package and signing certificate.

Open [Google Auth Platform > Clients](https://console.cloud.google.com/auth/clients).

### Create the Web client

1. Click **Create client**.
2. Choose **Web application**.
3. Name it `MedGuard Supabase Web`.
4. Leave **Authorized JavaScript origins** empty for the current mobile-only
   app.
5. Under **Authorized redirect URIs**, add exactly:

   ```text
   https://cddfhyxlhtmrrtduwlqd.supabase.co/auth/v1/callback
   ```

6. Create the client.
7. Keep the displayed **Client ID** and **Client secret** available for the
   Supabase step. Do not put the secret in the mobile app.

Do not put `medguard://google-auth` into Google Cloud's redirect URI field.
Google returns to Supabase first; Supabase then returns to the app deep link.

### Create the Android client

1. Return to **Clients** and click **Create client** again.
2. Choose **Android**.
3. Name it `MedGuard Android`.
4. Enter this package name exactly:

   ```text
   com.medguard.ng
   ```

5. Enter the current debug SHA-1 fingerprint:

   ```text
   5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
   ```

6. Create the client and keep its **Client ID**.

The Android client has no client secret. The current local release build is
debug-signed, so the SHA-1 above is only for development. Before Play Store
release, create a private upload/release key, obtain its SHA-1, and create or
update the Android client with that production fingerprint.

To print fingerprints again locally:

```powershell
cd C:\dev-folder\MEDGUARD\mobile-expo\android
.\gradlew.bat signingReport
```

## Part 4: Enable Google in Supabase

1. Return to the MedGuard Supabase project.
2. Open **Authentication > Sign In / Providers**.
3. Select **Google**, or use the direct
   [Google provider page](https://supabase.com/dashboard/project/cddfhyxlhtmrrtduwlqd/auth/providers?provider=Google).
4. Enable the Google provider.
5. In **Client IDs**, enter the Web client ID first, followed by the Android
   client ID, separated by a comma:

   ```text
   WEB_CLIENT_ID.apps.googleusercontent.com,ANDROID_CLIENT_ID.apps.googleusercontent.com
   ```

6. In **Client Secret**, enter the secret from the Web client.
7. Leave **Skip nonce check** disabled.
8. Save.

The client IDs and secret are configured in Supabase, not in `.env` and not in
`app.json`.

## Part 5: Test Google sign-in

1. Confirm your Google email is listed as a Google Cloud test user.
2. Install the latest MedGuard debug APK.
3. Tap **Continue with Google**.
4. Select an account and approve the basic profile request.
5. Confirm the browser returns to MedGuard and the correct Google account is
   signed in.

Common errors:

- **redirect_uri_mismatch:** the Web client's authorized redirect URI is not
  the exact Supabase callback shown above.
- **Access blocked / app not verified:** the app is in Testing and the Google
  account is not listed under Test users.
- **Provider not enabled:** Google is not enabled or its client IDs/secret were
  not saved in Supabase.
- **App does not reopen:** one of the three `medguard://` URLs is missing from
  Supabase URL Configuration, or an old APK is installed.

## Part 6: Configure production email with Resend

### Recommended provider

Use [Resend](https://resend.com) for MedGuard's current stage. It has a direct
Supabase SMTP integration, a simple dashboard, and is easier to configure than
AWS SES. Postmark or AWS SES can be considered later when delivery volume and
operational requirements grow.

Supabase's built-in email service is for development only. It currently sends
only to pre-authorized project-team addresses and is heavily rate-limited, so
real signup and password-reset emails need custom SMTP.

### No-domain option: SendGrid Single Sender

If you do not own a domain yet, Twilio SendGrid can verify one individual
sender address such as `medguardng@gmail.com`. This is suitable for testing,
hackathon demos, and a small private pilot.

1. Create a [Twilio SendGrid](https://sendgrid.com) account.
2. Open **Settings > Sender Authentication**.
3. Under **Single Sender Verification**, click **Verify a Single Sender**.
4. Use `MedGuard` as the sender name and `medguardng@gmail.com` as the sender
   email. Complete the remaining contact fields truthfully.
5. Open the verification email sent to `medguardng@gmail.com` and confirm it.
6. In SendGrid, open **Settings > API Keys** and create an API key with Mail
   Send permission. Copy it once and keep it secret.
7. In Supabase, open **Authentication > Notifications > Email > SMTP
   Settings**, enable custom SMTP, and enter:

| Supabase field | SendGrid value |
| --- | --- |
| Sender email | `medguardng@gmail.com` |
| Sender name | `MedGuard` |
| Host | `smtp.sendgrid.net` |
| Port | `587` |
| Username | `apikey` (the literal word, not your email) |
| Password | Your SendGrid API key |

Save and test signup plus password recovery with a different email address.
Never put the SendGrid API key in the mobile app or `.env`.

Single Sender Verification does not provide the same branding, SPF/DKIM
alignment, or delivery reputation as an authenticated domain. Move to Resend
or SendGrid Domain Authentication before a broad public release. Recipients may
otherwise see `via sendgrid.net`, and delivery to spam folders is more likely.

### Temporary fallback: Gmail SMTP

If SendGrid blocks account or phone verification, MedGuard can temporarily
send Auth emails through `medguardng@gmail.com` itself. This is appropriate for
development and a small demo, not a broad public release.

1. Sign in to the `medguardng@gmail.com` Google account.
2. Open [Google Account Security](https://myaccount.google.com/security) and
   enable **2-Step Verification**.
3. Open [Google App Passwords](https://myaccount.google.com/apppasswords).
4. Create an app password named `MedGuard Supabase`.
5. Copy the generated 16-character password. Do not use the normal Gmail
   account password.
6. In Supabase, open **Authentication > Notifications > Email > SMTP
   Settings**, enable custom SMTP, and enter:

| Supabase field | Gmail value |
| --- | --- |
| Sender email | `medguardng@gmail.com` |
| Sender name | `MedGuard` |
| Host | `smtp.gmail.com` |
| Port | `465` |
| Username | `medguardng@gmail.com` |
| Password | The 16-character Google App Password |

Save and test signup plus Forgot Password with another email address. If Google
does not show the App Passwords page, confirm that 2-Step Verification is fully
enabled. App Passwords can also be unavailable for managed accounts, Advanced
Protection accounts, or some security-key-only configurations.

Gmail may throttle or filter automated messages and Google describes App
Passwords as a legacy compatibility mechanism. Replace this with authenticated
domain SMTP before MedGuard's public production launch.

### Add and verify a sending domain

1. Create a Resend account at [resend.com](https://resend.com).
2. In Resend, open **Domains** and click **Add Domain**.
3. Prefer a dedicated authentication subdomain, for example:

   ```text
   auth.yourdomain.com
   ```

4. Resend will show DNS records. Open the DNS dashboard at the company where
   your domain is managed and add every record exactly as Resend displays it.
5. Return to Resend and wait until the domain status becomes **Verified**.

This domain must be one you own. A Gmail/Yahoo address cannot be used as the
sender for production SMTP. Configure SPF, DKIM, and DMARC for good delivery;
Resend guides the SPF/DKIM portion during domain verification.

### Create the Resend API key

1. In Resend, open **API Keys**.
2. Create a key named `MedGuard Supabase Auth` with sending permission.
3. Copy the key immediately. It starts with `re_` and is shown only once.
4. Treat this key as a password. Never place it in the Expo app or commit it.

### Fill the Supabase SMTP form

1. Open the MedGuard Supabase project.
2. Go to **Authentication > Notifications > Email > SMTP Settings**, or use
   the direct [SMTP settings page](https://supabase.com/dashboard/project/cddfhyxlhtmrrtduwlqd/auth/smtp).
3. Enable custom SMTP and enter:

| Supabase field | Value |
| --- | --- |
| Sender email | `no-reply@auth.yourdomain.com` |
| Sender name | `MedGuard` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Your Resend API key beginning with `re_` |

Replace `yourdomain.com` with the verified domain you actually added to
Resend. The Sender email must belong to that verified domain.

4. Save the SMTP settings.
5. Open **Authentication > Rate Limits**. Supabase initially applies a low
   custom-SMTP limit (currently 30 messages per hour). Keep a conservative
   limit while testing and raise it only when needed.

### Test email delivery

1. Sign up using an email address that is not a member of the Supabase project.
2. Confirm the account-created screen appears and the confirmation email
   arrives.
3. Confirm the link reopens MedGuard and permits sign-in.
4. Use **Forgot password** and verify that the reset email and deep link work.
5. Check Spam/Promotions and Resend's Logs if an email does not arrive.

Do not disable email confirmation to work around delivery problems. Fix SMTP,
DNS, sender-domain, or rate-limit configuration instead.

## Part 7: Final Supabase Auth settings

In the Supabase Authentication settings:

- Keep email confirmation enabled.
- Set minimum password length to at least 10 characters.
- Enable leaked-password protection if the project plan supports it.
- Keep Google **Skip nonce check** disabled.
- Customize confirmation and password-recovery email templates with MedGuard
  wording, but preserve Supabase's confirmation/reset link variables.
- Add CAPTCHA before a public high-traffic launch to protect signup and email
  reputation.

## Completion checklist

- [ ] Supabase Site URL and three mobile redirect URLs saved
- [ ] Google Cloud project selected
- [ ] Branding, Audience, test users, and scopes configured
- [ ] Web OAuth client created with the Supabase callback
- [ ] Android OAuth client created for `com.medguard.ng`
- [ ] Google enabled in Supabase with both client IDs and Web secret
- [ ] Google login tested from the latest APK
- [ ] Resend sending domain verified
- [ ] Resend SMTP credentials saved in Supabase
- [ ] Signup confirmation email tested with a non-team address
- [ ] Password recovery tested end to end
- [ ] Production release key and SHA-1 configured before Play Store release

## Official references

- [Supabase Google Auth guide](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Supabase redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase custom domains](https://supabase.com/docs/guides/platform/custom-domains)
- [Supabase custom SMTP guide](https://supabase.com/docs/guides/auth/auth-smtp)
- [Google Auth Platform](https://console.cloud.google.com/auth/overview)
- [Resend Supabase SMTP guide](https://resend.com/docs/send-with-supabase-smtp)
- [SendGrid Single Sender Verification](https://www.twilio.com/docs/sendgrid/ui/sending-email/sender-verification)
- [SendGrid SMTP guide](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/getting-started-smtp)
- [Google App Passwords](https://support.google.com/accounts/answer/185833)
- [Google SMTP configuration](https://support.google.com/a/answer/176600)
