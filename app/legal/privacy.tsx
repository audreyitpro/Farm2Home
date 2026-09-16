// app/privacy.tsx

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

const COLORS = {
  navy: "#020617",
  primary: "#635BFF",
  primaryDark: "#4638D8",
  primarySoft: "#EEF2FF",
  green: "#10B981",
  greenDark: "#047857",
  greenSoft: "#D1FAE5",
  background: "#F6F7FB",
  card: "#FFFFFF",
  surface: "#F8FAFC",
  text: "#101828",
  muted: "#667085",
  border: "#E5E7EB",
  white: "#FFFFFF",
  danger: "#DC2626",
};

const SUPPORT_EMAIL = "audreyitprofessional@gmail.com";

type PolicySectionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
};

function PolicySection({
  icon,
  title,
  children,
}: PolicySectionProps) {
  return (
    <View style={styles.card}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name={icon}
            size={20}
            color={COLORS.primary}
          />
        </View>

        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      {children}
    </View>
  );
}

export default function PrivacyPage() {
  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/" as any);
  }

  function openSupportEmail() {
    Linking.openURL(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
        "Farm2Home Privacy Request"
      )}`
    ).catch((error) => {
      console.log("Unable to open email client:", error);
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar
        barStyle="light-content"
        backgroundColor={COLORS.navy}
      />

      <View style={styles.header}>
        <Pressable
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
          onPress={goBack}
        >
          <Ionicons
            name="arrow-back-outline"
            size={21}
            color={COLORS.white}
          />
        </Pressable>

        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Privacy Policy</Text>
          <Text style={styles.headerSubtitle}>
            Farm2Home
          </Text>
        </View>

        <View style={styles.headerRight}>
          <Ionicons
            name="shield-checkmark-outline"
            size={23}
            color={COLORS.white}
          />
        </View>
      </View>

      <ScrollView
        style={styles.page}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons
              name="shield-checkmark-outline"
              size={32}
              color={COLORS.white}
            />
          </View>

          <Text style={styles.heroTitle}>
            Your Privacy Matters
          </Text>

          <Text style={styles.heroText}>
            Farm2Home is committed to protecting the privacy and
            personal information of customers, farmers, freight
            carriers, and drivers who use our marketplace and
            delivery platform.
          </Text>

          <View style={styles.updatedBadge}>
            <Ionicons
              name="calendar-outline"
              size={15}
              color={COLORS.primary}
            />

            <Text style={styles.updatedText}>
              Last Updated: September 15, 2026
            </Text>
          </View>
        </View>

        <PolicySection
          icon="information-circle-outline"
          title="About This Privacy Policy"
        >
          <Text style={styles.text}>
            This Privacy Policy explains how Farm2Home collects,
            uses, stores, shares, and protects information when you
            access or use the Farm2Home mobile application, website,
            marketplace, delivery services, freight services, and
            related features.
          </Text>

          <Text style={styles.textLast}>
            By using Farm2Home, you acknowledge the practices
            described in this Privacy Policy.
          </Text>
        </PolicySection>

        <PolicySection
          icon="person-outline"
          title="Information We Collect"
        >
          <Text style={styles.text}>
            The information Farm2Home collects depends on how you
            use the platform and the type of account you maintain.
          </Text>

          <Text style={styles.bullet}>
            • Account information such as your name, email address,
            telephone number, account type, and profile information.
          </Text>

          <Text style={styles.bullet}>
            • Customer information such as delivery addresses,
            order information, shopping activity, and transaction
            information.
          </Text>

          <Text style={styles.bullet}>
            • Farmer information such as farm or business
            information, products, store information, compliance
            documents, and payout-related account information.
          </Text>

          <Text style={styles.bullet}>
            • Freight carrier and driver information necessary to
            coordinate transportation, pickups, deliveries, and
            shipment activity.
          </Text>

          <Text style={styles.bullet}>
            • Location information when location-based features are
            used, including features associated with delivery,
            freight, navigation, or shipment tracking.
          </Text>

          <Text style={styles.bullet}>
            • Photos or documents that users choose to upload,
            including proof-of-pickup, proof-of-delivery, profile
            images, farm images, or compliance documentation.
          </Text>

          <Text style={styles.bulletLast}>
            • Technical information necessary to operate, secure,
            troubleshoot, and improve the Farm2Home platform.
          </Text>
        </PolicySection>

        <PolicySection
          icon="card-outline"
          title="Payments and Financial Information"
        >
          <Text style={styles.text}>
            Farm2Home uses third-party payment services to process
            eligible purchases, subscriptions, marketplace
            transactions, and payouts.
          </Text>

          <Text style={styles.text}>
            Payment information may be provided directly to the
            applicable payment processor. Farm2Home may receive
            transaction identifiers, payment status, subscription
            information, payout status, or other information
            necessary to manage transactions.
          </Text>

          <Text style={styles.textLast}>
            Farm2Home does not sell payment information or personal
            information.
          </Text>
        </PolicySection>

        <PolicySection
          icon="location-outline"
          title="Location Information"
        >
          <Text style={styles.text}>
            Certain Farm2Home features may request access to device
            location information. Location may be used to support
            delivery, driver, freight, route, navigation, shipment,
            and other location-based functionality.
          </Text>

          <Text style={styles.textLast}>
            Device permissions can be managed through your device
            settings. Some location-dependent features may not
            function properly when location access is disabled.
          </Text>
        </PolicySection>

        <PolicySection
          icon="camera-outline"
          title="Photos, Camera, and Documents"
        >
          <Text style={styles.text}>
            Farm2Home may request permission to access the camera,
            photo library, or files when you choose features that
            require uploading images or documents.
          </Text>

          <Text style={styles.textLast}>
            These materials may include profile images, farm and
            product images, compliance documents,
            proof-of-pickup, and proof-of-delivery information.
          </Text>
        </PolicySection>

        <PolicySection
          icon="notifications-outline"
          title="Notifications"
        >
          <Text style={styles.textLast}>
            If notifications are enabled, Farm2Home may send
            notifications related to account activity, orders,
            deliveries, marketplace activity, freight activity,
            driver activity, subscription status, or other
            important service information. Notification
            permissions can be managed through your device
            settings.
          </Text>
        </PolicySection>

        <PolicySection
          icon="settings-outline"
          title="How We Use Information"
        >
          <Text style={styles.bullet}>
            • Create, authenticate, and manage Farm2Home accounts.
          </Text>

          <Text style={styles.bullet}>
            • Provide marketplace browsing and purchasing
            functionality.
          </Text>

          <Text style={styles.bullet}>
            • Process and manage orders, payments, subscriptions,
            refunds, and payouts.
          </Text>

          <Text style={styles.bullet}>
            • Coordinate farmers, customers, freight carriers, and
            drivers.
          </Text>

          <Text style={styles.bullet}>
            • Support delivery, pickup, freight, and shipment
            tracking.
          </Text>

          <Text style={styles.bullet}>
            • Provide customer support and respond to requests.
          </Text>

          <Text style={styles.bullet}>
            • Protect users and the platform from fraud, misuse,
            security threats, and unauthorized activity.
          </Text>

          <Text style={styles.bulletLast}>
            • Comply with applicable legal, accounting, tax,
            regulatory, and contractual obligations.
          </Text>
        </PolicySection>

        <PolicySection
          icon="people-outline"
          title="How Information May Be Shared"
        >
          <Text style={styles.text}>
            Farm2Home may share information when necessary to
            provide requested services. Depending on the
            transaction, this may include sharing appropriate
            information between customers, farmers, freight
            carriers, and drivers.
          </Text>

          <Text style={styles.text}>
            Information may also be processed by service providers
            that support payment processing, authentication,
            database hosting, file storage, communications,
            infrastructure, analytics, fraud prevention, or other
            services necessary to operate Farm2Home.
          </Text>

          <Text style={styles.textLast}>
            Farm2Home does not sell personal information.
          </Text>
        </PolicySection>

        <PolicySection
          icon="lock-closed-outline"
          title="Data Security"
        >
          <Text style={styles.textLast}>
            Farm2Home uses commercially reasonable administrative,
            technical, and organizational safeguards designed to
            protect personal information. However, no electronic
            storage or transmission method can be guaranteed to be
            completely secure.
          </Text>
        </PolicySection>

        <PolicySection
          icon="time-outline"
          title="Data Retention"
        >
          <Text style={styles.text}>
            Farm2Home retains information for as long as reasonably
            necessary to provide services, maintain accounts,
            resolve disputes, prevent fraud, enforce agreements,
            and satisfy applicable legal, tax, accounting, and
            regulatory requirements.
          </Text>

          <Text style={styles.textLast}>
            When an account is deleted, information that is not
            required to be retained may be deleted or anonymized.
            Certain transaction, financial, legal, fraud
            prevention, or compliance records may be retained when
            required or permitted by law.
          </Text>
        </PolicySection>

        <PolicySection
          icon="trash-outline"
          title="Account Deletion"
        >
          <Text style={styles.text}>
            Registered Farm2Home users may request permanent
            deletion of their Farm2Home account.
          </Text>

          <Text style={styles.text}>
            Users can access the account deletion option from their
            profile or account settings when signed in. Farm2Home
            may require confirmation before permanently deleting
            the account.
          </Text>

          <Text style={styles.textLast}>
            Account deletion is permanent. Information that must be
            retained for legitimate legal, financial, tax,
            security, fraud-prevention, or regulatory purposes may
            be retained as permitted by applicable law.
          </Text>
        </PolicySection>

        <PolicySection
          icon="create-outline"
          title="Your Privacy Choices"
        >
          <Text style={styles.text}>
            Depending on applicable law and the information
            involved, users may request access, correction, or
            deletion of certain personal information.
          </Text>

          <Text style={styles.textLast}>
            You may also manage applicable camera, photo,
            notification, and location permissions through your
            device settings.
          </Text>
        </PolicySection>

        <PolicySection
          icon="people-circle-outline"
          title="Children's Privacy"
        >
          <Text style={styles.textLast}>
            Farm2Home is intended for users who are legally able to
            enter into the transactions offered through the
            platform. Farm2Home does not knowingly collect personal
            information from children in violation of applicable
            law.
          </Text>
        </PolicySection>

        <PolicySection
          icon="refresh-outline"
          title="Changes to This Privacy Policy"
        >
          <Text style={styles.textLast}>
            Farm2Home may update this Privacy Policy as the
            platform, services, or legal requirements change. The
            updated policy will display a revised effective or last
            updated date.
          </Text>
        </PolicySection>

        <PolicySection
          icon="mail-outline"
          title="Contact Farm2Home"
        >
          <Text style={styles.text}>
            If you have questions about this Privacy Policy or want
            to submit a privacy-related request, contact Farm2Home.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.emailButton,
              pressed && styles.pressed,
            ]}
            onPress={openSupportEmail}
          >
            <Ionicons
              name="mail-outline"
              size={18}
              color={COLORS.white}
            />

            <Text style={styles.emailButtonText}>
              {SUPPORT_EMAIL}
            </Text>
          </Pressable>
        </PolicySection>

        <View style={styles.footer}>
          <View style={styles.footerLogo}>
            <Ionicons
              name="leaf-outline"
              size={23}
              color={COLORS.white}
            />
          </View>

          <Text style={styles.footerTitle}>Farm2Home</Text>

          <Text style={styles.footerText}>
            Local farms. Local food. Connected communities.
          </Text>

          <Text style={styles.copyright}>
            © 2026 Farm2Home. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.navy,
  },

  header: {
    minHeight: 68,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTextContainer: {
    flex: 1,
  },

  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: "900",
  },

  headerSubtitle: {
    marginTop: 2,
    color: "#A5B4FC",
    fontSize: 12,
    fontWeight: "700",
  },

  headerRight: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  page: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    width: "100%",
    maxWidth: 1000,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 60,
  },

  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: 24,
    padding: 24,
    marginBottom: 18,
  },

  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  heroTitle: {
    color: COLORS.white,
    fontSize: 30,
    lineHeight: 36,
    fontWeight: "900",
    marginBottom: 10,
  },

  heroText: {
    color: "#EEF2FF",
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "600",
    maxWidth: 760,
  },

  updatedBadge: {
    alignSelf: "flex-start",
    marginTop: 18,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  updatedText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,

    ...Platform.select({
      ios: {
        shadowColor: "#000000",
        shadowOffset: {
          width: 0,
          height: 4,
        },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },

      android: {
        elevation: 2,
      },

      web: {
        boxShadow: "0 4px 18px rgba(15, 23, 42, 0.06)",
      } as any,
    }),
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  sectionTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
  },

  text: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 23,
    fontWeight: "500",
    marginBottom: 12,
  },

  textLast: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 23,
    fontWeight: "500",
  },

  bullet: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 23,
    fontWeight: "500",
    marginBottom: 9,
  },

  bulletLast: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 23,
    fontWeight: "500",
  },

  emailButton: {
    alignSelf: "flex-start",
    minHeight: 46,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  emailButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },

  footer: {
    marginTop: 10,
    backgroundColor: COLORS.navy,
    borderRadius: 22,
    padding: 26,
    alignItems: "center",
  },

  footerLogo: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },

  footerTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
  },

  footerText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 5,
  },

  copyright: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 14,
  },

  pressed: {
    opacity: 0.72,
  },
});