import React from 'react';
import { ForceUpdateView } from './PremiumUI';
import { checkVersionPolicy, VersionGateResult } from '../services/versionPolicy';

/**
 * VersionGate — non-blocking.
 *
 * The version check runs invisibly in the background: the app renders
 * immediately (children) while it resolves, so there's no "Checking MedGuard"
 * screen. Only if the policy comes back `blocked` do we replace the UI with the
 * force-update screen (appears a moment after launch, if ever).
 */
export default function VersionGate({ children }: { children: React.ReactNode }) {
  const [result, setResult] = React.useState<VersionGateResult | null>(null);

  React.useEffect(() => {
    let mounted = true;
    checkVersionPolicy().then((next) => {
      if (mounted) setResult(next);
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (result?.status === 'blocked') {
    return (
      <ForceUpdateView
        message={result.policy.message}
        updateUrl={result.policy.update_url}
        latestBuild={result.policy.latest_build}
      />
    );
  }

  return <>{children}</>;
}
