import { getMarketplaceProducts } from "../data/farmerStore";
import { supabase } from "../data/supabaseClient";

export type RecommendationType =
  | "PRODUCT"
  | "FARM"
  | "FREIGHT_LOAD"
  | "DRIVER"
  | "MARKETPLACE";

export type RecommendationPriority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type RecommendationItem = {
  id: string;
  type: RecommendationType;
  title: string;
  subtitle: string;
  score: number;
  priority: RecommendationPriority;
  reason: string;
  route?: string;
  params?: Record<string, string>;
};

export type RecommendedProduct = {
  id: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  inventory: number;
  imageUrl?: string;
  farmName?: string;
  score: number;
  reason: string;
};

type ProductRow = {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  farm_name?: string;
  farmName?: string;
  price?: number;
  inventory?: number;
  quantity?: number;
  stock?: number;
  organic?: boolean;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  created_at?: string;
};

type FarmRow = {
  id: string;
  farm_name?: string;
  owner_name?: string;
  city?: string;
  state?: string;
  farmer_verified?: boolean;
  verification_status?: string;
  created_at?: string;
};

type FreightLoadRow = {
  id: string;
  title?: string;
  commodity?: string;
  pickup_city?: string;
  pickup_state?: string;
  delivery_city?: string;
  delivery_state?: string;
  rate?: number;
  status?: string;
  priority_level?: string;
  temperature_controlled?: boolean;
  created_at?: string;
};

type DriverLocationRow = {
  id: string;
  load_id?: string | null;
  carrier_id?: string | null;
  status?: string;
  speed?: number | null;
  updated_at?: string;
  freight_carriers?: {
    company_name?: string;
  } | null;
};

function safeNumber(value: unknown) {
  const numberValue = Number(value || 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function normalize(value?: string) {
  return String(value || "").toLowerCase();
}

function priorityFromScore(score: number): RecommendationPriority {
  if (score >= 90) return "CRITICAL";
  if (score >= 75) return "HIGH";
  if (score >= 55) return "MEDIUM";
  return "LOW";
}

function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

export async function getRecommendedProducts(params?: {
  limit?: number;
}): Promise<RecommendedProduct[]> {
  try {
    const limit = params?.limit || 20;
    const products = await getMarketplaceProducts();

    if (!Array.isArray(products)) {
      return [];
    }

    return products.slice(0, limit).map((product: ProductRow, index: number) => {
      const inventory = safeNumber(
        product.stock ?? product.quantity ?? product.inventory ?? 0
      );

      return {
        id: String(product.id || `product_${index}`),
        name: product.name || product.title || "Farm Product",
        description: product.description || "",
        category: product.category || "Farm Goods",
        price: safeNumber(product.price),
        inventory,
        imageUrl: product.image || product.imageUrl || product.image_url || "",
        farmName: product.farmName || product.farm_name || "Local Farm",
        score: Math.max(70, 98 - index * 3),
        reason:
          index === 0
            ? "Popular local farm item based on freshness and availability."
            : "Recommended because it matches current marketplace availability.",
      };
    });
  } catch (error) {
    console.log("Recommended products error:", error);
    return [];
  }
}

export async function getMarketplaceHomeRecommendations(customerEmail?: string) {
  const products = await getRecommendedProducts({
    limit: 12,
  });

  return {
    customerEmail: customerEmail || "",
    generatedAt: new Date().toISOString(),
    products,
  };
}

export async function getProductRecommendations(): Promise<
  RecommendationItem[]
> {
  try {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const products = (data || []) as ProductRow[];

    return products.slice(0, 20).map((product) => {
      const inventory = safeNumber(product.inventory ?? product.stock);
      const price = safeNumber(product.price);

      let score = 50;
      const reasons: string[] = [];

      if (inventory > 20) {
        score += 15;
        reasons.push("strong inventory");
      }

      if (inventory <= 5) {
        score += 20;
        reasons.push("low inventory alert");
      }

      if (product.organic) {
        score += 10;
        reasons.push("organic product");
      }

      if (price > 0) {
        score += 5;
        reasons.push("active pricing");
      }

      const finalScore = clampScore(score);

      return {
        id: product.id,
        type: "PRODUCT",
        title: product.name || product.title || "Farm2Home Product",
        subtitle: `${product.category || "Produce"} · ${
          product.farm_name || "Farm2Home Farm"
        }`,
        score: finalScore,
        priority: priorityFromScore(finalScore),
        reason:
          reasons.length > 0
            ? `Recommended because of ${reasons.join(", ")}.`
            : "Recommended based on marketplace product activity.",
        route: "/customer/marketplace",
      };
    });
  } catch (error) {
    console.log("Product recommendations error:", error);
    return [];
  }
}

export async function getFarmRecommendations(): Promise<RecommendationItem[]> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("role", "farmer")
      .order("created_at", { ascending: false });

    if (error) throw error;

    const farms = (data || []) as FarmRow[];

    return farms.slice(0, 20).map((farm) => {
      let score = 55;
      const reasons: string[] = [];

      const verified =
        farm.farmer_verified === true ||
        normalize(farm.verification_status) === "approved";

      if (verified) {
        score += 30;
        reasons.push("verified farmer");
      }

      if (farm.city || farm.state) {
        score += 10;
        reasons.push("local farm location available");
      }

      const finalScore = clampScore(score);

      return {
        id: farm.id,
        type: "FARM",
        title: farm.farm_name || farm.owner_name || "Farm2Home Farmer",
        subtitle: `${farm.city || "Local"}, ${farm.state || ""}`,
        score: finalScore,
        priority: priorityFromScore(finalScore),
        reason:
          reasons.length > 0
            ? `Recommended because of ${reasons.join(", ")}.`
            : "Recommended based on farmer marketplace activity.",
        route: "/customer/marketplace",
      };
    });
  } catch (error) {
    console.log("Farm recommendations error:", error);
    return [];
  }
}

export async function getFreightLoadRecommendations(): Promise<
  RecommendationItem[]
> {
  try {
    const { data, error } = await supabase
      .from("freight_loads")
      .select("*")
      .in("status", ["OPEN", "POSTED"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    const loads = (data || []) as FreightLoadRow[];

    return loads.slice(0, 20).map((load) => {
      let score = 50;
      const reasons: string[] = [];

      const commodityText = normalize(
        `${load.title || ""} ${load.commodity || ""}`
      );
      const rate = safeNumber(load.rate);

      if (load.temperature_controlled) {
        score += 25;
        reasons.push("cold-chain freight");
      }

      if (commodityText.includes("medical") || commodityText.includes("urgent")) {
        score += 25;
        reasons.push("urgent or medical shipment");
      }

      if (String(load.priority_level || "").toUpperCase() === "CRITICAL") {
        score += 25;
        reasons.push("critical priority");
      }

      if (String(load.priority_level || "").toUpperCase() === "HIGH") {
        score += 15;
        reasons.push("high priority");
      }

      if (rate >= 750) {
        score += 10;
        reasons.push("high-value rate");
      }

      const finalScore = clampScore(score);

      return {
        id: load.id,
        type: "FREIGHT_LOAD",
        title: load.title || load.commodity || "Farm2Home Freight Load",
        subtitle: `${load.pickup_city || "Pickup"}, ${
          load.pickup_state || ""
        } → ${load.delivery_city || "Delivery"}, ${load.delivery_state || ""}`,
        score: finalScore,
        priority: priorityFromScore(finalScore),
        reason:
          reasons.length > 0
            ? `Recommended because of ${reasons.join(", ")}.`
            : "Recommended based on freight board activity.",
        route: "/freight/board",
        params: {
          loadId: load.id,
        },
      };
    });
  } catch (error) {
    console.log("Freight recommendations error:", error);
    return [];
  }
}

export async function getDriverRecommendations(): Promise<RecommendationItem[]> {
  try {
    const { data, error } = await supabase
      .from("driver_locations")
      .select(
        `
        *,
        freight_carriers (
          company_name
        )
      `
      )
      .order("updated_at", { ascending: false });

    if (error) throw error;

    const drivers = (data || []) as DriverLocationRow[];

    return drivers.slice(0, 20).map((driver) => {
      let score = 50;
      const reasons: string[] = [];

      const status = String(driver.status || "").toUpperCase();

      if (status === "READY") {
        score += 25;
        reasons.push("driver ready");
      }

      if (status === "EN_ROUTE_TO_PICKUP") {
        score += 15;
        reasons.push("driver already en route");
      }

      if (safeNumber(driver.speed) > 5) {
        score += 10;
        reasons.push("driver actively moving");
      }

      if (driver.updated_at) {
        const updatedAt = new Date(driver.updated_at).getTime();

        if (!Number.isNaN(updatedAt)) {
          const minutes = (Date.now() - updatedAt) / 1000 / 60;

          if (minutes <= 5) {
            score += 15;
            reasons.push("live GPS signal");
          } else if (minutes > 45) {
            score -= 20;
            reasons.push("GPS signal may be stale");
          }
        }
      }

      const finalScore = clampScore(score);

      return {
        id: driver.id,
        type: "DRIVER",
        title: driver.freight_carriers?.company_name || "Farm2Home Driver",
        subtitle: `Status: ${driver.status || "UNKNOWN"}`,
        score: finalScore,
        priority: priorityFromScore(finalScore),
        reason:
          reasons.length > 0
            ? `Recommended because of ${reasons.join(", ")}.`
            : "Recommended based on driver availability.",
        route: "/admin/fleet-map",
        params: {
          driverId: driver.id,
          loadId: driver.load_id || "",
        },
      };
    });
  } catch (error) {
    console.log("Driver recommendations error:", error);
    return [];
  }
}

export async function getMarketplaceRecommendations(): Promise<
  RecommendationItem[]
> {
  const [
    productRecommendations,
    farmRecommendations,
    freightRecommendations,
    driverRecommendations,
  ] = await Promise.all([
    getProductRecommendations(),
    getFarmRecommendations(),
    getFreightLoadRecommendations(),
    getDriverRecommendations(),
  ]);

  return [
    ...productRecommendations,
    ...farmRecommendations,
    ...freightRecommendations,
    ...driverRecommendations,
  ].sort((a, b) => b.score - a.score);
}

export async function getTopRecommendations(
  limit = 10
): Promise<RecommendationItem[]> {
  const recommendations = await getMarketplaceRecommendations();
  return recommendations.slice(0, limit);
}

export function getRecommendationSummary(items: RecommendationItem[]) {
  const critical = items.filter((item) => item.priority === "CRITICAL").length;
  const high = items.filter((item) => item.priority === "HIGH").length;
  const medium = items.filter((item) => item.priority === "MEDIUM").length;
  const low = items.filter((item) => item.priority === "LOW").length;

  const averageScore =
    items.length > 0
      ? items.reduce((sum, item) => sum + item.score, 0) / items.length
      : 0;

  return {
    total: items.length,
    critical,
    high,
    medium,
    low,
    averageScore: Number(averageScore.toFixed(1)),
  };
}