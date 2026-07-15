-- Retire all MedGuard builds below versionCode 2 (the old v1.0.0 / build-1 APKs).
--
-- RUN THIS ONLY AFTER a build-2 (v1.1.0) APK is installed on the phones that
-- should keep working. It force-blocks every build with versionCode < 2 the next
-- time that build is online. Build 2 and above pass.
--
-- Reversible: set min_supported_build back to 1 (or force_update = false) to lift.

update public.app_version_policy
   set min_supported_build = 2,
       latest_build        = 2,
       force_update        = true,
       -- Optional: a link where friends can grab the new build (Play Store,
       -- Expo internal-distribution URL, Drive link, etc.). Leave '' if none.
       update_url          = '',
       message             = 'This is an old test build of MedGuard and is no longer supported. Please install the latest version to continue.',
       updated_at          = now()
 where platform in ('android', 'ios');

-- Verify:
-- select platform, min_supported_build, latest_build, force_update, message from public.app_version_policy;
