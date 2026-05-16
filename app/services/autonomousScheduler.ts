import { AppState } from "react-native";

import {
  loadAvailableDrivers,
  loadOpenFreightLoads,
  predictDeliveryDelayRisk,
  runAutonomousDispatch,
} from "../ai/autonomous-dispatch-engine";

import { sendLocalNotification } from "./notificationService";

let schedulerInterval: NodeJS.Timeout | null =
  null;

let schedulerRunning = false;

let lastDispatchRun =
  0;

const DISPATCH_INTERVAL_MS =
  1000 * 60 * 2;

const RISK_SCAN_INTERVAL_MS =
  1000 * 60 * 3;

export async function startAutonomousScheduler() {
  if (schedulerRunning) {
    return;
  }

  schedulerRunning = true;

  console.log(
    "Autonomous logistics scheduler started."
  );

  schedulerInterval = setInterval(
    async () => {
      try {
        if (
          AppState.currentState !== "active"
        ) {
          return;
        }

        await runDispatchCycle();

        await runDelayRiskAnalysis();
      } catch (error) {
        console.log(
          "Autonomous scheduler error:",
          error
        );
      }
    },
    1000 * 30
  );
}

export function stopAutonomousScheduler() {
  if (schedulerInterval) {
    clearInterval(
      schedulerInterval
    );

    schedulerInterval = null;
  }

  schedulerRunning = false;

  console.log(
    "Autonomous logistics scheduler stopped."
  );
}

export async function runDispatchCycle() {
  const now =
    Date.now();

  if (
    now -
      lastDispatchRun <
    DISPATCH_INTERVAL_MS
  ) {
    return;
  }

  lastDispatchRun = now;

  console.log(
    "Running autonomous dispatch cycle..."
  );

  const loads =
    await loadOpenFreightLoads();

  if (
    loads.length === 0
  ) {
    console.log(
      "No open loads available."
    );

    return;
  }

  const results =
    await runAutonomousDispatch();

  console.log(
    `AI dispatch completed. Assignments: ${results.assigned}`
  );

  if (
    results.assigned > 0
  ) {
    await sendLocalNotification({
      title:
        "AI Dispatch Completed",
      body: `${results.assigned} freight loads automatically assigned.`,
      data: {
        type: "AI_DISPATCH_COMPLETE",
        assigned:
          results.assigned,
      },
    });
  }
}

let lastRiskRun =
  0;

export async function runDelayRiskAnalysis() {
  const now =
    Date.now();

  if (
    now -
      lastRiskRun <
    RISK_SCAN_INTERVAL_MS
  ) {
    return;
  }

  lastRiskRun = now;

  console.log(
    "Running delay risk analysis..."
  );

  const drivers =
    await loadAvailableDrivers();

  for (const driver of drivers) {
    const risk =
      await predictDeliveryDelayRisk(
        driver
      );

    if (
      risk === "HIGH"
    ) {
      console.log(
        "High delivery risk detected:",
        driver.id
      );

      await sendLocalNotification({
        title:
          "High Delivery Delay Risk",
        body: `${
          driver.freight_carriers
            ?.company_name ||
          "Driver"
        } may experience delivery delays.`,
        data: {
          type: "HIGH_DELAY_RISK",
          driverId:
            driver.id,
          loadId:
            driver.load_id,
        },
      });
    }
  }
}

export function getSchedulerStatus() {
  return {
    running:
      schedulerRunning,

    dispatchInterval:
      DISPATCH_INTERVAL_MS,

    riskInterval:
      RISK_SCAN_INTERVAL_MS,

    lastDispatchRun,

    lastRiskRun,
  };
}