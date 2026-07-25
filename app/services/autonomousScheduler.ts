// app/services/autonomousScheduler.ts

import { AppState } from "react-native";

import {
  loadAvailableDrivers,
  loadOpenFreightLoads,
  predictDeliveryDelayRisk,
  runAutonomousDispatch,
} from "../ai/autonomous-dispatch-engine";

import { sendLocalNotification } from "./notificationService";

type NotificationDataValue =
  | string
  | number
  | boolean
  | null
  | undefined;

type NotificationData = Record<string, NotificationDataValue>;

type LocalNotificationPayload = {
  title: string;
  body: string;
  data?: NotificationData;
};

type NotificationSender = (
  payload: LocalNotificationPayload
) => void | Promise<void>;

type DispatchResult = {
  assigned?: number;
};

type DriverRecord = {
  id?: string | number;
  load_id?: string | number;
  loadId?: string | number;
  company_name?: string;
  companyName?: string;
  name?: string;
  full_name?: string;
  freight_carriers?: {
    company_name?: string;
    companyName?: string;
    name?: string;
  } | null;
  [key: string]: unknown;
};

/*
 * Compatibility wrapper:
 * notificationService currently exposes sendLocalNotification with
 * a zero-argument TypeScript signature, while this scheduler must send
 * notification content.
 */
const sendNotification =
  sendLocalNotification as unknown as NotificationSender;

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

let schedulerRunning = false;
let schedulerCycleRunning = false;

let lastDispatchRun = 0;
let lastRiskRun = 0;

const DISPATCH_INTERVAL_MS = 1000 * 60 * 2;
const RISK_SCAN_INTERVAL_MS = 1000 * 60 * 3;
const SCHEDULER_TICK_MS = 1000 * 30;

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

async function deliverNotification(
  payload: LocalNotificationPayload
): Promise<void> {
  try {
    await Promise.resolve(sendNotification(payload));
  } catch (error) {
    console.log(
      "Local notification could not be delivered:",
      error
    );
  }
}

async function executeSchedulerCycle(): Promise<void> {
  if (schedulerCycleRunning) {
    return;
  }

  if (AppState.currentState !== "active") {
    return;
  }

  schedulerCycleRunning = true;

  try {
    await runDispatchCycle();
    await runDelayRiskAnalysis();
  } catch (error) {
    console.log(
      "Autonomous scheduler cycle error:",
      error
    );
  } finally {
    schedulerCycleRunning = false;
  }
}

export async function startAutonomousScheduler(): Promise<void> {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  console.log(
    "Autonomous logistics scheduler started."
  );

  /*
   * Run once immediately when the app is active.
   */
  if (AppState.currentState === "active") {
    await executeSchedulerCycle();
  }

  schedulerInterval = setInterval(() => {
    void executeSchedulerCycle();
  }, SCHEDULER_TICK_MS);
}

export function stopAutonomousScheduler(): void {
  if (schedulerInterval !== null) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }

  schedulerRunning = false;
  schedulerCycleRunning = false;

  console.log(
    "Autonomous logistics scheduler stopped."
  );
}

export async function runDispatchCycle(): Promise<void> {
  const now = Date.now();

  if (
    now - lastDispatchRun <
    DISPATCH_INTERVAL_MS
  ) {
    return;
  }

  lastDispatchRun = now;

  console.log(
    "Running autonomous dispatch cycle..."
  );

  try {
    const loads = await loadOpenFreightLoads();

    if (!Array.isArray(loads) || loads.length === 0) {
      console.log(
        "No open loads available."
      );

      return;
    }

    const rawResults =
      await runAutonomousDispatch();

    const results =
      (rawResults ?? {}) as DispatchResult;

    const assignedCount = Number(
      results.assigned ?? 0
    );

    console.log(
      `AI dispatch completed. Assignments: ${assignedCount}`
    );

    if (assignedCount > 0) {
      await deliverNotification({
        title: "AI Dispatch Completed",
        body: `${assignedCount} freight loads automatically assigned.`,
        data: {
          type: "AI_DISPATCH_COMPLETE",
          assigned: assignedCount,
        },
      });
    }
  } catch (error) {
    /*
     * Reset the timestamp so a failed dispatch can retry during the
     * next scheduler cycle.
     */
    lastDispatchRun = 0;

    console.log(
      "Autonomous dispatch cycle failed:",
      error
    );
  }
}

export async function runDelayRiskAnalysis(): Promise<void> {
  const now = Date.now();

  if (
    now - lastRiskRun <
    RISK_SCAN_INTERVAL_MS
  ) {
    return;
  }

  lastRiskRun = now;

  console.log(
    "Running delay risk analysis..."
  );

  try {
    const rawDrivers =
      await loadAvailableDrivers();

    if (
      !Array.isArray(rawDrivers) ||
      rawDrivers.length === 0
    ) {
      console.log(
        "No available drivers found for delay-risk analysis."
      );

      return;
    }

    for (const rawDriver of rawDrivers) {
      const driver =
        rawDriver as unknown as DriverRecord;

      try {
        const riskResult =
          await predictDeliveryDelayRisk(
            rawDriver
          );

        const normalizedRisk =
          clean(riskResult).toUpperCase();

        if (normalizedRisk !== "HIGH") {
          continue;
        }

        const driverId = clean(
          driver.id
        );

        const loadId = clean(
          driver.load_id ??
            driver.loadId
        );

        const companyName = clean(
          driver.freight_carriers?.company_name ??
            driver.freight_carriers?.companyName ??
            driver.freight_carriers?.name ??
            driver.company_name ??
            driver.companyName ??
            driver.full_name ??
            driver.name ??
            "Driver"
        );

        console.log(
          "High delivery risk detected:",
          driverId || "Unknown driver"
        );

        await deliverNotification({
          title: "High Delivery Delay Risk",
          body: `${
            companyName || "Driver"
          } may experience delivery delays.`,
          data: {
            type: "HIGH_DELAY_RISK",
            driverId,
            loadId,
          },
        });
      } catch (driverError) {
        console.log(
          `Delay-risk analysis failed for driver ${
            clean(driver.id) || "unknown"
          }:`,
          driverError
        );
      }
    }
  } catch (error) {
    /*
     * Reset the timestamp so a failed scan can retry during the next
     * scheduler cycle.
     */
    lastRiskRun = 0;

    console.log(
      "Delay risk analysis failed:",
      error
    );
  }
}

export function getSchedulerStatus() {
  return {
    running: schedulerRunning,
    cycleRunning: schedulerCycleRunning,

    dispatchInterval:
      DISPATCH_INTERVAL_MS,

    riskInterval:
      RISK_SCAN_INTERVAL_MS,

    schedulerTickInterval:
      SCHEDULER_TICK_MS,

    lastDispatchRun,
    lastRiskRun,

    lastDispatchRunAt:
      lastDispatchRun > 0
        ? new Date(
            lastDispatchRun
          ).toISOString()
        : null,

    lastRiskRunAt:
      lastRiskRun > 0
        ? new Date(
            lastRiskRun
          ).toISOString()
        : null,
  };
}