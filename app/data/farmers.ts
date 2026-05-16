// app/data/farmers.ts

export type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
};

export type Farmer = {
  id: string;
  farmName: string;
  ownerName: string;
  approved: boolean;
  pickup: boolean;
  delivery: boolean;
  logo: string;
  rating: number;
  reviews: number;
  itemsSold: number;
  revenue: number;
  products: Product[];
};

export const farmers: Farmer[] = [
  {
    id: "farm001",
    farmName: "Green Valley Farms",
    ownerName: "John Farmer",
    approved: true,
    pickup: true,
    delivery: true,
    logo: "https://images.unsplash.com/photo-1500595046743-cd271d694d30",
    rating: 4.8,
    reviews: 18,
    itemsSold: 74,
    revenue: 1260.5,
    products: [
      {
        id: "p001",
        name: "Fresh Tomatoes",
        price: 4.99,
        image:
          "https://images.unsplash.com/photo-1546470427-e26264be0b0d",
        category: "Vegetables",
      },
    ],
  },
  {
    id: "farm002",
    farmName: "Sunrise Orchard",
    ownerName: "Mary Fields",
    approved: false,
    pickup: true,
    delivery: false,
    logo:
      "https://images.unsplash.com/photo-1560493676-04071c5f467b",
    rating: 4.7,
    reviews: 12,
    itemsSold: 51,
    revenue: 890.25,
    products: [
      {
        id: "p003",
        name: "Fresh Apples",
        price: 6.99,
        image:
          "https://images.unsplash.com/photo-1567306226416-28f0efdc88ce",
        category: "Fruit",
      },
    ],
  },
];