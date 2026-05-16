import AsyncStorage from "@react-native-async-storage/async-storage";

export type FreightLoad = {
  id: string;
  postedBy: string;
  posterType: "Farmer" | "Business";
  loadType: "Livestock" | "Refrigerated Fresh Food";
  pickup: string;
  dropoff: string;
  miles: number;
  ratePerMile: number;
  cargoDescription: string;
  requiredEquipment: string;
  pickupDate: string;
  contactName: string;
  contactPhone: string;
  status: "Open" | "Accepted" | "Completed";
};

const LOADS_KEY = "farm2homeFreightLoads";

export const starterLoads: FreightLoad[] = [
  {
    id: "L001",
    postedBy: "Green Valley Farms",
    posterType: "Farmer",
    loadType: "Livestock",
    pickup: "Flint, MI",
    dropoff: "Lansing, MI",
    miles: 65,
    ratePerMile: 3.25,
    cargoDescription: "Goats moving farmer to farmer",
    requiredEquipment: "Livestock trailer",
    pickupDate: "Tomorrow",
    contactName: "John Farmer",
    contactPhone: "248-555-0101",
    status: "Open",
  },
  {
    id: "L002",
    postedBy: "Fresh Market Detroit",
    posterType: "Business",
    loadType: "Refrigerated Fresh Food",
    pickup: "Sterling Heights, MI",
    dropoff: "Detroit, MI",
    miles: 24,
    ratePerMile: 2.75,
    cargoDescription: "Fresh produce delivery to restaurant",
    requiredEquipment: "Refrigerated van or reefer box truck",
    pickupDate: "Today",
    contactName: "Market Manager",
    contactPhone: "313-555-0102",
    status: "Open",
  },
];

function normalizeLoad(load: Partial<FreightLoad>): FreightLoad {
  return {
    id: String(load.id || `load_${Date.now()}`),
    postedBy: String(load.postedBy || ""),
    posterType: load.posterType || "Farmer",
    loadType: load.loadType || "Refrigerated Fresh Food",
    pickup: String(load.pickup || ""),
    dropoff: String(load.dropoff || ""),
    miles: Number(load.miles || 0),
    ratePerMile: Number(load.ratePerMile || 0),
    cargoDescription: String(load.cargoDescription || ""),
    requiredEquipment: String(load.requiredEquipment || ""),
    pickupDate: String(load.pickupDate || ""),
    contactName: String(load.contactName || ""),
    contactPhone: String(load.contactPhone || ""),
    status: load.status || "Open",
  };
}

async function getSavedFreightLoads(): Promise<FreightLoad[]> {
  try {
    const raw = await AsyncStorage.getItem(LOADS_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeLoad);
  } catch (error) {
    console.log("Get saved freight loads error:", error);
    return [];
  }
}

async function saveLoads(loads: FreightLoad[]): Promise<void> {
  await AsyncStorage.setItem(LOADS_KEY, JSON.stringify(loads));
}

export async function getFreightLoads(): Promise<FreightLoad[]> {
  const savedLoads = await getSavedFreightLoads();
  const allLoads = [...starterLoads, ...savedLoads];

  return allLoads.filter((load) => load.status === "Open");
}

export async function saveFreightLoad(load: FreightLoad): Promise<void> {
  const savedLoads = await getSavedFreightLoads();

  const newLoad = normalizeLoad({
    ...load,
    id: load.id || `load_${Date.now()}`,
  });

  const updatedLoads = [newLoad, ...savedLoads];

  await saveLoads(updatedLoads);
}

export async function acceptFreightLoad(loadId: string): Promise<void> {
  const savedLoads = await getSavedFreightLoads();

  const updatedLoads = savedLoads.map((load) =>
    load.id === loadId
      ? {
          ...load,
          status: "Accepted" as const,
        }
      : load
  );

  await saveLoads(updatedLoads);
}