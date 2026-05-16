export const COLORS = {
  green: "#2F7D32",
  darkGreen: "#1B5E20",
  lightGreen: "#E8F5E9",
  gold: "#D4A017",
  brown: "#5C3B1E",
  cream: "#F7F7F2",
  white: "#FFFFFF",
  black: "#111111",
  gray: "#666666",
  lightGray: "#EEEEEE",
  border: "#E2E2E2",
  red: "#D32F2F",
  blue: "#1976D2",
};

export const BRAND = {
  name: "Farm2Home",
  shortName: "F2H",
  tagline: "From Local Farms To Your Family",
  mission:
    "Connecting certified local farmers directly with families and communities.",
};

export const FEES = {
  farmerSignup: 29.99,
  farmerMonthly: 14.99,
  customerMonthly: 4.99,
  marketplaceServiceRate: 0.04,
};

export const MEMBERSHIP_TEXT = {
  farmerPlan:
    "Farmers: $29.99 one-time signup + $14.99 monthly membership + 4% marketplace service fee.",
  customerPlan:
    "Customers: $4.99 monthly membership for premium access, deals, and delivery benefits.",
};

export const CATEGORY_LIST = [
  "All",
  "Produce",
  "Eggs",
  "Meat",
  "Honey",
  "Halal",
  "Livestock",
  "Dairy",
  "Baked Goods",
  "Herbs",
  "Flowers",
  "Plants",
];

export const QUICK_ACTIONS = [
  {
    label: "Farmer Sign Up",
    icon: "🚜",
    route: "/farmer/register",
  },
  {
    label: "Documents",
    icon: "📄",
    route: "/farmer/documents",
  },
  {
    label: "Livestock",
    icon: "🐄",
    route: "/livestock",
  },
  {
    label: "Freight",
    icon: "🚚",
    route: "/freight",
  },
  {
    label: "Membership",
    icon: "🌟",
    route: "/customer-membership",
  },
];

export const BADGES = {
  certified: "Certified",
  topRated: "Top Rated",
  localFavorite: "Local Favorite",
  verifiedFarmer: "Verified Farmer",
  premiumMember: "Premium Member",
};

export const APP_TEXT = {
  homeTitle: "Certified farmers near you",
  marketplaceTitle: "Farm2Home Marketplace",
  searchPlaceholder: "Search farms, eggs, beef, honey...",
  deliveringTo: "Delivering to",
  currentLocation: "📍 Current Location",
  seeAll: "See all",
};

export const FARMERS = [
  {
    id: 1,
    name: "Green Valley Farm",
    rating: 4.9,
    reviews: 128,
    distance: "2.4 mi",
    deliveryTime: "25–35 min",
    city: "Detroit, MI",
    products: "Eggs • Produce • Honey",
    image: "🥚",
  },
  {
    id: 2,
    name: "Oak Ridge Cattle Farm",
    rating: 4.8,
    reviews: 91,
    distance: "5.7 mi",
    deliveryTime: "45–60 min",
    city: "Flint, MI",
    products: "Beef • Halal Meat • Livestock",
    image: "🥩",
  },
  {
    id: 3,
    name: "Sweet Hive Farm",
    rating: 4.7,
    reviews: 76,
    distance: "7.9 mi",
    deliveryTime: "30–45 min",
    city: "Ann Arbor, MI",
    products: "Honey • Herbs • Produce",
    image: "🍯",
  },
  {
    id: 4,
    name: "Sunrise Produce",
    rating: 4.9,
    reviews: 143,
    distance: "3.1 mi",
    deliveryTime: "20–30 min",
    city: "Pontiac, MI",
    products: "Fresh Produce • Greens • Herbs",
    image: "🥬",
  },
];