# Trust Layer

**Trust Layer** is an anti-counterfeit product verification platform that uses QR code technology to let consumers verify product authenticity instantly, and lets brand owners protect their products, track scans, and now answer customer questions through an AI-powered assistant.

---

## Problem It Solves

Counterfeit products cost brands revenue and trust, and consumers have no easy way to verify if what they bought is genuine. Trust Layer solves this through three core pillars:

1. **Authentication** — verify a product is genuine at the point of scan
2. **Ownership Detection** — flag duplicate/counterfeit scans automatically
3. **Recall Notifications** — instantly notify affected customers if a product is recalled

---

## How the System Works (End-to-End)

1. **Brand owner registers a product** and generates a unique QR code for each unit via the dashboard.
2. **QR code + product data** is generated, stored, and the QR image/PDF is uploaded to **Cloudinary**.
3. **Consumer scans the QR code** on the product.
4. **First scan** → the system records this as the legitimate "ownership" event, tagging the scan with a **UUID stored in a cookie** on the user's device (replacing older IP-based tracking, which was unreliable behind shared networks/VPNs).
5. **Subsequent scans** of the same QR code (e.g., from a different device/location) are automatically flagged as **potential counterfeits**, since a genuine product should only be "claimed" once.
6. **Every scan event** (timestamp, device UUID, IP, location) is logged and visualized on an **analytics dashboard** for the brand owner.
7. **Brand owners can also add product knowledge** (ingredients, usage, warranty, etc.), which feeds the **RAG-based AI assistant** so consumers can ask questions about the product directly after scanning.
8. If a product is **recalled**, the system pushes recall notifications to users who scanned that batch/product.

---

## Core Features

### 1. QR Code Generation & Ownership Verification
- Unique QR code generated per product unit
- First-scan-owns logic: first scan = legitimate owner, later scans = flagged as suspicious
- QR images and PDFs stored via **Cloudinary**

### 2. Device Tracking
- UUID-based cookie tracking per device (replacing IP-based tracking for better reliability)
- Prevents easy spoofing compared to IP-only detection

### 3. Analytics Dashboard
- Built with **Chart.js**
- Visualizes scan activity, with **IP/device hover tooltips**
- Dark **navy/teal/orange** design system (earlier iteration used a warm amber/honey theme)

### 4. Email & Contact System
- **Nodemailer** integrated with **Gmail SMTP**, deployed on **Vercel**
- Contact form section wired to its own Nodemailer backend for inquiries

### 5. AI-Powered Product Assistant (RAG) — NEW
See detailed section below.

---

## AI-Powered Product Assistant (RAG)

A Retrieval-Augmented Generation (RAG) system that lets brand owners feed in detailed product information, and lets end users ask natural-language questions about that product after scanning its QR code.

### How It Works

1. **Brand owners add product knowledge**
   Owners input product details — ingredients, usage instructions, warranty terms, manufacturing info, storage guidelines, certifications, FAQs, etc. — through a dashboard form or bulk upload.

2. **Data gets embedded and stored per brand**
   Each piece of product info is converted into vector embeddings and stored in a vector database, scoped by `brandId`. This ensures one brand's data is never mixed with or leaked into another brand's responses — full data isolation.

3. **Users query naturally**
   After scanning a QR code, users can ask questions like:
   - "Is this safe for sensitive skin?"
   - "What's the expiry date policy?"
   - "How do I claim warranty on this?"

4. **Retrieval + generation**
   The system retrieves the most relevant chunks of that brand's product data (via similarity search) and passes them to an LLM, which generates a grounded, accurate answer — no hallucinated product claims.

### Why It Matters
- Builds consumer trust by giving instant, verified answers straight from the manufacturer
- Reduces support queries to brand owners
- Adds another layer of legitimacy — counterfeit products won't have real backing data to answer against

### Data Isolation Design

```
brandId: "brand_123"
 └── product_docs (embedded chunks)
 └── queries scoped strictly to matching brandId
 └── no cross-brand retrieval possible
```

### Example Flow

```
Owner uploads: "Our face cream contains 2% niacinamide, suitable for oily skin, 
shelf life 24 months from manufacture date..."
        ↓
   [Chunked + Embedded]
        ↓
User scans QR → asks: "Can I use this if I have oily skin?"
        ↓
   [Vector search retrieves relevant chunk]
        ↓
LLM responds: "Yes, this product is formulated with niacinamide, 
specifically suitable for oily skin types."
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js / Express |
| Database | MongoDB |
| File/Image Storage | Cloudinary |
| Templating | EJS |
| Charts/Analytics | Chart.js |
| Email | Nodemailer (Gmail SMTP) |
| Deployment | Vercel |
| Device Tracking | UUID (cookie-based) |
| Embeddings (RAG) | *(fill in — e.g. Fireworks API key)* |
| Vector Store (RAG) | *(fill in — e.g. MongoDB Atlas Vector Search)* |
| LLM (RAG) | *(fill in — your chosen provider/model)* |
| Data Isolation | `brandId`-scoped namespaces/collections |

---

## Brand Account Access Model

Trust Layer does not support open, public self-registration for brand accounts. This is a deliberate security measure to prevent unauthorized parties from issuing fraudulent verification for products they don't own.

**How it works:**

1. A prospective brand submits a verification/onboarding request (outside the platform, e.g. via contact form or direct outreach).
2. Trust Layer's team manually verifies the brand's legitimacy (business registration, product ownership, etc.).
3. Only the Super Admin can approve a request and provision a verified Brand Admin account on the platform.
4. Once created, the Brand Admin can log in and manage their own product QR codes, view analytics, and issue recall notifications — scoped strictly to their own brand's data.

This closed-registration model is core to Trust Layer's trust guarantee: every brand account on the platform has been vetted, so a "verified" badge actually means something to end consumers.

---

## Demo Access

For testing/demo purposes, a pre-verified Super Admin account is available:

| Field | Value |
|---|---|
| Username | `Abbott Admin` |
| Password | `ABBOTT` |

**Note:** These are demo credentials for evaluation purposes only. Do not use in production, and rotate/remove before any public deployment.

---

## How It Works on the Consumer Side

When a consumer scans the product, if it is a real, registered product, the system shows it as authentic. If the product has been counterfeited and its QR code duplicated, the system flags it as fake. This way, users can protect themselves from fake medicines or other counterfeit goods that could otherwise cause them harm.
