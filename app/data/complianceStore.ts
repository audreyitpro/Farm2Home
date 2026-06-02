// app/data/complianceStore.ts

export type ComplianceDocumentType =
  | "government_id"
  | "usda_meat_processing"
  | "dairy_license"
  | "egg_permit"
  | "cottage_food_permit"
  | "nursery_license"
  | "other_special_license"
  | "stripe_payout"
  | "pickup_delivery_agreement"
  | "legal_checklist";

export type FarmProductCategory =
  | "vegetables"
  | "fruit"
  | "herbs"
  | "honey"
  | "eggs"
  | "dairy"
  | "meat"
  | "plants"
  | "flowers"
  | "baked_goods"
  | "jams"
  | "sauces"
  | "other";

export type ComplianceDocument = {
  type: ComplianceDocumentType;
  label: string;
  description: string;
  required: boolean;
  categoryRequiredFor?: FarmProductCategory[];
};

export const FARM_PRODUCT_CATEGORIES: {
  id: FarmProductCategory;
  label: string;
  needsExtraDocument: boolean;
  documentType?: ComplianceDocumentType;
}[] = [
  { id: "vegetables", label: "Vegetables", needsExtraDocument: false },
  { id: "fruit", label: "Fruit", needsExtraDocument: false },
  { id: "herbs", label: "Herbs", needsExtraDocument: false },
  { id: "honey", label: "Honey", needsExtraDocument: false },
  { id: "flowers", label: "Flowers", needsExtraDocument: false },
  { id: "other", label: "Other Farm Products", needsExtraDocument: false },

  {
    id: "eggs",
    label: "Eggs",
    needsExtraDocument: true,
    documentType: "egg_permit",
  },
  {
    id: "dairy",
    label: "Dairy",
    needsExtraDocument: true,
    documentType: "dairy_license",
  },
  {
    id: "meat",
    label: "Meat",
    needsExtraDocument: true,
    documentType: "usda_meat_processing",
  },
  {
    id: "plants",
    label: "Plants / Nursery Stock",
    needsExtraDocument: true,
    documentType: "nursery_license",
  },
  {
    id: "baked_goods",
    label: "Baked Goods",
    needsExtraDocument: true,
    documentType: "cottage_food_permit",
  },
  {
    id: "jams",
    label: "Jams / Preserves",
    needsExtraDocument: true,
    documentType: "cottage_food_permit",
  },
  {
    id: "sauces",
    label: "Sauces",
    needsExtraDocument: true,
    documentType: "cottage_food_permit",
  },
];

export const REQUIRED_DOCUMENTS: ComplianceDocument[] = [
  {
    type: "government_id",
    label: "Government ID",
    description:
      "Upload a valid ID so Farm2Home can confirm the seller identity.",
    required: true,
  },

  {
    type: "usda_meat_processing",
    label: "USDA Meat Processing Documentation",
    description: "Only required if selling meat products.",
    required: false,
    categoryRequiredFor: ["meat"],
  },
  {
    type: "dairy_license",
    label: "Dairy License",
    description: "Only required if selling milk, cheese, or dairy products.",
    required: false,
    categoryRequiredFor: ["dairy"],
  },
  {
    type: "egg_permit",
    label: "Egg Permit",
    description: "Only required if your state requires a permit for egg sales.",
    required: false,
    categoryRequiredFor: ["eggs"],
  },
  {
    type: "cottage_food_permit",
    label: "Cottage Food Permit",
    description:
      "Only required if selling baked goods, jams, sauces, or cottage food items where your state requires it.",
    required: false,
    categoryRequiredFor: ["baked_goods", "jams", "sauces"],
  },
  {
    type: "nursery_license",
    label: "Nursery License",
    description: "Only required if selling plants or nursery stock.",
    required: false,
    categoryRequiredFor: ["plants"],
  },
  {
    type: "other_special_license",
    label: "Other Required License",
    description:
      "Upload any other license required for special products in your state.",
    required: false,
    categoryRequiredFor: ["other"],
  },

  {
    type: "stripe_payout",
    label: "Stripe Payout Setup",
    description: "Completed when the farmer connects Stripe payout.",
    required: false,
  },
  {
    type: "pickup_delivery_agreement",
    label: "Pickup / Delivery Agreement",
    description: "Completed when the farmer selects pickup, delivery, or both.",
    required: false,
  },
  {
    type: "legal_checklist",
    label: "Seller Agreement",
    description: "Completed when the farmer accepts seller terms.",
    required: false,
  },
];

export const REMOVED_REQUIRED_DOCUMENTS = [
  "EIN",
  "W-9 upload",
  "Business registration / DBA / LLC",
  "Sales tax certificate",
  "Liability insurance",
  "Invoice template",
  "Farmers market permit",
];

export function getRequiredDocumentsForCategories(
  selectedCategories: FarmProductCategory[]
) {
  const selected = new Set(selectedCategories);

  return REQUIRED_DOCUMENTS.filter((doc) => {
    if (doc.required) return true;

    if (!doc.categoryRequiredFor?.length) return false;

    return doc.categoryRequiredFor.some((category) => selected.has(category));
  });
}

export function getDocumentLabel(type: ComplianceDocumentType) {
  return REQUIRED_DOCUMENTS.find((doc) => doc.type === type)?.label || type;
}

export function productCategoryNeedsDocument(category: FarmProductCategory) {
  return FARM_PRODUCT_CATEGORIES.find((item) => item.id === category)
    ?.needsExtraDocument;
}