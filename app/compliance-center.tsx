// app/farmer/compliance-resources.tsx

import React from "react";
import {
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const complianceLinks = [
  {
    title: "State Department of Agriculture",
    description:
      "Find state rules for farm products, inspections, meat, eggs, dairy, and farm markets.",
    url: "https://www.nasda.org/state-directory/",
  },
  {
    title: "FDA State Food Code Directory",
    description:
      "Find state food safety and health department rules for food sales.",
    url: "https://www.fda.gov/food/fda-food-code/state-retail-and-food-service-codes-and-regulations-state",
  },
  {
    title: "Cottage Food Laws by State",
    description:
      "Check rules for baked goods, jams, sauces, shelf-stable foods, and home-based products.",
    url: "https://www.cottagefoodlicense.com/states",
  },
  {
    title: "Farmers Market Rules",
    description:
      "Review farmers market laws, vendor rules, and product guidance.",
    url: "https://www.afdo.org/resources/farmers-market-laws-and-guidance/",
  },
  {
    title: "IRS EIN Application",
    description:
      "Optional resource to apply for an Employer Identification Number.",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
  },
  {
    title: "IRS W-9 Form",
    description:
      "Optional tax form often requested by business buyers or vendors.",
    url: "https://www.irs.gov/forms-pubs/about-form-w-9",
  },
];

const requiredForFarm2Home = [
  "Business information",
  "Application fee",
  "Farmer membership",
  "Stripe payout setup",
  "Product categories",
  "Pickup / delivery selection",
  "Seller agreement",
];

const specialProductDocuments = [
  "Meat: USDA processing documentation may be required.",
  "Dairy: State dairy license may be required.",
  "Eggs: Egg permit may be required by state.",
  "Baked goods, jams, sauces: Cottage food permit may be required.",
  "Plants / nursery stock: Nursery license may be required.",
];

const optionalBusinessDocuments = [
  "EIN",
  "W-9 form",
  "Business registration / DBA / LLC",
  "Sales tax or exemption form",
  "Liability insurance",
  "Invoice template",
  "Farmers market permit",
];

export default function ComplianceResourcesScreen() {
  async function openLink(url: string) {
    try {
      const supported = await Linking.canOpenURL(url);

      if (!supported) {
        Alert.alert("Cannot Open Link", "This link could not be opened.");
        return;
      }

      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot Open Link", "This link could not be opened.");
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Farmer Compliance Resources</Text>

      <Text style={styles.subtitle}>
        These links are optional resources to help farmers understand state and
        product-specific selling rules. They are not all required to complete
        Farm2Home setup.
      </Text>

      <View style={styles.noticeBox}>
        <Text style={styles.noticeTitle}>Farm2Home Required Setup</Text>

        {requiredForFarm2Home.map((item) => (
          <Text key={item} style={styles.item}>
            • {item}
          </Text>
        ))}
      </View>

      <View style={styles.checklist}>
        <Text style={styles.section}>Special Product Documents</Text>
        <Text style={styles.helper}>
          These are only needed if the farmer sells certain regulated products.
        </Text>

        {specialProductDocuments.map((item) => (
          <Text key={item} style={styles.item}>
            • {item}
          </Text>
        ))}
      </View>

      <View style={styles.checklist}>
        <Text style={styles.section}>Optional Business Documents</Text>
        <Text style={styles.helper}>
          These may be useful for business buyers, taxes, or wholesale accounts,
          but they are not required for every farmer during Farm2Home signup.
        </Text>

        {optionalBusinessDocuments.map((item) => (
          <Text key={item} style={styles.item}>
            • {item}
          </Text>
        ))}
      </View>

      <Text style={styles.section}>Official Resource Links</Text>

      {complianceLinks.map((link) => (
        <TouchableOpacity
          key={link.title}
          style={styles.card}
          onPress={() => openLink(link.url)}
          activeOpacity={0.85}
        >
          <Text style={styles.cardTitle}>{link.title}</Text>
          <Text style={styles.cardText}>{link.description}</Text>
          <Text style={styles.open}>Open Link →</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    marginTop: 20,
    color: "#2F7D32",
  },
  subtitle: {
    color: "#666666",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 22,
    fontWeight: "700",
  },
  noticeBox: {
    backgroundColor: "#ECFDF5",
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#86EFAC",
  },
  noticeTitle: {
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
    color: "#14532D",
  },
  checklist: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  section: {
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
    color: "#111111",
  },
  helper: {
    color: "#666666",
    fontWeight: "700",
    lineHeight: 21,
    marginBottom: 12,
  },
  item: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "700",
    color: "#333333",
    lineHeight: 22,
  },
  card: {
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#EEEEEE",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111111",
  },
  cardText: {
    color: "#555555",
    marginTop: 6,
    lineHeight: 21,
    fontWeight: "700",
  },
  open: {
    color: "#2F7D32",
    fontWeight: "900",
    marginTop: 12,
  },
});