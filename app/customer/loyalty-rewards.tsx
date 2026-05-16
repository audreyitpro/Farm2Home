import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";

import farmTheme from "../styles/farmTheme";

type RewardTier = "Bronze" | "Silver" | "Gold" | "Platinum";

type Reward = {
  id: string;
  title: string;
  points: number;
  description: string;
  category: string;
};

const rewards: Reward[] = [
  {
    id: "free-delivery",
    title: "Free Delivery",
    points: 500,
    description: "Redeem points for one free local delivery.",
    category: "Delivery",
  },
  {
    id: "produce-discount",
    title: "$10 Produce Credit",
    points: 1000,
    description: "Use toward fresh produce from local farms.",
    category: "Credit",
  },
  {
    id: "premium-box",
    title: "Premium Produce Upgrade",
    points: 1500,
    description: "Upgrade one produce box to premium selections.",
    category: "Produce",
  },
  {
    id: "family-bundle",
    title: "Family Grocery Bundle",
    points: 2500,
    description: "Redeem toward a family-size grocery bundle.",
    category: "Bundle",
  },
];

export default function LoyaltyRewards() {
  const [points, setPoints] = useState(1280);
  const [deliveryStreak] = useState(6);
  const [referrals] = useState(3);

  const tier: RewardTier = useMemo(() => {
    if (points >= 5000) return "Platinum";
    if (points >= 2500) return "Gold";
    if (points >= 1000) return "Silver";
    return "Bronze";
  }, [points]);

  const nextTierPoints = useMemo(() => {
    if (points < 1000) return 1000 - points;
    if (points < 2500) return 2500 - points;
    if (points < 5000) return 5000 - points;
    return 0;
  }, [points]);

  const multiplier = useMemo(() => {
    if (tier === "Platinum") return "2.0x";
    if (tier === "Gold") return "1.5x";
    if (tier === "Silver") return "1.25x";
    return "1.0x";
  }, [tier]);

  function redeemReward(reward: Reward) {
    if (points < reward.points) {
      Alert.alert(
        "Not Enough FarmPoints",
        `You need ${reward.points - points} more points for ${reward.title}.`
      );
      return;
    }

    setPoints((prev) => prev - reward.points);

    Alert.alert(
      "Reward Redeemed",
      `${reward.title} has been redeemed successfully.`
    );
  }

  function earnDemoPoints() {
    setPoints((prev) => prev + 250);
    Alert.alert("FarmPoints Added", "250 demo FarmPoints were added.");
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Rewards</Text>
        <Text style={styles.title}>Loyalty Rewards</Text>
        <Text style={styles.subtitle}>
          Earn FarmPoints from orders, referrals, delivery streaks, memberships,
          and recurring produce subscriptions.
        </Text>

        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>Current Balance</Text>
          <Text style={styles.pointsNumber}>{points.toLocaleString()}</Text>
          <Text style={styles.pointsSub}>FarmPoints</Text>
        </View>
      </View>

      <View style={styles.tierCard}>
        <View style={styles.tierHeader}>
          <View>
            <Text style={styles.tierLabel}>Current Tier</Text>
            <Text style={styles.tierName}>{tier}</Text>
          </View>

          <View style={styles.multiplierBadge}>
            <Text style={styles.multiplierText}>{multiplier}</Text>
          </View>
        </View>

        <Text style={styles.tierDescription}>
          {nextTierPoints > 0
            ? `${nextTierPoints.toLocaleString()} more points until your next tier.`
            : "You are at the highest rewards tier."}
        </Text>

        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              {
                width:
                  tier === "Bronze"
                    ? "25%"
                    : tier === "Silver"
                    ? "50%"
                    : tier === "Gold"
                    ? "75%"
                    : "100%",
              },
            ]}
          />
        </View>

        <View style={styles.tierRow}>
          <Text style={styles.tierStep}>Bronze</Text>
          <Text style={styles.tierStep}>Silver</Text>
          <Text style={styles.tierStep}>Gold</Text>
          <Text style={styles.tierStep}>Platinum</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Rewards Dashboard</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statIcon}>🚚</Text>
          <Text style={styles.statNumber}>{deliveryStreak}</Text>
          <Text style={styles.statLabel}>Delivery Streak</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statIcon}>👥</Text>
          <Text style={styles.statNumber}>{referrals}</Text>
          <Text style={styles.statLabel}>Referrals</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statIcon}>⭐</Text>
          <Text style={styles.statNumber}>{multiplier}</Text>
          <Text style={styles.statLabel}>Point Multiplier</Text>
        </View>

        <View style={styles.statBox}>
          <Text style={styles.statIcon}>🥕</Text>
          <Text style={styles.statNumber}>12</Text>
          <Text style={styles.statLabel}>Farm Orders</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Redeem Rewards</Text>

      {rewards.map((reward) => {
        const locked = points < reward.points;

        return (
          <View key={reward.id} style={styles.rewardCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rewardCategory}>{reward.category}</Text>
              <Text style={styles.rewardTitle}>{reward.title}</Text>
              <Text style={styles.rewardDescription}>{reward.description}</Text>
              <Text style={styles.rewardPoints}>
                {reward.points.toLocaleString()} FarmPoints
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.redeemButton,
                locked && styles.redeemButtonLocked,
              ]}
              onPress={() => redeemReward(reward)}
            >
              <Text
                style={[
                  styles.redeemText,
                  locked && styles.redeemTextLocked,
                ]}
              >
                {locked ? "Locked" : "Redeem"}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })}

      <View style={styles.earnCard}>
        <Text style={styles.earnTitle}>How Customers Earn Points</Text>
        <Text style={styles.earnItem}>• Place marketplace orders</Text>
        <Text style={styles.earnItem}>• Subscribe to recurring produce boxes</Text>
        <Text style={styles.earnItem}>• Refer friends and family</Text>
        <Text style={styles.earnItem}>• Maintain delivery streaks</Text>
        <Text style={styles.earnItem}>• Upgrade to premium membership</Text>

        <TouchableOpacity style={styles.primaryButton} onPress={earnDemoPoints}>
          <Text style={styles.primaryText}>Add Demo Points</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Retention Layer</Text>
        <Text style={styles.aiText}>
          Later this can connect to customer purchase behavior, churn prediction,
          reward timing, referral campaigns, membership upgrades, and personalized
          grocery offers.
        </Text>
      </View>

      <View style={styles.navRow}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push("/customer/marketplace")}
        >
          <Text style={styles.navButtonText}>Marketplace</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButtonOutline}
          onPress={() => router.push("/customer/recurring-produce")}
        >
          <Text style={styles.navButtonOutlineText}>Produce Boxes</Text>
        </TouchableOpacity>
      </View>

      <View style={{ height: 90 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: farmTheme.colors.background,
  },

  hero: {
    backgroundColor: farmTheme.colors.primary,
    paddingTop: 64,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },

  eyebrow: {
    color: "#DFF5E5",
    fontWeight: "900",
    marginBottom: 8,
  },

  title: {
    color: "#FFFFFF",
    fontSize: 36,
    fontWeight: "900",
    marginBottom: 10,
  },

  subtitle: {
    color: "#E8F5E9",
    fontWeight: "700",
    lineHeight: 23,
  },

  pointsCard: {
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    padding: 18,
    marginTop: 20,
  },

  pointsLabel: {
    color: "#DFF5E5",
    fontWeight: "900",
  },

  pointsNumber: {
    color: "#FFFFFF",
    fontSize: 42,
    fontWeight: "900",
    marginTop: 4,
  },

  pointsSub: {
    color: "#BBF7D0",
    fontWeight: "900",
  },

  tierCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  tierHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  tierLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "900",
  },

  tierName: {
    color: farmTheme.colors.text,
    fontSize: 28,
    fontWeight: "900",
    marginTop: 4,
  },

  multiplierBadge: {
    backgroundColor: "#FACC15",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
  },

  multiplierText: {
    color: "#1F2937",
    fontWeight: "900",
  },

  tierDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginTop: 12,
  },

  progressTrack: {
    height: 12,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
    marginTop: 16,
  },

  progressFill: {
    height: "100%",
    backgroundColor: farmTheme.colors.primary,
    borderRadius: 999,
  },

  tierRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },

  tierStep: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    fontSize: 12,
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginBottom: 12,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 18,
    marginBottom: 18,
  },

  statBox: {
    width: "47%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  statIcon: {
    fontSize: 28,
    marginBottom: 8,
  },

  statNumber: {
    color: farmTheme.colors.primary,
    fontSize: 24,
    fontWeight: "900",
  },

  statLabel: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    marginTop: 4,
  },

  rewardCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },

  rewardCategory: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginBottom: 4,
  },

  rewardTitle: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  rewardDescription: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 20,
    marginTop: 4,
  },

  rewardPoints: {
    color: farmTheme.colors.text,
    fontWeight: "900",
    marginTop: 8,
  },

  redeemButton: {
    backgroundColor: farmTheme.colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
  },

  redeemButtonLocked: {
    backgroundColor: "#E5E7EB",
  },

  redeemText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  redeemTextLocked: {
    color: "#6B7280",
  },

  earnCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  earnTitle: {
    color: farmTheme.colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 10,
  },

  earnItem: {
    color: farmTheme.colors.mutedText,
    fontWeight: "800",
    lineHeight: 25,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 14,
  },

  primaryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    borderRadius: 22,
    padding: 18,
  },

  aiTitle: {
    color: "#FFFFFF",
    fontSize: 23,
    fontWeight: "900",
    marginBottom: 8,
  },

  aiText: {
    color: "#BBF7D0",
    fontWeight: "700",
    lineHeight: 22,
  },

  navRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    marginTop: 18,
  },

  navButton: {
    flex: 1,
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonOutline: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  navButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  navButtonOutlineText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },
});