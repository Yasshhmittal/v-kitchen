#!/usr/bin/env node
const crypto = require("crypto");

console.log("=================================================");
console.log("  V-Kitchen Production Environment Secrets Generator");
console.log("=================================================\n");

const jwtAccess = crypto.randomBytes(48).toString("base64url");
const jwtRefresh = crypto.randomBytes(48).toString("base64url");

console.log("Copy and paste these into Vercel and Render Environment Variables:\n");
console.log(`JWT_ACCESS_SECRET=${jwtAccess}`);
console.log(`JWT_REFRESH_SECRET=${jwtRefresh}`);
console.log(`NODE_ENV=production`);
console.log(`ACCESS_TOKEN_TTL=15m`);
console.log(`REFRESH_TOKEN_TTL_DAYS=7`);
console.log(`CUSTOMER_REFRESH_TOKEN_TTL_DAYS=180`);
console.log("\nRemember to also set:");
console.log("- DATABASE_URL (from your Render PostgreSQL instance)");
console.log("- NEXT_PUBLIC_SITE_URL (your production Vercel URL, e.g. https://your-project.vercel.app)");
console.log("- STORAGE_PROVIDER (cloudinary if using Cloudinary for images, or local)");
console.log("=================================================");
