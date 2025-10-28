/**
 * @format
 */

// Initialize Skia globally before any components load
import '@shopify/react-native-skia';
import { AppRegistry } from 'react-native';
import { name as appName } from './app.json';
import App from './src/App';

AppRegistry.registerComponent(appName, () => App);
