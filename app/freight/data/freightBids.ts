import AsyncStorage from "@react-native-async-storage/async-storage";

export type FreightBid = {
  id: string;
  loadId: string;
  carrierCompany: string;
  carrierEmail: string;
  bidPerMile: number;
  totalBid: number;
  message: string;
  status: "Pending" | "Accepted" | "Rejected";
  createdAt: string;
};

const BIDS_KEY = "farm2homeFreightBids";

function normalizeBid(bid: Partial<FreightBid>): FreightBid {
  return {
    id: String(bid.id || `bid_${Date.now()}`),
    loadId: String(bid.loadId || ""),
    carrierCompany: String(bid.carrierCompany || ""),
    carrierEmail: String(bid.carrierEmail || ""),
    bidPerMile: Number(bid.bidPerMile || 0),
    totalBid: Number(bid.totalBid || 0),
    message: String(bid.message || ""),
    status: bid.status || "Pending",
    createdAt:
      String(bid.createdAt) || new Date().toISOString(),
  };
}

export async function getBids(): Promise<FreightBid[]> {
  try {
    const raw = await AsyncStorage.getItem(BIDS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeBid);
  } catch (error) {
    console.log("Get bids error:", error);
    return [];
  }
}

export async function getBidsForLoad(
  loadId: string
): Promise<FreightBid[]> {
  const bids = await getBids();

  return bids.filter((bid) => bid.loadId === loadId);
}

export async function saveBid(
  bid: FreightBid
): Promise<void> {
  try {
    const bids = await getBids();

    const normalizedBid = normalizeBid({
      ...bid,
      createdAt: bid.createdAt || new Date().toISOString(),
    });

    await AsyncStorage.setItem(
      BIDS_KEY,
      JSON.stringify([normalizedBid, ...bids])
    );
  } catch (error) {
    console.log("Save bid error:", error);
  }
}

export async function acceptBid(
  loadId: string,
  bidId: string
): Promise<void> {
  try {
    const bids = await getBids();

    const updated = bids.map((bid) => {
      if (bid.loadId !== loadId) {
        return bid;
      }

      return {
        ...bid,
        status:
          bid.id === bidId
            ? "Accepted"
            : "Rejected",
      };
    });

    await AsyncStorage.setItem(
      BIDS_KEY,
      JSON.stringify(updated)
    );
  } catch (error) {
    console.log("Accept bid error:", error);
  }
}