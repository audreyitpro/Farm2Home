import AsyncStorage from "@react-native-async-storage/async-storage";

export const PRODUCT_UNITS = [
  "each",
  "bag",
  "jar",
  "dozen",
  "1/2 dozen",
  "gallon",
  "pounds",
  "bundle",
  "box",
  "crate",
  "bale",
  "bouquet",
  "bucket",
  "tray",
  "flat",
  "stem",
  "case",
  "quart",
  "pint",
  "bushel",
] as const;

export type Product = {
  id: string;
  farmerId: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  quantity?: number;
  stock?: number;
  lowStockThreshold?: number;
  isSoldOut?: boolean;
  unit?: string;
  image?: string;
  imageUrl?: string;
  deliveryOption?: string;
  processingOption?: string;
  sold?: number;
  grossSales?: number;
  lastUpdatedBy?: string;
  updatedAt?: string;
  farmName?: string;
  farmerName?: string;
};

export type Farmer = {
  id: string;
  ownerName: string;
  farmName: string;
  email: string;
  phone?: string;

  username?: string;
  password?: string;
  accountActive?: boolean;
  complianceStatus?: string;

  securityQuestion1?: string;
  securityAnswer1?: string;
  securityQuestion2?: string;
  securityAnswer2?: string;
  securityQuestion3?: string;
  securityAnswer3?: string;

  approved?: boolean;
  logoUrl?: string;
  bannerUrl?: string;
  about?: string;
  location?: string;
  farmLocation?: string;
  pickup?: boolean;
  delivery?: boolean;

  stripeAccountId?: string;
  farmerStripeAccountId?: string;
  stripePayoutAccount?: string;
  stripePayoutAccountLast4?: string;
  stripePayoutBankName?: string;
  stripeOnboardingComplete?: boolean;
  stripeChargesEnabled?: boolean;
  stripePayoutsEnabled?: boolean;

  products: Product[];
  reviews?: number;
  rating?: number;
  distanceMiles?: number;
  itemsSold?: number;
  revenue?: number;
  createdAt?: string;
  updatedAt?: string;
};

const FARMER_STORAGE_KEY = "farm2homeFarmers";

function normalizeProduct(product: Partial<Product>, farmer?: Farmer): Product {
  const stock = Math.max(Number(product.stock ?? product.quantity ?? 0), 0);

  return {
    id: String(product.id || `product-${Date.now()}`),
    farmerId: String(product.farmerId || farmer?.id || ""),
    name: product.name || "Farm Product",
    description: product.description || "",
    category: product.category || "Farm Goods",
    price: Number(product.price || 0),
    unit: product.unit || "each",
    quantity: stock,
    stock,
    lowStockThreshold: Number(product.lowStockThreshold ?? 5),
    isSoldOut:
      product.isSoldOut !== undefined ? Boolean(product.isSoldOut) : stock <= 0,
    image: product.image || product.imageUrl || "",
    imageUrl: product.imageUrl || product.image || "",
    deliveryOption: product.deliveryOption || "Pickup / Delivery Available",
    processingOption: product.processingOption || "",
    sold: Number(product.sold || 0),
    grossSales: Number(product.grossSales || 0),
    lastUpdatedBy: product.lastUpdatedBy || "",
    updatedAt: product.updatedAt || new Date().toISOString(),
    farmName: product.farmName || farmer?.farmName || "Farm2Home Farm",
    farmerName: product.farmerName || farmer?.ownerName || "Local Farmer",
  };
}

export function normalizeFarmer(farmer: Partial<Farmer> | any): Farmer {
  const approved =
    farmer.approved !== undefined ? Boolean(farmer.approved) : false;

  const base: Farmer = {
    id: String(farmer.id || `farmer-${Date.now()}`),

    ownerName:
      farmer.ownerName ||
      farmer.owner_name ||
      farmer.contactName ||
      farmer.fullName ||
      "Unknown Owner",

    farmName:
      farmer.farmName ||
      farmer.farm_name ||
      farmer.businessName ||
      "Unnamed Farm",

    email: farmer.email || "",
    phone: farmer.phone || "",

    username: farmer.username || farmer.email || "",
    password: farmer.password || "",

    approved,

    accountActive:
      farmer.accountActive !== undefined
        ? Boolean(farmer.accountActive)
        : approved === true,

    complianceStatus: farmer.complianceStatus || "not_started",

    securityQuestion1:
      farmer.securityQuestion1 || farmer.security_question_1 || "",
    securityAnswer1:
      farmer.securityAnswer1 || farmer.security_answer_1 || "",

    securityQuestion2:
      farmer.securityQuestion2 || farmer.security_question_2 || "",
    securityAnswer2:
      farmer.securityAnswer2 || farmer.security_answer_2 || "",

    securityQuestion3:
      farmer.securityQuestion3 || farmer.security_question_3 || "",
    securityAnswer3:
      farmer.securityAnswer3 || farmer.security_answer_3 || "",

    logoUrl: farmer.logoUrl || farmer.logo_url || "",
    bannerUrl: farmer.bannerUrl || farmer.banner_url || "",
    about: farmer.about || farmer.story || farmer.description || "",

    location:
      farmer.location ||
      farmer.farmLocation ||
      farmer.farm_location ||
      "Michigan",

    farmLocation:
      farmer.farmLocation ||
      farmer.location ||
      farmer.farm_location ||
      "Michigan",

    pickup:
      farmer.pickup !== undefined
        ? Boolean(farmer.pickup)
        : farmer.pickupAvailable !== undefined
        ? Boolean(farmer.pickupAvailable)
        : true,

    delivery:
      farmer.delivery !== undefined
        ? Boolean(farmer.delivery)
        : farmer.deliveryAvailable !== undefined
        ? Boolean(farmer.deliveryAvailable)
        : true,

    stripeAccountId:
      farmer.stripeAccountId ||
      farmer.stripe_account_id ||
      farmer.farmerStripeAccountId ||
      farmer.farmer_stripe_account_id ||
      "",

    farmerStripeAccountId:
      farmer.farmerStripeAccountId ||
      farmer.farmer_stripe_account_id ||
      farmer.stripeAccountId ||
      farmer.stripe_account_id ||
      "",

    stripePayoutAccount:
      farmer.stripePayoutAccount || farmer.stripe_payout_account || "",

    stripePayoutAccountLast4:
      farmer.stripePayoutAccountLast4 ||
      farmer.stripe_payout_account_last4 ||
      "",

    stripePayoutBankName:
      farmer.stripePayoutBankName || farmer.stripe_payout_bank_name || "",

    stripeOnboardingComplete:
      farmer.stripeOnboardingComplete !== undefined
        ? Boolean(farmer.stripeOnboardingComplete)
        : false,

    stripeChargesEnabled:
      farmer.stripeChargesEnabled !== undefined
        ? Boolean(farmer.stripeChargesEnabled)
        : false,

    stripePayoutsEnabled:
      farmer.stripePayoutsEnabled !== undefined
        ? Boolean(farmer.stripePayoutsEnabled)
        : false,

    products: [],

    reviews: Number(farmer.reviews || 0),
    rating: Number(farmer.rating || 4.8),
    distanceMiles: Number(farmer.distanceMiles || farmer.distance_miles || 5),
    itemsSold: Number(farmer.itemsSold || 0),
    revenue: Number(farmer.revenue || 0),

    createdAt: farmer.createdAt || farmer.created_at || new Date().toISOString(),
    updatedAt: farmer.updatedAt || farmer.updated_at || new Date().toISOString(),
  };

  base.products = Array.isArray(farmer.products)
    ? farmer.products.map((product: Partial<Product>) =>
        normalizeProduct(product, base)
      )
    : [];

  return base;
}

function safeParseFarmers(rawValue: string | null): Farmer[] {
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.map(normalizeFarmer) : [];
  } catch (error) {
    console.log("Parse farmers error:", error);
    return [];
  }
}

export async function getFarmers(): Promise<Farmer[]> {
  try {
    const saved = await AsyncStorage.getItem(FARMER_STORAGE_KEY);
    return safeParseFarmers(saved);
  } catch (error) {
    console.log("Error loading farmers:", error);
    return [];
  }
}

export async function saveFarmers(farmers: Farmer[]): Promise<void> {
  try {
    await AsyncStorage.setItem(
      FARMER_STORAGE_KEY,
      JSON.stringify(farmers.map(normalizeFarmer))
    );
  } catch (error) {
    console.log("Save farmers error:", error);
  }
}

export async function getApprovedFarmers(): Promise<Farmer[]> {
  const farmers = await getFarmers();

  return farmers.filter(
    (farmer) =>
      farmer.approved === true &&
      farmer.accountActive === true &&
      farmer.complianceStatus === "approved"
  );
}

export async function getFarmerById(
  farmerId: string
): Promise<Farmer | undefined> {
  const farmers = await getFarmers();
  return farmers.find((farmer) => farmer.id === farmerId);
}

export async function getFarmerByEmail(
  email: string
): Promise<Farmer | undefined> {
  const farmers = await getFarmers();

  return farmers.find(
    (farmer) =>
      farmer.email.toLowerCase().trim() === email.toLowerCase().trim()
  );
}

export async function getFarmerByUsername(
  username: string
): Promise<Farmer | undefined> {
  const farmers = await getFarmers();

  return farmers.find(
    (farmer) =>
      farmer.username?.toLowerCase().trim() === username.toLowerCase().trim() ||
      farmer.email.toLowerCase().trim() === username.toLowerCase().trim()
  );
}

export async function authenticateFarmer(
  username: string,
  password: string
): Promise<Farmer | undefined> {
  const farmers = await getFarmers();

  return farmers.find((farmer) => {
    const usernameMatch =
      farmer.username?.toLowerCase().trim() === username.toLowerCase().trim() ||
      farmer.email.toLowerCase().trim() === username.toLowerCase().trim();

    const passwordMatch = farmer.password === password;

    return usernameMatch && passwordMatch && farmer.accountActive !== false;
  });
}

export async function verifyFarmerSecurityQuestions(
  usernameOrEmail: string,
  answer1: string,
  answer2: string,
  answer3: string
): Promise<Farmer | undefined> {
  const farmer = await getFarmerByUsername(usernameOrEmail);

  if (!farmer) return undefined;

  const clean = (value?: string) => String(value || "").toLowerCase().trim();

  const answersMatch =
    clean(farmer.securityAnswer1) === clean(answer1) &&
    clean(farmer.securityAnswer2) === clean(answer2) &&
    clean(farmer.securityAnswer3) === clean(answer3);

  return answersMatch ? farmer : undefined;
}

export async function addFarmer(farmer: Farmer): Promise<Farmer[]> {
  const farmers = await getFarmers();
  const newFarmer = normalizeFarmer(farmer);

  const updatedFarmers = [
    ...farmers.filter((item) => item.id !== newFarmer.id),
    newFarmer,
  ];

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function updateFarmerStore(
  farmerId: string,
  updates: Partial<Farmer>
): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) =>
    farmer.id === farmerId
      ? normalizeFarmer({
          ...farmer,
          ...updates,
          updatedAt: new Date().toISOString(),
        })
      : farmer
  );

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function setFarmerCredentials(
  farmerId: string,
  username: string,
  password: string
): Promise<Farmer[]> {
  return await updateFarmerStore(farmerId, {
    username,
    password,
    accountActive: true,
    approved: true,
    complianceStatus: "approved",
  });
}

export async function setFarmerSecurityQuestions(
  farmerId: string,
  securityQuestion1: string,
  securityAnswer1: string,
  securityQuestion2: string,
  securityAnswer2: string,
  securityQuestion3: string,
  securityAnswer3: string
): Promise<Farmer[]> {
  return await updateFarmerStore(farmerId, {
    securityQuestion1,
    securityAnswer1,
    securityQuestion2,
    securityAnswer2,
    securityQuestion3,
    securityAnswer3,
  });
}

export async function setFarmerStripeAccount(
  farmerId: string,
  stripeAccountId: string
): Promise<Farmer[]> {
  return await updateFarmerStore(farmerId, {
    stripeAccountId,
    farmerStripeAccountId: stripeAccountId,
    complianceStatus: "stripe_pending",
  });
}

export async function setFarmerStripePayoutAccount(
  farmerId: string,
  stripeAccountId: string,
  payoutAccountName: string,
  bankName?: string,
  last4?: string,
  onboardingComplete?: boolean,
  chargesEnabled?: boolean,
  payoutsEnabled?: boolean
): Promise<Farmer[]> {
  return await updateFarmerStore(farmerId, {
    stripeAccountId,
    farmerStripeAccountId: stripeAccountId,
    stripePayoutAccount: payoutAccountName,
    stripePayoutBankName: bankName || "",
    stripePayoutAccountLast4: last4 || "",
    stripeOnboardingComplete: Boolean(onboardingComplete),
    stripeChargesEnabled: Boolean(chargesEnabled),
    stripePayoutsEnabled: Boolean(payoutsEnabled),
    complianceStatus: payoutsEnabled ? "stripe_complete" : "stripe_pending",
  });
}

export async function toggleFarmerApproval(id: string): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) => {
    if (farmer.id !== id) return farmer;

    const nextApproved = !farmer.approved;

    return normalizeFarmer({
      ...farmer,
      approved: nextApproved,
      accountActive: nextApproved,
      complianceStatus: nextApproved ? "approved" : "needs_more_info",
      updatedAt: new Date().toISOString(),
    });
  });

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function addProductToFarmer(
  farmerId: string,
  product: Partial<Product>
): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) => {
    if (farmer.id !== farmerId) return farmer;

    return normalizeFarmer({
      ...farmer,
      products: [
        ...farmer.products,
        normalizeProduct(
          {
            ...product,
            id: product.id || `product-${Date.now()}`,
            farmerId,
            updatedAt: new Date().toISOString(),
          },
          farmer
        ),
      ],
      updatedAt: new Date().toISOString(),
    });
  });

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function updateProductForFarmer(
  farmerId: string,
  productId: string,
  updatedProduct: Partial<Product>
): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) => {
    if (farmer.id !== farmerId) return farmer;

    const updatedProducts = farmer.products.map((product) =>
      product.id === productId
        ? normalizeProduct(
            {
              ...product,
              ...updatedProduct,
              updatedAt: new Date().toISOString(),
            },
            farmer
          )
        : product
    );

    return normalizeFarmer({
      ...farmer,
      products: updatedProducts,
      updatedAt: new Date().toISOString(),
    });
  });

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function deleteFarmerProduct(
  farmerId: string,
  productId: string
): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) =>
    farmer.id === farmerId
      ? normalizeFarmer({
          ...farmer,
          products: farmer.products.filter(
            (product) => product.id !== productId
          ),
          updatedAt: new Date().toISOString(),
        })
      : farmer
  );

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function updateFarmerProductStock(
  farmerId: string,
  productId: string,
  additionalStock: number,
  updatedBy: string
): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) => {
    if (farmer.id !== farmerId) return farmer;

    const updatedProducts = farmer.products.map((product) => {
      if (product.id !== productId) return product;

      const currentStock = Number(product.stock ?? product.quantity ?? 0);
      const newStock = Math.max(currentStock + Number(additionalStock || 0), 0);

      return normalizeProduct(
        {
          ...product,
          stock: newStock,
          quantity: newStock,
          lastUpdatedBy: updatedBy,
          updatedAt: new Date().toISOString(),
        },
        farmer
      );
    });

    return normalizeFarmer({
      ...farmer,
      products: updatedProducts,
      updatedAt: new Date().toISOString(),
    });
  });

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function setFarmerProductStock(
  farmerId: string,
  productId: string,
  newStockQty: number,
  updatedBy: string
): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) => {
    if (farmer.id !== farmerId) return farmer;

    const updatedProducts = farmer.products.map((product) => {
      if (product.id !== productId) return product;

      const newStock = Math.max(Number(newStockQty || 0), 0);

      return normalizeProduct(
        {
          ...product,
          stock: newStock,
          quantity: newStock,
          lastUpdatedBy: updatedBy,
          updatedAt: new Date().toISOString(),
        },
        farmer
      );
    });

    return normalizeFarmer({
      ...farmer,
      products: updatedProducts,
      updatedAt: new Date().toISOString(),
    });
  });

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function reduceInventoryAfterCheckout(
  cartItems: { id: string; productId?: string; quantity: number }[]
): Promise<Farmer[]> {
  const farmers = await getFarmers();

  const updatedFarmers = farmers.map((farmer) => {
    const updatedProducts = farmer.products.map((product) => {
      const cartItem = cartItems.find(
        (item) => item.id === product.id || item.productId === product.id
      );

      if (!cartItem) return product;

      const currentStock = Number(product.stock ?? product.quantity ?? 0);
      const purchaseQty = Math.max(Number(cartItem.quantity || 0), 0);
      const newStock = Math.max(currentStock - purchaseQty, 0);
      const currentSold = Number(product.sold || 0);
      const price = Number(product.price || 0);
      const currentGross = Number(product.grossSales || 0);

      return normalizeProduct(
        {
          ...product,
          stock: newStock,
          quantity: newStock,
          sold: currentSold + purchaseQty,
          grossSales: currentGross + price * purchaseQty,
          updatedAt: new Date().toISOString(),
        },
        farmer
      );
    });

    return normalizeFarmer({
      ...farmer,
      products: updatedProducts,
      updatedAt: new Date().toISOString(),
    });
  });

  await saveFarmers(updatedFarmers);
  return updatedFarmers;
}

export async function getLowStockProducts(
  farmerId?: string
): Promise<Product[]> {
  const farmers = await getFarmers();
  const lowStockProducts: Product[] = [];

  farmers.forEach((farmer) => {
    if (farmerId && farmer.id !== farmerId) return;

    farmer.products.forEach((product) => {
      const normalizedProduct = normalizeProduct(product, farmer);
      const stock = Number(normalizedProduct.stock ?? 0);
      const threshold = Number(normalizedProduct.lowStockThreshold ?? 5);

      if (stock > 0 && stock <= threshold) {
        lowStockProducts.push(normalizedProduct);
      }
    });
  });

  return lowStockProducts;
}

export async function getSoldOutProducts(
  farmerId?: string
): Promise<Product[]> {
  const farmers = await getFarmers();
  const soldOutProducts: Product[] = [];

  farmers.forEach((farmer) => {
    if (farmerId && farmer.id !== farmerId) return;

    farmer.products.forEach((product) => {
      const normalizedProduct = normalizeProduct(product, farmer);
      const stock = Number(normalizedProduct.stock ?? 0);

      if (stock <= 0 || normalizedProduct.isSoldOut) {
        soldOutProducts.push(normalizedProduct);
      }
    });
  });

  return soldOutProducts;
}

export async function getMarketplaceProducts(): Promise<Product[]> {
  const farmers = await getApprovedFarmers();
  const allProducts: Product[] = [];

  farmers.forEach((farmer) => {
    farmer.products.forEach((product) => {
      const normalized = normalizeProduct(product, farmer);

      if (!normalized.isSoldOut && Number(normalized.stock || 0) > 0) {
        allProducts.push(normalized);
      }
    });
  });

  return allProducts;
}

export const updateProduct = updateProductForFarmer;
export const updateProductStock = updateFarmerProductStock;