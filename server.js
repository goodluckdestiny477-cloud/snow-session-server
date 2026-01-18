const express = require("express")
const fs = require("fs")
const path = require("path")
const qrcode = require("qrcode")
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const app = express()
const PORT = process.env.PORT || 3000

const SESSION_DIR = "./session"
let sock
let latestQR = null
let pairingInProgress = false

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// ===========================
// WHATSAPP CONNECT
// ===========================
async function startWhatsApp(pairNumber = null) {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {
    const { connection, qr, lastDisconnect } = update

    if (qr) latestQR = qr

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        startWhatsApp(pairNumber)
      }
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected")
    }
  })

  if (pairNumber) {
    const code = await sock.requestPairingCode(pairNumber)
    return code
  }
}

// ===========================
// HOME PAGE
// ===========================
app.get("/", (req, res) => {
  res.send(`
<!DOCTYPE html>
<html>
<head>
  <title>Snow Bot</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family:Arial;text-align:center;padding:30px">

<h1 style="font-size:42px;font-weight:800">Welcome to Snowflake Bot</h1>
<p>Connect your WhatsApp and receive a session code</p>

<hr>

<h2>📱 Pair with Phone Number</h2>
<form action="/pair" method="post">
  <input name="number" placeholder="234xxxxxxxxxx" required />
  <br><br>
  <button type="submit">Get Pairing Code</button>
</form>

<hr>

<h2>📷 Pair with QR Code</h2>
<a href="/qr">Generate QR Code</a>

<hr>

<h2>📦 Get Session Code</h2>
<a href="/session">Generate Session Code</a>

</body>
</html>
`)
})

// ===========================
// PAIR WITH PHONE NUMBER
// ===========================
app.post("/pair", async (req, res) => {
  try {
    if (pairingInProgress) {
      return res.send("⏳ Pairing already in progress")
    }

    const number = req.body.number
    pairingInProgress = true

    const code = await startWhatsApp(number)

    res.send(`
      <h2>Pairing Code</h2>
      <h1>${code}</h1>
      <p>Enter this code in WhatsApp</p>
    `)

  } catch (err) {
    pairingInProgress = false
    res.send("❌ Error: " + err.message)
  }
})

// ===========================
// QR ROUTE
// ===========================
app.get("/qr", async (req, res) => {
  if (!latestQR) {
    startWhatsApp()
    return res.send("⏳ QR not ready yet, refresh...")
  }

  const qrImage = await qrcode.toDataURL(latestQR)

  res.send(`
    <h2>Scan QR Code</h2>
    <img src="${qrImage}" />
  `)
})

// ===========================
// SESSION EXPORT (PANEL READY)
// ===========================
app.get("/session", (req, res) => {
  if (!fs.existsSync(SESSION_DIR)) {
    return res.json({ error: "No session found" })
  }
app.get('/pair', async (req, res) => {
  res.json({
    status: true,
    message: 'Pairing route is working. Use POST with phone number.'
  });
});
  const files = fs.readdirSync(SESSION_DIR)
  let sessionData = {}

  for (const file of files) {
    const filePath = path.join(SESSION_DIR, file)
    sessionData[file] = fs.readFileSync(filePath, "utf-8")
  }

  const sessionCode = Buffer
    .from(JSON.stringify(sessionData))
    .toString("base64")

  res.json({
    session_code: sessionCode
  })
})

// ============================
// HOME PAGE
// ============================
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Snowflake Bot</title>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body {
          font-family: Arial, sans-serif;
          text-align: center;
          padding: 40px;
          background: #ffffff;
        }
        h1 {
          font-size: 36px;
          margin-bottom: 10px;
        }
        a {
          display: block;
          margin: 15px;
          font-size: 18px;
          color: #007bff;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <h1>Welcome to Snowflake Bot</h1>
      <p>Connect your WhatsApp easily</p>

      <a href="/pair">📱 Pair with Phone Number</a>
      <a href="/qr">📷 Pair with QR Code</a>
      <a href="/session">🔑 Get Session Code</a>
    </body>
    </html>
  `)
})
// ========================
// HOME ROUTE (IMPORTANT)
// ========================
app.get("/", (req, res) => {
  res.send("✅ Snow Session Server is running");
});
// ===========================
// START SERVER
// ===========================
app.listen(PORT, () => {
  console.log(`🚀 Snow Session Server running on port ${PORT}`)
})
