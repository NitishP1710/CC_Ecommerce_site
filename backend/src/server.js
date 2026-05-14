import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import { connectDB, Product, Purchase, mongoose } from "./db.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;
const frontendOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

app.use(cors({ origin: frontendOrigin }));
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  try {
    const count = await Product.countDocuments();
    res.json({ status: "ok", products: count, now: new Date() });
  } catch (error) {
    res.status(500).json({ status: "error", message: error.message });
  }
});

app.get("/api/products", async (_req, res) => {
  try {
    const products = await Product.find(
      {},
      "name description price_cents stock",
    ).sort({ _id: 1 });
    res.json(
      products.map((p) => ({
        id: p._id,
        name: p.name,
        description: p.description,
        price_cents: p.price_cents,
        stock: p.stock,
      })),
    );
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.post("/api/purchases", async (req, res) => {
  const {
    productId,
    quantity = 1,
    buyerEmail = "guest@example.com",
  } = req.body;
  const normalizedQuantity = Number(quantity);

  if (
    !productId ||
    !Number.isInteger(normalizedQuantity) ||
    normalizedQuantity < 1
  ) {
    return res
      .status(400)
      .json({ message: "productId and valid quantity are required" });
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const product = await Product.findById(productId).session(session);
    if (!product) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Product not found" });
    }

    if (product.stock < normalizedQuantity) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Insufficient stock" });
    }

    const totalCents = product.price_cents * normalizedQuantity;

    product.stock = product.stock - normalizedQuantity;
    await product.save({ session });

    const purchase = await Purchase.create(
      [
        {
          product_id: product._id,
          quantity: normalizedQuantity,
          total_cents: totalCents,
          buyer_email: buyerEmail,
        },
      ],
      { session },
    );

    await session.commitTransaction();

    const purchaseObj = purchase[0].toObject
      ? purchase[0].toObject()
      : purchase[0];
    purchaseObj.id = purchaseObj._id;

    return res.status(201).json({
      message: "Purchase simulated successfully",
      purchase: purchaseObj,
      productName: product.name,
      remainingStock: product.stock,
    });
  } catch (error) {
    await session.abortTransaction();
    return res.status(500).json({ message: error.message });
  } finally {
    session.endSession();
  }
});

(async function start() {
  try {
    await connectDB();
    app.listen(port, () => {
      console.log(`Backend listening on port ${port}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
})();
