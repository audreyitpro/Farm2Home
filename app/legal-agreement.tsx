import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { supabase } from "./data/supabaseClient";

const COLORS = {
  background: "#F8FAF7",
  card: "#FFFFFF",
  primary: "#2E7D32",
  primaryDark: "#14532D",
  primarySoft: "#EAF5E7",
  text: "#172017",
  muted: "#667085",
  border: "#DDE5D8",
  white: "#FFFFFF",
  danger: "#DC2626",
  warning: "#B45309",
  success: "#15803D",
  successSoft: "#DCFCE7",
  disabled: "#A7B0A4",
};

const AGREEMENT_VERSION = "1.0";
const AGREEMENT_TYPE = "platform_agreement";

type Farm2HomeRole = "customer" | "farmer" | "driver" | "freight";

const ROLE_ROUTES: Record<Farm2HomeRole, string> = {
  customer: "/customer/dashboard",
  farmer: "/farmer/dashboard",
  driver: "/driver/mobile-driver-app",
  freight: "/freight/dashboard",
};

/**
 * IMPORTANT:
 * Keep Version 1.0 text unchanged after release.
 *
 * If the agreement changes:
 * 1. Create Version 2.0.
 * 2. Change AGREEMENT_VERSION to "2.0".
 * 3. Keep the old Version 1.0 database record.
 * 4. Require users to accept the new version.
 */
const PLATFORM_AGREEMENT_TEXT = `
FARM2HOME DIRECT PLATFORM AGREEMENT
VERSION 1.0

Effective Date: September 9, 2026

1. PURPOSE OF FARM2HOME DIRECT

Farm2Home Direct is a technology marketplace and platform designed to connect customers with independent farmers, producers, freight carriers, and drivers.

Farm2Home Direct provides technology that may allow users to discover products, communicate, place orders, coordinate pickup or delivery, arrange transportation, process payments, manage subscriptions, and use related marketplace services.

Farm2Home Direct does not itself grow, manufacture, produce, harvest, inspect, package, prepare, transport, deliver, store, or independently verify products or services offered by independent users of the platform unless Farm2Home Direct expressly states otherwise for a particular service.

2. INDEPENDENT PLATFORM USERS

Farmers, producers, sellers, freight carriers, drivers, and other service providers using Farm2Home Direct operate independently.

They are not employees, agents, representatives, joint venturers, or partners of Farm2Home Direct merely because they use the Farm2Home Direct platform.

Each independent user is responsible for their own business operations, products, services, licenses, registrations, permits, insurance, taxes, equipment, vehicles, personnel, legal obligations, and regulatory compliance.

3. FARMER AND SELLER RESPONSIBILITIES

Farmers, producers, and sellers are responsible for the products they list or sell through Farm2Home Direct.

This includes responsibility for, where applicable:

• Product quality.
• Product safety.
• Accurate product descriptions.
• Pricing.
• Availability.
• Packaging.
• Labeling.
• Allergens.
• Food handling.
• Storage.
• Farm practices.
• Product claims.
• Applicable permits and licenses.
• Compliance with applicable federal, state, and local laws and regulations.

Farm2Home Direct does not guarantee the quality, condition, safety, legality, freshness, suitability, or accuracy of products offered by independent farmers or sellers.

4. CUSTOMER RESPONSIBILITIES

Customers are responsible for reviewing product information before making a purchase.

Customers should review relevant information including product descriptions, seller information, ingredients, allergens, pickup or delivery terms, storage requirements, and any other information relevant to the product being purchased.

Customers are responsible for determining whether a product is suitable for their individual needs.

5. FREIGHT CARRIER RESPONSIBILITIES

Freight carriers using Farm2Home Direct are independent transportation providers.

Each freight carrier is responsible for maintaining all licenses, permits, registrations, operating authority, insurance, vehicle requirements, safety requirements, and other qualifications required for the transportation services the carrier performs.

Freight carriers are responsible for the transportation, handling, custody, security, and delivery of loads accepted by the carrier.

Farm2Home Direct does not operate the carrier's vehicles and does not control the manner in which an independent carrier performs transportation services.

6. DRIVER RESPONSIBILITIES

Drivers using Farm2Home Direct are responsible for maintaining a valid driver's license, appropriate insurance, safe and legally compliant vehicles, and any other qualifications required for the delivery services they perform.

Drivers are responsible for safely handling, transporting, and delivering products assigned or accepted through the platform.

Drivers must comply with applicable traffic, transportation, safety, insurance, and delivery requirements.

7. PLATFORM ROLE

Farm2Home Direct facilitates connections between marketplace participants.

Depending on the features being used, Farm2Home Direct may provide technology for:

• Marketplace listings.
• Search and discovery.
• Account management.
• Communication.
• Order coordination.
• Delivery coordination.
• Freight coordination.
• Location and tracking.
• Payment processing.
• Subscription management.
• Stripe Connect payment or payout functionality.
• Notifications.
• Customer support.
• Related marketplace services.

The existence of these platform features does not make Farm2Home Direct the farmer, producer, seller, carrier, driver, employer, or direct provider of products or transportation services offered by independent platform users.

8. USER TRANSACTIONS

Transactions involving products or independent services are between the applicable platform participants, subject to the Farm2Home Direct Terms of Service and applicable law.

Users are responsible for the representations they make, the products or services they provide, and their conduct while using the platform.

9. PAYMENTS AND THIRD-PARTY SERVICES

Farm2Home Direct may use third-party service providers to support payments, payouts, authentication, communications, hosting, notifications, mapping, location services, and other functionality.

Use of those services may also be subject to the applicable third party's terms and policies.

10. NO GUARANTEE OF USER PERFORMANCE

Farm2Home Direct cannot guarantee that an independent user will complete a transaction, fulfill an order, deliver a product, perform transportation services, or otherwise perform exactly as another user expects.

Farm2Home Direct may provide technology, records, support tools, dispute-management features, or account controls, but independent users remain responsible for their own conduct and performance.

11. USER CONTENT AND REPRESENTATIONS

Users are responsible for information, images, product listings, business information, messages, documents, licenses, insurance information, delivery information, and other content they submit to Farm2Home Direct.

Users agree not to knowingly provide false, misleading, fraudulent, unlawful, or unauthorized information.

12. COMPLIANCE WITH LAW

All users must comply with applicable federal, state, and local laws and regulations relating to their activities on Farm2Home Direct.

Farmers, carriers, drivers, customers, and other users remain responsible for determining which laws, registrations, licenses, permits, insurance requirements, taxes, and regulations apply to them.

13. LIMITATION OF PLATFORM RESPONSIBILITY

To the fullest extent permitted by applicable law, Farm2Home Direct is not responsible for the independent acts, omissions, representations, products, services, transportation activities, delivery performance, business practices, or conduct of users of the platform.

Nothing in this agreement is intended to exclude, waive, or limit any responsibility or liability that cannot lawfully be excluded or limited.

14. SAFETY

Users must exercise reasonable judgment and follow applicable safety requirements when purchasing, selling, transporting, delivering, receiving, handling, storing, or consuming products.

Users should report suspected fraud, unsafe activity, prohibited conduct, or serious platform concerns through Farm2Home Direct support.

15. ACCOUNT RESPONSIBILITY

Users are responsible for maintaining the security of their Farm2Home Direct account and login credentials.

Users must not knowingly allow unauthorized individuals to use their account.

Users are responsible for keeping their account information reasonably accurate and current.

16. PRIVACY

Use of Farm2Home Direct is also governed by the Farm2Home Direct Privacy Policy.

The Privacy Policy describes how Farm2Home Direct collects, uses, stores, processes, shares, and protects information.

17. TERMS OF SERVICE

Use of Farm2Home Direct is also governed by the Farm2Home Direct Terms of Service.

If additional terms apply to a particular product, service, subscription, payment, delivery, or transportation feature, those additional terms may also apply.

18. ELECTRONIC ACCEPTANCE

By selecting the required acknowledgment boxes and pressing "I Agree & Continue," the user confirms that:

• The user has been given an opportunity to read this Platform Agreement.

• The user understands that Farm2Home Direct operates primarily as a technology marketplace connecting independent participants.

• The user agrees to comply with this Platform Agreement.

• The user agrees to the Farm2Home Direct Terms of Service.

• The user acknowledges the Farm2Home Direct Privacy Policy.

The electronic acceptance date and agreement version may be stored by Farm2Home Direct as part of the user's account records.

19. AGREEMENT VERSION

This is Farm2Home Direct Platform Agreement Version 1.0.

Acceptance of Version 1.0 applies to this version only.

If Farm2Home Direct materially updates this agreement, the platform may require the user to review and accept a new agreement version before continuing to use applicable Farm2Home Direct services.

20. ACKNOWLEDGMENT

BY SELECTING "I AGREE & CONTINUE," YOU ACKNOWLEDGE THAT YOU HAVE READ AND UNDERSTAND THIS FARM2HOME DIRECT PLATFORM AGREEMENT, VERSION 1.0, AND AGREE TO BE BOUND BY ITS TERMS.
`.trim();

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeRole(value: unknown): Farm2HomeRole | null {
  const role = clean(value).toLowerCase();

  if (
    role === "customer" ||
    role === "farmer" ||
    role === "driver" ||
    role === "freight"
  ) {
    return role;
  }

  return null;
}

function prettyRole(role: Farm2HomeRole | null) {
  if (!role) return "Farm2Home Direct User";

  return role.charAt(0).toUpperCase() + role.slice(1);
}

function formatAcceptedDate(value: string) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export default function LegalAgreementScreen() {
  const params = useLocalSearchParams<{
    role?: string;
    returnTo?: string;
  }>();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  const [role, setRole] = useState<Farm2HomeRole | null>(null);

  const [acknowledgeAgreement, setAcknowledgeAgreement] =
    useState(false);

  const [acknowledgePlatform, setAcknowledgePlatform] =
    useState(false);

  const [acknowledgePolicies, setAcknowledgePolicies] =
    useState(false);

  const [existingAcceptance, setExistingAcceptance] =
    useState<any>(null);

  const allAccepted = useMemo(() => {
    return (
      acknowledgeAgreement &&
      acknowledgePlatform &&
      acknowledgePolicies
    );
  }, [
    acknowledgeAgreement,
    acknowledgePlatform,
    acknowledgePolicies,
  ]);

  useEffect(() => {
    initializeAgreement();
  }, []);

  async function resolveRole() {
    const paramRole = normalizeRole(params.role);

    if (paramRole) {
      return paramRole;
    }

    const storedRole =
      (await AsyncStorage.getItem("currentUserRole")) ||
      (await AsyncStorage.getItem("userRole")) ||
      (await AsyncStorage.getItem("lastLoginRole"));

    const normalizedStoredRole = normalizeRole(storedRole);

    if (normalizedStoredRole) {
      return normalizedStoredRole;
    }

    const possibleSessions = [
      "currentCustomer",
      "currentFarmer",
      "currentDriver",
      "currentFreight",
      "currentFreightCarrier",
      "currentUser",
    ];

    for (const key of possibleSessions) {
      const raw = await AsyncStorage.getItem(key);

      if (!raw) continue;

      try {
        const parsed = JSON.parse(raw);
        const sessionRole = normalizeRole(parsed?.role);

        if (sessionRole) {
          return sessionRole;
        }
      } catch {
        // Ignore malformed local session.
      }
    }

    return null;
  }

  async function initializeAgreement() {
    try {
      setLoading(true);

      const resolvedRole = await resolveRole();

      if (!resolvedRole) {
        Alert.alert(
          "Account Type Required",
          "Farm2Home Direct could not determine your account type. Please log in again."
        );

        router.replace("/" as any);
        return;
      }

      setRole(resolvedRole);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        console.log(
          "Legal agreement auth lookup:",
          userError.message
        );
      }

      if (!user?.id) {
        Alert.alert(
          "Login Required",
          "Please log in before accepting the Farm2Home Direct Platform Agreement."
        );

        routeToLogin(resolvedRole);
        return;
      }

      const { data, error } = await supabase
        .from("legal_agreement_acceptances")
        .select(
          `
            id,
            user_id,
            role,
            agreement_type,
            agreement_version,
            agreement_text,
            agreement_hash,
            accepted,
            accepted_at,
            created_at
          `
        )
        .eq("user_id", user.id)
        .eq("role", resolvedRole)
        .eq("agreement_type", AGREEMENT_TYPE)
        .eq("agreement_version", AGREEMENT_VERSION)
        .eq("accepted", true)
        .maybeSingle();

      if (error) {
        console.log(
          "Agreement acceptance lookup error:",
          error.message
        );
      }

      if (data) {
        setExistingAcceptance(data);

        setAcknowledgeAgreement(true);
        setAcknowledgePlatform(true);
        setAcknowledgePolicies(true);
      }
    } catch (error: any) {
      console.log(
        "initializeAgreement error:",
        error
      );

      Alert.alert(
        "Agreement Error",
        error?.message ||
          "Unable to load the Farm2Home Direct agreement."
      );
    } finally {
      setLoading(false);
    }
  }

  function routeToLogin(accountRole: Farm2HomeRole) {
    const loginRoutes: Record<Farm2HomeRole, string> = {
      customer: "/customer/login",
      farmer: "/farmer/login",
      driver: "/driver/login",
      freight: "/freight/login",
    };

    router.replace(loginRoutes[accountRole] as any);
  }

  async function continueToApp() {
    if (!role) return;

    const returnTo = clean(params.returnTo);

    if (returnTo && returnTo.startsWith("/")) {
      router.replace(returnTo as any);
      return;
    }

    router.replace(ROLE_ROUTES[role] as any);
  }

  async function acceptAgreement() {
    if (!role || accepting) return;

    if (!allAccepted) {
      Alert.alert(
        "Acknowledgment Required",
        "You must acknowledge all Legal & Agreements items before continuing."
      );
      return;
    }

    try {
      setAccepting(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user?.id) {
        throw new Error(
          "Your login session expired. Please log in again."
        );
      }

      /**
       * First check again immediately before insert.
       * This prevents creating duplicate acceptance records.
       */
      const { data: alreadyAccepted } = await supabase
        .from("legal_agreement_acceptances")
        .select("*")
        .eq("user_id", user.id)
        .eq("role", role)
        .eq("agreement_type", AGREEMENT_TYPE)
        .eq("agreement_version", AGREEMENT_VERSION)
        .eq("accepted", true)
        .maybeSingle();

      if (alreadyAccepted) {
        setExistingAcceptance(alreadyAccepted);
        await saveLocalAgreementState(alreadyAccepted);
        await continueToApp();
        return;
      }

      /**
       * In production, the strongest design is for agreement_text
       * and agreement_hash to come from your server/legal_agreements
       * table instead of trusting the client.
       *
       * For Version 1.0 this screen preserves the exact agreement
       * text that the user accepted.
       */
      const agreementHash =
        `farm2home-platform-v${AGREEMENT_VERSION}`;

      const { data, error } = await supabase
        .from("legal_agreement_acceptances")
        .insert({
          user_id: user.id,

          role,

          agreement_type: AGREEMENT_TYPE,

          agreement_version:
            AGREEMENT_VERSION,

          agreement_text:
            PLATFORM_AGREEMENT_TEXT,

          agreement_hash:
            agreementHash,

          accepted: true,

          /**
           * DO NOT send accepted_at.
           *
           * PostgreSQL/Supabase generates the permanent
           * timestamp using DEFAULT now().
           */
        })
        .select("*")
        .single();

      if (error) {
        /**
         * If two requests somehow happened simultaneously,
         * the UNIQUE constraint should protect the record.
         * Retrieve the existing acceptance instead of changing it.
         */
        if (
          String(error.code) === "23505" ||
          String(error.message)
            .toLowerCase()
            .includes("duplicate")
        ) {
          const { data: existing, error: existingError } =
            await supabase
              .from(
                "legal_agreement_acceptances"
              )
              .select("*")
              .eq("user_id", user.id)
              .eq("role", role)
              .eq(
                "agreement_type",
                AGREEMENT_TYPE
              )
              .eq(
                "agreement_version",
                AGREEMENT_VERSION
              )
              .eq("accepted", true)
              .single();

          if (existingError) {
            throw existingError;
          }

          setExistingAcceptance(existing);

          await saveLocalAgreementState(
            existing
          );

          await continueToApp();
          return;
        }

        throw error;
      }

      setExistingAcceptance(data);

      await saveLocalAgreementState(data);

      Alert.alert(
        "Agreement Accepted",
        `Farm2Home Direct Platform Agreement Version ${AGREEMENT_VERSION} was accepted on ${formatAcceptedDate(
          data.accepted_at
        )}.`,
        [
          {
            text: "Continue",
            onPress: () => {
              continueToApp();
            },
          },
        ]
      );
    } catch (error: any) {
      console.log(
        "acceptAgreement error:",
        error
      );

      Alert.alert(
        "Agreement Error",
        error?.message ||
          "Unable to save your agreement acknowledgment."
      );
    } finally {
      setAccepting(false);
    }
  }

  async function saveLocalAgreementState(
    acceptance: any
  ) {
    await AsyncStorage.multiSet([
      [
        "farm2homeLegalAgreementAccepted",
        "true",
      ],
      [
        "farm2homeLegalAgreementVersion",
        clean(
          acceptance?.agreement_version ||
            AGREEMENT_VERSION
        ),
      ],
      [
        "farm2homeLegalAgreementAcceptedAt",
        clean(acceptance?.accepted_at),
      ],
      [
        "farm2homeLegalAgreementRole",
        clean(
          acceptance?.role || role
        ),
      ],
    ]);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={
            COLORS.background
          }
        />

        <View style={styles.loadingWrap}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            Loading Legal & Agreements...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={
          COLORS.background
        }
      />

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        <View style={styles.container}>
          <View style={styles.headerCard}>
            <View style={styles.iconBox}>
              <Ionicons
                name="shield-checkmark-outline"
                size={30}
                color={COLORS.white}
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                Legal & Agreements
              </Text>

              <Text style={styles.pageTitle}>
                Farm2Home Direct
              </Text>

              <Text style={styles.subtitle}>
                Platform Agreement
              </Text>
            </View>
          </View>

          <View style={styles.versionCard}>
            <View>
              <Text style={styles.versionLabel}>
                Agreement Version
              </Text>

              <Text style={styles.versionValue}>
                Version {AGREEMENT_VERSION}
              </Text>
            </View>

            <View style={styles.rolePill}>
              <Ionicons
                name="person-outline"
                size={15}
                color={
                  COLORS.primaryDark
                }
              />

              <Text style={styles.roleText}>
                {prettyRole(role)}
              </Text>
            </View>
          </View>

          {existingAcceptance ? (
            <View style={styles.acceptedCard}>
              <Ionicons
                name="checkmark-circle"
                size={30}
                color={COLORS.success}
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.acceptedTitle}>
                  Agreement Already Accepted
                </Text>

                <Text style={styles.acceptedText}>
                  Platform Agreement Version{" "}
                  {
                    existingAcceptance.agreement_version
                  }
                </Text>

                <Text style={styles.acceptedDate}>
                  Accepted:{" "}
                  {formatAcceptedDate(
                    existingAcceptance.accepted_at
                  )}
                </Text>

                <Text style={styles.permanentText}>
                  This acceptance record is
                  permanent and cannot be
                  changed from your profile.
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.requiredCard}>
              <Ionicons
                name="alert-circle-outline"
                size={22}
                color={COLORS.warning}
              />

              <Text style={styles.requiredText}>
                You must review and
                acknowledge this agreement
                before proceeding to
                Farm2Home Direct.
              </Text>
            </View>
          )}

          <View style={styles.agreementCard}>
            <Text style={styles.agreementTitle}>
              Farm2Home Direct Platform
              Agreement
            </Text>

            <Text style={styles.agreementVersion}>
              Version {AGREEMENT_VERSION}
            </Text>

            <View style={styles.divider} />

            <Text style={styles.agreementText}>
              {PLATFORM_AGREEMENT_TEXT}
            </Text>
          </View>

          <View style={styles.policyCard}>
            <Text style={styles.policyTitle}>
              Related Policies
            </Text>

            <Pressable
              style={styles.policyButton}
              onPress={() =>
                router.push(
                  "/terms" as any
                )
              }
            >
              <View
                style={
                  styles.policyIcon
                }
              >
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>

              <Text
                style={
                  styles.policyButtonText
                }
              >
                Terms of Service
              </Text>

              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={COLORS.muted}
              />
            </Pressable>

            <Pressable
              style={styles.policyButton}
              onPress={() =>
                router.push(
                  "/privacy" as any
                )
              }
            >
              <View
                style={
                  styles.policyIcon
                }
              >
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </View>

              <Text
                style={
                  styles.policyButtonText
                }
              >
                Privacy Policy
              </Text>

              <Ionicons
                name="chevron-forward-outline"
                size={18}
                color={COLORS.muted}
              />
            </Pressable>
          </View>

          {!existingAcceptance && (
            <View style={styles.ackCard}>
              <Text style={styles.ackTitle}>
                Required Acknowledgments
              </Text>

              <Text style={styles.ackSubtitle}>
                All three boxes must be
                selected before you can
                continue.
              </Text>

              <AgreementCheck
                checked={
                  acknowledgeAgreement
                }
                onPress={() =>
                  setAcknowledgeAgreement(
                    (value) => !value
                  )
                }
                text="I acknowledge that I have read and understand the Farm2Home Direct Platform Agreement."
              />

              <AgreementCheck
                checked={
                  acknowledgePlatform
                }
                onPress={() =>
                  setAcknowledgePlatform(
                    (value) => !value
                  )
                }
                text="I understand that Farm2Home Direct operates as a technology platform connecting customers with independent farmers, freight carriers and drivers."
              />

              <AgreementCheck
                checked={
                  acknowledgePolicies
                }
                onPress={() =>
                  setAcknowledgePolicies(
                    (value) => !value
                  )
                }
                text="I agree to the Terms of Service and acknowledge the Privacy Policy."
              />

              <Pressable
                style={[
                  styles.agreeButton,
                  (!allAccepted ||
                    accepting) &&
                    styles.agreeButtonDisabled,
                ]}
                disabled={
                  !allAccepted ||
                  accepting
                }
                onPress={acceptAgreement}
              >
                {accepting ? (
                  <ActivityIndicator
                    color={COLORS.white}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={21}
                      color={
                        COLORS.white
                      }
                    />

                    <Text
                      style={
                        styles.agreeButtonText
                      }
                    >
                      I Agree & Continue
                    </Text>
                  </>
                )}
              </Pressable>

              <Text
                style={
                  styles.acceptanceNotice
                }
              >
                Your acceptance will be
                recorded with the agreement
                version and a permanent
                database timestamp.
              </Text>
            </View>
          )}

          {existingAcceptance && (
            <Pressable
              style={styles.continueButton}
              onPress={continueToApp}
            >
              <Ionicons
                name="arrow-forward-circle-outline"
                size={21}
                color={COLORS.white}
              />

              <Text
                style={
                  styles.continueButtonText
                }
              >
                Continue to Farm2Home
                Direct
              </Text>
            </Pressable>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function AgreementCheck({
  checked,
  onPress,
  text,
}: {
  checked: boolean;
  onPress: () => void;
  text: string;
}) {
  return (
    <Pressable
      style={[
        styles.checkRow,
        checked &&
          styles.checkRowSelected,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.checkbox,
          checked &&
            styles.checkboxSelected,
        ]}
      >
        {checked && (
          <Ionicons
            name="checkmark"
            size={18}
            color={COLORS.white}
          />
        )}
      </View>

      <Text style={styles.checkText}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  content: {
    padding: 16,
    paddingBottom: 80,
  },

  container: {
    width: "100%",
    maxWidth: 920,
    alignSelf: "center",
  },

  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },

  loadingText: {
    color: COLORS.muted,
    fontWeight: "800",
    marginTop: 12,
  },

  headerCard: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 26,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 14,
  },

  iconBox: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  eyebrow: {
    color: "#BBF7D0",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
    textTransform: "uppercase",
  },

  pageTitle: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 27,
    marginTop: 3,
  },

  subtitle: {
    color: "#DCFCE7",
    fontWeight: "700",
    marginTop: 3,
  },

  versionCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 15,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  versionLabel: {
    color: COLORS.muted,
    fontWeight: "800",
    fontSize: 12,
  },

  versionValue: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 17,
    marginTop: 3,
  },

  rolePill: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  roleText: {
    color: COLORS.primaryDark,
    fontWeight: "900",
    fontSize: 12,
  },

  requiredCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
  },

  requiredText: {
    flex: 1,
    color: "#92400E",
    fontWeight: "800",
    lineHeight: 20,
  },

  acceptedCard: {
    backgroundColor: COLORS.successSoft,
    borderWidth: 1,
    borderColor: "#86EFAC",
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  acceptedTitle: {
    color: COLORS.success,
    fontWeight: "900",
    fontSize: 17,
  },

  acceptedText: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 5,
  },

  acceptedDate: {
    color: COLORS.text,
    fontWeight: "800",
    marginTop: 3,
  },

  permanentText: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },

  agreementCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 20,
    marginBottom: 14,
  },

  agreementTitle: {
    color: COLORS.text,
    fontSize: 23,
    fontWeight: "900",
  },

  agreementVersion: {
    color: COLORS.primary,
    fontWeight: "900",
    marginTop: 4,
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 18,
  },

  agreementText: {
    color: COLORS.text,
    lineHeight: 23,
    fontSize: 14,
    fontWeight: "600",
  },

  policyCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },

  policyTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 18,
    marginBottom: 10,
  },

  policyButton: {
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  policyIcon: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },

  policyButtonText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "900",
  },

  ackCard: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 18,
  },

  ackTitle: {
    color: COLORS.text,
    fontWeight: "900",
    fontSize: 21,
  },

  ackSubtitle: {
    color: COLORS.muted,
    fontWeight: "700",
    marginTop: 4,
    marginBottom: 14,
  },

  checkRow: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 17,
    padding: 14,
    marginBottom: 11,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },

  checkRowSelected: {
    backgroundColor: COLORS.primarySoft,
    borderColor: "#86B985",
  },

  checkbox: {
    width: 25,
    height: 25,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: "#98A2B3",
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },

  checkboxSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },

  checkText: {
    flex: 1,
    color: COLORS.text,
    fontWeight: "800",
    lineHeight: 21,
  },

  agreeButton: {
    minHeight: 58,
    backgroundColor: COLORS.primary,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 8,
  },

  agreeButtonDisabled: {
    backgroundColor: COLORS.disabled,
    opacity: 0.65,
  },

  agreeButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },

  acceptanceNotice: {
    color: COLORS.muted,
    fontWeight: "700",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
  },

  continueButton: {
    backgroundColor: COLORS.primary,
    minHeight: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 9,
    marginTop: 2,
  },

  continueButtonText: {
    color: COLORS.white,
    fontWeight: "900",
    fontSize: 16,
  },
});