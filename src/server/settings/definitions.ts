/**
 * The registry of every site-wide setting the owner can edit at
 * /admin/settings.
 *
 * This file defines the *shape* of a setting (its key, group, label, editor
 * type and factory default) — never a live value. Values live in the
 * `site_settings` table; the defaults here are only used to seed a fresh
 * install and to fall back if a row is missing.
 *
 * Adding a new editable field to the site = adding one entry here. The
 * settings screen renders itself from this registry.
 */

export type SettingEditor =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "image"
  | "color"
  | "url"
  | "email"
  | "phone"
  | "time"
  | "json"
  | "openingHours"
  | "imageList"
  | "linkList";

export interface SettingDefinition {
  key: string;
  group: SettingGroup;
  label: string;
  help?: string;
  editor: SettingEditor;
  defaultValue: unknown;
}

export const SETTING_GROUPS = [
  { id: "brand", label: "Brand", description: "Name, logo and identity" },
  { id: "contact", label: "Contact & Pickup", description: "How customers reach and find you" },
  { id: "hours", label: "Opening Hours", description: "When you are open and taking orders" },
  { id: "navigation", label: "Navigation", description: "Links in the top menu bar" },
  { id: "home", label: "Home Page", description: "Hero, banners and section headings" },
  { id: "ordering", label: "Ordering Rules", description: "Cut-offs, lead time and limits" },
  { id: "social", label: "Social Links", description: "Your profiles" },
  { id: "seo", label: "SEO", description: "Search and share previews" },
  { id: "footer", label: "Footer", description: "Footer copy and newsletter" },
  {
    id: "pages",
    label: "Page Content",
    description: "About, contact, enquiry and legal page copy",
  },
] as const;

export type SettingGroup = (typeof SETTING_GROUPS)[number]["id"];

export const SETTING_DEFINITIONS: SettingDefinition[] = [
  // ---- Brand -------------------------------------------------------------
  {
    key: "site.name",
    group: "brand",
    label: "Website name",
    editor: "text",
    defaultValue: "V-Kitchen",
  },
  {
    key: "site.tagline",
    group: "brand",
    label: "Tagline",
    help: "Short line shown under the logo in the footer.",
    editor: "text",
    defaultValue: "Real home food. Made fresh daily.",
  },
  {
    key: "site.logo",
    group: "brand",
    label: "Logo",
    help: "Transparent PNG or SVG works best. Leave empty to show the name as text.",
    editor: "image",
    defaultValue: "",
  },
  {
    key: "site.favicon",
    group: "brand",
    label: "Favicon",
    editor: "image",
    defaultValue: "",
  },
  {
    key: "site.currency",
    group: "brand",
    label: "Currency code",
    help: "ISO code, e.g. INR, USD, GBP.",
    editor: "text",
    defaultValue: "INR",
  },
  {
    key: "site.locale",
    group: "brand",
    label: "Locale",
    help: "Controls number and date formatting, e.g. en-IN.",
    editor: "text",
    defaultValue: "en-IN",
  },

  // ---- Contact & pickup --------------------------------------------------
  {
    key: "contact.phone",
    group: "contact",
    label: "Phone number",
    editor: "phone",
    defaultValue: "+91 98765 43210",
  },
  {
    key: "contact.whatsapp",
    group: "contact",
    label: "WhatsApp number",
    help: "Digits with country code, no spaces — used for order notifications.",
    editor: "phone",
    defaultValue: "919876543210",
  },
  {
    key: "contact.email",
    group: "contact",
    label: "Email address",
    editor: "email",
    defaultValue: "hello@vkitchen.local",
  },
  {
    key: "contact.address",
    group: "contact",
    label: "Pickup address",
    editor: "textarea",
    defaultValue: "12 Market Road, Near Central Park, Your City 000000",
  },
  {
    key: "contact.mapsEmbedUrl",
    group: "contact",
    label: "Google Maps embed URL",
    help: "Google Maps → Share → Embed a map → copy the src URL.",
    editor: "url",
    defaultValue: "",
  },
  {
    key: "contact.mapsLink",
    group: "contact",
    label: "Google Maps directions link",
    editor: "url",
    defaultValue: "",
  },
  {
    key: "contact.pickupNote",
    group: "contact",
    label: "Pickup instructions",
    help: "Shown at checkout and on the order confirmation.",
    editor: "textarea",
    defaultValue:
      "Please collect your order from the counter and show your order number. Pickup only — we do not deliver.",
  },

  // ---- Hours -------------------------------------------------------------
  {
    key: "hours.weekly",
    group: "hours",
    label: "Opening hours",
    editor: "openingHours",
    defaultValue: [
      { day: "Monday", open: "08:00", close: "21:00", closed: false },
      { day: "Tuesday", open: "08:00", close: "21:00", closed: false },
      { day: "Wednesday", open: "08:00", close: "21:00", closed: false },
      { day: "Thursday", open: "08:00", close: "21:00", closed: false },
      { day: "Friday", open: "08:00", close: "21:00", closed: false },
      { day: "Saturday", open: "08:00", close: "22:00", closed: false },
      { day: "Sunday", open: "09:00", close: "22:00", closed: false },
    ],
  },
  {
    key: "hours.note",
    group: "hours",
    label: "Hours note",
    editor: "text",
    defaultValue: "Closed on public holidays. Follow us for updates.",
  },

  // ---- Navigation --------------------------------------------------------
  {
    key: "nav.links",
    group: "navigation",
    label: "Top navigation links",
    help: "Shown in the header, in this order.",
    editor: "json",
    defaultValue: [
      { label: "Home", href: "/" },
      { label: "Menu", href: "/menu" },
      { label: "Specials", href: "/specials" },
      { label: "Laddus & Namkeen", href: "/products" },
      { label: "Bulk Orders", href: "/bulk-order" },
      { label: "Contact", href: "/contact" },
    ],
  },

  // ---- Home page ---------------------------------------------------------
  {
    key: "home.hero.eyebrow",
    group: "home",
    label: "Hero eyebrow",
    editor: "text",
    defaultValue: "Fresh. Homely. Made to order.",
  },
  {
    key: "home.hero.titleTop",
    group: "home",
    label: "Hero title — line 1",
    editor: "text",
    defaultValue: "Real Home Food.",
  },
  {
    key: "home.hero.titleBottom",
    group: "home",
    label: "Hero title — line 2 (highlighted)",
    editor: "text",
    defaultValue: "Made Fresh.",
  },
  {
    key: "home.hero.subtitle",
    group: "home",
    label: "Hero subtitle",
    editor: "textarea",
    defaultValue:
      "Savour authentic flavours, honest ingredients and recipes cooked fresh every single day. Order online and pick up when it suits you.",
  },
  {
    key: "home.hero.image",
    group: "home",
    label: "Hero image",
    editor: "image",
    defaultValue: "",
  },
  {
    key: "home.hero.primaryCta",
    group: "home",
    label: "Hero primary button",
    editor: "json",
    defaultValue: { label: "Order Online", href: "/menu" },
  },
  {
    key: "home.hero.secondaryCta",
    group: "home",
    label: "Hero secondary button",
    editor: "json",
    defaultValue: { label: "View Menu", href: "/menu" },
  },
  {
    key: "home.hero.highlights",
    group: "home",
    label: "Hero highlights",
    help: "The small icon + label row under the hero buttons.",
    editor: "json",
    defaultValue: [
      { icon: "leaf", title: "Fresh", subtitle: "Ingredients" },
      { icon: "flame", title: "Cooked", subtitle: "To Perfection" },
      { icon: "chef-hat", title: "Homely", subtitle: "Flavours" },
    ],
  },
  {
    key: "home.categories.eyebrow",
    group: "home",
    label: "Categories eyebrow",
    editor: "text",
    defaultValue: "What's your pick?",
  },
  {
    key: "home.categories.title",
    group: "home",
    label: "Categories heading",
    editor: "text",
    defaultValue: "Explore Our Menu",
  },
  {
    key: "home.feature.enabled",
    group: "home",
    label: "Show feature banner",
    editor: "boolean",
    defaultValue: true,
  },
  {
    key: "home.feature.badge",
    group: "home",
    label: "Feature banner badge",
    editor: "text",
    defaultValue: "Limited Time",
  },
  {
    key: "home.feature.title",
    group: "home",
    label: "Feature banner title",
    editor: "text",
    defaultValue: "Today's Special You'll Love",
  },
  {
    key: "home.feature.description",
    group: "home",
    label: "Feature banner text",
    editor: "textarea",
    defaultValue:
      "A dish we make in small batches, with the freshest produce of the day. Once it's gone, it's gone.",
  },
  {
    key: "home.feature.image",
    group: "home",
    label: "Feature banner image",
    editor: "image",
    defaultValue: "",
  },
  {
    key: "home.feature.cta",
    group: "home",
    label: "Feature banner button",
    editor: "json",
    defaultValue: { label: "Order Now", href: "/specials" },
  },
  {
    key: "home.why.eyebrow",
    group: "home",
    label: "Why-choose-us eyebrow",
    editor: "text",
    defaultValue: "Why choose V-Kitchen?",
  },
  {
    key: "home.why.title",
    group: "home",
    label: "Why-choose-us heading",
    editor: "text",
    defaultValue: "Fresh. Fast. Flavourful.",
  },
  {
    key: "home.why.items",
    group: "home",
    label: "Why-choose-us cards",
    editor: "json",
    defaultValue: [
      {
        icon: "leaf",
        title: "Fresh Ingredients",
        text: "We source the freshest produce and use it the same day.",
      },
      {
        icon: "flame",
        title: "Cooked To Order",
        text: "Nothing sits around. Your food is made when you order it.",
      },
      {
        icon: "clock",
        title: "Ready On Time",
        text: "Pick a slot that suits you and collect without waiting.",
      },
      {
        icon: "heart",
        title: "Made With Love",
        text: "Home recipes, honest portions, no shortcuts.",
      },
    ],
  },
  {
    key: "home.reviews.eyebrow",
    group: "home",
    label: "Reviews eyebrow",
    editor: "text",
    defaultValue: "What our customers say",
  },
  {
    key: "home.reviews.title",
    group: "home",
    label: "Reviews heading",
    editor: "text",
    defaultValue: "Loved By Our Regulars",
  },
  {
    key: "home.steps.title",
    group: "home",
    label: "How-it-works heading",
    editor: "text",
    defaultValue: "How Ordering Works",
  },
  {
    key: "home.steps.items",
    group: "home",
    label: "How-it-works steps",
    editor: "json",
    defaultValue: [
      { icon: "utensils", title: "Browse the menu", text: "See what's cooking this morning, afternoon and evening." },
      { icon: "shopping-bag", title: "Place your order", text: "Add items, choose a pickup date and time slot." },
      { icon: "bell", title: "We start cooking", text: "You get a confirmation and we prepare it fresh." },
      { icon: "map-pin", title: "Collect it", text: "Show your order number at the counter and you're done." },
    ],
  },
  {
    key: "home.cta.title",
    group: "home",
    label: "Bottom CTA title",
    editor: "text",
    defaultValue: "Craving something delicious?",
  },
  {
    key: "home.cta.subtitle",
    group: "home",
    label: "Bottom CTA subtitle",
    editor: "text",
    defaultValue: "Order online for pickup — ready when you are.",
  },
  {
    key: "home.cta.button",
    group: "home",
    label: "Bottom CTA button",
    editor: "json",
    defaultValue: { label: "Order Now", href: "/menu" },
  },

  // ---- Ordering rules ----------------------------------------------------
  {
    key: "ordering.enabled",
    group: "ordering",
    label: "Accept online orders",
    help: "Turn off to pause all ordering — the site stays browsable.",
    editor: "boolean",
    defaultValue: true,
  },
  {
    key: "ordering.pausedMessage",
    group: "ordering",
    label: "Message when ordering is paused",
    editor: "textarea",
    defaultValue: "We're not taking online orders right now. Please call us instead.",
  },
  {
    key: "ordering.minLeadMinutes",
    group: "ordering",
    label: "Minimum notice (minutes)",
    help: "Earliest pickup time from the moment an order is placed.",
    editor: "number",
    defaultValue: 45,
  },
  {
    key: "ordering.maxAdvanceDays",
    group: "ordering",
    label: "How far ahead orders can be placed (days)",
    editor: "number",
    defaultValue: 14,
  },
  {
    key: "ordering.minOrderValue",
    group: "ordering",
    label: "Minimum order value",
    help: "Set 0 for no minimum.",
    editor: "number",
    defaultValue: 0,
  },
  {
    key: "ordering.requireLogin",
    group: "ordering",
    label: "Require an account to order",
    help: "Off means guests can order with just a name and phone number.",
    editor: "boolean",
    defaultValue: false,
  },

  // ---- Social ------------------------------------------------------------
  {
    key: "social.links",
    group: "social",
    label: "Social profiles",
    editor: "linkList",
    defaultValue: [
      { platform: "facebook", url: "" },
      { platform: "instagram", url: "" },
      { platform: "youtube", url: "" },
      { platform: "x", url: "" },
    ],
  },

  // ---- SEO ---------------------------------------------------------------
  {
    key: "seo.title",
    group: "seo",
    label: "Default page title",
    editor: "text",
    defaultValue: "V-Kitchen — Fresh home food, ready for pickup",
  },
  {
    key: "seo.description",
    group: "seo",
    label: "Default meta description",
    editor: "textarea",
    defaultValue:
      "Daily home-cooked menus, laddus and namkeens made fresh. Order online and pick up from V-Kitchen.",
  },
  {
    key: "seo.keywords",
    group: "seo",
    label: "Keywords",
    help: "Comma separated.",
    editor: "text",
    defaultValue: "home food, tiffin, laddu, namkeen, takeaway, pickup",
  },
  {
    key: "seo.ogImage",
    group: "seo",
    label: "Social share image",
    help: "1200×630 recommended.",
    editor: "image",
    defaultValue: "",
  },

  // ---- Footer ------------------------------------------------------------
  {
    key: "footer.about",
    group: "footer",
    label: "Footer about text",
    editor: "textarea",
    defaultValue: "Real home food, made fresh daily and ready when you are.",
  },
  {
    key: "footer.newsletterEnabled",
    group: "footer",
    label: "Show newsletter signup",
    editor: "boolean",
    defaultValue: true,
  },
  {
    key: "footer.newsletterTitle",
    group: "footer",
    label: "Newsletter heading",
    editor: "text",
    defaultValue: "Stay Connected",
  },
  {
    key: "footer.newsletterText",
    group: "footer",
    label: "Newsletter text",
    editor: "text",
    defaultValue: "Join our newsletter for exclusive offers and updates.",
  },
  {
    key: "footer.copyright",
    group: "footer",
    label: "Copyright line",
    help: "Use {year} to insert the current year automatically.",
    editor: "text",
    defaultValue: "© {year} V-Kitchen. All rights reserved.",
  },
  {
    key: "footer.quickLinks",
    group: "footer",
    label: "Footer quick links",
    editor: "json",
    defaultValue: [
      { label: "Menu", href: "/menu" },
      { label: "Specials", href: "/specials" },
      { label: "Laddus & Namkeen", href: "/products" },
      { label: "Bulk Orders", href: "/bulk-order" },
      { label: "Custom Orders", href: "/custom-order" },
    ],
  },
  {
    key: "footer.supportLinks",
    group: "footer",
    label: "Footer support links",
    editor: "json",
    defaultValue: [
      { label: "About Us", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Track Order", href: "/track" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },

  // ---- Page content ------------------------------------------------------
  // Long-form copy for the static-looking pages. Stored here rather than in
  // the components so the owner can rewrite any of it from the dashboard.
  {
    key: "pages.about.eyebrow",
    group: "pages",
    label: "About — eyebrow",
    editor: "text",
    defaultValue: "Our story",
  },
  {
    key: "pages.about.title",
    group: "pages",
    label: "About — heading",
    editor: "text",
    defaultValue: "Cooked the way it is at home",
  },
  {
    key: "pages.about.lead",
    group: "pages",
    label: "About — intro",
    editor: "textarea",
    defaultValue:
      "A small kitchen, a short menu that changes through the day, and food made in batches small enough to still taste like someone made it for you.",
  },
  {
    key: "pages.about.image",
    group: "pages",
    label: "About — photo",
    editor: "image",
    defaultValue: "",
  },
  {
    key: "pages.about.body",
    group: "pages",
    label: "About — sections",
    help: "Each block becomes a heading with a paragraph.",
    editor: "json",
    defaultValue: [
      {
        heading: "Made fresh, in small batches",
        text: "Nothing sits overnight. The morning menu is cooked in the morning, the evening menu in the evening, and when a dish runs out for the day, it's gone until tomorrow.",
      },
      {
        heading: "Laddus and namkeens, all year",
        text: "Our sweets and savouries are made in the same kitchen, packed the day they're made, and sold by weight so you can take exactly as much as you need.",
      },
      {
        heading: "Pickup only, and that's on purpose",
        text: "We don't deliver. Food that travels for half an hour is not the food we cooked, so you order online, we tell you when it's ready, and you collect it warm.",
      },
      {
        heading: "Bulk and custom orders welcome",
        text: "Weddings, offices, festivals and family functions — tell us what you need and by when, and we'll come back with a plan and a price.",
      },
    ],
  },
  {
    key: "pages.about.stats",
    group: "pages",
    label: "About — highlight figures",
    editor: "json",
    defaultValue: [
      { value: "3", label: "Fresh menus a day" },
      { value: "100%", label: "Vegetarian kitchen" },
      { value: "0", label: "Preservatives added" },
    ],
  },
  {
    key: "pages.contact.eyebrow",
    group: "pages",
    label: "Contact — eyebrow",
    editor: "text",
    defaultValue: "Say hello",
  },
  {
    key: "pages.contact.title",
    group: "pages",
    label: "Contact — heading",
    editor: "text",
    defaultValue: "Come and find us",
  },
  {
    key: "pages.contact.lead",
    group: "pages",
    label: "Contact — intro",
    editor: "textarea",
    defaultValue:
      "Call for anything urgent, or drop us a message and we'll get back to you the same day.",
  },
  {
    key: "pages.bulk.eyebrow",
    group: "pages",
    label: "Bulk orders — eyebrow",
    editor: "text",
    defaultValue: "Feeding a crowd",
  },
  {
    key: "pages.bulk.title",
    group: "pages",
    label: "Bulk orders — heading",
    editor: "text",
    defaultValue: "Bulk & catering orders",
  },
  {
    key: "pages.bulk.lead",
    group: "pages",
    label: "Bulk orders — intro",
    editor: "textarea",
    defaultValue:
      "Tell us the occasion, the headcount and the date. We'll put together a spread and send you a quote — usually within a day.",
  },
  {
    key: "pages.bulk.points",
    group: "pages",
    label: "Bulk orders — what to expect",
    editor: "json",
    defaultValue: [
      { heading: "Any size", text: "From a family lunch for twenty to a function for several hundred." },
      { heading: "A written quote", text: "Itemised, with no obligation, before anything is cooked." },
      { heading: "Notice helps", text: "Two or three days is comfortable; ask anyway if it's sooner." },
    ],
  },
  {
    key: "pages.custom.eyebrow",
    group: "pages",
    label: "Custom orders — eyebrow",
    editor: "text",
    defaultValue: "Made your way",
  },
  {
    key: "pages.custom.title",
    group: "pages",
    label: "Custom orders — heading",
    editor: "text",
    defaultValue: "Ask for something special",
  },
  {
    key: "pages.custom.lead",
    group: "pages",
    label: "Custom orders — intro",
    editor: "textarea",
    defaultValue:
      "Sugar-free sweets, a jain thali, a gift box, a dish the way your grandmother made it — describe it and we'll tell you whether we can.",
  },
  {
    key: "pages.privacy.title",
    group: "pages",
    label: "Privacy policy — heading",
    editor: "text",
    defaultValue: "Privacy Policy",
  },
  {
    key: "pages.privacy.body",
    group: "pages",
    label: "Privacy policy — sections",
    editor: "json",
    defaultValue: [
      {
        heading: "What we collect",
        text: "When you place an order we store your name, phone number and, if you give it, your email address, along with the order itself. If you create an account we also store a hashed version of your password — never the password itself.",
      },
      {
        heading: "Why we collect it",
        text: "Purely to prepare your order, contact you about it, and show you your own order history. We do not build advertising profiles.",
      },
      {
        heading: "Who we share it with",
        text: "Nobody. We do not sell or rent your details, and we don't pass them to third parties for marketing.",
      },
      {
        heading: "Cookies",
        text: "We set a small number of cookies to keep you signed in and to remember your cart. There are no third-party advertising or tracking cookies.",
      },
      {
        heading: "Your choices",
        text: "Ask us and we'll tell you what we hold about you, correct it, or delete your account. Order records may be kept where we're required to for accounting.",
      },
    ],
  },
  {
    key: "pages.terms.title",
    group: "pages",
    label: "Terms — heading",
    editor: "text",
    defaultValue: "Terms of Service",
  },
  {
    key: "pages.terms.body",
    group: "pages",
    label: "Terms — sections",
    editor: "json",
    defaultValue: [
      {
        heading: "Orders and confirmation",
        text: "Placing an order online is a request, not a completed sale. An order is confirmed once we accept it, and you can check its progress from the track page at any time.",
      },
      {
        heading: "Pickup only",
        text: "All orders are collected in person at the address shown on this site. We do not deliver. Please collect within your chosen window so the food is at its best.",
      },
      {
        heading: "Payment",
        text: "Payment is taken at the counter when you collect. Prices shown online are what you pay unless we agree a change with you first.",
      },
      {
        heading: "Availability",
        text: "Menus change through the day and items are cooked in limited quantities. If something sells out after you order, we'll call you and either substitute it or refund it.",
      },
      {
        heading: "Cancellations",
        text: "Let us know as early as you can. We can usually cancel an order that hasn't been cooked yet; bulk and custom orders may involve costs already incurred.",
      },
      {
        heading: "Allergies",
        text: "Tell us about allergies in the notes and we'll do our best, but ours is a shared kitchen and we cannot guarantee any dish is free of traces.",
      },
    ],
  },
];

/** Fast lookup by key. */
export const SETTING_MAP = new Map(SETTING_DEFINITIONS.map((d) => [d.key, d]));

/** The complete default settings object, used to seed and to fill gaps. */
export function defaultSettings(): Record<string, unknown> {
  return Object.fromEntries(SETTING_DEFINITIONS.map((d) => [d.key, d.defaultValue]));
}
