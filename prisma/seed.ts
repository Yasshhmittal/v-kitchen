/**
 * Seed script — `npm run db:seed`.
 *
 * Creates the owner account, the setting rows, categories, a realistic set of
 * dishes and products, pickup slots and today's menus. Everything it writes is
 * ordinary content the owner can edit or delete from /admin; nothing here is
 * required for the app to run.
 *
 * Safe to re-run: it upserts by natural key rather than wiping tables.
 */

import { CategoryType, MenuSlot, PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

import { SETTING_DEFINITIONS } from "../src/server/settings/definitions";

const prisma = new PrismaClient();

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL || "owner@vkitchen.local";
  const password = process.env.SEED_OWNER_PASSWORD || "ChangeMe@123";
  const name = process.env.SEED_OWNER_NAME || "V-Kitchen Owner";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`  owner account already exists (${email}) — password unchanged`);
    return { email, created: false };
  }

  await prisma.user.create({
    data: {
      email,
      name,
      passwordHash: await bcrypt.hash(password, 12),
      role: Role.OWNER,
      isActive: true,
    },
  });

  return { email, password, created: true };
}

async function seedSettings() {
  let written = 0;
  for (const definition of SETTING_DEFINITIONS) {
    const existing = await prisma.siteSetting.findUnique({ where: { key: definition.key } });
    if (existing) continue;

    await prisma.siteSetting.create({
      data: {
        key: definition.key,
        value: definition.defaultValue as never,
        group: definition.group,
        label: definition.label,
      },
    });
    written += 1;
  }
  return written;
}

const MENU_CATEGORIES = [
  { name: "Breakfast", tintColor: "var(--tint-cream)", icon: "sunrise", description: "Fresh starts, cooked every morning." },
  { name: "Thali & Mains", tintColor: "var(--tint-green)", icon: "utensils", description: "Full plates, generous portions." },
  { name: "Snacks & Chaat", tintColor: "var(--tint-peach)", icon: "cookie", description: "Evening favourites, crisp and hot." },
  { name: "Breads & Rice", tintColor: "var(--tint-sage)", icon: "wheat", description: "Made to order, never reheated." },
  { name: "Sweets", tintColor: "var(--tint-cream)", icon: "candy", description: "Traditional mithai, made in small batches." },
];

const PRODUCT_CATEGORIES = [
  { name: "Laddus", tintColor: "var(--tint-cream)", icon: "circle-dot", description: "Hand-rolled, pure ghee, no preservatives." },
  { name: "Namkeen", tintColor: "var(--tint-peach)", icon: "flame", description: "Crisp, spiced and freshly fried." },
  { name: "Festival Boxes", tintColor: "var(--tint-green)", icon: "gift", description: "Gift-ready assortments for every occasion." },
];

async function seedCategories() {
  const created: Record<string, string> = {};

  for (const [index, category] of MENU_CATEGORIES.entries()) {
    const record = await prisma.category.upsert({
      where: { slug: slugify(category.name) },
      create: {
        ...category,
        slug: slugify(category.name),
        type: CategoryType.MENU,
        sortOrder: index,
        isFeatured: index < 3,
      },
      update: {},
    });
    created[category.name] = record.id;
  }

  for (const [index, category] of PRODUCT_CATEGORIES.entries()) {
    const record = await prisma.category.upsert({
      where: { slug: slugify(category.name) },
      create: {
        ...category,
        slug: slugify(category.name),
        type: CategoryType.PRODUCT,
        sortOrder: index,
        isFeatured: true,
      },
      update: {},
    });
    created[category.name] = record.id;
  }

  return created;
}

const MENU_ITEMS: Array<{
  name: string;
  category: string;
  description: string;
  price: number;
  discountPrice?: number;
  unitLabel?: string;
  prepTimeMins?: number;
  isFeatured?: boolean;
  isSpecial?: boolean;
  tags?: string[];
}> = [
  // Breakfast
  { name: "Poha", category: "Breakfast", description: "Flattened rice with peanuts, curry leaves and a squeeze of lime.", price: 40, unitLabel: "per plate", prepTimeMins: 10, isFeatured: true, tags: ["light", "quick"] },
  { name: "Aloo Paratha", category: "Breakfast", description: "Stuffed with spiced potato, served with butter and curd.", price: 60, unitLabel: "2 pieces", prepTimeMins: 15, isFeatured: true, tags: ["filling"] },
  { name: "Idli Sambar", category: "Breakfast", description: "Steamed rice cakes with hot sambar and coconut chutney.", price: 50, unitLabel: "4 pieces", prepTimeMins: 12, tags: ["south-indian"] },
  { name: "Masala Upma", category: "Breakfast", description: "Semolina with vegetables, tempered with mustard and curry leaves.", price: 45, prepTimeMins: 12 },
  { name: "Masala Chai", category: "Breakfast", description: "Strong, sweet and properly spiced.", price: 15, unitLabel: "per cup", prepTimeMins: 5 },

  // Thali & Mains
  { name: "Deluxe Veg Thali", category: "Thali & Mains", description: "Two vegetables, dal, rice, four rotis, salad, papad and a sweet.", price: 180, discountPrice: 160, unitLabel: "full plate", prepTimeMins: 25, isFeatured: true, tags: ["bestseller", "value"] },
  { name: "Rajma Chawal", category: "Thali & Mains", description: "Slow-cooked kidney beans with steamed basmati rice.", price: 120, prepTimeMins: 20, isFeatured: true },
  { name: "Chole Bhature", category: "Thali & Mains", description: "Spiced chickpeas with two fluffy bhature and pickled onion.", price: 130, prepTimeMins: 20, tags: ["bestseller"] },
  { name: "Paneer Butter Masala", category: "Thali & Mains", description: "Cottage cheese in a rich tomato and cashew gravy.", price: 210, prepTimeMins: 25 },
  { name: "Dal Tadka", category: "Thali & Mains", description: "Yellow lentils finished with a ghee and garlic tempering.", price: 110, prepTimeMins: 18 },
  { name: "Veg Biryani", category: "Thali & Mains", description: "Layered basmati with seasonal vegetables and raita.", price: 160, prepTimeMins: 30 },

  // Snacks & Chaat
  { name: "Samosa", category: "Snacks & Chaat", description: "Crisp pastry with spiced potato and peas.", price: 20, unitLabel: "per piece", prepTimeMins: 8, isFeatured: true },
  { name: "Pav Bhaji", category: "Snacks & Chaat", description: "Buttery mashed vegetables with toasted pav.", price: 90, prepTimeMins: 15, tags: ["bestseller"] },
  { name: "Dahi Puri", category: "Snacks & Chaat", description: "Crisp puris with curd, chutneys and sev.", price: 70, prepTimeMins: 10 },
  { name: "Vada Pav", category: "Snacks & Chaat", description: "Spiced potato fritter in a soft bun with dry garlic chutney.", price: 30, prepTimeMins: 8 },

  // Breads & Rice
  { name: "Tandoori Roti", category: "Breads & Rice", description: "Fresh from the tandoor.", price: 12, unitLabel: "per piece", prepTimeMins: 5 },
  { name: "Butter Naan", category: "Breads & Rice", description: "Soft, layered and brushed with butter.", price: 35, unitLabel: "per piece", prepTimeMins: 8 },
  { name: "Jeera Rice", category: "Breads & Rice", description: "Basmati tempered with cumin.", price: 90, prepTimeMins: 12 },

  // Sweets
  { name: "Gulab Jamun", category: "Sweets", description: "Warm, soaked in cardamom syrup.", price: 40, unitLabel: "2 pieces", prepTimeMins: 5, isFeatured: true },
  { name: "Rasmalai", category: "Sweets", description: "Soft paneer discs in saffron milk.", price: 60, unitLabel: "2 pieces", prepTimeMins: 5 },
  { name: "Shahi Tukda", category: "Sweets", description: "Fried bread in reduced milk, topped with pistachio.", price: 80, prepTimeMins: 10, isSpecial: true },
];

async function seedMenuItems(categories: Record<string, string>) {
  const byName: Record<string, string> = {};

  for (const [index, item] of MENU_ITEMS.entries()) {
    const record = await prisma.menuItem.upsert({
      where: { slug: slugify(item.name) },
      create: {
        name: item.name,
        slug: slugify(item.name),
        description: item.description,
        categoryId: categories[item.category],
        price: item.price,
        discountPrice: item.discountPrice ?? null,
        unitLabel: item.unitLabel ?? null,
        prepTimeMins: item.prepTimeMins ?? 20,
        isVeg: true,
        isFeatured: item.isFeatured ?? false,
        isSpecial: item.isSpecial ?? false,
        tags: item.tags ?? [],
        sortOrder: index,
      },
      update: {},
    });
    byName[item.name] = record.id;
  }

  return byName;
}

const PRODUCTS: Array<{
  name: string;
  category: string;
  description: string;
  longDescription: string;
  price: number;
  discountPrice?: number;
  weightLabel: string;
  weightGrams: number;
  isFeatured?: boolean;
  tags?: string[];
  variants?: Array<{ label: string; weightGrams: number; price: number }>;
}> = [
  {
    name: "Besan Laddu",
    category: "Laddus",
    description: "Roasted gram flour, pure ghee and cardamom.",
    longDescription:
      "Slow-roasted gram flour in pure ghee until it turns nutty and golden, then bound with powdered sugar and cardamom. No preservatives — best within ten days.",
    price: 450,
    weightLabel: "500 g",
    weightGrams: 500,
    isFeatured: true,
    tags: ["bestseller", "pure ghee"],
    variants: [
      { label: "250 g", weightGrams: 250, price: 240 },
      { label: "500 g", weightGrams: 500, price: 450 },
      { label: "1 kg", weightGrams: 1000, price: 860 },
    ],
  },
  {
    name: "Motichoor Laddu",
    category: "Laddus",
    description: "Fine boondi pearls soaked in saffron syrup.",
    longDescription:
      "Tiny boondi pearls fried in ghee, soaked in a light saffron syrup and pressed by hand while still warm. A festival staple.",
    price: 520,
    discountPrice: 470,
    weightLabel: "500 g",
    weightGrams: 500,
    isFeatured: true,
    tags: ["festival", "saffron"],
    variants: [
      { label: "250 g", weightGrams: 250, price: 270 },
      { label: "500 g", weightGrams: 500, price: 520 },
      { label: "1 kg", weightGrams: 1000, price: 990 },
    ],
  },
  {
    name: "Dry Fruit Laddu",
    category: "Laddus",
    description: "Dates, almonds, cashews and walnuts. No added sugar.",
    longDescription:
      "Bound with dates rather than sugar syrup, packed with almonds, cashews, walnuts and a little edible gum. The one we make for people who want something wholesome.",
    price: 720,
    weightLabel: "500 g",
    weightGrams: 500,
    tags: ["no added sugar", "premium"],
  },
  {
    name: "Boondi Laddu",
    category: "Laddus",
    description: "Classic temple-style, with a hint of clove.",
    longDescription: "Coarser boondi than motichoor, with raisins, cashews and a whisper of clove.",
    price: 420,
    weightLabel: "500 g",
    weightGrams: 500,
  },
  {
    name: "Bikaneri Bhujia",
    category: "Namkeen",
    description: "Fine, crisp and properly spiced.",
    longDescription: "Moth bean and gram flour bhujia, fried fresh and spiced the traditional way.",
    price: 180,
    weightLabel: "400 g",
    weightGrams: 400,
    isFeatured: true,
    tags: ["bestseller", "spicy"],
    variants: [
      { label: "200 g", weightGrams: 200, price: 95 },
      { label: "400 g", weightGrams: 400, price: 180 },
      { label: "1 kg", weightGrams: 1000, price: 420 },
    ],
  },
  {
    name: "Ratlami Sev",
    category: "Namkeen",
    description: "Clove and pepper sev with a proper kick.",
    longDescription: "Thick sev seasoned with clove, black pepper and ajwain. Excellent with chai.",
    price: 170,
    weightLabel: "400 g",
    weightGrams: 400,
    tags: ["spicy"],
  },
  {
    name: "Navratan Mixture",
    category: "Namkeen",
    description: "Nine-ingredient mix with peanuts, sev and raisins.",
    longDescription:
      "Our house mixture: sev, boondi, peanuts, cashews, raisins, corn flakes, curry leaves and two kinds of dal.",
    price: 200,
    discountPrice: 175,
    weightLabel: "400 g",
    weightGrams: 400,
    isFeatured: true,
    tags: ["bestseller"],
  },
  {
    name: "Methi Mathri",
    category: "Namkeen",
    description: "Flaky, savoury biscuits with fenugreek.",
    longDescription: "Layered and crisp, with kasuri methi and ajwain. Keeps for weeks in a tin.",
    price: 160,
    weightLabel: "400 g",
    weightGrams: 400,
  },
  {
    name: "Poha Chivda",
    category: "Namkeen",
    description: "Light roasted chivda with peanuts and curry leaves.",
    longDescription: "Roasted rather than deep-fried, so it stays light. Mildly spiced.",
    price: 150,
    weightLabel: "400 g",
    weightGrams: 400,
  },
  {
    name: "Festival Gift Box",
    category: "Festival Boxes",
    description: "Assorted laddus and namkeen in a gift box.",
    longDescription:
      "A ready-to-gift box with 250 g each of besan laddu, motichoor laddu, bhujia and mixture. Ribbon and card included.",
    price: 1150,
    discountPrice: 999,
    weightLabel: "1 kg assorted",
    weightGrams: 1000,
    isFeatured: true,
    tags: ["gifting", "festival"],
  },
];

async function seedProducts(categories: Record<string, string>) {
  for (const [index, product] of PRODUCTS.entries()) {
    const existing = await prisma.product.findUnique({ where: { slug: slugify(product.name) } });
    if (existing) continue;

    await prisma.product.create({
      data: {
        name: product.name,
        slug: slugify(product.name),
        description: product.description,
        longDescription: product.longDescription,
        categoryId: categories[product.category],
        price: product.price,
        discountPrice: product.discountPrice ?? null,
        weightLabel: product.weightLabel,
        weightGrams: product.weightGrams,
        trackStock: false,
        stockQty: 50,
        isFeatured: product.isFeatured ?? false,
        tags: product.tags ?? [],
        sortOrder: index,
        variants: product.variants
          ? {
              create: product.variants.map((variant, variantIndex) => ({
                label: variant.label,
                weightGrams: variant.weightGrams,
                price: variant.price,
                stockQty: 50,
                sortOrder: variantIndex,
              })),
            }
          : undefined,
      },
    });
  }
}

async function seedPickupSlots() {
  const slots = [
    { label: "Morning · 8:00 – 10:00", startTime: "08:00", endTime: "10:00", maxOrders: 20 },
    { label: "Late morning · 10:00 – 12:00", startTime: "10:00", endTime: "12:00", maxOrders: 20 },
    { label: "Lunch · 12:00 – 14:30", startTime: "12:00", endTime: "14:30", maxOrders: 30 },
    { label: "Evening · 17:00 – 19:00", startTime: "17:00", endTime: "19:00", maxOrders: 25 },
    { label: "Dinner · 19:00 – 21:00", startTime: "19:00", endTime: "21:00", maxOrders: 25 },
  ];

  if ((await prisma.pickupSlot.count()) > 0) return;

  await prisma.pickupSlot.createMany({
    data: slots.map((slot, index) => ({ ...slot, sortOrder: index })),
  });
}

async function seedMenus(items: Record<string, string>) {
  const definitions: Array<{
    title: string;
    subtitle: string;
    slot: MenuSlot;
    cutoff?: string;
    dayOfWeek?: number;
    items: string[];
  }> = [
    {
      title: "Morning Menu",
      subtitle: "Served fresh from 8 AM",
      slot: MenuSlot.MORNING,
      cutoff: "10:30",
      items: ["Poha", "Aloo Paratha", "Idli Sambar", "Masala Upma", "Masala Chai"],
    },
    {
      title: "Afternoon Menu",
      subtitle: "Full plates, cooked to order",
      slot: MenuSlot.AFTERNOON,
      cutoff: "14:00",
      items: ["Deluxe Veg Thali", "Rajma Chawal", "Chole Bhature", "Dal Tadka", "Jeera Rice", "Tandoori Roti"],
    },
    {
      title: "Evening Menu",
      subtitle: "Snacks and dinner from 5 PM",
      slot: MenuSlot.EVENING,
      cutoff: "20:30",
      items: ["Samosa", "Pav Bhaji", "Dahi Puri", "Vada Pav", "Paneer Butter Masala", "Butter Naan"],
    },
    {
      title: "Today's Special",
      subtitle: "Made in small batches",
      slot: MenuSlot.SPECIAL,
      items: ["Shahi Tukda", "Veg Biryani"],
    },
    {
      title: "Sunday Special",
      subtitle: "Our weekend feast",
      slot: MenuSlot.SUNDAY_SPECIAL,
      dayOfWeek: 0,
      items: ["Veg Biryani", "Paneer Butter Masala", "Chole Bhature", "Rasmalai", "Gulab Jamun"],
    },
  ];

  for (const [index, definition] of definitions.entries()) {
    const existing = await prisma.menu.findFirst({
      where: { title: definition.title, slot: definition.slot },
    });
    if (existing) continue;

    await prisma.menu.create({
      data: {
        title: definition.title,
        subtitle: definition.subtitle,
        slot: definition.slot,
        dayOfWeek: definition.dayOfWeek ?? null,
        orderCutoffTime: definition.cutoff ?? null,
        isActive: true,
        sortOrder: index,
        entries: {
          create: definition.items
            .map((name, itemIndex) => ({ id: items[name], itemIndex }))
            .filter((entry): entry is { id: string; itemIndex: number } => Boolean(entry.id))
            .map((entry) => ({ menuItemId: entry.id, sortOrder: entry.itemIndex })),
        },
      },
    });
  }
}

async function seedReviews() {
  if ((await prisma.review.count()) > 0) return;

  await prisma.review.createMany({
    data: [
      {
        authorName: "Ananya S.",
        rating: 5,
        comment: "The thali is genuinely home-style and the portions are generous. My go-to lunch now.",
        status: "APPROVED",
        isFeatured: true,
        sortOrder: 0,
      },
      {
        authorName: "Rahul M.",
        rating: 5,
        comment: "Ordered laddus for Diwali and everyone asked where they were from. Fresh and not too sweet.",
        status: "APPROVED",
        isFeatured: true,
        sortOrder: 1,
      },
      {
        authorName: "Priya K.",
        rating: 5,
        comment: "Pickup is quick, food is always ready on time, and the bhujia is the best I've had.",
        status: "APPROVED",
        isFeatured: true,
        sortOrder: 2,
      },
    ],
  });
}

async function main() {
  console.log("\nSeeding V-Kitchen…\n");

  const owner = await seedOwner();
  console.log("  ✓ owner account");

  const settingsWritten = await seedSettings();
  console.log(`  ✓ site settings (${settingsWritten} new)`);

  const categories = await seedCategories();
  console.log(`  ✓ categories (${Object.keys(categories).length})`);

  const items = await seedMenuItems(categories);
  console.log(`  ✓ menu items (${Object.keys(items).length})`);

  await seedProducts(categories);
  console.log(`  ✓ products (${PRODUCTS.length})`);

  await seedPickupSlots();
  console.log("  ✓ pickup slots");

  await seedMenus(items);
  console.log("  ✓ menus");

  await seedReviews();
  console.log("  ✓ reviews");

  console.log("\n" + "─".repeat(58));
  if (owner.created) {
    console.log("  Admin dashboard: http://localhost:3000/admin");
    console.log(`  Email:    ${owner.email}`);
    console.log(`  Password: ${owner.password}`);
    console.log("\n  ⚠  Change this password after your first login.");
  } else {
    console.log(`  Admin dashboard: http://localhost:3000/admin  (${owner.email})`);
  }
  console.log("─".repeat(58) + "\n");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
