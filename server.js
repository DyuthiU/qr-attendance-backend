console.log("SERVER.JS FILE IS RUNNING");
const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const QRCode = require("qrcode");
const { v4: uuidv4 } = require("uuid");

const app = express();
app.use(cors());
app.use(express.json());


const db = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: "dyuthidisha1*", // your MySQL password
  database: "DD"
});

db.connect((err) => {
  if (err) console.log("DB connection error:", err);
  else console.log("Connected to MySQL database");
});
db.query("SELECT 1", (err, result) => {
  if (err) {
    console.log("TEST QUERY FAILED ❌", err);
  } else {
    console.log("TEST QUERY SUCCESS ✅ Database is working");
  }
});

// Classroom location (example)
const CLASS_LAT = 12.9141;   // change later if needed
const CLASS_LNG = 74.8560;   // change later if needed
const ALLOWED_RADIUS = 25;   // meters

let currentQR = null;

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

app.get("/generate-qr", async (req, res) => {
  const qrId = uuidv4();
  const createdAt = Date.now();
  currentQR = { qrId, createdAt };

  const qrData = JSON.stringify(currentQR);
  const qrImage = await QRCode.toDataURL(qrData); // base64 image
  res.json({ qrImage, qrId }); // qrId optional, but useful
});

// Generate QR (expires in 2 minutes)

// Validate QR
app.post("/validate-qr", (req, res) => {
  const { studentId, qrId, lat, lng } = req.body;

  console.log("Student ID:", studentId);
  console.log("QR ID:", qrId);
  console.log("Lat:", lat, "Lng:", lng);

  // 1️⃣ Check QR exists
  if (!currentQR || qrId !== currentQR.qrId) {
    return res.status(400).json({ message: "Invalid QR" });
  }

  // 2️⃣ Check expiry (2 minutes)
  if (Date.now() - currentQR.createdAt > 2 * 60 * 1000) {
    return res.status(400).json({ message: "QR Expired" });
  }

  // 3️⃣ Check GPS radius
  const distance = getDistance(lat, lng, CLASS_LAT, CLASS_LNG);
  if (distance > ALLOWED_RADIUS) {
    return res.status(403).json({
      message: `Outside allowed area (${Math.round(distance)} meters away)`
    });
  }

  // 4️⃣ INSERT attendance ✅
  const sql = `
    INSERT INTO attendance (student_id, qr_id, latitude, longitude)
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [studentId, qrId, lat, lng], (err, result) => {
    if (err) {
      console.log(err);
      return res.status(500).json({ message: "DB error" });
    }
    console.log("Attendance saved ID:", result.insertId);
    res.json({ message: "Attendance saved" });
  });
});

// ✅ GET TODAY'S ATTENDANCE

  // ✅ ADD HERE (INSIDE the route)

  app.get("/attendance-today", (req, res) => {
  const sql = `
    SELECT student_id, qr_id, latitude, longitude, created_at
    FROM attendance
    WHERE DATE(created_at) = CURDATE()
    ORDER BY created_at DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ message: "Database error" });
    }
    res.json(results);
  });
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});