export const PRODUCT_CATEGORIES = [
  "Fresh Produce",
  "Eggs",
  "Honey",
  "Meat",
  "Poultry",
  "Dairy",
  "Baked Goods",
  "Cottage Foods",
  "Herbs",
  "Plants",
  "Flowers",
  "Jams and Preserves",
  "Microgreens",
  "Livestock",
];

export const BUYER_TYPES = [
  { label: "Everyone", value: "all" },
  { label: "Local Customer", value: "local_customer" },
  { label: "Community Group", value: "community" },
  { label: "Business", value: "business" },
];

export const PROCESSING_TYPES = [
  { label: "Not Applicable", value: "not_applicable" },
  { label: "Traditional", value: "traditional" },
  { label: "Halal", value: "halal" },
  { label: "Both Traditional and Halal", value: "both" },
];

export const REQUIRED_CERT_BY_CATEGORY: Record<string, string[]> = {
  "Fresh Produce": ["Produce Safety Certificate", "Farm Business License"],
  Eggs: ["Egg Sales License", "Farm Business License"],
  Honey: ["Honey Processing / Labeling Compliance"],
  Meat: ["Meat Processing Inspection Certificate", "Food Safety Certificate"],
  Poultry: ["Poultry Processing Certificate", "Food Safety Certificate"],
  Dairy: ["Dairy License", "Food Safety Certificate"],
  "Baked Goods": ["Cottage Food License or Commercial Kitchen Approval"],
  "Cottage Foods": ["Cottage Food Compliance"],
  Herbs: ["Produce Safety Certificate"],
  Plants: ["Nursery or Plant Sales License"],
  Flowers: ["Farm Sales Verification"],
  "Jams and Preserves": ["Cottage Food or Processing Approval"],
  Microgreens: ["Produce Safety Certificate"],
  Livestock: ["Animal Health Certificate", "Livestock Seller Permit"],
};