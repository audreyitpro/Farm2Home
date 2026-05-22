import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system";

import { supabase } from "./supabaseClient";

export type UploadBucket =
  | "avatars"
  | "proof-of-pickup"
  | "proof-of-delivery"
  | "freight-images"
  | "farm-products"
  | "farm-logos"
  | "compliance-documents";

function getContentType(fileExt: string) {
  switch (fileExt.toLowerCase()) {
    case "png":
      return "image/png";

    case "webp":
      return "image/webp";

    case "gif":
      return "image/gif";

    case "heic":
      return "image/heic";

    default:
      return "image/jpeg";
  }
}

function sanitizeFileName(value: string) {
  return value
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .toLowerCase();
}

async function uploadImageToBucket(
  bucket: UploadBucket,
  fileName: string,
  imageUri: string
) {
  try {
    if (!imageUri) {
      throw new Error("Missing image URI.");
    }

    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: "base64",
    });

    const contentType = getContentType(fileExt);

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

    const fileName = `avatar-${sanitizeFileName(
      userId
    )}-${Date.now()}.${fileExt}`;

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

export async function uploadFarmLogo(
  farmerId: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const fileName = `farm-logo-${sanitizeFileName(
      farmerId
    )}-${Date.now()}.${fileExt}`;

    return await uploadImageToBucket(
      "farm-logos",
      fileName,
      imageUri
    );
  } catch (error) {
    console.log("Farm logo upload error:", error);
    throw error;
  }
}

export async function uploadFarmProductImage(
  farmerId: string,
  productName: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const fileName =
      `product-${sanitizeFileName(farmerId)}-` +
      `${sanitizeFileName(productName)}-` +
      `${Date.now()}.${fileExt}`;

    return await uploadImageToBucket(
      "farm-products",
      fileName,
      imageUri
    );
  } catch (error) {
    console.log("Farm product upload error:", error);
    throw error;
  }
}

export async function uploadComplianceDocument(
  farmerId: string,
  imageUri: string
) {
  try {
    const fileExt =
      imageUri.split(".").pop()?.toLowerCase() || "jpg";

    const fileName =
      `compliance-${sanitizeFileName(farmerId)}-` +
      `${Date.now()}.${fileExt}`;

    return await uploadImageToBucket(
      "compliance-documents",
      fileName,
      imageUri
    );
  } catch (error) {
    console.log("Compliance upload error:", error);
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

    const fileName =
      `pickup-${sanitizeFileName(loadId)}-` +
      `${Date.now()}.${fileExt}`;

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

    const fileName =
      `delivery-${sanitizeFileName(loadId)}-` +
      `${Date.now()}.${fileExt}`;

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

    const fileName =
      `freight-${sanitizeFileName(loadId)}-` +
      `${Date.now()}.${fileExt}`;

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
    if (!filePath) return false;

    const cleanPath = filePath.includes("/storage/v1/object/public/")
      ? filePath.split("/public/")[1]?.split("/").slice(1).join("/")
      : filePath;

    const { error } = await supabase.storage
      .from(bucket)
      .remove([cleanPath]);

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