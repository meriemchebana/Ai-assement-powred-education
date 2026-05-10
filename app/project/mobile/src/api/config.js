import { Platform } from 'react-native';

// Change this one URL when deploying

const PRODUCTION_URL = 'https://your-server.com/api/v1';
// const LOCAL_URL = Platform.select({
//   android: 'http://10.0.2.2:8000/api/v1',
//   ios: 'http://localhost:8000/api/v1',
//   default: 'http://localhost:8000/api/v1',
// });

//Just for test
const LOCAL_URL = 'http://10.224.197.170:8000/api/v1';

// Switch between local and production
const IS_DEV = __DEV__;

export const API_BASE_URL = IS_DEV ? LOCAL_URL : PRODUCTION_URL;

