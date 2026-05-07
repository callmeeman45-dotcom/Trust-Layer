const express=require('express');
const mongoose=require('mongoose');
const cors=require('cors'); 
const app=express();
const Product=require('./models/Products');
const ejs=require('ejs');
app.set('view engine','ejs');
app.use(express.urlencoded({extended:true}));
app.use(express.json());
const MongoStore=require("connect-mongo").default;
const path=require('path');
app.set('views', path.join(__dirname, 'views'));
const fs=require('fs');
const QRCode=require('qrcode');
require("dotenv").config();
const ScanRecord=require('./models/scanrecord');
const bodyParser = require("body-parser");
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const cloudinary = require("cloudinary").v2;
cloudinary.config({ 
cloud_name: process.env.CLOUD_NAME, 
api_key: process.env.CLOUD_API_KEY, 
api_secret: process.env.CLOUD_API_SECRET 
});
const User=require('./models/users');
const localstrategy=require('passport-local');
const session=require('express-session');
const passport=require('passport');
const Mongourl=process.env.mongodb_cloud_address
async function main(){
    await mongoose.connect(Mongourl);
    console.log('Connected to MongoDB');
}
const store=MongoStore.create({
  mongoUrl:Mongourl,
  crypto:{
     secret:process.env.SECRET,
  },
  touchAfter:24*3600,
});

app.use(session({
    store,
    secret:process.env.SECRET,
    resave:false,
    saveUninitialized:false,   
    cookies:{
      expires:Date.now()+7*24*60*60*1000,
      maxAge:7*24*60*60*1000,
      httpOnly:true
    } // Set secure to false for development (HTTP)
}));
passport.use(new localstrategy(User.authenticate()));
app.use(passport.initialize()); 
app.use(passport.session());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

const isloggedin=(req,res,next)=>{
    if(req.isAuthenticated()){
     req.session.redirectURL=req.originalUrl;
        return next();
    }
    res.redirect("/login");
};
app.get("/login",(req,res)=>{
    res.render("login");
});


app.get("/register",(req,res)=>{
    if(req.user.username === "TRUST LAYER ADMIN"){
        res.render("register");
    } else {
        res.redirect("/login");
    }
});
app.post("/register",async(req,res)=>{
    const{brandname,email,username,password}=req.body;
    console.log(password);
    const user=new User({username,email,brandname});
    const registereduser=await User.register(user,password);
    // registereduser.save().catch(err=>console.log("User Save Error:",err));
    console.log("User Registered:", registereduser);
    res.redirect("/login");
});

app.get("/admin/space",isloggedin,(req,res)=>{
    res.render("admin-space1",{username:req.user.username,brandname:req.user.brandname,email:req.user.email});
});
app.post("/login",passport.authenticate("local",{
    successRedirect:"/admin/space",
    failureRedirect:"/login",
    // failureFlash:true
}),async(req,res)=>{
     if(!res.locals.originalurl){
    return res.redirect("/listings");
  }
  res.redirect(res.locals.originalurl);

   
});
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'product_images', // folder name in cloudinary
   allowed_formats:['png','jpg','jpeg'], // supports promises as well
  },
});
const multer  = require('multer')
const upload = multer({ storage })

app.use(cors());

main().catch(err=>console.log(err));
app.get("/add-product",(req,res)=>{
    res.render("add-product1");
});

app.get("/batch/edit/:batchNumber", async (req, res) => {
    const product = await Product.findOne({ batchNumber: req.params.batchNumber, brandname: req.user.brandname });
    if (!product) {
        return res.status(404).send("Batch not found");
    }
    res.render("edit-batch", {product})
});
app.get("/edit-product",async(req,res)=>{
    const brandname = req.user.brandname;

    const grouped_products = await Product.aggregate([
        {
            $match: { brandname: brandname }  // filter by brand first
        },
        {
            $group: {
                _id: "$batchNumber",
                count: { $sum: 1 },
                price: { $first: "$price" },         // grab these fields
                description: { $first: "$description" }, // directly in the
                image: { $first: "$image" }          // aggregation pipeline
            }
        }
    ]);
    res.render("edit-product", { products:grouped_products });
});

app.post("/edit-batch/:batchNumber", upload.single("image"), async (req, res) => {
    try {
        const { name, description, price, manufacturingDate, expiryDate, Recall} = req.body;

        // Only include fields that were actually provided
        const updateData = {
            ...(name              && { name }),
            ...(description       && { description }),
            ...(price             && { price }),
            ...(manufacturingDate && { manufacturingDate }),
            ...(expiryDate        && { expiryDate }),
            ...(Recall         !== undefined && { Recall }),
            ...(req.file          && { image: req.file.path }),
        };

        await Product.updateMany(
            { batchNumber: req.params.batchNumber, brandname: req.user.brandname },
            { $set: updateData }
        );
console.log("Batch updated with:", updateData);
        res.redirect("/admin/space");
    } catch (err) {
        console.error("Error updating batch:", err);
        res.status(500).json({ error: "Failed to update batch" });
    }
});
// app.post("/add-product", upload.single("image"), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.send("Image upload failed");
//         }
//        const brandname=req.user.brandname;
//         const imageUrl = req.file.path;

//         const {
//             name,
//             description,
//             batchNumber,
//             price,
//             manufacturingDate,
//             expiryDate,
//             quantity
            
//         } = req.body;

//         const qty = parseInt(quantity);

//         if (!qty || qty <= 0) {
//             return res.send("Invalid quantity");
//         }

//         const qrFolder = path.join(__dirname, "public/qrcodes");

//         if (!fs.existsSync(qrFolder)) {
//             fs.mkdirSync(qrFolder, { recursive: true });
//         }

//         for (let i = 0; i < qty; i++) {

//             const product = await new Product({
//                 name,
//                 description,
//                 batchNumber,
//                 price,
//                 manufacturingDate,
//                 image: imageUrl,
//                 status: "Genuine",
//                 expiryDate,
//                 brandname
//             });

//             const verificationURL = `http://localhost:3000/check/status/${product._id}`;

//             const qrPath = path.join(qrFolder, `${product._id}.png`);

//             await QRCode.toFile(qrPath, verificationURL);
//             console.log(product);
//             product.save().catch(err => console.log("Product Save Error:", err));
//         }
//         res.send(`${qty} products created successfully!`);

//     } catch (error) {
//         console.log("ERROR:", error);
//         res.status(500).send("Error occurred while generating products.");
//     }
// });

const PDFDocument = require('pdfkit');
app.post("/logout",(req,res)=>{
    req.logout(err=>{
        if(err){
            console.log("Logout Error:",err);
            return res.status(500).send("Error during logout.");
        }
        res.redirect("/");
    });
});


// app.post("/add-product", upload.single("image"), async (req, res) => {
//     try {
//         if (!req.file) {
//             return res.send("Image upload failed");
//         }

//         const brandname = req.user.brandname;
//         const imageUrl = req.file.path;

//         const {
//             name,
//             description,
//             batchNumber,
//             price,
//             manufacturingDate,
//             expiryDate,
//             quantity
//         } = req.body;

//         const qty = parseInt(quantity);
//         if (!qty || qty <= 0) {
//             return res.send("Invalid quantity");
//         }

//         const qrFolder = path.join(__dirname, "public/qrcodes");
//         if (!fs.existsSync(qrFolder)) {
//             fs.mkdirSync(qrFolder, { recursive: true });
//         }

//         // Step 1 — create all products and generate QR images
//         const qrPaths = [];

//         for (let i = 0; i < qty; i++) {
//             const product = new Product({
//                 name,
//                 description,
//                 batchNumber,
//                 price,
//                 manufacturingDate,
//                 image: imageUrl,
//                 status: "Genuine",
//                 expiryDate,
//                 brandname
//             });

//             const verificationURL = `https://trust-layer-project.vercel.app/check/status/${product._id}`;
//             const qrPath = path.join(qrFolder, `${product._id}.png`);

//             await QRCode.toFile(qrPath, verificationURL);
//             await product.save();

//             qrPaths.push({ qrPath, productId: product._id.toString() });
//         }

//         // Step 2 — build PDF in memory and send to client
//         const doc = new PDFDocument({
//             size: 'A4',
//             margin: 40
//         });

//         // Tell browser to download it as a file
//         res.setHeader('Content-Type', 'application/pdf');
//         res.setHeader('Content-Disposition', `attachment; filename="${batchNumber}_qrcodes.pdf"`);

//         // Pipe PDF directly to response
//         doc.pipe(res);

//         // PDF Title page info
//         doc
//             .fontSize(22)
//             .fillColor('#1a4d1a')
//             .text('Trust Layer — QR Codes', { align: 'center' });

//         doc
//             .fontSize(11)
//             .fillColor('#555')
//             .text(`Product: ${name}`, { align: 'center' })
//             .text(`Batch: ${batchNumber}`, { align: 'center' })
//             .text(`Total Units: ${qty}`, { align: 'center' })
//             .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });

//         doc.moveDown(1.5);
//         doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
//         doc.moveDown(1);

//         // Step 3 — place QR codes in a 3-column grid
//         const qrSize  = 140;   // px size of each QR in the PDF
//         const cols    = 3;
//         const colGap  = 20;
//         const rowGap  = 30;
//         const startX  = 40;
//         const startY  = doc.y;
//         const pageH   = 750;   // safe height before new page

//         for (let i = 0; i < qrPaths.length; i++) {
//             const col   = i % cols;
//             const row   = Math.floor(i / cols);
//             const x     = startX + col * (qrSize + colGap);
//             const y     = startY + row * (qrSize + rowGap + 20);

//             // Add new page if content overflows
//             if (y + qrSize + 40 > pageH && col === 0 && row !== 0) {
//                 doc.addPage();
//             }

//             const drawY = col === 0 && row > 0 ? doc.y : y;
//             const finalY = col === 0 && i > 0 ? doc.y : y;

//             // Draw QR image
//             doc.image(qrPaths[i].qrPath, x, finalY, {
//                 width: qrSize,
//                 height: qrSize
//             });

//             // Small label under each QR
//             doc
//                 .fontSize(7)
//                 .fillColor('#333333')
//                 .text(
//                     `#${i + 1} · ${qrPaths[i].productId.slice(-8)}`,
//                     x,
//                     finalY + qrSize + 4,
//                     { width: qrSize, align: 'center' }
//                 );
//         }

//         doc.end();

//     } catch (error) {
//         console.log("ERROR:", error);
//         res.status(500).send("Error occurred while generating products.");
//     }
// });


// const QRCode    = require('qrcode');
// const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier'); // npm i streamifier

// Helper: upload a buffer to Cloudinary
function uploadBufferToCloudinary(buffer, publicId) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'trust-layer/qrcodes',
                public_id: publicId,
                format: 'png',
                overwrite: true
            },
            (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });
}

app.post("/add-product", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "Image upload failed" });

        const brandname = req.user.brandname;
        const imageUrl  = req.file.path;

        const { name, description, batchNumber, price,
                manufacturingDate, expiryDate, quantity } = req.body;

        const qty = parseInt(quantity);
        if (!qty || qty <= 0) return res.status(400).json({ error: "Invalid quantity" });

        // Step 1 — Pre-generate all product _id's
        const products = Array.from({ length: qty }, () => new Product({
            name, description, batchNumber, price,
            manufacturingDate, expiryDate,
            image: imageUrl,
            status: "Genuine",
            brandname
        }));

        // Step 2 — For each product: generate QR buffer → upload to Cloudinary → save
        // Run in batches of 5 to avoid overwhelming Cloudinary API
        const BATCH_SIZE = 5;

        for (let i = 0; i < products.length; i += BATCH_SIZE) {
            const chunk = products.slice(i, i + BATCH_SIZE);

            await Promise.all(chunk.map(async (product) => {
                const verificationURL =
                    `https://trust-layer-project.vercel.app/check/status/${product._id}`;

                // Generate QR as buffer (no disk I/O)
                const qrBuffer = await QRCode.toBuffer(verificationURL, {
                    width: 400,
                    margin: 2,
                    color: { dark: '#1a4d1a', light: '#ffffff' }
                });

                // Upload to Cloudinary with product ID as filename
                const qrCodeUrl = await uploadBufferToCloudinary(
                    qrBuffer,
                    `qr_${product._id}` // unique name per product
                );

                // Save product with QR URL
                product.qrCodeUrl = qrCodeUrl;
                await product.save();
            }));
        }

        // Step 3 — Respond with success + redirect info
        res.json({
            success: true,
            message: `${qty} products created successfully`,
            batchNumber,
            viewUrl: `/admin/batch/${batchNumber}` // redirect admin here
        });

    } catch (error) {
        console.error("ERROR in /add-product:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Error generating products." });
        }
    }
});

// GET /admin/batch/:batchNumber
// GET /admin/batch/:batchNumber/download-pdf
app.get("/admin/batch/:batchNumber/download-pdf", async (req, res) => {
    try {
        const products = await Product
            .find({ batchNumber: req.params.batchNumber, brandname: req.user.brandname })
            .select('_id qrCodeUrl name batchNumber')
            .sort({ createdAt: 1 })
            .lean();

        if (!products.length) return res.status(404).json({ error: "Batch not found" });

        // Fetch all QR images from Cloudinary in parallel
        const qrBuffers = await Promise.all(
            products.map(async (p) => {
                const response = await fetch(p.qrCodeUrl);
                const arrayBuffer = await response.arrayBuffer();
                return {
                    buffer: Buffer.from(arrayBuffer),
                    productId: p._id.toString()
                };
            })
        );

        // Build PDF
        const doc = new PDFDocument({ size: 'A4', margin: 40 });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition',
            `attachment; filename="${req.params.batchNumber}_qrcodes.pdf"`);
        doc.pipe(res);

        // Title
        doc.fontSize(20).fillColor('#1a4d1a')
           .text('Trust Layer — QR Codes', { align: 'center' });
        doc.fontSize(11).fillColor('#555')
           .text(`Batch: ${req.params.batchNumber}`, { align: 'center' })
           .text(`Total: ${products.length} units`, { align: 'center' })
           .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });
        doc.moveDown(1.5);
        doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#ccc').stroke();
        doc.moveDown(1);

        // Grid layout
        const QR_SIZE  = 130;
        const COLS     = 3;
        const COL_GAP  = 25;
        const ROW_GAP  = 40;
        const MARGIN   = 40;
        const CELL_W   = (595 - MARGIN * 2 - COL_GAP * (COLS - 1)) / COLS;
        const SAFE_H   = 800;

        let gridStartY = doc.y;

        for (let i = 0; i < qrBuffers.length; i++) {
            const col = i % COLS;

            if (col === 0 && i > 0) {
                const projectedBottom = gridStartY + QR_SIZE + ROW_GAP;
                if (projectedBottom > SAFE_H) {
                    doc.addPage();
                    gridStartY = MARGIN;
                } else {
                    gridStartY += QR_SIZE + ROW_GAP;
                }
            }

            const x = MARGIN + col * (CELL_W + COL_GAP);
            const y = gridStartY;

            doc.image(qrBuffers[i].buffer, x, y, { width: QR_SIZE, height: QR_SIZE });
            doc.fontSize(7).fillColor('#333')
               .text(
                   `#${i + 1} · ${qrBuffers[i].productId.slice(-8)}`,
                   x, y + QR_SIZE + 4,
                   { width: CELL_W, align: 'center' }
               );
        }

        doc.end();

    } catch (err) {
        console.error("PDF generation error:", err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});
// app.get("/api/scan-stats", async (req, res) => {
   
//     // const db = client.db("HoneyBrand");
//     // const records = await db.collection("ScanRecord").find({}).toArray();
// const records = await ScanRecord.find();
//     let genuine = 0;
//     let counterfeit = 0;

//     records.forEach(r => {
//         if (r.status?.toLowerCase() === "not used") genuine++;
//         else if (r.status?.toLowerCase() === "used") counterfeit++;
//     });

//     // per product breakdown
//     const perProduct = {};
//     records.forEach(r => {
//         const id = r.productId?.toString().slice(-6);
//         if (!perProduct[id]) perProduct[id] = { genuine: 0, counterfeit: 0 };
//         if (r.status?.toLowerCase() === "not used") perProduct[id].genuine++;
//         else perProduct[id].counterfeit++;
//     });

//     res.render("analytics", {
//         genuine,
//         counterfeit,
//         perProduct
//     });
// });


app.get("/all-products", async (req, res) => {
    const brandname = req.user.brandname;

    const grouped_products = await Product.aggregate([
        {
            $match: { brandname: brandname }  // filter by brand first
        },
        {
            $group: {
                _id: "$batchNumber",
                count: { $sum: 1 },
                price: { $first: "$price" },         // grab these fields
                description: { $first: "$description" }, // directly in the
                image: { $first: "$image" }          // aggregation pipeline
            }
        }
    ]);

    console.log(grouped_products);
    res.render("allproducts", { products: grouped_products });
});
app.get("/all-products", async (req, res) => {
    const products = await Product.find();
    res.send(products);
});
app.get("/",async( req,res)=>{
    // res.send("Welcome to the product details API");
    res.render("index1");
});

const geoip = require("geoip-lite");

app.get("/check/status/:id", async (req, res) => {
    try {
        const id = req.params.id;

        const product = await Product.findById(id);

        if (!product) {
            return res.status(404).send("Product not found");
        }

        // 🚀 Send response immediately
        if (product.status === 'Genuine') {
            res.render("verify", { product });
        } else {
            res.render("counterfeit1");
        }

        // ===============================
        // ALWAYS insert scan record below
        // ===============================

        let ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    "Unknown";

// Normalize IPv6 mapped IPv4 addresses (e.g. ::ffff:192.168.1.1 → 192.168.1.1)
if (ip.startsWith("::ffff:")) {
    ip = ip.substring(7);
}

// Handle IPv6 localhost
if (ip === "::1") {
    ip = "127.0.0.1";
}

const geo = geoip.lookup(ip);

// Debug: log what you're actually looking up
console.log("IP:", ip, "| GEO:", geo);

const isPrivateIp = /^(127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);

const scanRecord = new ScanRecord({
    productId: product._id,
    location: geo
        ? `${geo.country || "Unknown"}, ${geo.city || "Unknown"}, ${geo.region || "Unknown"}`
        : isPrivateIp
            ? "Local Network"
            : "Unknown",
    ipAddress: ip,
    productstatus: product.status,
    brandname: product.brandname
});
        // Don't block response
        scanRecord.save().catch(err => console.log("Scan Save Error:", err));
        console.log("Scan record saved:", scanRecord);

        // Update status only if not used
        if (product.status === 'Genuine') {
            Product.updateOne(
                { _id: id },
                { status: 'Counterfeit' }
            ).catch(err => console.log("Update Error:", err));
        }

    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
});
app.get("/admin/dashboard", async (req, res) => {
    // we have to show the produt name based on the product id in the scan record so we have to do a lookup in the product collection and then we have to show the product name in the dashboard
    // there is function which retrive all the data of the the prodcut od which id is given from its database  

const records = await ScanRecord.find({ brandname: req.user.brandname });

   
res.render("dashboard", { records});
});





// routes/analytics.js
// Drop this into your existing Express routes folder and require it in app.js

const { MongoClient } = require('mongodb');

// ── MongoDB connection ────────────────────────────────────────────────────────
const MONGO_URI = process.env.mongodb_cloud_address;
const DB_NAME   = "test"; // your database name;
const COLLECTION = 'scanrecords'; // your collection name;
let client;
async function getCollection() {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
  }
  return client.db(DB_NAME).collection(COLLECTION);
}

// ── Helper: parse "Mon Apr 27 2026 17:09:44 GMT+0000 (...)" → Date ───────────
function parseDate(str) {
  return new Date(str);
}

// ── GET /analytics ────────────────────────────────────────────────────────────
app.get('/analytics', isloggedin,async (req, res) => {
    const brandname = req.user.brandname;
    console.log("Loading analytics dashboard...");
  try {
    const col  = await getCollection();
    const docs = await col.find({brandname: brandname}).toArray();
    console.log(docs);

    // ── 1. Genuine vs Counterfeit ─────────────────────────────────────────────
    const statusCount = { Genuine: 0, Counterfeit: 0 };
    docs.forEach(d => {
      const s = (d.productstatus || '').trim();
      if (s === 'Genuine')    statusCount.Genuine++;
      if (s === 'Counterfeit') statusCount.Counterfeit++;
    });

    // ── 2. Scans Over Time (daily) ────────────────────────────────────────────
    const dailyMap = {};
    docs.forEach(d => {
      const dt = parseDate(d['scanDate']);
      if (isNaN(dt)) return;
      const day = dt.toISOString().slice(0, 10); // "YYYY-MM-DD"
      if (!dailyMap[day]) dailyMap[day] = { Genuine: 0, Counterfeit: 0 };
      const s = (d.productstatus || '').trim();
      if (s === 'Genuine')    dailyMap[day].Genuine++;
      if (s === 'Counterfeit') dailyMap[day].Counterfeit++;
    });
    const sortedDays = Object.keys(dailyMap).sort();
    const scansOverTime = {
      labels:       sortedDays,
      genuine:      sortedDays.map(d => dailyMap[d].Genuine),
      counterfeit:  sortedDays.map(d => dailyMap[d].Counterfeit),
    };

    // ── 3. Scans by IP Address (Top 12, colored by dominant status) ───────────
    // const ipMap = {};
    // docs.forEach(d => {
    //   const ip = (d['ipAddress'] || 'Unknown').trim();
    //   const s  = (d.productstatus || '').trim();
    //   if (!ipMap[ip]) ipMap[ip] = { Genuine: 0, Counterfeit: 0, total: 0 };
    //   ipMap[ip].total++;
    //   if (s === 'Genuine')    ipMap[ip].Genuine++;
    //   if (s === 'Counterfeit') ipMap[ip].Counterfeit++;
    // });
    // const topIPs = Object.entries(ipMap)
    //   .sort((a, b) => b[1].total - a[1].total)
    //   .slice(0, 12);
    // const ipChart = {
    //   labels:      topIPs.map(([ip]) => ip),
    //   genuine:     topIPs.map(([, v]) => v.Genuine),
    //   counterfeit: topIPs.map(([, v]) => v.Counterfeit),
    // };



    // ── 3. Scans by IP Address
const ipMap = {};
docs.forEach(d => {
  const ip  = (d.ipAddress || 'Unknown').trim();
  const s   = (d.productstatus || '').trim();
  const pid = d.productId ? d.productId.toHexString() : 'Unknown';

  if (!ipMap[ip]) ipMap[ip] = {
    Genuine: 0, Counterfeit: 0, total: 0,
    genuineProducts: {},
    counterfeitProducts: {}
  };

  ipMap[ip].total++;

  if (s === 'Genuine') {
    ipMap[ip].Genuine++;
    if (!ipMap[ip].genuineProducts[pid]) ipMap[ip].genuineProducts[pid] = 0;
    ipMap[ip].genuineProducts[pid]++;
  }

  if (s === 'Counterfeit') {
    ipMap[ip].Counterfeit++;
    if (!ipMap[ip].counterfeitProducts[pid]) ipMap[ip].counterfeitProducts[pid] = 0;
    ipMap[ip].counterfeitProducts[pid]++;
  }
});
const topIPs = Object.entries(ipMap)
  .sort((a, b) => b[1].total - a[1].total)
  .slice(0, 12);
const ipChart = {
  labels:              topIPs.map(([ip]) => ip),
  genuine:             topIPs.map(([, v]) => v.Genuine),
  counterfeit:         topIPs.map(([, v]) => v.Counterfeit),
  genuineProducts:     topIPs.map(([, v]) => v.genuineProducts),
  counterfeitProducts: topIPs.map(([, v]) => v.counterfeitProducts),
};
    // ── 4. Multi-Scan Products (products scanned > 1 time) ───────────────────
const productMap = {};
docs.forEach(d => {
  const pid = d.productId ? `${d.productId}` : 'Unknown';
  const s   = (d.productstatus || '').trim();
  const ip  = d.ipAddress || d.ip || 'Unknown IP';

  if (!productMap[pid]) productMap[pid] = { 
    Genuine: 0, 
    Counterfeit: 0, 
    total: 0, 
    genuineIPs: new Set(),      // ← IPs that scanned as Genuine
    counterfeitIPs: new Set()   // ← IPs that scanned as Counterfeit
  };

  productMap[pid].total++;

  if (s === 'Genuine') {
    productMap[pid].Genuine++;
    productMap[pid].genuineIPs.add(ip);
  }
  if (s === 'Counterfeit') {
    productMap[pid].Counterfeit++;
    productMap[pid].counterfeitIPs.add(ip);
  }
});

const multiScan = Object.entries(productMap)
//   .filter(([, v]) => v.total > 1)
  .sort((a, b) => b[1].total - a[1].total);

const productChart = {
  labels:         multiScan.map(([pid]) => '…' + pid.slice(-6)),
  fullIds:        multiScan.map(([pid]) => pid),
  genuine:        multiScan.map(([, v]) => v.Genuine),
  counterfeit:    multiScan.map(([, v]) => v.Counterfeit),
  total:          multiScan.map(([, v]) => v.total),
  genuineIPs:     multiScan.map(([, v]) => [...v.genuineIPs]),     // ← new
  counterfeitIPs: multiScan.map(([, v]) => [...v.counterfeitIPs]), // ← new
};
    // ── 5. Geographic Summary ─────────────────────────────────────────────────
    const geoMap = {};
    docs.forEach(d => {
      const loc   = (d.location || 'Unknown').trim();
      const parts = loc.split(',').map(p => p.trim());
      const country = parts[0] || 'Unknown';
      const city    = parts[1] || 'Unknown';
      const key     = country;
      if (!geoMap[key]) geoMap[key] = { country, city, Genuine: 0, Counterfeit: 0, total: 0 };
      geoMap[key].total++;
      const s = (d.productstatus || '').trim();
      if (s === 'Genuine')    geoMap[key].Genuine++;
      if (s === 'Counterfeit') geoMap[key].Counterfeit++;
    });
    const geoData = Object.values(geoMap).sort((a, b) => b.total - a.total);
    const geoChart = {
      labels:      geoData.map(g => g.country),
      genuine:     geoData.map(g => g.Genuine),
      counterfeit: geoData.map(g => g.Counterfeit),
      rates:       geoData.map(g => ((g.Counterfeit / g.total) * 100).toFixed(1)),
      totals:      geoData.map(g => g.total),
    };
console.log("Status Count:", statusCount);
console.log("Scans Over Time:", scansOverTime);
console.log("IP Chart:", ipChart);
console.log("Product Chart:", productChart);
console.log("Geo Chart:", geoChart);
    // ── Render ─────────────────────────────────────────────────────────────────
    res.render('analytics2', {
      totalScans:docs.length,
      statusCount,
      scansOverTime,
      ipChart,
      productChart,
      geoChart,
      geoData,
      lastUpdated:   new Date().toLocaleString(),
      brandname: req.user.brandname
    });

  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).send('Error loading analytics: ' + err.message);
  }
});






app.listen(3000, () => {
    console.log("Server running on port 3000");
});