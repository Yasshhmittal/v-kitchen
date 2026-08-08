import { z } from "zod";
import {
  CategoryType,
  DiscountType,
  MenuSlot,
  Occasion,
  OrderStatus,
  RequestStatus,
  ReviewStatus,
  Role,
} from "@prisma/client";

/**
 * Every value entering the system is parsed here. Route handlers validate
 * request bodies with these schemas and the same schemas drive the admin forms
 * via `zodResolver`, so a rule is written once and enforced on both sides.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const idSchema = z.string().min(1, "Required");

export const slugSchema = z
  .string()
  .min(1, "Required")
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes only");

/** Accepts "1250", "1250.50" or a number; rejects negatives. */
export const moneySchema = z.coerce
  .number({ invalid_type_error: "Enter a valid amount" })
  .min(0, "Cannot be negative")
  .max(9_999_999, "That amount is too large")
  .refine((n) => Number.isFinite(n), "Enter a valid amount");

export const optionalMoneySchema = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? undefined : v),
  moneySchema.optional(),
);

export const phoneSchema = z
  .string()
  .min(7, "Enter a valid phone number")
  .max(20, "Enter a valid phone number")
  .regex(/^[+]?[\d\s()-]{7,20}$/, "Enter a valid phone number");

export const emailSchema = z.string().email("Enter a valid email address").max(160);

export const optionalEmailSchema = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  emailSchema.optional(),
);

/** "HH:mm" 24-hour time. */
export const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 10:30");

export const optionalTimeSchema = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  timeSchema.optional(),
);

/** Accepts a Date or an ISO/`yyyy-MM-dd` string. */
export const dateSchema = z.coerce.date({ invalid_type_error: "Choose a valid date" });

export const optionalDateSchema = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  dateSchema.optional(),
);

export const optionalText = (max = 2000) =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? undefined : v),
    z.string().max(max).optional(),
  );

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().max(120).optional(),
  sort: z.string().max(60).optional(),
  order: z.enum(["asc", "desc"]).default("desc"),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const adminLoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password").max(200),
});

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(200)
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/\d/, "Include a number");

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

/** Step one of sign-in: prove you can receive a message at this number. */
export const otpRequestSchema = z.object({
  phone: phoneSchema,
});

export const otpVerifySchema = z.object({
  phone: phoneSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const customerProfileSchema = z.object({
  name: z.string().min(2, "Enter your name").max(80),
  email: optionalEmailSchema,
  addressNote: optionalText(300),
});

// ---------------------------------------------------------------------------
// Staff users
// ---------------------------------------------------------------------------

export const userCreateSchema = z.object({
  name: z.string().min(2, "Enter a name").max(80),
  email: emailSchema,
  phone: z.preprocess((v) => (v === "" ? undefined : v), phoneSchema.optional()),
  password: passwordSchema,
  role: z.nativeEnum(Role),
  isActive: z.boolean().default(true),
});

export const userUpdateSchema = userCreateSchema
  .partial()
  .omit({ password: true })
  .extend({
    password: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      passwordSchema.optional(),
    ),
  });

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  name: z.string().min(1, "Enter a name").max(80),
  slug: slugSchema.optional(),
  description: optionalText(500),
  image: optionalText(500),
  tintColor: optionalText(40),
  icon: optionalText(40),
  type: z.nativeEnum(CategoryType).default(CategoryType.MENU),
  sortOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
});

export const categoryUpdateSchema = categorySchema.partial();

// ---------------------------------------------------------------------------
// Menu items and menus
// ---------------------------------------------------------------------------

export const menuItemSchema = z
  .object({
    name: z.string().min(1, "Enter a name").max(120),
    slug: slugSchema.optional(),
    description: optionalText(1000),
    image: optionalText(500),
    categoryId: z.preprocess((v) => (v === "" || v === "none" ? undefined : v), idSchema.optional()),
    price: moneySchema,
    discountPrice: optionalMoneySchema,
    unitLabel: optionalText(40),
    isAvailable: z.boolean().default(true),
    prepTimeMins: z.coerce.number().int().min(0).max(1440).default(20),
    isVeg: z.boolean().default(true),
    isSpecial: z.boolean().default(false),
    isFeatured: z.boolean().default(false),
    tags: z.array(z.string().max(30)).max(12).default([]),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine((d) => d.discountPrice === undefined || d.discountPrice < d.price, {
    message: "Offer price must be lower than the regular price",
    path: ["discountPrice"],
  });

export const menuItemUpdateSchema = menuItemSchema.innerType().partial();

export const menuEntrySchema = z.object({
  menuItemId: idSchema,
  priceOverride: optionalMoneySchema,
  isAvailable: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const menuSchema = z.object({
  title: z.string().min(1, "Enter a title").max(120),
  subtitle: optionalText(200),
  slot: z.nativeEnum(MenuSlot),
  /** Null/absent means the menu recurs rather than being tied to one day. */
  date: optionalDateSchema,
  dayOfWeek: z.preprocess(
    (v) => (v === "" || v === null || v === "any" ? undefined : v),
    z.coerce.number().int().min(0).max(6).optional(),
  ),
  bannerImage: optionalText(500),
  orderCutoffTime: optionalTimeSchema,
  publishAt: optionalDateSchema,
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  entries: z.array(menuEntrySchema).default([]),
});

export const menuUpdateSchema = menuSchema.partial();

export const menuDuplicateSchema = z.object({
  sourceMenuId: idSchema,
  title: z.string().min(1).max(120).optional(),
  date: optionalDateSchema,
  slot: z.nativeEnum(MenuSlot).optional(),
});

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export const productVariantSchema = z.object({
  id: idSchema.optional(),
  label: z.string().min(1, "Enter a label").max(60),
  weightGrams: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(0).optional(),
  ),
  price: moneySchema,
  discountPrice: optionalMoneySchema,
  stockQty: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
});

export const productSchema = z
  .object({
    name: z.string().min(1, "Enter a name").max(120),
    slug: slugSchema.optional(),
    description: optionalText(500),
    longDescription: optionalText(4000),
    images: z.array(z.string().max(500)).max(8).default([]),
    categoryId: z.preprocess((v) => (v === "" || v === "none" ? undefined : v), idSchema.optional()),
    price: moneySchema,
    discountPrice: optionalMoneySchema,
    weightLabel: optionalText(40),
    weightGrams: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int().min(0).optional(),
    ),
    trackStock: z.boolean().default(false),
    stockQty: z.coerce.number().int().min(0).default(0),
    isVeg: z.boolean().default(true),
    isActive: z.boolean().default(true),
    isFeatured: z.boolean().default(false),
    tags: z.array(z.string().max(30)).max(12).default([]),
    sortOrder: z.coerce.number().int().min(0).default(0),
    variants: z.array(productVariantSchema).max(10).default([]),
  })
  .refine((d) => d.discountPrice === undefined || d.discountPrice < d.price, {
    message: "Offer price must be lower than the regular price",
    path: ["discountPrice"],
  });

export const productUpdateSchema = productSchema.innerType().partial();

// ---------------------------------------------------------------------------
// Pickup slots
// ---------------------------------------------------------------------------

export const pickupSlotSchema = z
  .object({
    label: z.string().min(1, "Enter a label").max(60),
    startTime: timeSchema,
    endTime: timeSchema,
    maxOrders: z.coerce.number().int().min(0).default(0),
    isActive: z.boolean().default(true),
    sortOrder: z.coerce.number().int().min(0).default(0),
  })
  .refine((d) => d.startTime < d.endTime, {
    message: "End time must be after the start time",
    path: ["endTime"],
  });

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

/**
 * The client sends only identifiers and quantities. Prices are looked up
 * server-side — a cart total posted by the browser is never trusted.
 */
export const orderLineSchema = z
  .object({
    kind: z.enum(["MENU_ITEM", "PRODUCT"]),
    itemId: idSchema,
    variantId: idSchema.optional(),
    quantity: z.coerce.number().int().min(1, "Quantity must be at least 1").max(99),
  })
  .refine((d) => d.kind === "PRODUCT" || !d.variantId, {
    message: "Only products can have a variant",
    path: ["variantId"],
  });

export const orderCreateSchema = z.object({
  items: z.array(orderLineSchema).min(1, "Add at least one item to your order"),
  contactName: z.string().min(2, "Enter your name").max(80),
  contactPhone: phoneSchema,
  contactEmail: optionalEmailSchema,
  pickupDate: dateSchema,
  pickupSlotId: z.preprocess((v) => (v === "" || v === "none" ? undefined : v), idSchema.optional()),
  pickupTime: optionalTimeSchema,
  notes: optionalText(500),
  couponCode: optionalText(40),
});

export const orderStatusUpdateSchema = z.object({
  status: z.nativeEnum(OrderStatus),
  cancelReason: optionalText(300),
  adminNotes: optionalText(1000),
});

export const orderLookupSchema = z.object({
  orderNo: z.string().min(3, "Enter your order number").max(40),
  phone: phoneSchema,
});

// ---------------------------------------------------------------------------
// Enquiries
// ---------------------------------------------------------------------------

export const bulkOrderSchema = z.object({
  name: z.string().min(2, "Enter your name").max(80),
  phone: phoneSchema,
  email: optionalEmailSchema,
  occasion: z.nativeEnum(Occasion).default(Occasion.OTHER),
  occasionOther: optionalText(80),
  peopleCount: z.preprocess(
    (v) => (v === "" || v === null ? undefined : v),
    z.coerce.number().int().min(1).max(100000).optional(),
  ),
  requirements: z.string().min(10, "Tell us a little more about what you need").max(3000),
  preferredDate: optionalDateSchema,
  budget: optionalMoneySchema,
  instructions: optionalText(2000),
});

export const customOrderSchema = z.object({
  name: z.string().min(2, "Enter your name").max(80),
  phone: phoneSchema,
  email: optionalEmailSchema,
  itemName: z.string().min(2, "What would you like us to make?").max(120),
  description: z.string().min(10, "Describe what you'd like in a bit more detail").max(3000),
  ingredients: optionalText(1500),
  quantity: optionalText(120),
  preferredDate: optionalDateSchema,
  preferredTime: optionalTimeSchema,
  budget: optionalMoneySchema,
  referenceImage: optionalText(500),
});

export const requestStatusUpdateSchema = z.object({
  status: z.nativeEnum(RequestStatus),
  quotedAmount: optionalMoneySchema,
  adminNotes: optionalText(2000),
});

// ---------------------------------------------------------------------------
// Reviews and coupons
// ---------------------------------------------------------------------------

export const reviewSchema = z.object({
  authorName: z.string().min(2, "Enter your name").max(80),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: z.string().min(5, "Tell us a bit more").max(1000),
  image: optionalText(500),
});

export const reviewModerationSchema = z.object({
  status: z.nativeEnum(ReviewStatus),
  isFeatured: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .min(3, "At least 3 characters")
      .max(24)
      .regex(/^[A-Z0-9_-]+$/, "Use capital letters, numbers, dashes and underscores"),
    description: optionalText(200),
    discountType: z.nativeEnum(DiscountType).default(DiscountType.PERCENT),
    value: moneySchema,
    minOrder: optionalMoneySchema,
    maxDiscount: optionalMoneySchema,
    usageLimit: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int().min(1).optional(),
    ),
    perCustomerLimit: z.preprocess(
      (v) => (v === "" || v === null ? undefined : v),
      z.coerce.number().int().min(1).optional(),
    ),
    startsAt: optionalDateSchema,
    expiresAt: optionalDateSchema,
    isActive: z.boolean().default(true),
  })
  .refine((d) => d.discountType !== DiscountType.PERCENT || d.value <= 100, {
    message: "A percentage discount cannot exceed 100",
    path: ["value"],
  })
  .refine((d) => !d.startsAt || !d.expiresAt || d.startsAt < d.expiresAt, {
    message: "The end date must be after the start date",
    path: ["expiresAt"],
  });

// ---------------------------------------------------------------------------
// Settings and media
// ---------------------------------------------------------------------------

export const settingsUpdateSchema = z.object({
  values: z.record(z.string(), z.unknown()),
});

export const mediaUpdateSchema = z.object({
  alt: optionalText(200),
  folder: z.string().min(1).max(60).optional(),
});

export const reorderSchema = z.object({
  ids: z.array(idSchema).min(1),
});

// ---------------------------------------------------------------------------
// Inferred types — import these instead of redeclaring shapes.
// ---------------------------------------------------------------------------

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;
export type CustomerProfileInput = z.infer<typeof customerProfileSchema>;
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type MenuItemInput = z.infer<typeof menuItemSchema>;
export type MenuInput = z.infer<typeof menuSchema>;
export type ProductInput = z.infer<typeof productSchema>;
export type OrderCreateInput = z.infer<typeof orderCreateSchema>;
export type BulkOrderInput = z.infer<typeof bulkOrderSchema>;
export type CustomOrderInput = z.infer<typeof customOrderSchema>;
export type RequestStatusUpdateInput = z.infer<typeof requestStatusUpdateSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type PickupSlotInput = z.infer<typeof pickupSlotSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
