import { registerRootComponent } from 'expo';

// Expo must see the background task definition while the JavaScript bundle is
// loading. React providers are not mounted when the OS launches a headless task.
import './src/services/backgroundLocationTask';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
