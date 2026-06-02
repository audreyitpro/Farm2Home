// app/data/farmProductCatalog.ts

export type FarmProductUnit =
  | "lb"
  | "bunch"
  | "dozen"
  | "each"
  | "box"
  | "bag"
  | "case"
  | "bundle"
  | "gallon"
  | "pint"
  | "quart"
  | "jar"
  | "basket"
  | "bale"
  | "cord"
  | "tray"
  | "flat";

export type FarmProductCategory =
  | "Fruits"
  | "Vegetables"
  | "Herbs"
  | "Honey & Bee Products"
  | "Dairy"
  | "Eggs"
  | "Meat"
  | "Fish & Aquaculture"
  | "Plants & Nursery"
  | "Flowers"
  | "Hay & Feed"
  | "Farm Supplies"
  | "Bakery & Cottage Foods"
  | "Seasonal Products"
  | "Specialty Products";

export type FarmCatalogProduct = {
  id: string;
  name: string;
  category: FarmProductCategory;
  unit: FarmProductUnit;
  imageUrl: string;
  tags: string[];
  defaultPrice: number;
  defaultStock: number;
};

export const FARM_PRODUCT_CATALOG: FarmCatalogProduct[] = [
  // FRUITS
  {
    id: "apples",
    name: "Apples",
    category: "Fruits",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1560806887-1e4cd0b6cbd6",
    tags: ["local", "seasonal"],
    defaultPrice: 2.99,
    defaultStock: 50,
  },
  {
    id: "peaches",
    name: "Peaches",
    category: "Fruits",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1531171596281-8b5d26917d8b",
    tags: ["fresh", "seasonal"],
    defaultPrice: 3.49,
    defaultStock: 40,
  },
  {
    id: "blueberries",
    name: "Blueberries",
    category: "Fruits",
    unit: "pint",
    imageUrl: "https://images.unsplash.com/photo-1498557850523-fd3d118b962e",
    tags: ["fresh", "local"],
    defaultPrice: 4.99,
    defaultStock: 30,
  },
  {
    id: "strawberries",
    name: "Strawberries",
    category: "Fruits",
    unit: "quart",
    imageUrl: "https://images.unsplash.com/photo-1464965911861-746a04b4bca6",
    tags: ["fresh", "seasonal"],
    defaultPrice: 5.99,
    defaultStock: 30,
  },
  {
    id: "watermelon",
    name: "Watermelon",
    category: "Fruits",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1587049352846-4a222e784d38",
    tags: ["seasonal"],
    defaultPrice: 7.99,
    defaultStock: 20,
  },
  {
    id: "grapes",
    name: "Grapes",
    category: "Fruits",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1537640538966-79f369143f8f",
    tags: ["fresh", "seasonal"],
    defaultPrice: 3.99,
    defaultStock: 35,
  },

  // VEGETABLES
  {
    id: "tomatoes",
    name: "Tomatoes",
    category: "Vegetables",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1546470427-e5ac89c8ef30",
    tags: ["fresh", "local"],
    defaultPrice: 2.99,
    defaultStock: 50,
  },
  {
    id: "sweet-corn",
    name: "Sweet Corn",
    category: "Vegetables",
    unit: "dozen",
    imageUrl: "https://images.unsplash.com/photo-1551754655-cd27e38d2076",
    tags: ["seasonal", "local"],
    defaultPrice: 6.99,
    defaultStock: 25,
  },
  {
    id: "green-beans",
    name: "Green Beans",
    category: "Vegetables",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1567375698348-5d9d5ae99de0",
    tags: ["fresh"],
    defaultPrice: 3.49,
    defaultStock: 40,
  },
  {
    id: "cucumbers",
    name: "Cucumbers",
    category: "Vegetables",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1604977042946-1eecc30f269e",
    tags: ["fresh", "local"],
    defaultPrice: 1.25,
    defaultStock: 50,
  },
  {
    id: "lettuce",
    name: "Lettuce",
    category: "Vegetables",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1622206151226-18ca2c9ab4a1",
    tags: ["fresh", "local"],
    defaultPrice: 2.99,
    defaultStock: 35,
  },
  {
    id: "potatoes",
    name: "Potatoes",
    category: "Vegetables",
    unit: "bag",
    imageUrl: "https://images.unsplash.com/photo-1518977676601-b53f82aba655",
    tags: ["local"],
    defaultPrice: 5.99,
    defaultStock: 30,
  },
  {
    id: "carrots",
    name: "Carrots",
    category: "Vegetables",
    unit: "bunch",
    imageUrl: "https://images.unsplash.com/photo-1445282768818-728615cc910a",
    tags: ["fresh"],
    defaultPrice: 2.99,
    defaultStock: 35,
  },
  {
    id: "peppers",
    name: "Peppers",
    category: "Vegetables",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1563565375-f3fdfdbefa83",
    tags: ["fresh"],
    defaultPrice: 3.99,
    defaultStock: 35,
  },

  // HERBS
  {
    id: "basil",
    name: "Basil",
    category: "Herbs",
    unit: "bunch",
    imageUrl: "https://images.unsplash.com/photo-1618164435735-413d3b066c9a",
    tags: ["fresh"],
    defaultPrice: 2.49,
    defaultStock: 25,
  },
  {
    id: "mint",
    name: "Mint",
    category: "Herbs",
    unit: "bunch",
    imageUrl: "https://images.unsplash.com/photo-1628557044797-f21a177c37ec",
    tags: ["fresh"],
    defaultPrice: 2.49,
    defaultStock: 25,
  },
  {
    id: "cilantro",
    name: "Cilantro",
    category: "Herbs",
    unit: "bunch",
    imageUrl: "https://images.unsplash.com/photo-1600626333392-65f95654a35b",
    tags: ["fresh"],
    defaultPrice: 1.99,
    defaultStock: 25,
  },

  // HONEY
  {
    id: "honey",
    name: "Honey",
    category: "Honey & Bee Products",
    unit: "jar",
    imageUrl: "https://images.unsplash.com/photo-1587049352851-8d4e89133924",
    tags: ["local", "natural"],
    defaultPrice: 9.99,
    defaultStock: 20,
  },
  {
    id: "raw-honey",
    name: "Raw Honey",
    category: "Honey & Bee Products",
    unit: "jar",
    imageUrl: "https://images.unsplash.com/photo-1471943311424-646960669fbc",
    tags: ["local", "raw"],
    defaultPrice: 12.99,
    defaultStock: 18,
  },
  {
    id: "honeycomb",
    name: "Honeycomb",
    category: "Honey & Bee Products",
    unit: "box",
    imageUrl: "https://images.unsplash.com/photo-1471943311424-646960669fbc",
    tags: ["local"],
    defaultPrice: 12.99,
    defaultStock: 15,
  },

  // EGGS
  {
    id: "chicken-eggs",
    name: "Chicken Eggs",
    category: "Eggs",
    unit: "dozen",
    imageUrl: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f",
    tags: ["local", "farm fresh"],
    defaultPrice: 4.99,
    defaultStock: 30,
  },
  {
    id: "duck-eggs",
    name: "Duck Eggs",
    category: "Eggs",
    unit: "dozen",
    imageUrl: "https://images.unsplash.com/photo-1598965402089-897ce52e8355",
    tags: ["local"],
    defaultPrice: 7.99,
    defaultStock: 15,
  },
  {
    id: "quail-eggs",
    name: "Quail Eggs",
    category: "Eggs",
    unit: "dozen",
    imageUrl: "https://images.unsplash.com/photo-1582722872445-44dc5f7e3c8f",
    tags: ["local", "specialty"],
    defaultPrice: 8.99,
    defaultStock: 15,
  },

  // DAIRY
  {
    id: "milk",
    name: "Milk",
    category: "Dairy",
    unit: "gallon",
    imageUrl: "https://images.unsplash.com/photo-1563636619-e9143da7973b",
    tags: ["local"],
    defaultPrice: 5.99,
    defaultStock: 20,
  },
  {
    id: "cheese",
    name: "Cheese",
    category: "Dairy",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1486297678162-eb2a19b0a32d",
    tags: ["local"],
    defaultPrice: 8.99,
    defaultStock: 20,
  },
  {
    id: "yogurt",
    name: "Yogurt",
    category: "Dairy",
    unit: "quart",
    imageUrl: "https://images.unsplash.com/photo-1488477181946-6428a0291777",
    tags: ["local"],
    defaultPrice: 5.99,
    defaultStock: 20,
  },

  // MEAT
  {
    id: "beef",
    name: "Beef",
    category: "Meat",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1603048297172-c92544798d5a",
    tags: ["local"],
    defaultPrice: 9.99,
    defaultStock: 25,
  },
  {
    id: "chicken",
    name: "Chicken",
    category: "Meat",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1604503468506-a8da13d82791",
    tags: ["local"],
    defaultPrice: 5.99,
    defaultStock: 25,
  },
  {
    id: "turkey",
    name: "Turkey",
    category: "Meat",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1574672280600-4accfa5b6f98",
    tags: ["holiday", "seasonal"],
    defaultPrice: 4.99,
    defaultStock: 20,
  },

  // FISH & AQUACULTURE
  {
    id: "fresh-fish",
    name: "Fresh Fish",
    category: "Fish & Aquaculture",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62",
    tags: ["fresh", "local"],
    defaultPrice: 8.99,
    defaultStock: 25,
  },
  {
    id: "catfish",
    name: "Catfish",
    category: "Fish & Aquaculture",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1559847844-5315695dadae",
    tags: ["aquaculture"],
    defaultPrice: 7.99,
    defaultStock: 25,
  },
  {
    id: "tilapia",
    name: "Tilapia",
    category: "Fish & Aquaculture",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1534766555764-ce878a5e3a2b",
    tags: ["aquaculture"],
    defaultPrice: 7.49,
    defaultStock: 25,
  },
  {
    id: "trout",
    name: "Trout",
    category: "Fish & Aquaculture",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62",
    tags: ["aquaculture", "fresh"],
    defaultPrice: 9.99,
    defaultStock: 20,
  },
  {
    id: "shrimp",
    name: "Shrimp",
    category: "Fish & Aquaculture",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1565680018434-b513d5e5fd47",
    tags: ["fresh"],
    defaultPrice: 12.99,
    defaultStock: 20,
  },
  {
    id: "crawfish",
    name: "Crawfish",
    category: "Fish & Aquaculture",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62",
    tags: ["seasonal"],
    defaultPrice: 6.99,
    defaultStock: 30,
  },

  // HAY & FEED
  {
    id: "bale-of-hay",
    name: "Bale of Hay",
    category: "Hay & Feed",
    unit: "bale",
    imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
    tags: ["farm supply"],
    defaultPrice: 8.99,
    defaultStock: 50,
  },
  {
    id: "straw-bale",
    name: "Straw Bale",
    category: "Hay & Feed",
    unit: "bale",
    imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
    tags: ["seasonal", "farm supply"],
    defaultPrice: 7.99,
    defaultStock: 50,
  },
  {
    id: "alfalfa-hay",
    name: "Alfalfa Hay",
    category: "Hay & Feed",
    unit: "bale",
    imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
    tags: ["feed"],
    defaultPrice: 12.99,
    defaultStock: 40,
  },
  {
    id: "timothy-hay",
    name: "Timothy Hay",
    category: "Hay & Feed",
    unit: "bale",
    imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
    tags: ["feed"],
    defaultPrice: 12.99,
    defaultStock: 40,
  },
  {
    id: "feed-corn",
    name: "Feed Corn",
    category: "Hay & Feed",
    unit: "bag",
    imageUrl: "https://images.unsplash.com/photo-1551754655-cd27e38d2076",
    tags: ["feed"],
    defaultPrice: 14.99,
    defaultStock: 30,
  },
  {
    id: "animal-feed",
    name: "Animal Feed",
    category: "Hay & Feed",
    unit: "bag",
    imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
    tags: ["feed", "farm supply"],
    defaultPrice: 18.99,
    defaultStock: 25,
  },

  // PLANTS & NURSERY
  {
    id: "vegetable-plants",
    name: "Vegetable Plants",
    category: "Plants & Nursery",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b",
    tags: ["nursery", "seasonal"],
    defaultPrice: 3.99,
    defaultStock: 50,
  },
  {
    id: "fruit-trees",
    name: "Fruit Trees",
    category: "Plants & Nursery",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1591857177580-dc82b9ac4e1e",
    tags: ["nursery"],
    defaultPrice: 39.99,
    defaultStock: 15,
  },
  {
    id: "shade-trees",
    name: "Shade Trees",
    category: "Plants & Nursery",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6",
    tags: ["nursery"],
    defaultPrice: 49.99,
    defaultStock: 12,
  },

  // FLOWERS
  {
    id: "sunflowers",
    name: "Sunflowers",
    category: "Flowers",
    unit: "bunch",
    imageUrl: "https://images.unsplash.com/photo-1470509037663-253afd7f0f51",
    tags: ["seasonal"],
    defaultPrice: 8.99,
    defaultStock: 25,
  },
  {
    id: "wildflower-bouquets",
    name: "Wildflower Bouquets",
    category: "Flowers",
    unit: "bunch",
    imageUrl: "https://images.unsplash.com/photo-1468327768560-75b778cbb551",
    tags: ["local", "seasonal"],
    defaultPrice: 12.99,
    defaultStock: 20,
  },
  {
    id: "easter-flowers",
    name: "Easter Flowers",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1490750967868-88aa4486c946",
    tags: ["spring", "holiday", "seasonal"],
    defaultPrice: 14.99,
    defaultStock: 20,
  },

  // FARM SUPPLIES
  {
    id: "firewood",
    name: "Firewood",
    category: "Farm Supplies",
    unit: "bundle",
    imageUrl: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60",
    tags: ["seasonal"],
    defaultPrice: 6.99,
    defaultStock: 40,
  },
  {
    id: "firewood-cord",
    name: "Firewood Cord",
    category: "Farm Supplies",
    unit: "cord",
    imageUrl: "https://images.unsplash.com/photo-1517677208171-0bc6725a3e60",
    tags: ["seasonal"],
    defaultPrice: 180,
    defaultStock: 10,
  },
  {
    id: "compost",
    name: "Compost",
    category: "Farm Supplies",
    unit: "bag",
    imageUrl: "https://images.unsplash.com/photo-1581578017421-7e52c07f620a",
    tags: ["garden"],
    defaultPrice: 5.99,
    defaultStock: 40,
  },
  {
    id: "mulch",
    name: "Mulch",
    category: "Farm Supplies",
    unit: "bag",
    imageUrl: "https://images.unsplash.com/photo-1581578017421-7e52c07f620a",
    tags: ["garden"],
    defaultPrice: 4.99,
    defaultStock: 40,
  },
  {
    id: "topsoil",
    name: "Topsoil",
    category: "Farm Supplies",
    unit: "bag",
    imageUrl: "https://images.unsplash.com/photo-1581578017421-7e52c07f620a",
    tags: ["garden"],
    defaultPrice: 4.99,
    defaultStock: 40,
  },

  // BAKERY & COTTAGE FOODS
  {
    id: "bread",
    name: "Bread",
    category: "Bakery & Cottage Foods",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff",
    tags: ["cottage food"],
    defaultPrice: 6.99,
    defaultStock: 20,
  },
  {
    id: "pies",
    name: "Pies",
    category: "Bakery & Cottage Foods",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1621743478914-cc8a86d7e7b5",
    tags: ["cottage food", "seasonal"],
    defaultPrice: 14.99,
    defaultStock: 12,
  },
  {
    id: "jams",
    name: "Jams",
    category: "Bakery & Cottage Foods",
    unit: "jar",
    imageUrl: "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d",
    tags: ["cottage food"],
    defaultPrice: 7.99,
    defaultStock: 20,
  },
  {
    id: "salsa",
    name: "Salsa",
    category: "Bakery & Cottage Foods",
    unit: "jar",
    imageUrl: "https://images.unsplash.com/photo-1571066811602-716837d681de",
    tags: ["cottage food"],
    defaultPrice: 6.99,
    defaultStock: 20,
  },

  // SEASONAL
  {
    id: "pumpkins",
    name: "Pumpkins",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1506917728037-b6af01a7d403",
    tags: ["fall", "seasonal"],
    defaultPrice: 8.99,
    defaultStock: 30,
  },
  {
    id: "christmas-trees",
    name: "Christmas Trees",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543",
    tags: ["winter", "holiday", "seasonal"],
    defaultPrice: 59.99,
    defaultStock: 25,
  },
  {
    id: "fresh-cut-christmas-trees",
    name: "Fresh Cut Christmas Trees",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543",
    tags: ["winter", "holiday", "seasonal"],
    defaultPrice: 69.99,
    defaultStock: 20,
  },
  {
    id: "live-christmas-trees",
    name: "Live Christmas Trees",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543",
    tags: ["winter", "holiday", "seasonal"],
    defaultPrice: 79.99,
    defaultStock: 15,
  },
  {
    id: "wreaths",
    name: "Wreaths",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1543589077-47d81606c1bf",
    tags: ["winter", "holiday"],
    defaultPrice: 24.99,
    defaultStock: 25,
  },
  {
    id: "garland",
    name: "Garland",
    category: "Seasonal Products",
    unit: "bundle",
    imageUrl: "https://images.unsplash.com/photo-1543589077-47d81606c1bf",
    tags: ["winter", "holiday"],
    defaultPrice: 19.99,
    defaultStock: 25,
  },
  {
    id: "corn-stalks",
    name: "Corn Stalks",
    category: "Seasonal Products",
    unit: "bundle",
    imageUrl: "https://images.unsplash.com/photo-1500382017468-9049fed747ef",
    tags: ["fall", "seasonal"],
    defaultPrice: 9.99,
    defaultStock: 30,
  },
  {
    id: "gourds",
    name: "Gourds",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1506917728037-b6af01a7d403",
    tags: ["fall", "seasonal"],
    defaultPrice: 2.99,
    defaultStock: 50,
  },
  {
    id: "poinsettias",
    name: "Poinsettias",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1512389142860-9c449e58a543",
    tags: ["winter", "holiday"],
    defaultPrice: 14.99,
    defaultStock: 25,
  },
  {
    id: "thanksgiving-turkeys",
    name: "Thanksgiving Turkeys",
    category: "Seasonal Products",
    unit: "each",
    imageUrl: "https://images.unsplash.com/photo-1574672280600-4accfa5b6f98",
    tags: ["fall", "holiday", "seasonal"],
    defaultPrice: 69.99,
    defaultStock: 15,
  },
  {
    id: "holiday-gift-baskets",
    name: "Holiday Gift Baskets",
    category: "Seasonal Products",
    unit: "basket",
    imageUrl: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a",
    tags: ["holiday", "seasonal"],
    defaultPrice: 39.99,
    defaultStock: 15,
  },

  // SPECIALTY
  {
    id: "maple-syrup",
    name: "Maple Syrup",
    category: "Specialty Products",
    unit: "jar",
    imageUrl: "https://images.unsplash.com/photo-1587049352851-8d4e89133924",
    tags: ["local", "seasonal"],
    defaultPrice: 12.99,
    defaultStock: 20,
  },
  {
    id: "mushrooms",
    name: "Mushrooms",
    category: "Specialty Products",
    unit: "lb",
    imageUrl: "https://images.unsplash.com/photo-1504545102780-26774c1bb073",
    tags: ["specialty"],
    defaultPrice: 8.99,
    defaultStock: 20,
  },
  {
    id: "microgreens",
    name: "Microgreens",
    category: "Specialty Products",
    unit: "box",
    imageUrl: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd",
    tags: ["fresh", "specialty"],
    defaultPrice: 6.99,
    defaultStock: 25,
  },
  {
    id: "lavender",
    name: "Lavender",
    category: "Specialty Products",
    unit: "bunch",
    imageUrl: "https://images.unsplash.com/photo-1499002238440-d264edd596ec",
    tags: ["specialty", "local"],
    defaultPrice: 6.99,
    defaultStock: 25,
  },
];

export const FARM_PRODUCT_CATEGORIES: FarmProductCategory[] = [
  "Fruits",
  "Vegetables",
  "Herbs",
  "Honey & Bee Products",
  "Dairy",
  "Eggs",
  "Meat",
  "Fish & Aquaculture",
  "Plants & Nursery",
  "Flowers",
  "Hay & Feed",
  "Farm Supplies",
  "Bakery & Cottage Foods",
  "Seasonal Products",
  "Specialty Products",
];

export function getFarmProductById(id: string) {
  return FARM_PRODUCT_CATALOG.find((item) => item.id === id) || null;
}

export function getFarmProductsByCategory(category: FarmProductCategory) {
  return FARM_PRODUCT_CATALOG.filter((item) => item.category === category);
}

export function searchFarmProducts(query: string) {
  const q = query.trim().toLowerCase();

  if (!q) return FARM_PRODUCT_CATALOG;

  return FARM_PRODUCT_CATALOG.filter((item) => {
    return (
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });
}