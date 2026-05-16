import React, { ReactNode, useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";

import { useAuth } from "../providers/AuthProvider";

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: string[];
};

export default function ProtectedRoute({
  children,
  allowedRoles = [],
}: ProtectedRouteProps) {
  const { loading, isLoggedIn, role } = useAuth();

  useEffect(() => {
    if (loading) return;

    if (!isLoggedIn) {
      router.replace("/auth/login");
      return;
    }

    if (allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
      router.replace("/auth/login");
    }
  }, [loading, isLoggedIn, role, allowedRoles]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#10B981" />
        <Text style={styles.text}>Checking session...</Text>
      </View>
    );
  }

  if (!isLoggedIn) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Login Required</Text>
        <Text style={styles.text}>Redirecting to login...</Text>
      </View>
    );
  }

  if (allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access Restricted</Text>
        <Text style={styles.text}>You do not have access to this section.</Text>
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },

  title: {
    color: "#111827",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },

  text: {
    color: "#6B7280",
    fontWeight: "700",
    textAlign: "center",
  },
});