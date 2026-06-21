import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800;
const META_SUFFIX = '.__chunks';
const CHUNK_SUFFIX = '.__chunk_';

const secureOptions: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const metaKey = (key: string) => `${key}${META_SUFFIX}`;
const chunkKey = (key: string, index: number) => `${key}${CHUNK_SUFFIX}${index}`;

async function removeSecureValue(key: string): Promise<void> {
  const meta = await SecureStore.getItemAsync(metaKey(key), secureOptions);
  const count = Number(meta);

  if (Number.isInteger(count) && count > 0) {
    await Promise.all(
      Array.from({ length: count }, (_, index) =>
        SecureStore.deleteItemAsync(chunkKey(key, index), secureOptions)
      )
    );
  }

  await Promise.all([
    SecureStore.deleteItemAsync(metaKey(key), secureOptions),
    SecureStore.deleteItemAsync(key, secureOptions),
  ]);
}

/** Native Supabase auth storage. SecureStore is removed on Android uninstall. */
export const authStorage = {
  async getItem(key: string): Promise<string | null> {
    // Never migrate an old AsyncStorage auth token into secure storage. Removing
    // it prevents Android backup restore from reviving a previous account.
    await AsyncStorage.removeItem(key).catch(() => undefined);

    const meta = await SecureStore.getItemAsync(metaKey(key), secureOptions);
    const count = Number(meta);
    if (Number.isInteger(count) && count > 0) {
      const chunks = await Promise.all(
        Array.from({ length: count }, (_, index) =>
          SecureStore.getItemAsync(chunkKey(key, index), secureOptions)
        )
      );
      return chunks.every((chunk): chunk is string => typeof chunk === 'string')
        ? chunks.join('')
        : null;
    }

    // Supports a previous direct SecureStore value if the adapter changes.
    return SecureStore.getItemAsync(key, secureOptions);
  },

  async setItem(key: string, value: string): Promise<void> {
    await removeSecureValue(key);
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, 'gs')) ?? [''];

    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(chunkKey(key, index), chunk, secureOptions)
      )
    );
    await SecureStore.setItemAsync(metaKey(key), String(chunks.length), secureOptions);
  },

  async removeItem(key: string): Promise<void> {
    await Promise.all([
      removeSecureValue(key),
      AsyncStorage.removeItem(key).catch(() => undefined),
    ]);
  },
};
