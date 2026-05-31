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
    let mounted = true;
    let subscription: any = null;

    async function start() {
      try {
        await loadAuth(mounted);

        const listener: any = listenToAuthChanges(
          async (_event: any, newSession: any) => {
            if (!mounted) return;

            setSession(newSession || null);
            setUser(newSession?.user || null);

            if (newSession?.user?.id) {
              await loadProfile(newSession.user.id, mounted);
              await setupPushNotifications();
            } else {
              setProfile(null);
            }
          }
        );

        subscription = listener?.data?.subscription || listener?.subscription || null;
      } catch (error) {
        console.log("AuthProvider listener error:", error);
      }
    }

    start();

    return () => {
      mounted = false;

      try {
        if (subscription?.unsubscribe) {
          subscription.unsubscribe();
        }
      } catch (error) {
        console.log("AuthProvider unsubscribe error:", error);
      }
    };
  }, []);

  async function loadAuth(isMounted = true) {
    try {
      const currentSession = await getCurrentSession();
      const currentUser = await getCurrentUser();

      if (!isMounted) return;

      setSession(currentSession || null);
      setUser(currentUser || null);

      if (currentUser?.id) {
        await loadProfile(currentUser.id, isMounted);
        await setupPushNotifications();
      }
    } catch (error) {
      console.log("AuthProvider load error:", error);

      if (isMounted) {
        setSession(null);
        setUser(null);
        setProfile(null);
      }
    } finally {
      if (isMounted) setLoading(false);
    }
  }

  async function loadProfile(userId: string, isMounted = true) {
    try {
      const cloudProfile = await getUserProfile(userId);

      if (isMounted) {
        setProfile(cloudProfile || null);
      }
    } catch (error) {
      console.log("Profile load error:", error);

      if (isMounted) {
        setProfile(null);
      }
    }
  }

  async function setupPushNotifications() {
    try {
      await registerPushNotifications();
    } catch (error) {
      console.log("Push notification setup error:", error);
    }
  }

  async function refreshProfile() {
    if (user?.id) {
      await loadProfile(user.id, true);
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
      isLoggedIn: Boolean(session?.user || user),
      refreshProfile,
    }),
    [loading, session, user, profile, role, onboardingComplete]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}