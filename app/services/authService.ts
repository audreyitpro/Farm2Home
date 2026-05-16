// app/services/authService.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "./supabaseClient";
import { createUserProfile } from "./profileService";

export type AppUserRole =
  | "customer"
  | "farmer"
  | "freight"
  | "driver"
  | "admin";

export type TestUser = {
  id: string;
  email: string;
  fullName: string;
  role: AppUserRole;
};

const CURRENT_TEST_USER_KEY = "farm2homeCurrentTestUser";

const TEST_USERS: Record<
  string,
  {
    password: string;
    user: TestUser;
  }
> = {
  "customer@test.com": {
    password: "test123",
    user: {
      id: "test_customer_001",
      email: "customer@test.com",
      fullName: "Test Customer",
      role: "customer",
    },
  },
  "farmer@test.com": {
    password: "test123",
    user: {
      id: "test_farmer_001",
      email: "farmer@test.com",
      fullName: "Test Farmer",
      role: "farmer",
    },
  },
  "driver@test.com": {
    password: "test123",
    user: {
      id: "test_driver_001",
      email: "driver@test.com",
      fullName: "Test Driver",
      role: "driver",
    },
  },
  "freight@test.com": {
    password: "test123",
    user: {
      id: "test_freight_001",
      email: "freight@test.com",
      fullName: "Test Freight Carrier",
      role: "freight",
    },
  },
  "admin@test.com": {
    password: "admin123",
    user: {
      id: "test_admin_001",
      email: "admin@test.com",
      fullName: "Test Admin",
      role: "admin",
    },
  },
};

function getTestUser(email: string, password: string) {
  const cleanEmail = email.trim().toLowerCase();
  const testRecord = TEST_USERS[cleanEmail];

  if (!testRecord) {
    return null;
  }

  if (testRecord.password !== password) {
    return null;
  }

  return testRecord.user;
}

export async function signUpWithEmail({
  email,
  password,
  role,
  fullName,
}: {
  email: string;
  password: string;
  role: AppUserRole;
  fullName: string;
}) {
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanFullName = fullName.trim();

    if (
      cleanEmail.endsWith("@test.com") ||
      cleanEmail === "admin@test.com"
    ) {
      const testUser: TestUser = {
        id: `test_${role}_${Date.now()}`,
        email: cleanEmail,
        fullName: cleanFullName || "Test User",
        role,
      };

      await AsyncStorage.setItem(
        CURRENT_TEST_USER_KEY,
        JSON.stringify(testUser)
      );

      return {
        success: true,
        user: testUser,
        session: {
          user: testUser,
          access_token: "test_access_token",
        },
      };
    }

    const result = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          role,
          full_name: cleanFullName,
        },
      },
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    if (result.data.user) {
      try {
        await createUserProfile({
          id: result.data.user.id,
          email: cleanEmail,
          fullName: cleanFullName,
          role,
        });
      } catch (profileError: any) {
        console.log("Profile creation error:", profileError.message);

        return {
          success: false,
          error:
            profileError.message ||
            "Account was created, but profile setup failed.",
        };
      }
    }

    return {
      success: true,
      user: result.data.user,
      session: result.data.session,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Signup failed.",
    };
  }
}

export async function signInWithEmail({
  email,
  password,
}: {
  email: string;
  password: string;
}) {
  try {
    const cleanEmail = email.trim().toLowerCase();

    const testUser = getTestUser(cleanEmail, password);

    if (testUser) {
      await AsyncStorage.setItem(
        CURRENT_TEST_USER_KEY,
        JSON.stringify(testUser)
      );

      return {
        success: true,
        user: testUser,
        session: {
          user: testUser,
          access_token: "test_access_token",
        },
      };
    }

    const result = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      user: result.data.user,
      session: result.data.session,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Login failed.",
    };
  }
}

export async function signOutUser() {
  try {
    await AsyncStorage.removeItem(CURRENT_TEST_USER_KEY);

    const result = await supabase.auth.signOut();

    if (result.error) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || "Logout failed.",
    };
  }
}

export async function getCurrentUser() {
  try {
    const testRaw = await AsyncStorage.getItem(CURRENT_TEST_USER_KEY);

    if (testRaw) {
      return JSON.parse(testRaw);
    }

    const result = await supabase.auth.getUser();

    if (result.error) {
      console.log("Get current user error:", result.error.message);
      return null;
    }

    return result.data.user;
  } catch (error) {
    console.log("Get current user crash:", error);
    return null;
  }
}

export async function getCurrentSession() {
  try {
    const testRaw = await AsyncStorage.getItem(CURRENT_TEST_USER_KEY);

    if (testRaw) {
      const testUser = JSON.parse(testRaw);

      return {
        user: testUser,
        access_token: "test_access_token",
      };
    }

    const result = await supabase.auth.getSession();

    if (result.error) {
      console.log("Get current session error:", result.error.message);
      return null;
    }

    return result.data.session;
  } catch (error) {
    console.log("Get current session crash:", error);
    return null;
  }
}

export function listenToAuthChanges(
  callback: (event: string, session: any) => void
) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}