import { useEffect, useMemo, useState } from "react";
import stainlessBottleImage from "./assets/stainless-bottle.svg";

const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";

const productImages = {
  1: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80",
  2: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=800&q=80",
  3: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=800&q=80",
  4: stainlessBottleImage
};

function formatPrice(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(cents / 100);
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [buyerEmail, setBuyerEmail] = useState("demo-user@example.com");
  const [status, setStatus] = useState({ type: "", text: "" });
  const [latestOrder, setLatestOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadProducts({ keepSelection = true } = {}) {
    const response = await fetch(`${apiUrl}/api/products`);
    if (!response.ok) {
      throw new Error("Failed to fetch products");
    }
    const data = await response.json();
    setProducts(data);
    if (!keepSelection && data.length > 0) {
      setSelectedId(String(data[0].id));
    }
    return data;
  }

  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        await loadProducts({ keepSelection: false });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  const selectedProduct = useMemo(
    () => products.find((product) => String(product.id) === selectedId),
    [products, selectedId]
  );

  const totalPreview = useMemo(() => {
    if (!selectedProduct) {
      return 0;
    }
    return selectedProduct.price_cents * Number(quantity || 1);
  }, [selectedProduct, quantity]);

  useEffect(() => {
    if (!selectedProduct) {
      return;
    }

    if (Number(quantity) > selectedProduct.stock && selectedProduct.stock > 0) {
      setQuantity(selectedProduct.stock);
    }

    if (selectedProduct.stock === 0) {
      setQuantity(1);
    }
  }, [selectedProduct, quantity]);

  async function submitPurchase(event) {
    event.preventDefault();
    setStatus({ type: "", text: "" });

    try {
      setSubmitting(true);
      const response = await fetch(`${apiUrl}/api/purchases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
            productId: selectedId,
            quantity: Number(quantity),
            buyerEmail
          })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Purchase failed");
      }

      setLatestOrder({
        id: data.purchase.id,
        productName: data.productName,
        totalCents: data.purchase.total_cents,
        quantity: data.purchase.quantity,
        buyerEmail: data.purchase.buyer_email,
        remainingStock: data.remainingStock
      });
      setStatus({
        type: "success",
        text: `Order #${data.purchase.id} placed successfully.`
      });

      try {
        await loadProducts();
      } catch {
        setStatus({
          type: "success",
          text: `Order #${data.purchase.id} placed successfully. Product list refresh failed.`
        });
      }
    } catch (err) {
      setStatus({ type: "error", text: err.message });
    } finally {
      setSubmitting(false);
    }
  }

  function getImage(product) {
    return (
      productImages[product.id] ||
      "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80"
    );
  }

  return (
    <div>
      <header className="topBar">
        <div className="brand">amazon-lite</div>
        <input className="search" placeholder="Search demo catalog" />
        <div className="topLinks">
          <span>Orders</span>
          <span>Cart</span>
        </div>
      </header>

      <nav className="subBar">
        <span>All</span>
        <span>Today&apos;s Deals</span>
        <span>Electronics</span>
        <span>Fashion</span>
        <span>Home</span>
      </nav>

      <main className="page">
        <section className="catalogSection">
          <h1>Recommended products</h1>
          {loading ? <p>Loading products...</p> : null}
          {error ? <p className="error">{error}</p> : null}

          <div className="grid">
            {products.map((product) => (
              <article key={product.id} className="card">
                <img src={getImage(product)} alt={product.name} className="productImage" loading="lazy" />
                <h3>{product.name}</h3>
                <p className="description">{product.description}</p>
                <p className="price">{formatPrice(product.price_cents)}</p>
                <p className="stock">In stock: {product.stock}</p>
              </article>
            ))}
          </div>
        </section>

        <aside className="buyPanel">
          <h2>Buy Now</h2>
          <form onSubmit={submitPurchase}>
            <label>
              Product
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} required>
                {products.map((product) => (
                  <option value={product.id} key={product.id}>
                    {product.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Quantity
              <input
                type="number"
                min="1"
                max={selectedProduct?.stock || 1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                required
              />
            </label>

            <label>
              Buyer Email
              <input
                type="email"
                value={buyerEmail}
                onChange={(event) => setBuyerEmail(event.target.value)}
                required
              />
            </label>

            <p className="orderPreview">Total: {formatPrice(totalPreview)}</p>

            <button type="submit" disabled={submitting || !selectedProduct || selectedProduct.stock === 0}>
              {submitting ? "Processing Order..." : "Buy Now"}
            </button>
          </form>

          {status.text ? (
            <p className={status.type === "error" ? "status errorStatus" : "status successStatus"}>
              {status.text}
            </p>
          ) : null}

          {latestOrder ? (
            <div className="latestOrder">
              <h3>Latest order</h3>
              <p>Order ID: {latestOrder.id}</p>
              <p>Product: {latestOrder.productName}</p>
              <p>Quantity: {latestOrder.quantity}</p>
              <p>Total: {formatPrice(latestOrder.totalCents)}</p>
              <p>Buyer: {latestOrder.buyerEmail}</p>
              {typeof latestOrder.remainingStock === "number" ? (
                <p>Remaining stock: {latestOrder.remainingStock}</p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
