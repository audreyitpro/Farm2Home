import AsyncStorage from "@react-native-async-storage/async-storage";

export type TrackingStatus =
  | "Assigned"
  | "Driver En Route"
  | "Arrived at Pickup"
  | "Loaded"
  | "In Transit"
  | "Arrived at Dropoff"
  | "Delivered";

export type TrackingRecord = {
  loadId: string;
  carrierCompany: string;
  carrierEmail: string;
  status: TrackingStatus;
  lastUpdated: string;
  notes?: string;
};

const TRACKING_KEY = "farm2homeFreightTracking";

function normalizeTrackingRecord(
  record: Partial<TrackingRecord>
): TrackingRecord {
  return {
    loadId: String(record.loadId || ""),
    carrierCompany: String(record.carrierCompany || ""),
    carrierEmail: String(record.carrierEmail || ""),
    status: record.status || "Assigned",
    lastUpdated: String(record.lastUpdated || new Date().toLocaleString()),
    notes: record.notes || "",
  };
}

export async function getTrackingRecords(): Promise<TrackingRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(TRACKING_KEY);

    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map(normalizeTrackingRecord);
  } catch (error) {
    console.log("Get tracking records error:", error);
    return [];
  }
}

export async function getTrackingForLoad(
  loadId: string
): Promise<TrackingRecord | null> {
  const records = await getTrackingRecords();

  return records.find((record) => record.loadId === loadId) || null;
}

export async function createTracking(
  record: TrackingRecord
): Promise<void> {
  const records = await getTrackingRecords();

  const newRecord = normalizeTrackingRecord({
    ...record,
    lastUpdated: record.lastUpdated || new Date().toLocaleString(),
  });

  const filtered = records.filter(
    (item) => item.loadId !== newRecord.loadId
  );

  await AsyncStorage.setItem(
    TRACKING_KEY,
    JSON.stringify([newRecord, ...filtered])
  );
}

export async function updateTracking(
  loadId: string,
  status: TrackingStatus,
  notes?: string
): Promise<void> {
  const records = await getTrackingRecords();

  const updated = records.map((record) =>
    record.loadId === loadId
      ? normalizeTrackingRecord({
          ...record,
          status,
          notes: notes || record.notes,
          lastUpdated: new Date().toLocaleString(),
        })
      : record
  );

  await AsyncStorage.setItem(
    TRACKING_KEY,
    JSON.stringify(updated)
  );
}