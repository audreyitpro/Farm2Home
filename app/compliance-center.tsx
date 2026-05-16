import React from "react";
import {
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from "react-native";

const complianceLinks = [
  {
    title: "State Department of Agriculture",
    description:
      "Find state rules for farm products, inspections, meat, eggs, dairy, and markets.",
    url: "https://www.nasda.org/state-directory/",
  },
  {
    title: "FDA State Food Code Directory",
    description:
      "Find food safety and health department rules by state.",
    url: "https://www.fda.gov/food/fda-food-code/state-retail-and-food-service-codes-and-regulations-state",
  },
  {
    title: "Cottage Food Laws by State",
    description:
      "Find rules for baked goods, jams, honey, shelf-stable foods, and home-based products.",
    url: "https://www.cottagefoodlicense.com/states",
  },
  {
    title: "IRS State Government Websites",
    description:
      "Find business registration, tax, and state agency links.",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites",
  },
  {
    title: "Farmers Market Rules",
    description:
      "Find farmers market laws, vendor rules, and product guidance.",
    url: "https://www.afdo.org/resources/farmers-market-laws-and-guidance/",
  },
  {
    title: "IRS EIN Application",
    description:
      "Apply for an Employer Identification Number for your farm business.",
    url: "https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online",
  },
  {
    title: "IRS W-9 Form",
    description:
      "Download the official W-9 form often needed for business buyers and vendors.",
    url: "https://www.irs.gov/forms-pubs/about-form-w-9",
  },
];

export default function ComplianceCenter() {
  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Cannot Open Link", "This link could not be opened.");
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Farmer Compliance Center</Text>

      <Text style={styles.subtitle}>
        State-by-state document links and selling guidelines for farmers.
      </Text>

      <View style={styles.checklist}>
        <Text style={styles.section}>Buyer-Ready Checklist</Text>
        <Text style={styles.item}>✅ EIN</Text>
        <Text style={styles.item}>✅ W-9 Form</Text>
        <Text style={styles.item}>✅ Business Registration / DBA / LLC</Text>
        <Text style={styles.item}>✅ Sales Tax or Exemption Form</Text>
        <Text style={styles.item}>✅ Food Safety License if needed</Text>
        <Text style={styles.item}>✅ Liability Insurance</Text>
        <Text style={styles.item}>✅ Invoice Template</Text>
      </View>

      <Text style={styles.section}>Official Resource Links</Text>

      {complianceLinks.map((link) => (
        <TouchableOpacity
          key={link.title}
          style={styles.card}
          onPress={() => openLink(link.url)}
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
    color: "#666",
    marginTop: 6,
    marginBottom: 20,
    lineHeight: 22,
  },
  checklist: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#eee",
  },
  section: {
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 12,
    color: "#111",
  },
  item: {
    fontSize: 16,
    marginBottom: 8,
    fontWeight: "700",
    color: "#333",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#eee",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#111",
  },
  cardText: {
    color: "#555",
    marginTop: 6,
    lineHeight: 21,
  },
  open: {
    color: "#2F7D32",
    fontWeight: "900",
    marginTop: 12,
  },
});