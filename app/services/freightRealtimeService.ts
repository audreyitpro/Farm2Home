// app/services/freightRealtimeService.ts

import { supabase } from "./supabaseClient";

export function subscribeToLoadBoard(
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel("load-board")
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "freight_loads",
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function subscribeToLoadTracking(
  loadId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`load-${loadId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "freight_tracking",
        filter: `load_id=eq.${loadId}`,
      },
      (payload) => {
        callback(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export async function updateLoadTracking({
  loadId,
  status,
  location,
}: {
  loadId: string;
  status: string;
  location?: string;
}) {
  const result = await supabase
    .from("freight_tracking")
    .insert({
      load_id: loadId,
      status,
      location,
      updated_at: new Date().toISOString(),
    });

  if (result.error) {
    throw result.error;
  }

  return true;
}