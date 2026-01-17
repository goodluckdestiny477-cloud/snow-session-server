const express = require("express")
const fs = require("fs")
const path = require("path")
const P = require("pino")
const qrcode = require("qrcode")

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys")

const app = express()

// ===== MIDDLEWARE =====
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// ===== CONFIG =====
const PORT = process.env.PORT || 3000
const SESSION_DIR = path.join(__dirname, "auth")

let sock
let latestQR = null
let pairingInProgress = false

// ===============================
// START WHATSAPP SOCKET
// ===============================
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr) {
      latestQR = qr
      console.log("📸 QR received")
    }

    if (connection === "open") {
      console.log("✅ WhatsApp connected")
      latestQR = null
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !==
        DisconnectReason.loggedOut

      console.log("❌ Connection closed. Reconnect:", shouldReconnect)

      if (shouldReconnect) {
        startSock()
      }
    }
  })
}

// START ON BOOT
startSock()

// ===============================
// HOME (PREVENT 502)
// ===============================
app.get("/", (req, res) => {
  res.send("✅ Snow Session Server is running")
})

// ===============================
// PAIRING UI (OPEN IN BROWSER)
// ===============================
app.get("/pair-ui", (req, res) => {
  res.send(`
    <h2>WhatsApp Phone Pairing</h2>
    <form method="POST" action="/pair">
      <input
        name="phone"
        placeholder="234XXXXXXXXXX"
        required
      />
      <button type="submit">Get Pairing Code</button>
    </form>
  `)
})

// ===============================
// PAIR WITH PHONE NUMBER (POST)
// ===============================
app.post("/pair", async (req, res) => {
  try {
    const { phone } = req.body

    if (!phone) {
      return res.send("❌ Phone number required")
    }

    if (pairingInProgress) {
      return res.send("⏳ Pairing already in progress")
    }

    pairingInProgress = true
    const code = await sock.requestPairingCode(phone)
    pairingInProgress = false

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

// ===============================
// QR ROUTE (OPTIONAL)
// ===============================
app.get("/qr", async (req, res) => {
  if (!latestQR) {
    return res.send("❌ No QR available. Restart service or use pairing.")
  }

  const qrImage = await qrcode.toDataURL(latestQR)
  res.send(`
    <h2>Scan QR Code</h2>
    <img src="${qrImage}" />
  `)
})

// ===============================
// SESSION EXPORT
// ===============================
app.get("/session", (req, res) => {
  if (!fs.existsSync(SESSION_DIR)) {
    return res.json({ error: "No session yet" })
  }

  const files = fs.readdirSync(SESSION_DIR)
  const sessionCode = Buffer.from(JSON.stringify(files)).toString("base64")

  res.json({
    session_code: sessionCode
  })
})

// ===============================
// START SERVER
// ===============================
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
