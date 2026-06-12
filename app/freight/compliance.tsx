// app/freight/compliance.tsx

import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { supabase } from "../data/supabaseClient";

const FREIGHT_ROUTES = {
  dashboard: "/freight/dashboard",
  managementCenter: "/freight/freight-management-center",
  legal: "/freight/legal",
  documents: "/freight/documents",
  connectBank: "/freight/connect-bank",
  subscription: "/freight/subscription",
  profile: "/freight/profile",
  settings: "/freight/settings",
  support: "/freight/support",
  help: "/freight/help",
  board: "/freight/board",
  login: "/freight/login",
  register: "/freight/register",
} as const;

type FreightRoute = (typeof FREIGHT_ROUTES)[keyof typeof FREIGHT_ROUTES];

const COLORS = {
  bg: "#F4F5F7",
  card: "#FFFFFF",
  surface: "#F9FAFB",
  black: "#050505",
  red: "#D71920",
  text: "#111827",
  muted: "#6B7280",
  border: "#E5E7EB",
  green: "#16A34A",
  amber: "#D97706",
  blue: "#2563EB",
  slate: "#64748B",
};

function normalize(value: any) {
  return String(value || "").trim().toLowerCase();
}

function goTo(route: FreightRoute) {
  router.push(route as any);
}

export default function FreightComplianceScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [carrier, setCarrier] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);

  const [insuranceConfirmed, setInsuranceConfirmed] = useState(false);
  const [equipmentConfirmed, setEquipmentConfirmed] = useState(false);
  const [safetyConfirmed, setSafetyConfirmed] = useState(false);
  const [termsConfirmed, setTermsConfirmed] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadCompliance();
    }, [])
  );

  const status = useMemo(() => {
    const legalComplete = Boolean(
      carrier?.legalAccepted ||
        carrier?.legal_accepted ||
        carrier?.freightTermsAccepted ||
        carrier?.freight_terms_accepted
    );

    const stripeComplete = Boolean(
      (carrier?.stripeAccountId || carrier?.stripe_account_id) &&
        (carrier?.payoutsEnabled || carrier?.payouts_enabled) &&
        (carrier?.chargesEnabled || carrier?.charges_enabled) &&
        (carrier?.onboardingComplete || carrier?.stripe_onboarding_complete)
    );

    const subscriptionActive = ["active", "trialing"].includes(
      normalize(carrier?.subscriptionStatus || carrier?.subscription_status)
    );

    const requiredDocumentsUploaded =
      documents.length > 0 ||
      Boolean(carrier?.documents_uploaded || carrier?.compliance_documents_uploaded);

    const complianceChecklistComplete =
      insuranceConfirmed && equipmentConfirmed && safetyConfirmed && termsConfirmed;

    const complete =
      legalComplete &&
      stripeComplete &&
      subscriptionActive &&
      requiredDocumentsUploaded &&
      complianceChecklistComplete;

    return {
      legalComplete,
      stripeComplete,
      subscriptionActive,
      requiredDocumentsUploaded,
      complianceChecklistComplete,
      complete,
    };
  }, [carrier, documents, insuranceConfirmed, equipmentConfirmed, safetyConfirmed, termsConfirmed]);

  async function getStoredCarrier() {
    const raw =
      (await AsyncStorage.getItem("currentFreightCarrier")) ||
      (await AsyncStorage.getItem("currentFreight")) ||
      (await AsyncStorage.getItem("currentFreightUser")) ||
      (await AsyncStorage.getItem("currentUser"));

    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function persistCarrier(nextCarrier: any) {
    const normalizedCarrier = {
      ...nextCarrier,
      id: nextCarrier.id || nextCarrier.freightId,
      freightId: nextCarrier.freightId || nextCarrier.id,
      role: "freight",
      email: normalize(nextCarrier.email),
      companyName:
        nextCarrier.companyName ||
        nextCarrier.businessName ||
        nextCarrier.company_name ||
        nextCarrier.business_name ||
        "Freight Connect Carrier",
      businessName:
        nextCarrier.businessName ||
        nextCarrier.companyName ||
        nextCarrier.business_name ||
        nextCarrier.company_name ||
        "Freight Connect Carrier",
      stripeAccountId:
        nextCarrier.stripeAccountId || nextCarrier.stripe_account_id || "",
      stripe_account_id:
        nextCarrier.stripe_account_id || nextCarrier.stripeAccountId || "",
      payoutsEnabled:
        nextCarrier.payoutsEnabled ?? nextCarrier.payouts_enabled ?? false,
      chargesEnabled:
        nextCarrier.chargesEnabled ?? nextCarrier.charges_enabled ?? false,
      onboardingComplete:
        nextCarrier.onboardingComplete ??
        nextCarrier.stripe_onboarding_complete ??
        false,
      legalAccepted:
        nextCarrier.legalAccepted ?? nextCarrier.legal_accepted ?? false,
      freightTermsAccepted:
        nextCarrier.freightTermsAccepted ?? nextCarrier.freight_terms_accepted ?? false,
      subscriptionStatus:
        nextCarrier.subscriptionStatus || nextCarrier.subscription_status || "not_started",
    };

    await AsyncStorage.setItem("currentFreight", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightCarrier", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentFreightUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("currentUser", JSON.stringify(normalizedCarrier));
    await AsyncStorage.setItem("userRole", "freight");
    await AsyncStorage.setItem("currentUserRole", "freight");

    setCarrier(normalizedCarrier);
    return normalizedCarrier;
  }

  async function loadCompliance() {
    try {
      setLoading(true);

      const stored = await getStoredCarrier();
      const { data: authData } = await supabase.auth.getUser();
      const email = normalize(stored?.email || authData?.user?.email || "");

      if (!email) {
        router.replace(FREIGHT_ROUTES.login as any);
        return;
      }

      const { data: dbCarrier, error } = await supabase
        .from("freight_users")
        .select("*")
        .eq("email", email)
        .maybeSingle();

      if (error) {
        console.log("Freight compliance profile error:", error.message);
      }

      if (!dbCarrier) {
        Alert.alert(
          "Freight Profile Missing",
          "No freight profile was found. Please complete freight registration first."
        );
        router.replace(FREIGHT_ROUTES.register as any);
        return;
      }

      const mergedCarrier = {
        ...(stored || {}),
        ...(dbCarrier || {}),
        id: dbCarrier.id,
        freightId: dbCarrier.id,
        role: "freight",
        email: normalize(dbCarrier.email || email),
        companyName:
          dbCarrier.company_name ||
          dbCarrier.business_name ||
          stored?.companyName ||
          stored?.businessName ||
          "Freight Connect Carrier",
        businessName:
          dbCarrier.business_name ||
          dbCarrier.company_name ||
          stored?.businessName ||
          stored?.companyName ||
          "Freight Connect Carrier",
        stripeAccountId:
          dbCarrier.stripe_account_id ||
          stored?.stripeAccountId ||
          stored?.stripe_account_id ||
          "",
        stripe_account_id:
          dbCarrier.stripe_account_id ||
          stored?.stripe_account_id ||
          stored?.stripeAccountId ||
          "",
        payoutsEnabled:
          dbCarrier.payouts_enabled ??
          dbCarrier.stripe_payouts_enabled ??
          stored?.payoutsEnabled ??
          false,
        chargesEnabled:
          dbCarrier.charges_enabled ??
          dbCarrier.stripe_charges_enabled ??
          stored?.chargesEnabled ??
          false,
        onboardingComplete:
          dbCarrier.stripe_onboarding_complete ??
          stored?.onboardingComplete ??
          false,
        legalAccepted:
          dbCarrier.legal_accepted ??
          stored?.legalAccepted ??
          false,
        freightTermsAccepted:
          dbCarrier.freight_terms_accepted ??
          stored?.freightTermsAccepted ??
          false,
        subscriptionStatus:
          dbCarrier.subscription_status ||
          stored?.subscriptionStatus ||
          "not_started",
      };

      await persistCarrier(mergedCarrier);

      setInsuranceConfirmed(Boolean(dbCarrier.insurance_confirmed));
      setEquipmentConfirmed(Boolean(dbCarrier.equipment_confirmed));
      setSafetyConfirmed(Boolean(dbCarrier.safety_confirmed));
      setTermsConfirmed(Boolean(dbCarrier.compliance_terms_confirmed));

      const { data: docData, error: docError } = await supabase
        .from("freight_documents")
        .select("*")
        .eq("freight_id", dbCarrier.id)
        .order("created_at", { ascending: false });

      if (docError) {
        console.log("Freight documents load error:", docError.message);
        setDocuments([]);
      } else {
        setDocuments(Array.isArray(docData) ? docData : []);
      }
    } catch (error: any) {
      console.log("Freight compliance error:", error);
      Alert.alert("Compliance Error", error?.message || "Unable to load freight compliance.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await loadCompliance();
  }

  async function saveChecklist() {
    if (!carrier?.id) {
      Alert.alert("Profile Missing", "Please log in again.");
      router.replace(FREIGHT_ROUTES.login as any);
      return;
    }

    try {
      setSaving(true);

      const payload = {
        insurance_confirmed: insuranceConfirmed,
        equipment_confirmed: equipmentConfirmed,
        safety_confirmed: safetyConfirmed,
        compliance_terms_confirmed: termsConfirmed,
        compliance_status:
          insuranceConfirmed && equipmentConfirmed && safetyConfirmed && termsConfirmed
            ? "checklist_completed"
            : "incomplete",
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("freight_users")
        .update(payload)
        .eq("id", carrier.id);

      if (error) throw error;

      await persistCarrier({
        ...carrier,
        ...payload,
      });

      Alert.alert("Saved", "Freight compliance checklist was saved.");
    } catch (error: any) {
      Alert.alert("Save Error", error?.message || "Unable to save compliance checklist.");
    } finally {
      setSaving(false);
    }
  }

  function stripeStatusLabel() {
    if (status.stripeComplete) return "Complete";
    if (carrier?.stripeAccountId || carrier?.stripe_account_id) return "Needs Onboarding";
    return "Not Connected";
  }

  function renderStatusColor(value: boolean) {
    return value ? COLORS.green : COLORS.amber;
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />
        <ActivityIndicator size="large" color={COLORS.red} />
        <Text style={styles.centerText}>Loading freight compliance...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.black} />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>Farm2Home Freight Connect</Text>
            <Text style={styles.title}>Freight Compliance</Text>
            <Text style={styles.subtitle}>
              Review carrier requirements, legal acceptance, documents, subscription,
              Stripe Connect, safety, and payout readiness.
            </Text>
          </View>

          <TouchableOpacity style={styles.heroIcon} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
            <Ionicons name="shield-checkmark-outline" size={34} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.carrierCard}>
          <View style={styles.avatar}>
            <Ionicons name="business-outline" size={28} color="#FFFFFF" />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.carrierName}>
              {carrier?.companyName || "Freight Connect Carrier"}
            </Text>
            <Text style={styles.carrierEmail}>{carrier?.email || "Carrier workspace"}</Text>

            <View
              style={[
                styles.overallPill,
                { backgroundColor: status.complete ? COLORS.green : COLORS.amber },
              ]}
            >
              <Text style={styles.overallPillText}>
                {status.complete ? "Compliance Complete" : "Action Required"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.quickGrid}>
          <QuickLink icon="shield-checkmark-outline" label="Legal" route={FREIGHT_ROUTES.legal} />
          <QuickLink icon="document-attach-outline" label="Documents" route={FREIGHT_ROUTES.documents} />
          <QuickLink icon="business-outline" label="Connect Bank" route={FREIGHT_ROUTES.connectBank} />
          <QuickLink icon="card-outline" label="Subscription" route={FREIGHT_ROUTES.subscription} />
        </View>

        <View style={styles.statusGrid}>
          <StatusCard
            icon="document-text-outline"
            label="Legal Terms"
            value={status.legalComplete ? "Accepted" : "Required"}
            complete={status.legalComplete}
            route={FREIGHT_ROUTES.legal}
          />

          <StatusCard
            icon="document-attach-outline"
            label="Documents"
            value={status.requiredDocumentsUploaded ? "Uploaded" : "Needed"}
            complete={status.requiredDocumentsUploaded}
            route={FREIGHT_ROUTES.documents}
          />

          <StatusCard
            icon="business-outline"
            label="Stripe Connect"
            value={stripeStatusLabel()}
            complete={status.stripeComplete}
            route={FREIGHT_ROUTES.connectBank}
          />

          <StatusCard
            icon="card-outline"
            label="Subscription"
            value={status.subscriptionActive ? "Active" : "Not Active"}
            complete={status.subscriptionActive}
            route={FREIGHT_ROUTES.subscription}
          />
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="checkmark-circle-outline"
            title="Carrier Compliance Checklist"
            subtitle="Confirm key operating requirements for freight access."
          />

          <ChecklistRow
            label="Insurance and carrier coverage are current"
            value={insuranceConfirmed}
            onChange={setInsuranceConfirmed}
          />

          <ChecklistRow
            label="Equipment is safe, clean, and suitable for accepted loads"
            value={equipmentConfirmed}
            onChange={setEquipmentConfirmed}
          />

          <ChecklistRow
            label="I understand safety, cold-chain, and livestock handling requirements"
            value={safetyConfirmed}
            onChange={setSafetyConfirmed}
          />

          <ChecklistRow
            label="I agree to keep documentation and profile information accurate"
            value={termsConfirmed}
            onChange={setTermsConfirmed}
          />

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={saveChecklist}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.primaryText}>Save Compliance Checklist</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="document-attach-outline"
            title="Document Status"
            subtitle="Uploaded freight carrier documents connected to this profile."
          />

          {documents.length === 0 ? (
            <View style={styles.emptyDocBox}>
              <Ionicons name="document-outline" size={30} color={COLORS.red} />
              <Text style={styles.emptyDocTitle}>No freight documents found.</Text>
              <Text style={styles.emptyDocText}>
                Upload insurance, equipment, authority, or compliance documents.
              </Text>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() => goTo(FREIGHT_ROUTES.documents)}
              >
                <Text style={styles.secondaryButtonText}>Open Documents</Text>
              </TouchableOpacity>
            </View>
          ) : (
            documents.map((doc) => (
              <View key={String(doc.id)} style={styles.docRow}>
                <Ionicons name="document-text-outline" size={20} color={COLORS.red} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.docTitle}>
                    {doc.document_type || doc.title || doc.file_name || "Freight Document"}
                  </Text>
                  <Text style={styles.docSub}>
                    Status: {doc.status || doc.review_status || "submitted"}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <SectionHeader
            icon="navigate-circle-outline"
            title="Next Steps"
            subtitle="Complete these actions to keep freight operations ready."
          />

          <NextStep text="Accept legal and safety terms" complete={status.legalComplete} />
          <NextStep text="Upload required carrier documents" complete={status.requiredDocumentsUploaded} />
          <NextStep text="Finish Stripe Connect onboarding" complete={status.stripeComplete} />
          <NextStep text="Maintain active freight subscription" complete={status.subscriptionActive} />
          <NextStep text="Save compliance checklist" complete={status.complianceChecklistComplete} />
        </View>

        <TouchableOpacity style={styles.primaryButtonPage} onPress={() => goTo(FREIGHT_ROUTES.managementCenter)}>
          <Ionicons name="apps-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Back to Management Center</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.darkButton} onPress={() => goTo(FREIGHT_ROUTES.support)}>
          <Ionicons name="headset-outline" size={18} color="#FFFFFF" />
          <Text style={styles.primaryText}>Compliance Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={20} color="#FFFFFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

function QuickLink({
  icon,
  label,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.quickLink} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={22} color={COLORS.red} />
      <Text style={styles.quickText}>{label}</Text>
    </TouchableOpacity>
  );
}

function StatusCard({
  icon,
  label,
  value,
  complete,
  route,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  complete: boolean;
  route: FreightRoute;
}) {
  return (
    <TouchableOpacity style={styles.statusCard} onPress={() => goTo(route)}>
      <Ionicons name={icon} size={23} color={complete ? COLORS.green : COLORS.amber} />
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusValue, { color: complete ? COLORS.green : COLORS.amber }]}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

function ChecklistRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <View style={styles.checklistRow}>
      <Text style={styles.checklistText}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: "#CBD5E1", true: "#FCA5A5" }}
        thumbColor={value ? COLORS.red : "#FFFFFF"}
      />
    </View>
  );
}

function NextStep({ text, complete }: { text: string; complete: boolean }) {
  return (
    <View style={styles.nextStep}>
      <Ionicons
        name={complete ? "checkmark-circle" : "alert-circle-outline"}
        size={20}
        color={complete ? COLORS.green : COLORS.amber}
      />
      <Text style={styles.nextStepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  content: { paddingBottom: 90 },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  centerText: { color: COLORS.muted, marginTop: 12, fontWeight: "800" },
  hero: {
    backgroundColor: COLORS.black,
    paddingTop: 30,
    paddingHorizontal: 20,
    paddingBottom: 30,
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
  },
  heroIcon: {
    width: 58,
    height: 58,
    borderRadius: 24,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: "#FCA5A5",
    fontWeight: "900",
    marginBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 12,
  },
  title: { color: "#FFFFFF", fontSize: 32, fontWeight: "900", marginBottom: 10 },
  subtitle: { color: "#D1D5DB", lineHeight: 22, fontWeight: "700" },
  carrierCard: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 20,
    backgroundColor: COLORS.red,
    alignItems: "center",
    justifyContent: "center",
  },
  carrierName: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  carrierEmail: { color: COLORS.muted, fontWeight: "700", marginTop: 4 },
  overallPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 9,
  },
  overallPillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "900" },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  quickLink: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    gap: 8,
  },
  quickText: { color: COLORS.text, fontWeight: "900", textAlign: "center" },
  statusGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: 18,
    marginBottom: 14,
  },
  statusCard: {
    width: "48%",
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 15,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusLabel: { color: COLORS.text, fontWeight: "900", marginTop: 8 },
  statusValue: { fontWeight: "900", marginTop: 4 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    padding: 18,
    marginHorizontal: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeader: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: COLORS.black,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: { color: COLORS.text, fontSize: 21, fontWeight: "900" },
  sectionSubtitle: { color: COLORS.muted, fontWeight: "700", lineHeight: 20, marginTop: 3 },
  checklistRow: {
    backgroundColor: COLORS.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 13,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checklistText: { color: COLORS.text, fontWeight: "900", flex: 1, lineHeight: 20 },
  primaryButton: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  primaryText: { color: "#FFFFFF", fontWeight: "900" },
  emptyDocBox: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    padding: 18,
    alignItems: "center",
  },
  emptyDocTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900", marginTop: 8 },
  emptyDocText: {
    color: COLORS.muted,
    textAlign: "center",
    fontWeight: "700",
    marginTop: 5,
    lineHeight: 20,
  },
  secondaryButton: {
    backgroundColor: "#FFF1F2",
    borderWidth: 1,
    borderColor: COLORS.red,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  secondaryButtonText: { color: COLORS.red, fontWeight: "900" },
  docRow: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  docTitle: { color: COLORS.text, fontWeight: "900" },
  docSub: { color: COLORS.muted, fontWeight: "700", marginTop: 3 },
  nextStep: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 13,
    marginBottom: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  nextStepText: { color: COLORS.text, fontWeight: "900", flex: 1, lineHeight: 20 },
  primaryButtonPage: {
    backgroundColor: COLORS.red,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 4,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  darkButton: {
    backgroundColor: COLORS.black,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 18,
    marginTop: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
});