const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

/* =========================
   MIDDLEWARE (VERY IMPORTANT)
========================= */
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

/* =========================
   CONSTANTS
========================= */
const PORT = process.env.PORT || 3000;
const SESSION_DIR = path.join(__dirname, 'session');

/* =========================
   HOME PAGE
========================= */
app.get('/', (req, res) => {
  res.send(`
    <h1>Welcome to Snowflake Bot</h1>
    <p>Connect your WhatsApp and receive a session code</p>

    <hr />

    <h3>📱 Pair with Phone Number</h3>
    <form method="POST" action="/pair">
      <input name="phone" placeholder="234xxxxxxxxxx" required />
      <button type="submit">Get Pairing Code</button>
    </form>

    <hr />

    <h3>📷 Pair with QR Code</h3>
    <a href="/qr">Generate QR Code</a>

    <hr />

    <h3>📦 Get Session Code</h3>
    <a href="/session">Generate Session Code</a>
  `);
});

/* =========================
   SAFE GET /pair (PREVENT CRASH)
========================= */
app.get('/pair', (req, res) => {
  res.send('<h3>Please use the form on the home page</h3>');
});

/* =========================
   POST /pair (PHONE PAIRING)
========================= */
app.post('/pair', async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.send('❌ Phone number required');
  }

  // DEMO pairing code (replace later with Baileys logic)
  const pairingCode = `SNOW-${Math.random().toString(36).slice(2, 10)}`;

  res.send(`
    <h2>✅ Pairing Code Generated</h2>
    <p><b>${pairingCode}</b></p>
    <p>Enter this code in WhatsApp</p>
  `);
});

/* =========================
   QR CODE PLACEHOLDER
========================= */
app.get('/qr', (req, res) => {
  res.send(`
    <h2>Scan QR Code</h2>
    <p>QR generation will appear here</p>
  `);
});

/* =========================
   SESSION EXPORT
========================= */
app.get('/session', (req, res) => {
  if (!fs.existsSync(SESSION_DIR)) {
    return res.json({ error: 'No session found yet' });
  }

  const files = fs.readdirSync(SESSION_DIR);
  let sessionData = {};

  for (const file of files) {
    const filePath = path.join(SESSION_DIR, file);
    sessionData[file] = fs.readFileSync(filePath);
  }

  const sessionCode = Buffer
    .from(JSON.stringify(sessionData))
    .toString('base64');

  res.json({ session_code: sessionCode });
});

/* =========================
   START SERVER (RENDER SAFE)
========================= */
app.listen(PORT, () => {
  console.log(`🚀 Snow Session Server running on port ${PORT}`);
});
