import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";

import { getFreightLoads, FreightLoad } from "./data/freightLoads";
import {
  FreightBid,
  getBidsForLoad,
  saveBid,
  acceptBid,
} from "./data/freightBids";
import { createTracking } from "./data/trackingStore";

export default function LoadDetail() {
  const params = useLocalSearchParams();

  const loadId = Array.isArray(params.loadId)
    ? params.loadId[0]
    : params.loadId || "";

  const [load, setLoad] = useState<FreightLoad | null>(null);
  const [bids, setBids] = useState<FreightBid[]>([]);
  const [carrier, setCarrier] = useState<any>(null);

  const [bidPerMile, setBidPerMile] = useState("");
  const [message, setMessage] = useState("");

  const loadScreen = useCallback(async () => {
    const carrierRaw = await AsyncStorage.getItem("currentFreightCarrier");

    if (carrierRaw) {
      setCarrier(JSON.parse(carrierRaw));
    }

    const loads = await getFreightLoads();
    const selected = loads.find((item) => item.id === String(loadId));

    setLoad(selected || null);

    if (loadId) {
      const loadBids = await getBidsForLoad(String(loadId));
      setBids(loadBids);
    }
  }, [loadId]);

  useEffect(() => {
    loadScreen();
  }, [loadScreen]);

  async function submitBid() {
    if (!load) return;

    if (!carrier) {
      Alert.alert(
        "Carrier Login Required",
        "Please login as a Freight Connect carrier."
      );
      router.push("/freight/login");
      return;
    }

    const bidRate = Number(bidPerMile);

    if (!bidRate || Number.isNaN(bidRate) || bidRate <= 0) {
      Alert.alert("Invalid Bid", "Enter a valid bid per mile.");
      return;
    }

    const bid: FreightBid = {
      id: `BID${Date.now()}`,
      loadId: load.id,
      carrierCompany: carrier.companyName || "Freight Carrier",
      carrierEmail: carrier.email || "",
      bidPerMile: bidRate,
      totalBid: bidRate * load.miles,
      message: message.trim(),
      status: "Pending",
      createdAt: new Date().toLocaleString(),
    };

    await saveBid(bid);

    setBidPerMile("");
    setMessage("");

    Alert.alert("Bid Submitted", "Your bid was sent.");

    loadScreen();
  }

  async function handleAcceptBid(bid: FreightBid) {
    if (!load) return;

    await acceptBid(load.id, bid.id);

    await createTracking({
      loadId: load.id,
      carrierCompany: bid.carrierCompany,
      carrierEmail: bid.carrierEmail,
      status: "Assigned",
      lastUpdated: new Date().toLocaleString(),
      notes: "Carrier assigned from accepted bid.",
    });

    Alert.alert("Bid Accepted", "Carrier assigned and tracking started.");

    loadScreen();
  }

  if (!load) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Load not found.</Text>
      </View>
    );
  }

  const postedTotal = load.miles * load.ratePerMile;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Load Details</Text>

      <View style={styles.card}>
        <Text style={styles.loadType}>{load.loadType}</Text>
        <Text style={styles.description}>{load.cargoDescription}</Text>

        <Text style={styles.label}>Posted By</Text>
        <Text style={styles.value}>{load.postedBy}</Text>

        <Text style={styles.label}>Route</Text>
        <Text style={styles.value}>
          {load.pickup} → {load.dropoff}
        </Text>

        <Text style={styles.label}>Pickup Date</Text>
        <Text style={styles.value}>{load.pickupDate}</Text>

        <Text style={styles.label}>Miles</Text>
        <Text style={styles.value}>{load.miles}</Text>

        <Text style={styles.label}>Posted Rate</Text>
        <Text style={styles.value}>${load.ratePerMile.toFixed(2)} / mile</Text>

        <Text style={styles.total}>Posted Total: ${postedTotal.toFixed(2)}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Submit Carrier Bid</Text>

        <TextInput
          style={styles.input}
          placeholder="Your bid per mile"
          placeholderTextColor="#777"
          keyboardType="decimal-pad"
          value={bidPerMile}
          onChangeText={setBidPerMile}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Message to farmer/business"
          placeholderTextColor="#777"
          multiline
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity style={styles.button} onPress={submitBid}>
          <Text style={styles.buttonText}>Submit Bid</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.section}>Carrier Bids</Text>

        <FlatList
          data={bids}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.value}>No bids yet.</Text>}
          renderItem={({ item }) => (
            <View style={styles.bidCard}>
              <Text style={styles.bidCompany}>{item.carrierCompany}</Text>
              <Text style={styles.value}>${item.bidPerMile.toFixed(2)} / mile</Text>
              <Text style={styles.value}>Total Bid: ${item.totalBid.toFixed(2)}</Text>
              <Text style={styles.value}>Status: {item.status}</Text>

              {!!item.message && (
                <Text style={styles.value}>Message: {item.message}</Text>
              )}

              {item.status === "Pending" && (
                <TouchableOpacity
                  style={styles.acceptButton}
                  onPress={() => handleAcceptBid(item)}
                >
                  <Text style={styles.buttonText}>Accept Bid</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      </View>

      <TouchableOpacity
        style={styles.trackButton}
        onPress={() =>
          router.push({
            pathname: "/freight/tracking",
            params: { loadId: load.id },
          })
        }
      >
        <Text style={styles.buttonText}>View Live Tracking</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7F7F2",
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    padding: 18,
    backgroundColor: "#F7F7F2",
    justifyContent: "center",
  },
  emptyText: {
    fontWeight: "900",
    color: "#333",
    textAlign: "center",
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#1f7a3f",
    marginBottom: 14,
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  loadType: {
    fontSize: 20,
    fontWeight: "900",
    color: "#1f7a3f",
  },
  description: {
    fontWeight: "800",
    marginVertical: 8,
    color: "#111827",
  },
  label: {
    marginTop: 10,
    fontWeight: "900",
    color: "#333",
  },
  value: {
    color: "#111827",
    fontWeight: "700",
  },
  total: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: "900",
    color: "#1f7a3f",
  },
  section: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 12,
    color: "#111827",
  },
  input: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 14,
    borderRadius: 12,
    marginBottom: 12,
    color: "#111827",
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#2F7D32",
    padding: 14,
    borderRadius: 12,
  },
  buttonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "900",
  },
  bidCard: {
    backgroundColor: "#F7F7F2",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  bidCompany: {
    fontWeight: "900",
    fontSize: 16,
    color: "#111827",
  },
  acceptButton: {
    backgroundColor: "#1f7a3f",
    padding: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  trackButton: {
    backgroundColor: "#1E5F74",
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
});