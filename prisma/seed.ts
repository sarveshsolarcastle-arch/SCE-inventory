import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);

  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@example.com",
      passwordHash,
      role: "ADMIN",
    },
  });

  // Fixtures covering the three shapes the pack model has to handle, so the
  // verification steps have something to run against on a fresh database.
  const fixtures = [
    {
      sku: "WIRE-2.5",
      name: "Wire 2.5mm²",
      category: "Cable",
      baseUnit: "m",
      packUnit: "roll",
      measure: "CONTINUOUS" as const,
      scrapThreshold: 15,
      minStock: 500,
    },
    {
      sku: "SCR-M4",
      name: "Screws M4",
      category: "Fixings",
      baseUnit: "pcs",
      packUnit: "packet",
      measure: "DISCRETE" as const,
      scrapThreshold: null,
      minStock: 200,
    },
    {
      sku: "INV-5K",
      name: "Inverter 5kW",
      category: "Equipment",
      baseUnit: "pcs",
      packUnit: null, // unpackaged — must behave exactly as before
      measure: "DISCRETE" as const,
      scrapThreshold: null,
      minStock: 2,
    },
  ];

  for (const fixture of fixtures) {
    await prisma.item.upsert({
      where: { sku: fixture.sku },
      update: {},
      create: fixture,
    });
  }

  for (const name of ["Kandivali Site", "Borivali Site"]) {
    const existing = await prisma.site.findFirst({ where: { name } });
    if (!existing) await prisma.site.create({ data: { name } });
  }

  console.log("Seeded admin user: admin@example.com / admin123");
  console.log(`Seeded ${fixtures.length} items and 2 sites (stock starts at zero)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
