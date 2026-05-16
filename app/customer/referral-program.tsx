import React, { useMemo, useState } from "react";
import {
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";

import farmTheme from "../styles/farmTheme";

type ReferralStatus = "Pending" | "Completed" | "Rewarded";

type Referral = {
  id: string;
  name: string;
  joinedDate: string;
  reward: number;
  status: ReferralStatus;
};

const referralsData: Referral[] = [
  {
    id: "1",
    name: "Sarah Johnson",
    joinedDate: "May 1",
    reward: 250,
    status: "Rewarded",
  },
  {
    id: "2",
    name: "Marcus Lee",
    joinedDate: "May 3",
    reward: 250,
    status: "Completed",
  },
  {
    id: "3",
    name: "Emily Carter",
    joinedDate: "May 6",
    reward: 250,
    status: "Pending",
  },
];

export default function ReferralProgram() {
  const [farmPoints] = useState(1750);

  const referralCode = "FARM2HOME250";

  const totalEarned = useMemo(() => {
    return referralsData
      .filter((ref) => ref.status !== "Pending")
      .reduce((sum, ref) => sum + ref.reward, 0);
  }, []);

  const completedReferrals = useMemo(() => {
    return referralsData.filter(
      (ref) => ref.status === "Completed" || ref.status === "Rewarded"
    ).length;
  }, []);

  async function copyCode() {
    await Clipboard.setStringAsync(referralCode);

    Alert.alert(
      "Referral Code Copied",
      `${referralCode} copied to clipboard.`
    );
  }

  async function shareReferral() {
    try {
      await Share.share({
        message:
          `Join Farm2Home and get fresh produce delivered from local farms.\n\n` +
          `Use my referral code: ${referralCode}\n\n` +
          `Earn rewards, FarmPoints, and discounts.`,
      });
    } catch (error) {
      console.log("Share referral error:", error);
    }
  }

  function bonusDemo() {
    Alert.alert(
      "Referral Bonus",
      "Referral bonus campaign activated. +500 bonus FarmPoints."
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Farm2Home Growth</Text>

        <Text style={styles.title}>Referral Program</Text>

        <Text style={styles.subtitle}>
          Invite friends and family to Farm2Home and earn FarmPoints, grocery
          credits, rewards, and bonus produce perks.
        </Text>

        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Your Referral Code</Text>

          <Text style={styles.heroCode}>{referralCode}</Text>

          <TouchableOpacity style={styles.copyButton} onPress={copyCode}>
            <Text style={styles.copyButtonText}>Copy Referral Code</Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Referral Dashboard</Text>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statIcon}>👥</Text>
          <Text style={styles.statNumber}>{completedReferrals}</Text>
          <Text style={styles.statLabel}>Successful Referrals</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>⭐</Text>
          <Text style={styles.statNumber}>
            {farmPoints.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>FarmPoints</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>💰</Text>
          <Text style={styles.statNumber}>
            {totalEarned.toLocaleString()}
          </Text>
          <Text style={styles.statLabel}>Points Earned</Text>
        </View>

        <View style={styles.statCard}>
          <Text style={styles.statIcon}>🥕</Text>
          <Text style={styles.statNumber}>3</Text>
          <Text style={styles.statLabel}>Reward Bonuses</Text>
        </View>
      </View>

      <View style={styles.shareCard}>
        <Text style={styles.shareTitle}>Invite & Earn</Text>

        <Text style={styles.shareText}>
          Every successful referral can earn FarmPoints, delivery credits,
          produce discounts, and premium rewards.
        </Text>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={shareReferral}
        >
          <Text style={styles.primaryButtonText}>Share Referral Invite</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.outlineButton}
          onPress={bonusDemo}
        >
          <Text style={styles.outlineButtonText}>
            Activate Bonus Campaign
          </Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Referral Rewards</Text>

      <View style={styles.rewardCard}>
        <Text style={styles.rewardTitle}>Friend Signup Bonus</Text>
        <Text style={styles.rewardDescription}>
          Earn 250 FarmPoints when a new customer signs up using your code.
        </Text>
      </View>

      <View style={styles.rewardCard}>
        <Text style={styles.rewardTitle}>First Order Bonus</Text>
        <Text style={styles.rewardDescription}>
          Earn additional FarmPoints after their first marketplace order.
        </Text>
      </View>

      <View style={styles.rewardCard}>
        <Text style={styles.rewardTitle}>Recurring Produce Bonus</Text>
        <Text style={styles.rewardDescription}>
          Earn premium rewards when referrals subscribe to produce boxes.
        </Text>
      </View>

      <Text style={styles.sectionTitle}>Referral Activity</Text>

      {referralsData.map((referral) => (
        <View key={referral.id} style={styles.referralCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.referralName}>{referral.name}</Text>

            <Text style={styles.referralDate}>
              Joined: {referral.joinedDate}
            </Text>

            <Text style={styles.referralReward}>
              +{referral.reward} FarmPoints
            </Text>
          </View>

          <View
            style={[
              styles.statusBadge,
              referral.status === "Pending" && styles.pendingBadge,
              referral.status === "Completed" && styles.completedBadge,
              referral.status === "Rewarded" && styles.rewardedBadge,
            ]}
          >
            <Text style={styles.statusText}>{referral.status}</Text>
          </View>
        </View>
      ))}

      <View style={styles.aiCard}>
        <Text style={styles.aiTitle}>AI Growth Engine</Text>

        <Text style={styles.aiText}>
          Later this can connect to referral campaigns, viral growth tracking,
          customer retention scoring, reward optimization, and automated loyalty
          incentives.
        </Text>

        <View style={styles.aiList}>
          <Text style={styles.aiItem}>
            • Smart referral targeting
          </Text>

          <Text style={styles.aiItem}>
            • Personalized referral bonuses
          </Text>

          <Text style={styles.aiItem}>
            • Seasonal growth campaigns
          </Text>

          <Text style={styles.aiItem}>
            • AI referral reward optimization
          </Text>

          <Text style={styles.aiItem}>
            • Viral sharing analytics
          </Text>
        </View>
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
    paddingBottom: 30,
  },

  eyebrow: {
    color: "#D1FAE5",
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
    lineHeight: 23,
    fontWeight: "700",
  },

  heroCard: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 22,
    padding: 18,
    marginTop: 20,
  },

  heroLabel: {
    color: "#D1FAE5",
    fontWeight: "900",
  },

  heroCode: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "900",
    marginVertical: 10,
  },

  copyButton: {
    backgroundColor: "#FFFFFF",
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: "center",
  },

  copyButtonText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  sectionTitle: {
    color: farmTheme.colors.text,
    fontSize: 23,
    fontWeight: "900",
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 12,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingHorizontal: 18,
  },

  statCard: {
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

  shareCard: {
    backgroundColor: "#FFFFFF",
    margin: 18,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    ...farmTheme.shadow,
  },

  shareTitle: {
    color: farmTheme.colors.text,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 8,
  },

  shareText: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    lineHeight: 22,
    marginBottom: 16,
  },

  primaryButton: {
    backgroundColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    marginBottom: 10,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  outlineButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: farmTheme.colors.primary,
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  outlineButtonText: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
  },

  rewardCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
  },

  rewardTitle: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  rewardDescription: {
    color: farmTheme.colors.mutedText,
    lineHeight: 21,
    fontWeight: "700",
    marginTop: 6,
  },

  referralCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 18,
    marginBottom: 12,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: farmTheme.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  referralName: {
    color: farmTheme.colors.text,
    fontSize: 18,
    fontWeight: "900",
  },

  referralDate: {
    color: farmTheme.colors.mutedText,
    fontWeight: "700",
    marginTop: 4,
  },

  referralReward: {
    color: farmTheme.colors.primary,
    fontWeight: "900",
    marginTop: 6,
  },

  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },

  pendingBadge: {
    backgroundColor: "#FEF3C7",
  },

  completedBadge: {
    backgroundColor: "#DBEAFE",
  },

  rewardedBadge: {
    backgroundColor: "#DCFCE7",
  },

  statusText: {
    fontWeight: "900",
    color: "#111827",
  },

  aiCard: {
    backgroundColor: "#064E3B",
    marginHorizontal: 18,
    marginTop: 8,
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
    lineHeight: 22,
    fontWeight: "700",
  },

  aiList: {
    marginTop: 12,
  },

  aiItem: {
    color: "#D1FAE5",
    fontWeight: "800",
    lineHeight: 25,
  },
});