/**
 * useAuthGate
 * Hook for gating features based on authentication state.
 * Provides helpers to check auth status and show the auth modal.
 *
 * Usage:
 * const { isGuest, requireAuth, AuthGateModalComponent } = useAuthGate();
 *
 * // Check before action
 * const handleSave = () => {
 *   if (requireAuth('saving health data')) return;
 *   // ... proceed with save
 * };
 *
 * // Render modal at bottom of component
 * return (
 *   <>
 *     {content}
 *     <AuthGateModalComponent />
 *   </>
 * );
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from './useAuth';
import AuthGateModal from '../components/AuthGateModal';

interface AuthGateOptions {
  /** Feature name for modal message customization */
  feature?: string;
  /** Custom modal title */
  title?: string;
  /** Custom modal message */
  message?: string;
}

interface UseAuthGateReturn {
  /** Whether the current user is a guest (not authenticated) */
  isGuest: boolean;
  /** Whether the current user is authenticated */
  isAuthenticated: boolean;
  /**
   * Checks if user is authenticated. If not, shows auth gate modal.
   * @returns true if auth is required (user is guest), false if authenticated
   */
  requireAuth: (featureOrOptions?: string | AuthGateOptions) => boolean;
  /** Shows the auth gate modal with optional customization */
  showAuthGate: (options?: AuthGateOptions) => void;
  /** Hides the auth gate modal */
  hideAuthGate: () => void;
  /** Whether the auth gate modal is currently visible */
  authGateVisible: boolean;
  /** Pre-configured modal component - render at bottom of your component */
  AuthGateModalComponent: React.FC;
}

export const useAuthGate = (): UseAuthGateReturn => {
  const { user, session, isGuest } = useAuth();
  const [visible, setVisible] = useState(false);
  const [modalOptions, setModalOptions] = useState<AuthGateOptions>({});

  // User is authenticated if they have a session/user and are not in guest mode
  const isAuthenticated = Boolean(user || session) && !isGuest;

  const showAuthGate = useCallback((options: AuthGateOptions = {}) => {
    setModalOptions(options);
    setVisible(true);
  }, []);

  const hideAuthGate = useCallback(() => {
    setVisible(false);
  }, []);

  /**
   * Check if authentication is required. Shows modal if user is a guest.
   * @returns true if user is a guest (action should be blocked)
   */
  const requireAuth = useCallback(
    (featureOrOptions?: string | AuthGateOptions): boolean => {
      if (isAuthenticated) {
        return false; // User is authenticated, no block needed
      }

      // Parse options
      const options: AuthGateOptions =
        typeof featureOrOptions === 'string'
          ? { feature: featureOrOptions }
          : featureOrOptions || {};

      showAuthGate(options);
      return true; // User is guest, block the action
    },
    [isAuthenticated, showAuthGate]
  );

  // Pre-configured modal component
  const AuthGateModalComponent = useMemo(() => {
    const ModalWrapper: React.FC = () => (
      <AuthGateModal
        visible={visible}
        onClose={hideAuthGate}
        feature={modalOptions.feature}
        title={modalOptions.title}
        message={modalOptions.message}
      />
    );
    return ModalWrapper;
  }, [visible, hideAuthGate, modalOptions]);

  return {
    isGuest,
    isAuthenticated,
    requireAuth,
    showAuthGate,
    hideAuthGate,
    authGateVisible: visible,
    AuthGateModalComponent,
  };
};

export default useAuthGate;
