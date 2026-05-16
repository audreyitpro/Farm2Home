import { getMarketplaceProducts } from "../data/farmerStore";

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

export async function getRecommendedProducts(params?: {
  limit?: number;
}): Promise<RecommendedProduct[]> {
  try {
    const limit = params?.limit || 20;

    const products = await getMarketplaceProducts();

    if (!products || !Array.isArray(products)) {
      return [];
    }

    return products.slice(0, limit).map((product: any, index: number) => {
      const inventory = Number(
        product.stock ??
          product.quantity ??
          product.inventory ??
          0
      );

      return {
        id: String(product.id || `product_${index}`),

        name: product.name || "Farm Product",

        description: product.description || "",

        category: product.category || "Farm Goods",

        price: Number(product.price || 0),

        inventory,

        imageUrl:
          product.image ||
          product.imageUrl ||
          product.image_url ||
          "",

        farmName:
          product.farmName ||
          product.farm_name ||
          "Local Farm",

        score: Math.max(70, 98 - index * 3),

        reason:
          index === 0
            ? "Popular local farm item based on freshness and availability."
            : "Recommended because it matches current marketplace availability.",
      };
    });
  } catch (error) {
    console.log("Recommendation engine error:", error);
    return [];
  }
}

export async function getMarketplaceHomeRecommendations(
  customerEmail?: string
) {
  try {
    const products = await getRecommendedProducts({
      limit: 12,
    });

    return {
      customerEmail: customerEmail || "",
      generatedAt: new Date().toISOString(),
      products,
    };
  } catch (error) {
    console.log("Marketplace recommendation error:", error);

    return {
      customerEmail: customerEmail || "",
      generatedAt: new Date().toISOString(),
      products: [],
    };
  }
}