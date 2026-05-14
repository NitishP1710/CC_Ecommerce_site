import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is required. Add it to backend/.env");
}

export async function connectDB() {
  const opts = {
    autoIndex: true,
    maxPoolSize: 10,
  };

  await mongoose.connect(process.env.MONGODB_URI, opts);
}

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: { type: String, required: true },
  price_cents: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0, default: 0 },
});

const purchaseSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Product",
    required: true,
  },
  quantity: { type: Number, required: true, min: 1 },
  total_cents: { type: Number, required: true, min: 0 },
  buyer_email: { type: String, required: true },
  created_at: { type: Date, default: () => new Date() },
});

export const Product =
  mongoose.models.Product || mongoose.model("Product", productSchema);
export const Purchase =
  mongoose.models.Purchase || mongoose.model("Purchase", purchaseSchema);

export { mongoose };
