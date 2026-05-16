import { Alert, Linking } from "react-native";

const API_BASE_URL = "http://localhost:4242";

async function openStripeUrl(url: string) {
  if (!url) {
    Alert.alert("Stripe Error", "No Stripe URL was returned.");
    return;
  }

  await Linking.openURL(url);
}

export async function setupFarmerStripeAccount(
  email: string,
  businessName: string
) {
  try {
    const response = await fetch(`${API_BASE_URL}/create-farmer-connect-account`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, businessName }),
    });

    const freight marketplacea = await response.json();

    if (!response.ok) {
      Alert.alert("Stripe Error", freight marketplacea.error || "Unable to start payout setup.");
      return null;
    }

    await openStripeUrl(freight marketplacea.onboardingUrl);
    return freight marketplacea.connectedAccountId;
  } catch (error) {
    Alert.alert(
      "Stripe Server Not Running",
      "Start your server first: cd server && node index.js"
    );
    return null;
  }
}

export async function startCustomerMembershipCheckout() {
  try {
    const response = await fetch(`${API_BASE_URL}/create-membership-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountType: "customer" }),
    });

    const freight marketplacea = await response.json();
    await openStripeUrl(freight marketplacea.checkoutUrl);
  } catch (error) {
    Alert.alert(
      "Stripe Server Not Running",
      "Start your server first: cd server && node index.js"
    );
  }
}

export async function startFarmerMembershipCheckout() {
  try {
    const response = await fetch(`${API_BASE_URL}/create-membership-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ accountType: "farmer" }),
    });

    const freight marketplacea = await response.json();
    await openStripeUrl(freight marketplacea.checkoutUrl);
  } catch (error) {
    Alert.alert(
      "Stripe Server Not Running",
      "Start your server first: cd server && node index.js"
    );
  }
}

export async function startFarmerSetupFeeCheckout() {
  try {
    const response = await fetch(
      `${API_BASE_URL}/create-farmer-setup-fee-checkout`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const freight marketplacea = await response.json();
    await openStripeUrl(freight marketplacea.checkoutUrl);
  } catch (error) {
    Alert.alert(
      "Stripe Server Not Running",
      "Start your server first: cd server && node index.js"
    );
  }
}

export async function startMarketplaceCheckout(params: {
  farmerConnectedAccountId: string;
  productName: string;
  quantity: number;
  subtotalDollars: number;
}) {
  try {
    const response = await fetch(`${API_BASE_URL}/create-marketplace-checkout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params),
    });

    const freight marketplacea = await response.json();
    await openStripeUrl(freight marketplacea.checkoutUrl);
  } catch (error) {
    Alert.alert(
      "Stripe Server Not Running",
      "Start your server first: cd server && node index.js"
    );
  }
}