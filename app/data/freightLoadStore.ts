import AsyncStorage from "@react-native-async-storage/async-storage";

const FREIGHT_LOADS_KEY = "farm2homeFreightLoads";

export type FreightLoadStatus =
  | "OPEN"
  | "ACCEPTED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED"
  | "CANCELED";

export type FreightLoadProof = {
  signerName: string;
  signature: string;
  photoUri?: string;
  capturedAt: string;
};

export type FreightLoad = {
  id: string;

  farmerName: string;
  farmName?: string;
  postedBy?: string;
  posterType?: "Farmer" | "Business";

  title?: string;
  commodity?: string;
  equipment?: string;
  requiredEquipment?: string;
  weight?: string;

  miles?: number;
  ratePerMile?: number;

  loadType: string;
  description: string;
  cargoDescription?: string;

  pickupLocation: string;
  dropoffLocation: string;
  pickup?: string;
  dropoff?: string;

  pickupDate: string;
  deliveryDeadline: string;

  contactName?: string;
  contactPhone?: string;

  payoutAmount: number;

  status: FreightLoadStatus;

  acceptedBy?: string;
  assignedCarrier?: string;
  assignedCarrierId?: string;

  pickupProof?: FreightLoadProof;
  deliveryProof?: FreightLoadProof;

  createdAt: string;
  updatedAt: string;
};

const starterLoads: FreightLoad[] = [
  {
    id: "starter_load_001",
    farmerName: "Green Valley Farms",
    farmName: "Green Valley Farms",
    postedBy: "Green Valley Farms",
    posterType: "Farmer",
    title: "Livestock Delivery",
    commodity: "Livestock",
    equipment: "Livestock Trailer",
    requiredEquipment: "Livestock Trailer",
    weight: "Not provided",
    miles: 65,
    ratePerMile: 3.25,
    loadType: "Livestock",
    description: "Goats moving farmer to farmer",
    cargoDescription: "Goats moving farmer to farmer",
    pickupLocation: "Flint, MI",
    dropoffLocation: "Lansing, MI",
    pickup: "Flint, MI",
    dropoff: "Lansing, MI",
    pickupDate: "Tomorrow",
    deliveryDeadline: "Same Day / Next Available",
    contactName: "John Farmer",
    contactPhone: "248-555-0101",
    payoutAmount: 211.25,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: "starter_load_002",
    farmerName: "Fresh Market Detroit",
    farmName: "Fresh Market Detroit",
    postedBy: "Fresh Market Detroit",
    posterType: "Business",
    title: "Fresh Produce Delivery",
    commodity: "Refrigerated Fresh Food",
    equipment: "Refrigerated Van",
    requiredEquipment: "Refrigerated Van",
    weight: "Not provided",
    miles: 24,
    ratePerMile: 2.75,
    loadType: "Refrigerated Fresh Food",
    description: "Fresh produce delivery to restaurant",
    cargoDescription: "Fresh produce delivery to restaurant",
    pickupLocation: "Sterling Heights, MI",
    dropoffLocation: "Detroit, MI",
    pickup: "Sterling Heights, MI",
    dropoff: "Detroit, MI",
    pickupDate: "Today",
    deliveryDeadline: "Same Day / Next Available",
    contactName: "Market Manager",
    contactPhone: "313-555-0102",
    payoutAmount: 66,
    status: "OPEN",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function normalizeStatus(status: any): FreightLoadStatus {
  switch (status) {
    case "Open":
    case "OPEN":
      return "OPEN";
    case "Accepted":
    case "ACCEPTED":
    case "BOOKED":
      return "ACCEPTED";
    case "PICKED_UP":
      return "PICKED_UP";
    case "IN_TRANSIT":
      return "IN_TRANSIT";
    case "Completed":
    case "DELIVERED":
      return "DELIVERED";
    case "Cancelled":
    case "Canceled":
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    default:
      return "OPEN";
  }
}

function normalizeLoad(load: any): FreightLoad {
  const now = new Date().toISOString();

  const miles = Number(load?.miles || 0);
  const ratePerMile = Number(load?.ratePerMile || 0);

  const payoutAmount =
    load?.payoutAmount !== undefined
      ? Number(load.payoutAmount || 0)
      : load?.rate !== undefined
      ? Number(load.rate || 0)
      : Number(load?.payout || miles * ratePerMile || 0);

  const farmerName =
    load?.farmerName ||
    load?.farmName ||
    load?.postedBy ||
    "Farm2Home Partner";

  const pickupLocation =
    load?.pickupLocation || load?.pickup || load?.origin || "";

  const dropoffLocation =
    load?.dropoffLocation || load?.dropoff || load?.destination || "";

  const equipment =
    load?.equipment || load?.requiredEquipment || "Not provided";

  const title =
    load?.title ||
    load?.commodity ||
    load?.loadType ||
    "Farm2Home Freight Load";

  const description =
    load?.description ||
    load?.cargoDescription ||
    `${title}\nEquipment: ${equipment}\nWeight: ${
      load?.weight || "Not provided"
    }\nMiles: ${miles || "Not provided"}\nRate Per Mile: $${
      ratePerMile || "Not provided"
    }`;

  return {
    id: String(load?.id || `load_${Date.now()}`),

    farmerName: String(farmerName),
    farmName: String(load?.farmName || farmerName),
    postedBy: String(load?.postedBy || farmerName),
    posterType: load?.posterType || "Farmer",

    title: String(title),
    commodity: String(load?.commodity || load?.loadType || title),
    equipment: String(equipment),
    requiredEquipment: String(equipment),
    weight: String(load?.weight || "Not provided"),

    miles,
    ratePerMile,

    loadType: String(load?.loadType || load?.commodity || "Other"),
    description: String(description),
    cargoDescription: String(load?.cargoDescription || description),

    pickupLocation: String(pickupLocation),
    dropoffLocation: String(dropoffLocation),
    pickup: String(pickupLocation),
    dropoff: String(dropoffLocation),

    pickupDate: String(load?.pickupDate || "Available Now"),
    deliveryDeadline: String(
      load?.deliveryDeadline || "Same Day / Next Available"
    ),

    contactName: String(load?.contactName || ""),
    contactPhone: String(load?.contactPhone || ""),

    payoutAmount,

    status: normalizeStatus(load?.status),

    acceptedBy: load?.acceptedBy || "",
    assignedCarrier: load?.assignedCarrier || "",
    assignedCarrierId: load?.assignedCarrierId || "",

    pickupProof: load?.pickupProof || undefined,
    deliveryProof: load?.deliveryProof || undefined,

    createdAt: load?.createdAt || load?.created_at || now,
    updatedAt: load?.updatedAt || load?.updated_at || now,
  };
}

async function getSavedFreightLoads(): Promise<FreightLoad[]> {
  try {
    const raw = await AsyncStorage.getItem(FREIGHT_LOADS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeLoad);
  } catch (error) {
    console.log("Get freight loads error:", error);
    return [];
  }
}

export async function getFreightLoads(): Promise<FreightLoad[]> {
  const savedLoads = await getSavedFreightLoads();

  const starterIds = new Set(starterLoads.map((load) => load.id));

  const cleanSavedLoads = savedLoads.filter(
    (load) => !starterIds.has(load.id)
  );

  return [...cleanSavedLoads, ...starterLoads];
}

export async function saveFreightLoads(loads: FreightLoad[]): Promise<void> {
  await AsyncStorage.setItem(
    FREIGHT_LOADS_KEY,
    JSON.stringify(loads.map(normalizeLoad))
  );
}

export async function addFreightLoad(
  load: Partial<FreightLoad>
): Promise<FreightLoad[]> {
  const existingLoads = await getSavedFreightLoads();

  const newLoad = normalizeLoad({
    ...load,
    id: load.id || `load_${Date.now()}`,
    status: load.status || "OPEN",
    createdAt: load.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const updatedLoads = [newLoad, ...existingLoads];

  await saveFreightLoads(updatedLoads);

  return getFreightLoads();
}

export async function saveFreightLoad(load: FreightLoad): Promise<void> {
  await addFreightLoad(load);
}

export async function updateFreightLoadStatus(
  loadId: string,
  status: FreightLoadStatus,
  carrierName?: string,
  carrierId?: string
): Promise<FreightLoad[]> {
  const loads = await getFreightLoads();

  const updatedLoads = loads.map((load) =>
    load.id === loadId
      ? normalizeLoad({
          ...load,
          status,
          acceptedBy: carrierName || load.acceptedBy,
          assignedCarrier: carrierName || load.assignedCarrier,
          assignedCarrierId: carrierId || load.assignedCarrierId,
          updatedAt: new Date().toISOString(),
        })
      : load
  );

  await saveFreightLoads(updatedLoads);

  return getFreightLoads();
}

export async function updateFreightLoadProof(
  loadId: string,
  proofUpdates: Partial<FreightLoad>
): Promise<FreightLoad[]> {
  const loads = await getFreightLoads();

  const updatedLoads = loads.map((load) =>
    load.id === loadId
      ? normalizeLoad({
          ...load,
          ...proofUpdates,
          updatedAt: new Date().toISOString(),
        })
      : load
  );

  await saveFreightLoads(updatedLoads);

  return getFreightLoads();
}

export async function acceptFreightLoad(loadId: string): Promise<void> {
  await updateFreightLoadStatus(loadId, "ACCEPTED");
}

export async function getCarrierLoads(
  carrierId: string
): Promise<FreightLoad[]> {
  const loads = await getFreightLoads();

  return loads.filter(
    (load) =>
      load.assignedCarrierId === carrierId ||
      load.assignedCarrier === carrierId ||
      load.acceptedBy === carrierId
  );
}

export async function deleteFreightLoad(
  loadId: string
): Promise<FreightLoad[]> {
  const savedLoads = await getSavedFreightLoads();

  const updatedLoads = savedLoads.filter((load) => load.id !== loadId);

  await saveFreightLoads(updatedLoads);

  return getFreightLoads();
}

export async function clearFreightLoads(): Promise<void> {
  await AsyncStorage.removeItem(FREIGHT_LOADS_KEY);
}