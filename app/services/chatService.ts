// app/services/chatService.ts

import { supabase } from "./supabaseClient";

export async function sendChatMessage({
  conversationId,
  senderId,
  senderRole,
  message,
}: {
  conversationId: string;
  senderId: string;
  senderRole: string;
  message: string;
}) {
  const result = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      sender_role: senderRole,
      message,
    })
    .select()
    .single();

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export async function getConversationMessages(
  conversationId: string
) {
  const result = await supabase
    .from("chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return result.data;
}

export function subscribeToConversation(
  conversationId: string,
  callback: (payload: any) => void
) {
  const channel = supabase
    .channel(`conversation-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
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