type ErrorContext =
  | 'auth'
  | 'signup'
  | 'signin'
  | 'chat'
  | 'location'
  | 'facilities'
  | 'checkin'
  | 'profile'
  | 'upload'
  | 'notifications'
  | 'version'
  | 'general';

const normalized = (value: unknown) => {
  if (!value) return '';
  if (typeof value === 'string') return value.toLowerCase();
  const err = value as any;
  return String(err?.hint || err?.message || err?.error_description || err?.error || '').toLowerCase();
};

export function toUserMessage(error: unknown, context: ErrorContext = 'general'): string {
  const message = normalized(error);

  if (!message) return fallbackFor(context);
  if (message.includes('cancelled') || message.includes('aborted')) return '';

  if (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('internet') ||
    message.includes('failed to fetch') ||
    message.includes('network request failed')
  ) {
    return 'Your internet connection looks unstable. Please check your network and try again.';
  }

  if (message.includes('timed out') || message.includes('timeout')) {
    return 'This is taking longer than expected. Please try again in a moment.';
  }

  if (message.includes('status=429') || message.includes('rate limit') || message.includes('too many')) {
    return context === 'chat'
      ? "You've reached your chat limit for now. Please wait a bit before trying again."
      : 'Too many attempts in a short time. Please wait a moment and try again.';
  }

  if (message.includes('status=401') || message.includes('jwt') || message.includes('unauthorized')) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  if (message.includes('status=503') || message.includes('status=502') || message.includes('status=504')) {
    return context === 'chat'
      ? 'MedGuard AI is busy right now. Please try again in a moment.'
      : 'MedGuard services are temporarily busy. Please try again shortly.';
  }

  if (message.includes('invalid login') || message.includes('invalid credentials')) {
    return 'The email or password is incorrect. Please check and try again.';
  }

  if (
    message.includes('session mismatch') ||
    message.includes('session_invalid') ||
    message.includes('session could not be verified') ||
    message.includes('did not match the requested account')
  ) {
    return 'We could not verify this sign-in safely. Please try again.';
  }

  if (message.includes('provider is not enabled') || message.includes('unsupported provider')) {
    return 'Google sign-in is not configured yet. Please use email and password for now.';
  }

  if (message.includes('oauth') || message.includes('google sign-in')) {
    return 'Google sign-in could not be completed. Please try again.';
  }

  if (message.includes('email not confirmed') || message.includes('confirm your email')) {
    return 'Please confirm your email address before signing in.';
  }

  if (message.includes('already registered') || message.includes('user already registered')) {
    return 'An account already exists with this email. Try signing in instead.';
  }

  if (message.includes('password') && (message.includes('weak') || message.includes('short'))) {
    return 'Please choose a stronger password before continuing.';
  }

  if (message.includes('permission') && message.includes('location')) {
    return 'Location permission is off. Enable it to see health alerts near you.';
  }

  if (message.includes('gps') || message.includes('location unavailable') || message.includes('determine current location')) {
    return 'We could not read your current location. Check GPS and try again.';
  }

  if (message.includes('storage') || message.includes('upload') || message.includes('avatar')) {
    return 'We could not upload that image. Please try a smaller photo or try again.';
  }

  if (message.includes('supabase is not configured') || message.includes('credentials not configured')) {
    return 'MedGuard is missing its app configuration. Restart the app after the correct environment is set.';
  }

  return fallbackFor(context);
}

function fallbackFor(context: ErrorContext): string {
  switch (context) {
    case 'signin':
      return 'We could not sign you in. Please check your details and try again.';
    case 'signup':
      return 'We could not create your account right now. Please review your details and try again.';
    case 'chat':
      return 'MedGuard AI could not respond right now. Please try again.';
    case 'location':
      return 'We could not update your location. Please check GPS and try again.';
    case 'facilities':
      return 'We could not load nearby clinics and pharmacies. Please try again.';
    case 'checkin':
      return 'We could not save your check-in. Please try again.';
    case 'profile':
      return 'We could not update your profile. Please try again.';
    case 'upload':
      return 'We could not upload your file. Please try again.';
    case 'notifications':
      return 'We could not update your notification settings. Please try again.';
    case 'version':
      return 'We could not check for updates right now.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
