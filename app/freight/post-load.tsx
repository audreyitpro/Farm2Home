import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import { addFreightLoad } from "../data/freightLoadStore";

type LoadType =
  | "Livestock"
  | "Refrigerated Fresh Food"
  | "Other";

const MIN_RATE_PER_MILE = 1.5;
const MAX_RATE_PER_MILE = 3.5;

const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || "";

export default function FreightPostLoadScreen() {
  const [farmerName, setFarmerName] = useState(
    "Green Valley Farms"
  );

  const [loadTitle, setLoadTitle] = useState(
    "Fresh Produce Delivery"
  );

  const [loadType, setLoadType] =
    useState<LoadType>(
      "Refrigerated Fresh Food"
    );

  const [requiredEquipment, setRequiredEquipment] =
    useState("Refrigerated Truck");

  const [pickupLocation, setPickupLocation] =
    useState("");

  const [dropoffLocation, setDropoffLocation] =
    useState("");

  const [pickupDate, setPickupDate] =
    useState("");

  const [deliveryDeadline, setDeliveryDeadline] =
    useState("");

  const [weight, setWeight] = useState("");

  const [miles, setMiles] = useState("");
  const [distanceText, setDistanceText] =
    useState("");

  const [ratePerMile, setRatePerMile] =
    useState("1.50");

  const [contactName, setContactName] =
    useState("");

  const [contactPhone, setContactPhone] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [calculatingMiles, setCalculatingMiles] =
    useState(false);

  const milesNumber = Number(miles || 0);
  const rateNumber = Number(ratePerMile || 0);

  const payoutAmount = milesNumber * rateNumber;

  function selectEquipment(value: string) {
    setRequiredEquipment(value);

    if (value === "Livestock Trailer") {
      setLoadType("Livestock");
    }

    if (value === "Refrigerated Truck") {
      setLoadType(
        "Refrigerated Fresh Food"
      );
    }

    if (value === "Dry Van") {
      setLoadType("Other");
    }
  }

  async function calculateDistance() {
    if (
      !pickupLocation.trim() ||
      !dropoffLocation.trim()
    ) {
      Alert.alert(
        "Missing Locations",
        "Please enter pickup and dropoff locations."
      );

      return;
    }

    if (!GOOGLE_MAPS_API_KEY) {
      Alert.alert(
        "Manual Miles Needed",
        "Google Maps API key is not connected yet. Please enter total miles manually."
      );

      return;
    }

    try {
      setCalculatingMiles(true);

      const origin = encodeURIComponent(
        pickupLocation.trim()
      );

      const destination =
        encodeURIComponent(
          dropoffLocation.trim()
        );

      const url =
        `https://maps.googleapis.com/maps/api/distancematrix/json` +
        `?origins=${origin}` +
        `&destinations=${destination}` +
        `&units=imperial` +
        `&key=${GOOGLE_MAPS_API_KEY}`;

      console.log(
        "Distance URL:",
        url.replace(
          GOOGLE_MAPS_API_KEY,
          "API_KEY_HIDDEN"
        )
      );

      const response = await fetch(url);

      const data = await response.json();

      console.log(
        "Distance Matrix response:",
        data
      );

      const element =
        data?.rows?.[0]?.elements?.[0];

      if (data?.status !== "OK") {
        Alert.alert(
          "Google Maps Error",
          data?.error_message ||
            `API status: ${
              data?.status || "Unknown"
            }`
        );

        return;
      }

      if (element?.status !== "OK") {
        Alert.alert(
          "Route Error",
          `Route status: ${
            element?.status || "Unknown"
          }. Enter miles manually.`
        );

        return;
      }

      const meters = Number(
        element.distance?.value || 0
      );

      const calculatedMiles =
        meters / 1609.344;

      setMiles(
        calculatedMiles.toFixed(1)
      );

      setDistanceText(
        element.distance?.text ||
          `${calculatedMiles.toFixed(
            1
          )} miles`
      );

      Alert.alert(
        "Distance Calculated",
        `${calculatedMiles.toFixed(
          1
        )} miles`
      );
    } catch (error: any) {
      console.log(
        "Distance calculation error:",
        error
      );

      Alert.alert(
        "Distance Error",
        error?.message ||
          "Unable to calculate distance. Enter miles manually."
      );
    } finally {
      setCalculatingMiles(false);
    }
  }

  async function postLoad() {
    if (
      !farmerName.trim() ||
      !pickupLocation.trim() ||
      !dropoffLocation.trim() ||
      !pickupDate.trim() ||
      !deliveryDeadline.trim() ||
      !contactName.trim() ||
      !contactPhone.trim()
    ) {
      Alert.alert(
        "Missing Information",
        "Please complete all required fields."
      );

      return;
    }

    if (milesNumber <= 0) {
      Alert.alert(
        "Missing Miles",
        "Please calculate or enter route miles."
      );

      return;
    }

    if (
      rateNumber <
        MIN_RATE_PER_MILE ||
      rateNumber >
        MAX_RATE_PER_MILE
    ) {
      Alert.alert(
        "Invalid Rate",
        "Rate must be between $1.50 and $3.50 per mile."
      );

      return;
    }

    try {
      const now =
        new Date().toISOString();

      await addFreightLoad({
        id: `load_${Date.now()}`,

        farmerName,
        farmName: farmerName,

        title: loadTitle,

        commodity: loadType,
        equipment:
          requiredEquipment,
        weight,

        miles: milesNumber,
        ratePerMile:
          rateNumber,

        loadType,

        description,

        pickupLocation,
        dropoffLocation,

        pickupDate,
        deliveryDeadline,

        payoutAmount,

        status: "OPEN",

        createdAt: now,
        updatedAt: now,
      });

      Alert.alert(
        "Load Posted",
        "Your freight load is now visible on the freight board.",
        [
          {
            text: "Open Freight Board",
            onPress: () =>
              router.push(
                "/freight/board" as any
              ),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        "Post Error",
        error?.message ||
          "Unable to post freight load."
      );
    }
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={
        styles.content
      }
    >
      <Text style={styles.title}>
        Freight Load Creation
      </Text>

      <Text style={styles.subtitle}>
        Create freight opportunities
        with automatic route mileage
        and payout calculations.
      </Text>

      <TextInput
        style={styles.input}
        value={farmerName}
        onChangeText={setFarmerName}
        placeholder="Farm / Business Name"
      />

      <TextInput
        style={styles.input}
        value={loadTitle}
        onChangeText={setLoadTitle}
        placeholder="Load Title"
      />

      <Text style={styles.label}>
        Required Equipment
      </Text>

      {[
        "Livestock Trailer",
        "Refrigerated Truck",
        "Dry Van",
      ].map((item) => (
        <TouchableOpacity
          key={item}
          style={[
            styles.equipmentButton,
            requiredEquipment ===
              item &&
              styles.equipmentButtonActive,
          ]}
          onPress={() =>
            selectEquipment(item)
          }
        >
          <Text
            style={[
              styles.equipmentButtonText,
              requiredEquipment ===
                item &&
                styles.equipmentButtonTextActive,
            ]}
          >
            {item}
          </Text>
        </TouchableOpacity>
      ))}

      <TextInput
        style={[
          styles.input,
          styles.textArea,
        ]}
        value={description}
        onChangeText={setDescription}
        placeholder="Load Description"
        multiline
      />

      <TextInput
        style={styles.input}
        value={pickupLocation}
        onChangeText={
          setPickupLocation
        }
        placeholder="Pickup Location / Origin"
      />

      <TextInput
        style={styles.input}
        value={dropoffLocation}
        onChangeText={
          setDropoffLocation
        }
        placeholder="Dropoff Location / Destination"
      />

      <TouchableOpacity
        style={
          styles.calculateButton
        }
        onPress={
          calculateDistance
        }
      >
        {calculatingMiles ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text
            style={
              styles.calculateButtonText
            }
          >
            Calculate Distance &
            Miles
          </Text>
        )}
      </TouchableOpacity>

      <View
        style={styles.distanceBox}
      >
        <Text
          style={styles.distanceTitle}
        >
          Distance & Payout
        </Text>

        <Text
          style={styles.distanceText}
        >
          {distanceText ||
            "Distance not calculated yet"}
        </Text>

        <TextInput
          style={styles.input}
          value={miles}
          onChangeText={setMiles}
          placeholder="Total Miles"
          keyboardType="numeric"
        />

        <TextInput
          style={styles.input}
          value={ratePerMile}
          onChangeText={
            setRatePerMile
          }
          placeholder="Rate Per Mile"
          keyboardType="numeric"
        />

        <View
          style={
            styles.rateButtonsRow
          }
        >
          <TouchableOpacity
            style={styles.rateButton}
            onPress={() =>
              setRatePerMile(
                "1.50"
              )
            }
          >
            <Text
              style={
                styles.rateButtonText
              }
            >
              Minimum $1.50 /
              mile
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.rateButton}
            onPress={() =>
              setRatePerMile(
                "3.50"
              )
            }
          >
            <Text
              style={
                styles.rateButtonText
              }
            >
              Maximum $3.50 /
              mile
            </Text>
          </TouchableOpacity>
        </View>

        <Text
          style={styles.payoutText}
        >
          {milesNumber.toFixed(
            1
          )}{" "}
          miles × $
          {rateNumber.toFixed(2)} /
          mile
        </Text>

        <Text
          style={styles.totalPayout}
        >
          Carrier Payout: $
          {payoutAmount.toFixed(2)}
        </Text>
      </View>

      <TextInput
        style={styles.input}
        value={pickupDate}
        onChangeText={setPickupDate}
        placeholder="Pickup Date / Time"
      />

      <TextInput
        style={styles.input}
        value={deliveryDeadline}
        onChangeText={
          setDeliveryDeadline
        }
        placeholder="Delivery Deadline"
      />

      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        placeholder="Weight"
      />

      <TextInput
        style={styles.input}
        value={contactName}
        onChangeText={setContactName}
        placeholder="Contact Name"
      />

      <TextInput
        style={styles.input}
        value={contactPhone}
        onChangeText={setContactPhone}
        placeholder="Contact Phone"
      />

      <TouchableOpacity
        style={styles.postButton}
        onPress={postLoad}
      >
        <Text
          style={styles.postButtonText}
        >
          Post Freight Load
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        "#F7F7F2",
    },

    content: {
      padding: 20,
      paddingBottom: 80,
    },

    title: {
      fontSize: 34,
      fontWeight: "900",
      color: "#1F7A3F",
      marginBottom: 10,
    },

    subtitle: {
      color: "#4B5563",
      lineHeight: 22,
      marginBottom: 20,
      fontWeight: "700",
    },

    label: {
      fontWeight: "900",
      marginBottom: 10,
      color: "#111827",
      fontSize: 16,
    },

    input: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor: "#D1D5DB",
      borderRadius: 14,
      padding: 16,
      marginBottom: 14,
      color: "#111827",
      fontWeight: "700",
    },

    textArea: {
      minHeight: 100,
      textAlignVertical:
        "top",
    },

    equipmentButton: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor: "#2F7D32",
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
      marginBottom: 10,
    },

    equipmentButtonActive: {
      backgroundColor:
        "#2F7D32",
    },

    equipmentButtonText: {
      color: "#2F7D32",
      fontWeight: "900",
    },

    equipmentButtonTextActive:
      {
        color: "#FFFFFF",
      },

    calculateButton: {
      backgroundColor:
        "#064E3B",
      borderRadius: 14,
      padding: 16,
      alignItems: "center",
      marginBottom: 16,
    },

    calculateButtonText: {
      color: "#FFFFFF",
      fontWeight: "900",
    },

    distanceBox: {
      backgroundColor:
        "#EAF6EC",
      borderRadius: 18,
      padding: 18,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#CDE8D2",
    },

    distanceTitle: {
      fontSize: 20,
      fontWeight: "900",
      color: "#064E3B",
      marginBottom: 10,
    },

    distanceText: {
      color: "#4B5563",
      marginBottom: 14,
      fontWeight: "700",
    },

    rateButtonsRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 10,
    },

    rateButton: {
      flex: 1,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor: "#2F7D32",
      borderRadius: 12,
      padding: 14,
      alignItems: "center",
    },

    rateButtonText: {
      color: "#2F7D32",
      fontWeight: "900",
      textAlign: "center",
    },

    payoutText: {
      color: "#4B5563",
      fontWeight: "800",
      marginBottom: 10,
    },

    totalPayout: {
      fontSize: 30,
      fontWeight: "900",
      color: "#064E3B",
    },

    postButton: {
      backgroundColor:
        "#2F7D32",
      borderRadius: 16,
      padding: 18,
      alignItems: "center",
      marginTop: 10,
    },

    postButtonText: {
      color: "#FFFFFF",
      fontWeight: "900",
      fontSize: 16,
    },
  });