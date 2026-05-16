import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "farm2homeCart";
const CART_HISTORY_KEY = "farm2homeCartHistory";

export type CartItem = {
  id: string;
  productId?: string;
  name: string;
  price: number;
  image?: string;
  quantity: number;
  farmName: string;
  farmId?: string;
  farmerId?: string;
  farmerStripeAccountId?: string;
  stripeAccountId?: string;
  unit?: string;
  distanceMiles?: number;
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
    .map((item) => {
      const cartItem = item as CartItem;

      const id =
        cartItem.id ||
        cartItem.productId ||
        `${cartItem.name || "item"}-${cartItem.farmName || "farm"}`;

      return {
        ...cartItem,
        id: String(id),
        productId: cartItem.productId || String(id),
        name: cartItem.name || "Farm2Home Item",
        price: Number(cartItem.price || 0),
        quantity: Math.max(1, Number(cartItem.quantity || 1)),
        farmName: cartItem.farmName || "Farm2Home Farm",
        farmId: cartItem.farmId || cartItem.farmerId || "",
        farmerId: cartItem.farmerId || cartItem.farmId || "",
        farmerStripeAccountId:
          cartItem.farmerStripeAccountId || cartItem.stripeAccountId || "",
        stripeAccountId:
          cartItem.stripeAccountId || cartItem.farmerStripeAccountId || "",
        unit: cartItem.unit || "each",
        distanceMiles: Number(cartItem.distanceMiles || 0),
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

    const rawHistory = await AsyncStorage.getItem(CART_HISTORY_KEY);
    const history: CartHistoryItem[] = rawHistory ? JSON.parse(rawHistory) : [];

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

    if (cleanCart.length > 0) {
      await saveCartSnapshot(cleanCart, "saved");
    }

    return cleanCart;
  } catch (error) {
    console.log("Save cart error:", error);
    return [];
  }
}

export async function addToCart(item: CartItem): Promise<CartItem[]> {
  try {
    const cart = await getCart();

    const cleanItem = sanitizeCart([
      {
        ...item,
        quantity: Number(item.quantity || 1),
      },
    ])[0];

    const existing = cart.find(
      (cartItem) =>
        cartItem.id === cleanItem.id ||
        (cartItem.productId &&
          cleanItem.productId &&
          cartItem.productId === cleanItem.productId &&
          cartItem.farmId === cleanItem.farmId)
    );

    const updatedCart = existing
      ? cart.map((cartItem) =>
          cartItem.id === existing.id
            ? {
                ...cartItem,
                quantity:
                  Number(cartItem.quantity || 0) +
                  Number(cleanItem.quantity || 1),
                farmerStripeAccountId:
                  cartItem.farmerStripeAccountId ||
                  cleanItem.farmerStripeAccountId ||
                  "",
                stripeAccountId:
                  cartItem.stripeAccountId || cleanItem.stripeAccountId || "",
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
    item.id === id
      ? {
          ...item,
          quantity: Number(item.quantity || 0) + 1,
        }
      : item
  );

  return await saveCart(updatedCart);
}

export async function decreaseCartItem(id: string): Promise<CartItem[]> {
  const cart = await getCart();

  const updatedCart = cart
    .map((item) =>
      item.id === id
        ? {
            ...item,
            quantity: Number(item.quantity || 0) - 1,
          }
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
      item.id === id
        ? {
            ...item,
            quantity: Number(quantity || 0),
          }
        : item
    )
    .filter((item) => Number(item.quantity || 0) > 0);

  return await saveCart(updatedCart);
}

export async function removeCartItem(id: string): Promise<CartItem[]> {
  const cart = await getCart();
  const updatedCart = cart.filter((item) => item.id !== id);

  await AsyncStorage.setItem(CART_KEY, JSON.stringify(updatedCart));

  if (updatedCart.length > 0) {
    await saveCartSnapshot(updatedCart, "saved");
  }

  return updatedCart;
}

export async function clearCart(): Promise<void> {
  try {
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
    return JSON.parse(raw);
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

/**
 * Compatibility aliases.
 */
export const getCartItems = getCart;
export const saveCartItems = saveCart;
export const addCartItem = addToCart;