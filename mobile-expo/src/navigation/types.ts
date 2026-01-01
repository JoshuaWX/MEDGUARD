/**
 * MedGuard Navigation Types
 */

export type RootStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
  SignUp2: undefined;
  MainTabs: undefined;
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
