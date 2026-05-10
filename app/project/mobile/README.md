# School Generator - Mobile App

React Native (Expo) mobile app for the School Generator platform.

## Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app on your phone (iOS/Android)
- Backend running on `http://localhost:8000`

## Installation

```bash
cd mobile
npm install




```
Running in Development
bash
npx expo start
Scan the QR code with Expo Go app on your phone.

Testing
On Physical Device
Ensure your phone and computer are on the same WiFi network

Update API_BASE_URL in src/api/client.js to your computer's local IP:

javascript
const API_BASE_URL = 'http://192.168.1.X:8000/api/v1';
Run npx expo start and scan QR code

On Android Emulator
bash
npx expo start --android
Uses http://10.0.2.2:8000 automatically.

On iOS Simulator
bash
npx expo start --ios
Uses http://localhost:8000 automatically.

Building for Production
Install EAS CLI
bash
npm install -g eas-cli
eas login
Configure Build
bash
eas build:configure
Build for Android (APK)
bash
eas build --platform android --profile preview
Build for iOS
bash
eas build --platform ios
Build APK for direct download
bash
eas build --platform android --profile production
Download the APK from the Expo dashboard and install on any Android phone.

Project Structure
text
mobile/
├── App.js                    # Entry point
├── app.json                  # Expo config
├── src/
│   ├── api/
│   │   └── client.js         # API functions
│   ├── context/
│   │   └── AuthContext.js    # Auth state
│   ├── screens/
│   │   ├── LoginScreen.js
│   │   ├── RegisterScreen.js
│   │   ├── SubjectsScreen.js
│   │   └── SubjectDetailScreen.js
│   └── navigation/
│       └── AppNavigator.js   # Stack navigator
Features
Teacher authentication (login/register)

Subject management (CRUD)

Courses, Practical Series, Theoretical Series, Exams

PDF upload and viewing

AI exam generation

Pull-to-refresh

text
That's all files! Run:

bash
cd mobile
npm install
npx expo start
Scan the QR code with Expo Go and test! 🎉

Test on your phone with Expo Go (Recommended)
It works without Android SDK.

bash
# Just start Expo normally
npx expo start
Then:

Install Expo Go app from Play Store/App Store on your phone

Make sure your phone and computer are on same WiFi

Scan the QR code that appears in terminal

The app opens instantly!

Option 2: Test in web browser
bash
npx expo start --web
This runs the app in your browser.


```