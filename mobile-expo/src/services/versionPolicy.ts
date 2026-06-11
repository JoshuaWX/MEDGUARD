import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { supabase, supabaseConfigured } from './supabase';
import { toUserMessage } from './errorMessages';

export type VersionPolicyResponse = {
  platform: 'android' | 'ios';
  min_supported_build: number;
  latest_build: number;
  force_update: boolean;
  update_url: string;
  message: string;
};

export type VersionGateResult =
  | { status: 'allowed'; currentBuild: number; policy?: VersionPolicyResponse; softUpdate?: boolean }
  | { status: 'blocked'; currentBuild: number; policy: VersionPolicyResponse }
  | { status: 'check_failed'; currentBuild: number; message: string };

const parseBuild = (value: string | null | undefined) => {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : 1;
};

export function getCurrentBuildNumber() {
  const expoAndroidVersionCode = (Constants.expoConfig as any)?.android?.versionCode;
  const expoIosBuildNumber = (Constants.expoConfig as any)?.ios?.buildNumber;
  return parseBuild(
    Platform.OS === 'ios'
      ? Application.nativeBuildVersion || expoIosBuildNumber
      : Application.nativeBuildVersion || expoAndroidVersionCode
  );
}

export async function checkVersionPolicy(): Promise<VersionGateResult> {
  const currentBuild = getCurrentBuildNumber();

  if (!supabaseConfigured) {
    return { status: 'check_failed', currentBuild, message: toUserMessage(null, 'version') };
  }

  try {
    const { data, error } = await supabase.functions.invoke('app-version', {
      body: {
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        build: currentBuild,
        version: Constants.expoConfig?.version || Application.nativeApplicationVersion || '1.0.0',
      },
    });

    if (error || !data) {
      return { status: 'check_failed', currentBuild, message: toUserMessage(error, 'version') };
    }

    const policy = data as VersionPolicyResponse;
    const blocked = Boolean(policy.force_update) && currentBuild < Number(policy.min_supported_build || 0);
    if (blocked) {
      return { status: 'blocked', currentBuild, policy };
    }

    return {
      status: 'allowed',
      currentBuild,
      policy,
      softUpdate: currentBuild < Number(policy.latest_build || 0),
    };
  } catch (error) {
    return { status: 'check_failed', currentBuild, message: toUserMessage(error, 'version') };
  }
}
