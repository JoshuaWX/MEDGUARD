/**
 * MedGuard Navigation Types
 */

import type { NavigatorScreenParams } from '@react-navigation/native';
import type { HealthPost } from '../hooks/useHealthFeed';

export type RootStackParamList = {
  Welcome: undefined;
  SignIn: { mode?: 'resetPassword' } | undefined;
  SignUp: undefined;
  SignUp2: undefined;
  MainTabs: NavigatorScreenParams<MainTabParamList> | undefined;
  Chatbot: undefined;
  Alerts: undefined;
  Settings: undefined;
  BrainReport: undefined;
  CycleTracker: undefined;
  HealthNews: undefined;
  HealthPost: { post?: HealthPost; postId?: string };
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
