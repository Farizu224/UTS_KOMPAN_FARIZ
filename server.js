require("dotenv").config();

const path = require("path");
const crypto = require("crypto");
const express = require("express");
const helmet = require("helmet");
const morgan = require("morgan");
const multer = require("multer");
const mysql = require("mysql2/promise");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const app = express();
const PORT = process.env.PORT || 3000;

const requiredEnv = [
  "RDS_HOST",
  "RDS_USER",
  "RDS_PASSWORD",
  "S3_BUCKET_NAME",
  "AWS_ACCESS_KEY",
  "AWS_SECRET_KEY"
];

for (const envName of requiredEnv) {
  if (!process.env[envName]) {
    throw new Error(`Missing required environment variable: ${envName}`);
  }
}

const dbPool = mysql.createPool({
  host: process.env.RDS_HOST,
  user: process.env.RDS_USER,
  password: process.env.RDS_PASSWORD,
  database: process.env.RDS_DATABASE || "tinder_trash_finder",
  port: Number(process.env.RDS_PORT || 3306),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_POOL_SIZE || 10),
  queueLimit: 0,
  ssl: process.env.RDS_USE_SSL === "true" ? { rejectUnauthorized: false } : undefined
});

const awsRegion = process.env.AWS_REGION || "ap-southeast-1";
const s3Client = new S3Client({
  region: awsRegion,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY
  }
});

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Number(process.env.MAX_UPLOAD_SIZE || 5 * 1024 * 1024) }
});

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", "https://cdn.jsdelivr.net"],
        "font-src": ["'self'", "data:", "https://cdn.jsdelivr.net"],
        "upgrade-insecure-requests": null
      }
    }
  })
);
app.use(morgan("combined"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/health", async (_req, res) => {
  try {
    await dbPool.query("SELECT 1");
    return res.status(200).json({ status: "ok", database: "connected" });
  } catch (err) {
    return res.status(503).json({ status: "degraded", database: "disconnected", error: err.message });
  }
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/report", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "report.html"));
});

app.post("/report", upload.single("photo"), async (req, res, next) => {
  try {
    const location = (req.body.location || "").trim();
    const description = (req.body.description || "").trim();
    const file = req.file;

    if (!location || !description || !file) {
      return res.redirect("/report?error=Semua%20field%20wajib%20diisi");
    }

    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
    const randomId = crypto.randomBytes(8).toString("hex");
    const objectKey = `reports/${Date.now()}-${randomId}-${safeOriginalName}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: objectKey,
        Body: file.buffer,
        ContentType: file.mimetype
      })
    );

    const photoUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${awsRegion}.amazonaws.com/${objectKey}`;

    await dbPool.execute(
      `
      INSERT INTO waste_reports (location, description, photo_url, s3_key, status, created_at)
      VALUES (?, ?, ?, ?, 'NEW', NOW())
      `,
      [location, description, photoUrl, objectKey]
    );

    return res.redirect("/report?success=1");
  } catch (err) {
    return next(err);
  }
});

app.get("/schedule", async (_req, res, next) => {
  return res.sendFile(path.join(__dirname, "public", "schedule.html"));
});

app.get("/api/schedule", async (_req, res, next) => {
  try {
    const [rows] = await dbPool.query(
      `
      SELECT id, area_name, day_of_week, pickup_time, notes
      FROM collection_schedules
      ORDER BY FIELD(day_of_week,'Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'), pickup_time
      `
    );

    return res.status(200).json(rows);
  } catch (err) {
    return next(err);
  }
});

app.get("/admin", async (_req, res, next) => {
  return res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/api/admin", async (_req, res, next) => {
  try {
    const [reports] = await dbPool.query(
      `
      SELECT id, location, description, photo_url, status, created_at
      FROM waste_reports
      ORDER BY created_at DESC
      LIMIT 100
      `
    );

    const [workers] = await dbPool.query(
      `
      SELECT id, worker_name, assigned_area, status, last_active_at
      FROM sanitation_workers
      ORDER BY worker_name ASC
      `
    );

    return res.status(200).json({ reports, workers });
  } catch (err) {
    return next(err);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);

  if (err instanceof multer.MulterError) {
    return res.status(400).send("File upload gagal: ukuran file terlalu besar atau format tidak valid.");
  }

  return res.status(500).send("Terjadi kesalahan pada server.");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Tinder (Trash Finder) running on port ${PORT}`);
});
