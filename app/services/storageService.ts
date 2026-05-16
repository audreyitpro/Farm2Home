import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";

import { supabase } from "./supabaseClient";

type UploadBucket =
  | "avatars"
  | "proof-of-pickup"
  | "proof-of-delivery"
  | "freight-images";

async function uploadImageToBucket(
  bucket: UploadBucket,
  fileName: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64",
    });

    const contentType =
      fileExt === "png"
        ? "image/png"
        : fileExt === "webp"
        ? "image/webp"
        : "image/jpeg";

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, decode(base64), {
        contentType,
        upsert: true,
      });

    if (error) {
      console.log("SUPABASE_STORAGE_UPLOAD_ERROR:", error);
      throw error;
    }

    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    return data.publicUrl;
  } catch (error) {
    console.log("UPLOAD_IMAGE_TO_BUCKET_ERROR:", error);
    throw error;
  }
}

export async function uploadAvatarImage(
  userId: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `avatar-${userId}-${Date.now()}.${fileExt}`;

    return await uploadImageToBucket(
      "avatars",
      fileName,
      imageUri
    );
  } catch (error) {
    console.log("Avatar upload error:", error);
    throw error;
  }
}

export async function uploadProofOfPickupImage(
  loadId: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `pickup-${loadId}-${Date.now()}.${fileExt}`;

    return await uploadImageToBucket(
      "proof-of-pickup",
      fileName,
      imageUri
    );
  } catch (error) {
    console.log("Pickup upload error:", error);
    throw error;
  }
}

export async function uploadProofOfDeliveryImage(
  loadId: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `delivery-${loadId}-${Date.now()}.${fileExt}`;

    return await uploadImageToBucket(
      "proof-of-delivery",
      fileName,
      imageUri
    );
  } catch (error) {
    console.log("Delivery upload error:", error);
    throw error;
  }
}

export async function uploadFreightImage(
  loadId: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `freight-${loadId}-${Date.now()}.${fileExt}`;

    return await uploadImageToBucket(
      "freight-images",
      fileName,
      imageUri
    );
  } catch (error) {
    console.log("Freight image upload error:", error);
    throw error;
  }
}

export async function deleteStorageImage(
  bucket: UploadBucket,
  filePath: string
) {
  try {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.log("DELETE_STORAGE_IMAGE_ERROR:", error);
      throw error;
    }

    return true;
  } catch (error) {
    console.log("DELETE_STORAGE_IMAGE_CRASH:", error);
    return false;
  }
}

export function getStoragePublicUrl(
  bucket: UploadBucket,
  filePath: string
) {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}