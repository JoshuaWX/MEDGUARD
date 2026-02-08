/**
 * MedGuard Navigation Types
 */

import type { NavigatorScreenParams } from '@react-navigation/native';

export type RootStackParamList = {
  Welcome: undefined;
  SignIn: { mode?: 'resetPassword' } | undefined;
  SignUp: undefined;
  SignUp2: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Chatbot: undefined;
  Alerts: undefined;
  Settings: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  Map: undefined;
  MyHealth: undefined;
  Profile: undefined;
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
