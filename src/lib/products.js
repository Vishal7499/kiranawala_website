// Kirana catalog. Saler sees the exact text the customer picked or typed.
export const CATEGORIES = [
  {
    name: 'Daily Kirana',
    items: [
      'Toor dal 1kg',
      'Rice 5kg',
      'Wheat atta 5kg',
      'Sugar 1kg',
      'Salt 1kg',
      'Cooking oil 1L',
      'Tea leaves 250g',
      'Milk 1L',
      'Bread',
      'Egg (6)',
    ],
  },
  {
    name: 'Personal Care',
    items: ['Soap (4)', 'Colgate 200g', 'Colgate 100g', 'Brush (2)', 'Shampoo 180ml', 'Hair oil', 'Tissue paper'],
  },
  {
    name: 'Home Care',
    items: ['Surf excel 1kg', 'Utensil wash liquid', 'Floor cleaner 1L', 'Phenyl 1L', 'Mosquito coil', 'Garbage bags'],
  },
  {
    name: 'Snacks & Frozen',
    items: ['Ice cream (1L)', 'Ice cream cup (4)', 'Chips', 'Biscuits', 'Namkeen 200g', 'Cold drink 750ml'],
  },
];

export const ALL_ITEMS = CATEGORIES.flatMap((c) => c.items);

export const QUICK_ITEMS = ['Kirana basket', 'Soap', 'Colgate', 'Brush', 'Ice cream', 'Milk', 'Bread', 'Egg (6)'];
