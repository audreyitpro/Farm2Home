// app/delete-account.tsx

import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type AccountRole = "customer" | "farmer" | "freight" | "driver";

const SUPPORT_EMAIL = "audreyitprofessional@gmail.com";

const ROLE_OPTIONS: Array<{
  value: AccountRole;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  {
    value: "customer",
    label: "Customer",
    icon: "person-outline",
  },
  {
    value: "farmer",
    label: "Farmer",
    icon: "leaf-outline",
  },
  {
    value: "freight",
    label: "Freight Carrier",
    icon: "business-outline",
  },
  {
    value: "driver",
    label: "Driver",
    icon: "car-outline",
  },
];

export default function DeleteAccountScreen() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AccountRole>("customer");
  const [confirmed, setConfirmed] = useState(false);
  const [openingEmail, setOpeningEmail] = useState(false);

  const normalizedEmail = email.trim().toLowerCase();

  const emailValid = useMemo(() => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail);
  }, [normalizedEmail]);

  const selectedRoleLabel =
    ROLE_OPTIONS.find((item) => item.value === role)?.label ?? "Customer";

  const canSubmit = emailValid && confirmed && !openingEmail;

  async function openDeletionRequestEmail() {
    if (!emailValid) {
      Alert.alert(
        "Valid email required",
        "Enter the email address associated with your Farm2Home Direct account."
      );
      return;
    }

    if (!confirmed) {
      Alert.alert(
        "Confirmation required",
        "Confirm that you understand this request may permanently delete your Farm2Home Direct account."
      );
      return;
    }

    const subject = "Farm2Home Direct Account Deletion Request";

    const body = [
      "Farm2Home Direct Account Deletion Request",
      "",
      `Account email: ${normalizedEmail}`,
      `Account type: ${selectedRoleLabel}`,
      "",
      "I am requesting deletion of my Farm2Home Direct account and associated personal information.",
      "",
      "I understand that Farm2Home Direct may need to verify account ownership before processing this request.",
      "",
      "I also understand that certain information may be retained when required for legal, security, fraud-prevention, tax, accounting, transaction, regulatory, or dispute-resolution purposes.",
      "",
      "Please confirm receipt of this account deletion request.",
    ].join("\n");

    const mailto =
      `mailto:${SUPPORT_EMAIL}` +
      `?subject=${encodeURIComponent(subject)}` +
      `&body=${encodeURIComponent(body)}`;

    try {
      setOpeningEmail(true);

      const supported = await Linking.canOpenURL(mailto);

      if (!supported && Platform.OS !== "web") {
        Alert.alert(
          "Email app unavailable",
          `Please email ${SUPPORT_EMAIL} with the subject "${subject}".`
        );
        return;
      }

      await Linking.openURL(mailto);
    } catch (error) {
      console.error("Unable to open deletion request email:", error);

      Alert.alert(
        "Unable to open email",
        `Please email ${SUPPORT_EMAIL} and request deletion of your Farm2Home Direct account.`
      );
    } finally {
      setOpeningEmail(false);
    }
  }

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }

    router.replace("/");
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.pressed,
          ]}
        >
          <Ionicons name="arrow-back" size={22} color="#0B2B18" />
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Farm2Home Direct</Text>
          <Text style={styles.headerSubtitle}>Account & Data Deletion</Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="trash-outline" size={32} color="#FFFFFF" />
          </View>

          <Text style={styles.heroEyebrow}>ACCOUNT PRIVACY</Text>

          <Text style={styles.heroTitle}>
            Request deletion of your Farm2Home Direct account
          </Text>

          <Text style={styles.heroDescription}>
            Farm2Home Direct users can request permanent deletion of their
            account and associated personal information.
          </Text>
        </View>

        <View style={styles.contentGrid}>
          <View style={styles.mainColumn}>
            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionNumber}>
                  <Text style={styles.sectionNumberText}>1</Text>
                </View>

                <View style={styles.sectionHeadingText}>
                  <Text style={styles.sectionTitle}>Identify your account</Text>
                  <Text style={styles.sectionSubtitle}>
                    Enter the email associated with your Farm2Home Direct
                    account.
                  </Text>
                </View>
              </View>

              <Text style={styles.label}>Account email</Text>

              <View style={styles.inputWrap}>
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color="#667085"
                  style={styles.inputIcon}
                />

                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  placeholderTextColor="#98A2B3"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.input}
                />
              </View>

              {email.length > 0 && !emailValid ? (
                <Text style={styles.errorText}>
                  Enter a valid email address.
                </Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionNumber}>
                  <Text style={styles.sectionNumberText}>2</Text>
                </View>

                <View style={styles.sectionHeadingText}>
                  <Text style={styles.sectionTitle}>Select account type</Text>
                  <Text style={styles.sectionSubtitle}>
                    Choose the Farm2Home Direct role associated with this
                    account.
                  </Text>
                </View>
              </View>

              <View style={styles.roleGrid}>
                {ROLE_OPTIONS.map((item) => {
                  const active = item.value === role;

                  return (
                    <Pressable
                      key={item.value}
                      onPress={() => setRole(item.value)}
                      style={({ pressed }) => [
                        styles.roleCard,
                        active && styles.roleCardActive,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.roleIcon,
                          active && styles.roleIconActive,
                        ]}
                      >
                        <Ionicons
                          name={item.icon}
                          size={22}
                          color={active ? "#FFFFFF" : "#126B39"}
                        />
                      </View>

                      <Text
                        style={[
                          styles.roleLabel,
                          active && styles.roleLabelActive,
                        ]}
                      >
                        {item.label}
                      </Text>

                      <View
                        style={[
                          styles.radioOuter,
                          active && styles.radioOuterActive,
                        ]}
                      >
                        {active ? <View style={styles.radioInner} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.sectionHeadingRow}>
                <View style={styles.sectionNumber}>
                  <Text style={styles.sectionNumberText}>3</Text>
                </View>

                <View style={styles.sectionHeadingText}>
                  <Text style={styles.sectionTitle}>Confirm your request</Text>
                  <Text style={styles.sectionSubtitle}>
                    Account deletion is permanent after your request has been
                    verified and completed.
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={() => setConfirmed((current) => !current)}
                style={({ pressed }) => [
                  styles.confirmRow,
                  confirmed && styles.confirmRowActive,
                  pressed && styles.pressed,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    confirmed && styles.checkboxActive,
                  ]}
                >
                  {confirmed ? (
                    <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                  ) : null}
                </View>

                <Text style={styles.confirmText}>
                  I understand that I am requesting permanent deletion of my
                  Farm2Home Direct account and associated personal information,
                  subject to information that must legally or legitimately be
                  retained.
                </Text>
              </Pressable>

              <Pressable
                disabled={!canSubmit}
                onPress={openDeletionRequestEmail}
                style={({ pressed }) => [
                  styles.primaryButton,
                  !canSubmit && styles.primaryButtonDisabled,
                  pressed && canSubmit && styles.primaryButtonPressed,
                ]}
              >
                <Ionicons name="send-outline" size={20} color="#FFFFFF" />

                <Text style={styles.primaryButtonText}>
                  {openingEmail
                    ? "Opening email..."
                    : "Request Account Deletion"}
                </Text>
              </Pressable>

              <Text style={styles.requestHelp}>
                Your email application will open with the deletion request
                information prepared for you.
              </Text>
            </View>
          </View>

          <View style={styles.sideColumn}>
            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons
                  name="information-circle-outline"
                  size={25}
                  color="#126B39"
                />
              </View>

              <Text style={styles.infoTitle}>What happens next?</Text>

              <View style={styles.step}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>
                  Farm2Home Direct receives your deletion request.
                </Text>
              </View>

              <View style={styles.step}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>
                  We may contact you to verify account ownership.
                </Text>
              </View>

              <View style={styles.step}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>
                  Eligible account information is deleted after verification.
                </Text>
              </View>

              <View style={styles.step}>
                <View style={styles.stepDot} />
                <Text style={styles.stepText}>
                  You receive confirmation when the request has been processed.
                </Text>
              </View>
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="shield-checkmark-outline" size={25} color="#126B39" />
              </View>

              <Text style={styles.infoTitle}>Information we may delete</Text>

              <Bullet text="Account profile information" />
              <Bullet text="Stored contact information" />
              <Bullet text="Marketplace profile information" />
              <Bullet text="Application preferences" />
              <Bullet text="Location-related account data where applicable" />
              <Bullet text="Uploaded content not required to be retained" />
            </View>

            <View style={styles.infoCard}>
              <View style={styles.infoIcon}>
                <Ionicons name="document-text-outline" size={25} color="#126B39" />
              </View>

              <Text style={styles.infoTitle}>
                Information that may be retained
              </Text>

              <Text style={styles.infoBody}>
                Certain information may be retained when required for legal,
                security, fraud-prevention, tax, accounting, transaction,
                regulatory, or dispute-resolution purposes.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.warningCard}>
          <Ionicons name="warning-outline" size={25} color="#A15C00" />

          <View style={styles.warningContent}>
            <Text style={styles.warningTitle}>
              Never email sensitive credentials
            </Text>

            <Text style={styles.warningText}>
              Do not send your password, complete payment-card information,
              Social Security number, banking credentials, security answers, or
              other sensitive authentication information with your deletion
              request.
            </Text>
          </View>
        </View>

        <View style={styles.contactCard}>
          <Ionicons name="mail-outline" size={26} color="#126B39" />

          <View style={styles.contactContent}>
            <Text style={styles.contactTitle}>Need assistance?</Text>

            <Text style={styles.contactText}>
              You can also contact Farm2Home Direct directly at:
            </Text>

            <Pressable
              onPress={() =>
                Linking.openURL(
                  `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                    "Farm2Home Direct Account Deletion Request"
                  )}`
                )
              }
            >
              <Text style={styles.contactEmail}>{SUPPORT_EMAIL}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerBrand}>Farm2Home Direct</Text>

          <Text style={styles.footerText}>
            Fresh From Our Farms. Delivered To Your Door.
          </Text>

          <Text style={styles.footerCopyright}>
            © 2026 Farm2Home Direct. All rights reserved.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F8F4",
  },

  header: {
    minHeight: 72,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E4E7EC",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    minWidth: 100,
  },

  backText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0B2B18",
  },

  headerTitleWrap: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0B2B18",
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 12,
    color: "#667085",
  },

  headerSpacer: {
    minWidth: 100,
  },

  scrollContent: {
    paddingBottom: 50,
  },

  hero: {
    backgroundColor: "#0D6535",
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },

  heroIcon: {
    width: 62,
    height: 62,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },

  heroEyebrow: {
    color: "#BFF2D2",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginBottom: 10,
  },

  heroTitle: {
    maxWidth: 720,
    textAlign: "center",
    color: "#FFFFFF",
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "900",
  },

  heroDescription: {
    maxWidth: 680,
    marginTop: 14,
    textAlign: "center",
    color: "#E2F4E8",
    fontSize: 16,
    lineHeight: 24,
  },

  contentGrid: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 30,
    flexDirection: Platform.OS === "web" ? "row" : "column",
    gap: 20,
  },

  mainColumn: {
    flex: 1.6,
    gap: 18,
  },

  sideColumn: {
    flex: 1,
    gap: 18,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 22,
  },

  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 22,
  },

  sectionNumber: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "#DDF6E6",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  sectionNumberText: {
    color: "#126B39",
    fontSize: 15,
    fontWeight: "900",
  },

  sectionHeadingText: {
    flex: 1,
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#101828",
  },

  sectionSubtitle: {
    marginTop: 4,
    color: "#667085",
    lineHeight: 20,
    fontSize: 13,
  },

  label: {
    fontSize: 13,
    fontWeight: "800",
    color: "#344054",
    marginBottom: 8,
  },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 52,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
  },

  inputIcon: {
    marginRight: 10,
  },

  input: {
    flex: 1,
    color: "#101828",
    fontSize: 15,
    paddingVertical: 12,
    outlineStyle: "none",
  } as any,

  errorText: {
    marginTop: 7,
    color: "#B42318",
    fontSize: 12,
    fontWeight: "700",
  },

  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },

  roleCard: {
    flexGrow: 1,
    flexBasis: "47%",
    minHeight: 82,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    padding: 13,
    backgroundColor: "#FFFFFF",
  },

  roleCardActive: {
    borderColor: "#159447",
    backgroundColor: "#F0FBF4",
  },

  roleIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF7EF",
  },

  roleIconActive: {
    backgroundColor: "#159447",
  },

  roleLabel: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    fontWeight: "800",
    color: "#344054",
  },

  roleLabelActive: {
    color: "#0D6535",
  },

  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#98A2B3",
    alignItems: "center",
    justifyContent: "center",
  },

  radioOuterActive: {
    borderColor: "#159447",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#159447",
  },

  confirmRow: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 14,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FAFBFC",
  },

  confirmRowActive: {
    borderColor: "#72D69A",
    backgroundColor: "#F0FBF4",
  },

  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: "#98A2B3",
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },

  checkboxActive: {
    backgroundColor: "#159447",
    borderColor: "#159447",
  },

  confirmText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: "#475467",
  },

  primaryButton: {
    minHeight: 54,
    marginTop: 18,
    borderRadius: 14,
    backgroundColor: "#0D6535",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 18,
  },

  primaryButtonPressed: {
    opacity: 0.88,
  },

  primaryButtonDisabled: {
    backgroundColor: "#A8B5AC",
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },

  requestHelp: {
    marginTop: 10,
    color: "#667085",
    fontSize: 12,
    textAlign: "center",
  },

  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E4E7EC",
    padding: 20,
  },

  infoIcon: {
    width: 45,
    height: 45,
    borderRadius: 13,
    backgroundColor: "#EAF7EF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  infoTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#101828",
    marginBottom: 12,
  },

  infoBody: {
    color: "#667085",
    fontSize: 13,
    lineHeight: 20,
  },

  step: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 11,
  },

  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#159447",
    marginTop: 6,
    marginRight: 10,
  },

  stepText: {
    flex: 1,
    color: "#475467",
    fontSize: 13,
    lineHeight: 19,
  },

  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 9,
  },

  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#159447",
    marginTop: 7,
    marginRight: 9,
  },

  bulletText: {
    flex: 1,
    color: "#475467",
    fontSize: 13,
    lineHeight: 20,
  },

  warningCard: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    marginTop: 20,
    marginHorizontal: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#F5D49A",
    backgroundColor: "#FFF8EA",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  warningContent: {
    flex: 1,
    marginLeft: 12,
  },

  warningTitle: {
    fontWeight: "900",
    fontSize: 14,
    color: "#7A4300",
  },

  warningText: {
    color: "#8D5A16",
    marginTop: 4,
    lineHeight: 20,
    fontSize: 13,
  },

  contactCard: {
    width: "100%",
    maxWidth: 1100,
    alignSelf: "center",
    marginTop: 20,
    padding: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4E7EC",
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  contactContent: {
    flex: 1,
    marginLeft: 12,
  },

  contactTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#101828",
  },

  contactText: {
    color: "#667085",
    fontSize: 13,
    marginTop: 3,
  },

  contactEmail: {
    marginTop: 5,
    fontSize: 13,
    color: "#126B39",
    fontWeight: "800",
    textDecorationLine: "underline",
  },

  footer: {
    alignItems: "center",
    paddingTop: 38,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },

  footerBrand: {
    color: "#0D6535",
    fontSize: 20,
    fontWeight: "900",
  },

  footerText: {
    marginTop: 5,
    color: "#667085",
    fontSize: 13,
  },

  footerCopyright: {
    marginTop: 14,
    color: "#98A2B3",
    fontSize: 11,
  },

  pressed: {
    opacity: 0.82,
  },
});