import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "farm2homeCart";
const CART_HISTORY_KEY = "farm2homeCartHistory";

export type CartItem = {
  id: string;
  cartItemId?: string;
  productId?: string;
  productName?: string;
  name: string;
  price: number;
  image?: string;
  imageUrl?: string;
  image_url?: string;
  quantity: number;
  farmName: string;
  farmerName?: string;
  farmId?: string;
  farmerId?: string;
  farmer_id?: string;
  farmerEmail?: string;
  farmer_email?: string;
  farmerStripeAccountId?: string;
  farmer_stripe_account_id?: string;
  stripeAccountId?: string;
  stripe_account_id?: string;
  unit?: string;
  category?: string;
  stock?: number;
  distanceMiles?: number;
  miles?: number;
  farmAddress?: string;
  pickupAddress?: string;
  farmLocation?: string;
  addedAt?: string;
};

export type CartHistoryItem = {
  id: string;
  createdAt: string;
  items: CartItem[];
  itemCount: number;
  total: number;
  status: "saved" | "checkout_started" | "paid" | "cancelled";
};

function sanitizeCart(cart: unknown): CartItem[] {
  if (!Array.isArray(cart)) return [];

  return cart
    .filter((item) => item && typeof item === "object")
    .map((item: any) => {
      const productId = String(item.productId || item.id || "");
      const farmerId = String(item.farmerId || item.farmer_id || item.farmId || "");
      const farmName = item.farmName || item.farmerName || item.farm_name || "Farm2Home Farm";

      const id = String(
        item.id ||
          item.cartItemId ||
          `${farmerId || farmName}_${productId || item.name || Date.now()}`
      );

      const stripeAccountId =
        item.farmerStripeAccountId ||
        item.stripeAccountId ||
        item.farmer_stripe_account_id ||
        item.stripe_account_id ||
        "";

      const image = item.image || item.imageUrl || item.image_url || "";

      return {
        ...item,
        id,
        cartItemId: item.cartItemId || id,
        productId: productId || id,
        productName: item.productName || item.name || "Farm2Home Item",
        name: item.name || item.productName || "Farm2Home Item",
        price: Number(item.price || 0),
        quantity: Math.max(1, Number(item.quantity || 1)),
        image,
        imageUrl: item.imageUrl || image,
        image_url: item.image_url || image,
        farmName,
        farmerName: item.farmerName || farmName,
        farmId: item.farmId || farmerId,
        farmerId,
        farmer_id: farmerId,
        farmerEmail: item.farmerEmail || item.farmer_email || "",
        farmer_email: item.farmer_email || item.farmerEmail || "",
        farmerStripeAccountId: stripeAccountId,
        farmer_stripe_account_id: stripeAccountId,
        stripeAccountId,
        stripe_account_id: stripeAccountId,
        unit: item.unit || "each",
        category: item.category || "",
        stock: Number(item.stock || 0),
        distanceMiles: Number(item.distanceMiles || item.miles || 0),
        miles: Number(item.miles || item.distanceMiles || 0),
        farmAddress: item.farmAddress || "",
        pickupAddress: item.pickupAddress || "",
        farmLocation: item.farmLocation || "",
        addedAt: item.addedAt || new Date().toISOString(),
      };
    });
}

function getCartItemCountFromCart(cart: CartItem[]) {
  return cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
}

function getCartTotalFromCart(cart: CartItem[]) {
  return cart.reduce(
    (sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0),
    0
  );
}

async function saveCartSnapshot(
  cart: CartItem[],
  status: CartHistoryItem["status"] = "saved"
): Promise<void> {
  try {
    const cleanCart = sanitizeCart(cart);
    if (cleanCart.length === 0) return;

    const snapshot: CartHistoryItem = {
      id: `cart_snapshot_${Date.now()}`,
      createdAt: new Date().toISOString(),
      items: cleanCart,
      itemCount: getCartItemCountFromCart(cleanCart),
      total: getCartTotalFromCart(cleanCart),
      status,
    };

    const history = await getCartHistory();

    await AsyncStorage.setItem(
      CART_HISTORY_KEY,
      JSON.stringify([snapshot, ...history].slice(0, 50))
    );
  } catch (error) {
    console.log("Save cart snapshot error:", error);
  }
}

export async function getCart(): Promise<CartItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CART_KEY);
    if (!raw) return [];
    return sanitizeCart(JSON.parse(raw));
  } catch (error) {
    console.log("Get cart error:", error);
    return [];
  }
}

export async function saveCart(cart: CartItem[]): Promise<CartItem[]> {
  try {
    const cleanCart = sanitizeCart(cart);
    await AsyncStorage.setItem(CART_KEY, JSON.stringify(cleanCart));
    return cleanCart;
  } catch (error) {
    console.log("Save cart error:", error);
    return [];
  }
}

export async function addToCart(item: CartItem): Promise<CartItem[]> {
  try {
    const cart = await getCart();
    const cleanItem = sanitizeCart([{ ...item, quantity: Number(item.quantity || 1) }])[0];

    const existing = cart.find((cartItem) => {
      const sameId = cartItem.id === cleanItem.id;
      const sameProductAndFarmer =
        cartItem.productId === cleanItem.productId &&
        cartItem.farmerId === cleanItem.farmerId;

      return sameId || sameProductAndFarmer;
    });

    const updatedCart = existing
      ? cart.map((cartItem) =>
          cartItem.id === existing.id
            ? {
                ...cartItem,
                quantity: Number(cartItem.quantity || 0) + Number(cleanItem.quantity || 1),
                farmerId: cartItem.farmerId || cleanItem.farmerId,
                farmer_id: cartItem.farmer_id || cleanItem.farmer_id,
                farmerStripeAccountId:
                  cartItem.farmerStripeAccountId || cleanItem.farmerStripeAccountId,
                farmer_stripe_account_id:
                  cartItem.farmer_stripe_account_id || cleanItem.farmer_stripe_account_id,
                stripeAccountId: cartItem.stripeAccountId || cleanItem.stripeAccountId,
                stripe_account_id: cartItem.stripe_account_id || cleanItem.stripe_account_id,
              }
            : cartItem
        )
      : [...cart, cleanItem];

    return await saveCart(updatedCart);
  } catch (error) {
    console.log("Add to cart error:", error);
    return await getCart();
  }
}

export async function increaseCartItem(id: string): Promise<CartItem[]> {
  const cart = await getCart();

  const updatedCart = cart.map((item) =>
    item.id === id || item.cartItemId === id
      ? { ...item, quantity: Number(item.quantity || 0) + 1 }
      : item
  );

  return await saveCart(updatedCart);
}

export async function decreaseCartItem(id: string): Promise<CartItem[]> {
  const cart = await getCart();

  const updatedCart = cart
    .map((item) =>
      item.id === id || item.cartItemId === id
        ? { ...item, quantity: Number(item.quantity || 0) - 1 }
        : item
    )
    .filter((item) => Number(item.quantity || 0) > 0);

  return await saveCart(updatedCart);
}

export async function updateCartItemQuantity(
  id: string,
  quantity: number
): Promise<CartItem[]> {
  const cart = await getCart();

  const updatedCart = cart
    .map((item) =>
      item.id === id || item.cartItemId === id
        ? { ...item, quantity: Number(quantity || 0) }
        : item
    )
    .filter((item) => Number(item.quantity || 0) > 0);

  return await saveCart(updatedCart);
}

export async function removeCartItem(id: string): Promise<CartItem[]> {
  const cart = await getCart();
  const updatedCart = cart.filter((item) => item.id !== id && item.cartItemId !== id);
  return await saveCart(updatedCart);
}

export async function clearCart(): Promise<void> {
  try {
    const cart = await getCart();

    if (cart.length > 0) {
      await saveCartSnapshot(cart, "checkout_started");
    }

    await AsyncStorage.removeItem(CART_KEY);
  } catch (error) {
    console.log("Clear cart error:", error);
  }
}

export async function getCartTotal(): Promise<number> {
  const cart = await getCart();
  return getCartTotalFromCart(cart);
}

export async function getCartItemCount(): Promise<number> {
  const cart = await getCart();
  return getCartItemCountFromCart(cart);
}

export async function getCartHistory(): Promise<CartHistoryItem[]> {
  try {
    const raw = await AsyncStorage.getItem(CART_HISTORY_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item: any) => ({
      id: String(item.id || `cart_${Date.now()}`),
      createdAt: item.createdAt || new Date().toISOString(),
      items: sanitizeCart(item.items || []),
      itemCount: Number(item.itemCount || getCartItemCountFromCart(item.items || [])),
      total: Number(item.total || getCartTotalFromCart(item.items || [])),
      status: item.status || "saved",
    }));
  } catch (error) {
    console.log("Get cart history error:", error);
    return [];
  }
}

export async function saveCartToHistory(
  status: CartHistoryItem["status"] = "saved"
): Promise<CartHistoryItem | null> {
  try {
    const cart = await getCart();
    if (cart.length === 0) return null;

    const snapshot: CartHistoryItem = {
      id: `cart_${Date.now()}`,
      createdAt: new Date().toISOString(),
      items: cart,
      itemCount: getCartItemCountFromCart(cart),
      total: getCartTotalFromCart(cart),
      status,
    };

    const history = await getCartHistory();

    await AsyncStorage.setItem(
      CART_HISTORY_KEY,
      JSON.stringify([snapshot, ...history].slice(0, 50))
    );

    return snapshot;
  } catch (error) {
    console.log("Save cart to history error:", error);
    return null;
  }
}

export async function clearCartHistory(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CART_HISTORY_KEY);
  } catch (error) {
    console.log("Clear cart history error:", error);
  }
}

export const getCartItems = getCart;
export const saveCartItems = saveCart;
export const addCartItem = addToCart;