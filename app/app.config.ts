// app.config.ts

import "dotenv/config";
import type { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  const googleMapsApiKey =
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    "";

  if (!googleMapsApiKey) {
    console.warn(
      "GOOGLE_MAPS_API_KEY is missing. Native Google Maps may not work."
    );
  }

  return {
    ...config,

    name: "Farm2Home",
    slug: "farm2home",
    owner: "audreyitpro",

    version: "1.0.0",
    orientation: "portrait",
    scheme: "farm2home",

    icon: "./assets/images/farm2home-logo.png",
    backgroundColor: "#F7F7F2",
    primaryColor: "#166534",

    userInterfaceStyle: "automatic",

    plugins: [
      "expo-router",
      "expo-sqlite",
      "expo-image-picker",
      "expo-web-browser",

      [
        "expo-splash-screen",
        {
          image: "./assets/images/farm2home-logo.png",
          imageWidth: 220,
          resizeMode: "contain",
          backgroundColor: "#F7F7F2",
          dark: {
            image: "./assets/images/farm2home-logo.png",
            backgroundColor: "#07150D",
          },
        },
      ],

      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Farm2Home uses your location to show nearby farms, calculate delivery routes, and support live delivery tracking.",

          locationAlwaysAndWhenInUsePermission:
            "Farm2Home uses background location while an active delivery is in progress so customers and dispatchers can track delivery status.",

          isIosBackgroundLocationEnabled: true,
          isAndroidBackgroundLocationEnabled: true,
          isAndroidForegroundServiceEnabled: true,

          androidForegroundServiceIcon:
            "./assets/images/notification-icon.png",
        },
      ],

      [
        "expo-notifications",
        {
          icon: "./assets/images/notification-icon.png",
          color: "#166534",
          defaultChannel: "farm2home-updates",
          enableBackgroundRemoteNotifications: true,
        },
      ],
    ],

    ios: {
      supportsTablet: true,

      bundleIdentifier: "com.asodevelopments.farm2home",
      buildNumber: "1",

      icon: "./assets/images/farm2home-logo.png",

      config: {
        googleMapsApiKey,
      },

      infoPlist: {
        NSLocationWhenInUseUsageDescription:
          "Farm2Home uses your location to show nearby farms and support pickup and delivery routing.",

        NSLocationAlwaysAndWhenInUseUsageDescription:
          "Farm2Home uses background location only while an active delivery is being tracked.",

        NSLocationAlwaysUsageDescription:
          "Farm2Home uses background location only while an active delivery is being tracked.",

        NSPhotoLibraryUsageDescription:
          "Farm2Home uses photo access for profile images, farm products, compliance documents, and proof of delivery.",

        NSCameraUsageDescription:
          "Farm2Home uses the camera for profile images, product photos, compliance documents, and proof of pickup or delivery.",

        NSMicrophoneUsageDescription:
          "Farm2Home uses microphone access only when recording supported audio messages.",

        NSUserNotificationsUsageDescription:
          "Farm2Home sends order, delivery, freight, payment, and account notifications.",

        ITSAppUsesNonExemptEncryption: false,
      },
    },

    android: {
      package: "com.asodevelopments.farm2home",
      versionCode: 1,

      icon: "./assets/images/farm2home-logo.png",

      adaptiveIcon: {
        foregroundImage: "./assets/images/farm2home-logo.png",
        backgroundColor: "#F7F7F2",
      },

      permissions: [
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_BACKGROUND_LOCATION",
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.POST_NOTIFICATIONS",
        "android.permission.FOREGROUND_SERVICE",
        "android.permission.FOREGROUND_SERVICE_LOCATION",
      ],

      config: {
        googleMaps: {
          apiKey: googleMapsApiKey,
        },
      },

      softwareKeyboardLayoutMode: "resize",
    },

    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/farm2home-logo.png",
    },

    extra: {
      eas: {
        projectId: "04912a96-3223-40b8-a8ae-fba4424db741",
      },

      apiBaseUrl:
        process.env.EXPO_PUBLIC_API_BASE_URL ||
        "https://farm2home-production-e4bd.up.railway.app",

      appUrl:
        process.env.EXPO_PUBLIC_APP_URL ||
        "https://farm2home-rho.vercel.app",

      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "",

      stripePublishableKey:
        process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY || "",
    },

    updates: {
      enabled: true,
      checkAutomatically: "ON_LOAD",
      fallbackToCacheTimeout: 0,
    },

    runtimeVersion: {
      policy: "appVersion",
    },
  };
};