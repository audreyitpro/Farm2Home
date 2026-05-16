import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getCurrentSession,
  getCurrentUser,
  listenToAuthChanges,
} from "../services/authService";

import { getUserProfile, UserProfile } from "../services/profileService";

import { registerPushNotifications } from "../services/notificationService";

type AuthContextValue = {
  loading: boolean;
  session: any | null;
  user: any | null;
  profile: UserProfile | null;
  role: string | null;
  onboardingComplete: boolean;
  isLoggedIn: boolean;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  loading: true,
  session: null,
  user: null,
  profile: null,
  role: null,
  onboardingComplete: false,
  isLoggedIn: false,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    loadAuth();

    const listener = listenToAuthChanges(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user || null);

      if (newSession?.user?.id) {
        await loadProfile(newSession.user.id);
        await setupPushNotifications(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => {
      listener.data.subscription.unsubscribe();
    };
  }, []);

  async function loadAuth() {
    try {
      const currentSession = await getCurrentSession();
      const currentUser = await getCurrentUser();

      setSession(currentSession);
      setUser(currentUser);

      if (currentUser?.id) {
        await loadProfile(currentUser.id);
        await setupPushNotifications(currentUser.id);
      }
    } catch (error) {
      console.log("AuthProvider load error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile(userId: string) {
    try {
      const cloudProfile = await getUserProfile(userId);
      setProfile(cloudProfile);
    } catch (error) {
      console.log("Profile load error:", error);
      setProfile(null);
    }
  }

  async function setupPushNotifications(userId: string) {
    try {
      await registerPushNotifications(userId);
    } catch (error) {
      console.log("Push notification setup error:", error);
    }
  }

  async function refreshProfile() {
    if (user?.id) {
      await loadProfile(user.id);
    }
  }

  const role = profile?.role || user?.user_metadata?.role || null;

  const onboardingComplete = Boolean(profile?.onboarding_complete);

  const value = useMemo(
    () => ({
      loading,
      session,
      user,
      profile,
      role,
      onboardingComplete,
      isLoggedIn: !!session?.user,
      refreshProfile,
    }),
    [loading, session, user, profile, role, onboardingComplete]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}