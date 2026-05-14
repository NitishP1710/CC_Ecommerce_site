import dotenv from "dotenv";
import { connectDB, Product } from "../src/db.js";

dotenv.config();

async function init() {
  await connectDB();

  const seedProducts = [
    {
      name: "Classic White Tee",
      description: "100% cotton minimal everyday t-shirt.",
      price_cents: 1999,
      stock: 25,
    },
    {
      name: "Urban Backpack",
      description: "Water-resistant backpack for daily commute.",
      price_cents: 4599,
      stock: 12,
    },
    {
      name: "Wireless Earbuds",
      description: "Compact audio companion with charging case.",
      price_cents: 6999,
      stock: 18,
    },
    {
      name: "Stainless Bottle",
      description: "750ml insulated bottle for hot and cold drinks.",
      price_cents: 2499,
      stock: 30,
    },
  ];

  for (const prod of seedProducts) {
    await Product.updateOne(
      { name: prod.name },
      { $setOnInsert: prod },
      { upsert: true },
    );
  }

  console.log("MongoDB initialized with sample products.");
}

init()
  .catch((error) => {
    console.error("Database initialization failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    // close mongoose connection
    try {
      const { mongoose } = await import("../src/db.js");
      await mongoose.connection.close();
    } catch (e) {
      // ignore
    }
  });
