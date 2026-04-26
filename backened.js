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
    res.render("admin-space",{username:req.user.username,brandname:req.user.brandname,email:req.user.email});
});
app.post("/login",passport.authenticate("local",{
    successRedirect:"/",
    failureRedirect:"/login",
    // failureFlash:true
}),async(req,res)=>{
   
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
    res.render("add-product");
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


app.post("/add-product", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.send("Image upload failed");
        }

        const brandname = req.user.brandname;
        const imageUrl = req.file.path;

        const {
            name,
            description,
            batchNumber,
            price,
            manufacturingDate,
            expiryDate,
            quantity
        } = req.body;

        const qty = parseInt(quantity);
        if (!qty || qty <= 0) {
            return res.send("Invalid quantity");
        }

        const qrFolder = path.join(__dirname, "public/qrcodes");
        if (!fs.existsSync(qrFolder)) {
            fs.mkdirSync(qrFolder, { recursive: true });
        }

        // Step 1 — create all products and generate QR images
        const qrPaths = [];

        for (let i = 0; i < qty; i++) {
            const product = new Product({
                name,
                description,
                batchNumber,
                price,
                manufacturingDate,
                image: imageUrl,
                status: "Genuine",
                expiryDate,
                brandname
            });

            const verificationURL = `http://localhost:3000/check/status/${product._id}`;
            const qrPath = path.join(qrFolder, `${product._id}.png`);

            await QRCode.toFile(qrPath, verificationURL);
            await product.save();

            qrPaths.push({ qrPath, productId: product._id.toString() });
        }

        // Step 2 — build PDF in memory and send to client
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40
        });

        // Tell browser to download it as a file
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${batchNumber}_qrcodes.pdf"`);

        // Pipe PDF directly to response
        doc.pipe(res);

        // PDF Title page info
        doc
            .fontSize(22)
            .fillColor('#1a4d1a')
            .text('Trust Layer — QR Codes', { align: 'center' });

        doc
            .fontSize(11)
            .fillColor('#555')
            .text(`Product: ${name}`, { align: 'center' })
            .text(`Batch: ${batchNumber}`, { align: 'center' })
            .text(`Total Units: ${qty}`, { align: 'center' })
            .text(`Generated: ${new Date().toLocaleDateString()}`, { align: 'center' });

        doc.moveDown(1.5);
        doc.moveTo(40, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(1);

        // Step 3 — place QR codes in a 3-column grid
        const qrSize  = 140;   // px size of each QR in the PDF
        const cols    = 3;
        const colGap  = 20;
        const rowGap  = 30;
        const startX  = 40;
        const startY  = doc.y;
        const pageH   = 750;   // safe height before new page

        for (let i = 0; i < qrPaths.length; i++) {
            const col   = i % cols;
            const row   = Math.floor(i / cols);
            const x     = startX + col * (qrSize + colGap);
            const y     = startY + row * (qrSize + rowGap + 20);

            // Add new page if content overflows
            if (y + qrSize + 40 > pageH && col === 0 && row !== 0) {
                doc.addPage();
            }

            const drawY = col === 0 && row > 0 ? doc.y : y;
            const finalY = col === 0 && i > 0 ? doc.y : y;

            // Draw QR image
            doc.image(qrPaths[i].qrPath, x, finalY, {
                width: qrSize,
                height: qrSize
            });

            // Small label under each QR
            doc
                .fontSize(7)
                .fillColor('#333333')
                .text(
                    `#${i + 1} · ${qrPaths[i].productId.slice(-8)}`,
                    x,
                    finalY + qrSize + 4,
                    { width: qrSize, align: 'center' }
                );
        }

        doc.end();

    } catch (error) {
        console.log("ERROR:", error);
        res.status(500).send("Error occurred while generating products.");
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
    res.render("index");
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
            res.render("counterfiet");
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


app.get("/analytics", async (req, res) => {
    res.render("analytics");
});


app.listen(3000, () => {
    console.log("Server running on port 3000");
});