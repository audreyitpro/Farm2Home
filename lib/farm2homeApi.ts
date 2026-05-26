// app/services/farm2homeapi.ts

import {
  addDoc,
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  updateDoc,
  where,
  Timestamp,
} from "firebase/firestore";

import { db } from "./firebase";

export async function createFarmer(data: any) {
  const ref = await addDoc(collection(db, "farmers"), {
    ...data,
    verified: false,
    created_at: Timestamp.now(),
  });

  return ref.id;
}

export async function submitCertification(data: any) {
  return addDoc(collection(db, "farmer_certifications"), {
    ...data,
    status: "pending",
    ai_score: 75,
    ai_notes: "MVP placeholder. Admin should review manually.",
    created_at: Timestamp.now(),
  });
}

export async function getApprovedCertifications(farmerId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const q = query(
    collection(db, "farmer_certifications"),
    where("farmer_id", "==", farmerId),
    where("status", "==", "approved")
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }))
    .filter(
      (item: any) =>
        !item.expiration_date || item.expiration_date >= today
    );
}

export async function addProduct(data: any) {
  return addDoc(collection(db, "products"), {
    ...data,
    active: true,
    created_at: Timestamp.now(),
  });
}

export async function getProducts(buyerType: string) {
  const q = query(
    collection(db, "products"),
    where("active", "==", true),
    orderBy("created_at", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }))
    .filter((item: any) => {
      const hasQuantity =
        Number(item.quantity_available || 0) > 0;

      const matchesBuyer =
        buyerType === "all" ||
        item.buyer_type === "all" ||
        item.buyer_type === buyerType;

      return hasQuantity && matchesBuyer;
    });
}

export async function createOrder(cart: any[], buyerType: string) {
  const total = cart.reduce(
    (sum, item) =>
      sum + Number(item.price || 0) * Number(item.quantity || 1),
    0
  );

  const orderRef = await addDoc(collection(db, "orders"), {
    buyer_name: "Guest Buyer",
    buyer_email: "guest@example.com",
    buyer_type: buyerType,
    delivery_method: "pickup",
    total,
    status: "pending",
    created_at: Timestamp.now(),
  });

  for (const item of cart) {
    await addDoc(collection(db, "order_items"), {
      order_id: orderRef.id,
      product_id: item.id,
      quantity: Number(item.quantity || 1),
      price: Number(item.price || 0),
      created_at: Timestamp.now(),
    });
  }

  return orderRef.id;
}

export async function getAllCertifications() {
  const q = query(
    collection(db, "farmer_certifications"),
    orderBy("created_at", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function updateCertificationStatus(
  id: string,
  status: "approved" | "rejected"
) {
  return updateDoc(doc(db, "farmer_certifications", id), {
    status,
  });
}

export async function addLivestockListing(data: any) {
  return addDoc(collection(db, "livestock_listings"), {
    ...data,
    active: true,
    created_at: Timestamp.now(),
  });
}

export async function getLivestockListings() {
  const q = query(
    collection(db, "livestock_listings"),
    where("active", "==", true),
    orderBy("created_at", "desc")
  );

  const snap = await getDocs(q);

  return snap.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));
}

export async function registerFreightCarrier(data: any) {
  return addDoc(collection(db, "freight_carriers"), {
    ...data,
    approved: false,
    created_at: Timestamp.now(),
  });
}

export async function requestLivestockFreight(data: any) {
  const carriersQ = query(
    collection(db, "freight_carriers"),
    where("approved", "==", true)
  );

  const carrierSnap = await getDocs(carriersQ);

  const matchedCarrier = carrierSnap.docs
    .map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }))
    .find((carrier: any) =>
      carrier.service_states?.includes(
        String(data.destination_state || "").toUpperCase()
      )
    );

  const requestRef = await addDoc(
    collection(db, "livestock_freight_requests"),
    {
      ...data,
      selected_carrier_id: matchedCarrier?.id || null,
      status: matchedCarrier ? "carrier_matched" : "pending_carrier",
      created_at: Timestamp.now(),
    }
  );

  return {
    requestId: requestRef.id,
    carrier: matchedCarrier || null,
  };
}