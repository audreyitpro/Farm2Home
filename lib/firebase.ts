import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import {
  initializeAppCheck,
  ReCaptchaV3Provider,
} from "firebase/app-check";

const firebaseConfig = {
  apiKey: "AIzaSyBWoLIk54zGapzdWtyP1h46jLg3FlgDI0w",
  authDomain: "farm2home-2bd13.firebaseapp.com",
  projectId: "farm2home-2bd13",
  storageBucket: "farm2home-2bd13.firebasestorage.app",
  messagingSenderId: "1065115588098",
  appId: "1:1065115588098:web:807baab06bc63894caf91b",
};

const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

if (typeof window !== "undefined") {
  initializeAppCheck(firebaseApp, {
    provider: new ReCaptchaV3Provider(
      "6Leo7dAsAAAAAMR1ySjvzomEH5mj6d1-Hr9IbDXD"
    ),
    isTokenAutoRefreshEnabled: true,
  });
}

export const auth = getAuth(firebaseApp);
export const db = getFirestore(firebaseApp);
export const storage = getStorage(firebaseApp);

export default firebaseApp;