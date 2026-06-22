// services/cartService.ts

import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_KEY = "customerCart";

export type CartProduct = {
  id: string;
  farmer_id: string;
  farmer_name?: string;
  name: string;
  photo_url?: string | null;
  price: number;
  unit?: string | null;
  inventory_quantity?: number | null;
  organic?: boolean;
  local?: boolean;
};

export type CartItem = {
  id: string;
  product_id: string;
  farmer_id: string;
  farmer_name?: string;
  name: string;
  photo_url?: string | null;
  price: number;
  unit?: string | null;
  quantity: number;
  inventory_quantity?: number | null;
  organic?: boolean;
  local?: boolean;
};

export type FarmerCartGroup = {
  farmer_id: string;
  farmer_name?: string;
  items: CartItem[];
  subtotal: number;
  item_count: number;
};

function money(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function makeCartItem(product: CartProduct, quantity = 1): CartItem {
  return {
    id: `${product.farmer_id}_${product.id}`,
    product_id: product.id,
    farmer_id: product.farmer_id,
    farmer_name: product.farmer_name,
    name: product.name,
    photo_url: product.photo_url ?? null,
    price: Number(product.price || 0),
    unit: product.unit ?? null,
    quantity,
    inventory_quantity: product.inventory_quantity ?? null,
    organic: Boolean(product.organic),
    local: Boolean(product.local),
  };
}

export async function getCart(): Promise<CartItem[]> {
  const raw = await AsyncStorage.getItem(CART_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveCart(items: CartItem[]) {
  await AsyncStorage.setItem(CART_KEY, JSON.stringify(items));
  return items;
}

export async function clearCart() {
  await AsyncStorage.removeItem(CART_KEY);
  return true;
}

export async function addToCart(product: CartProduct, quantity = 1) {
  if (!product?.id) throw new Error("Missing product id.");
  if (!product?.farmer_id) throw new Error("Missing farmer id.");

  const cart = await getCart();
  const cartId = `${product.farmer_id}_${product.id}`;

  const existingIndex = cart.findIndex((item) => item.id === cartId);

  if (existingIndex >= 0) {
    const existing = cart[existingIndex];
    const nextQuantity = existing.quantity + quantity;

    if (
      existing.inventory_quantity !== null &&
      existing.inventory_quantity !== undefined &&
      nextQuantity > existing.inventory_quantity
    ) {
      throw new Error("Not enough inventory available.");
    }

    cart[existingIndex] = {
      ...existing,
      quantity: nextQuantity,
    };
  } else {
    if (
      product.inventory_quantity !== null &&
      product.inventory_quantity !== undefined &&
      quantity > product.inventory_quantity
    ) {
      throw new Error("Not enough inventory available.");
    }

    cart.push(makeCartItem(product, quantity));
  }

  return saveCart(cart);
}

export async function removeFromCart(cartItemId: string) {
  const cart = await getCart();
  const updated = cart.filter((item) => item.id !== cartItemId);
  return saveCart(updated);
}

export async function updateQuantity(cartItemId: string, quantity: number) {
  const cart = await getCart();

  if (quantity <= 0) {
    return removeFromCart(cartItemId);
  }

  const updated = cart.map((item) => {
    if (item.id !== cartItemId) return item;

    if (
      item.inventory_quantity !== null &&
      item.inventory_quantity !== undefined &&
      quantity > item.inventory_quantity
    ) {
      throw new Error("Not enough inventory available.");
    }

    return {
      ...item,
      quantity,
    };
  });

  return saveCart(updated);
}

export function groupByFarmer(items: CartItem[]): FarmerCartGroup[] {
  const grouped: Record<string, FarmerCartGroup> = {};

  for (const item of items) {
    if (!grouped[item.farmer_id]) {
      grouped[item.farmer_id] = {
        farmer_id: item.farmer_id,
        farmer_name: item.farmer_name,
        items: [],
        subtotal: 0,
        item_count: 0,
      };
    }

    grouped[item.farmer_id].items.push(item);
    grouped[item.farmer_id].subtotal = money(
      grouped[item.farmer_id].subtotal + item.price * item.quantity
    );
    grouped[item.farmer_id].item_count += item.quantity;
  }

  return Object.values(grouped);
}

export function calculateTotals(items: CartItem[]) {
  const subtotal = money(
    items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  );

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return {
    subtotal,
    item_count: itemCount,
    farmer_count: groupByFarmer(items).length,
    total: subtotal,
  };
}

export async function prepareCheckout() {
  const cartItems = await getCart();

  if (!cartItems.length) {
    throw new Error("Your cart is empty.");
  }

  const groups = groupByFarmer(cartItems);
  const totals = calculateTotals(cartItems);

  return {
    cartItems,
    farmerGroups: groups,
    totals,
  };
}

export const cartService = {
  getCart,
  saveCart,
  clearCart,
  addToCart,
  removeFromCart,
  updateQuantity,
  groupByFarmer,
  calculateTotals,
  prepareCheckout,
};