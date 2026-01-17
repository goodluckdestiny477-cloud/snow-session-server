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
app.use(express.json())

const PORT = process.env.PORT || 3000
const SESSION_DIR = path.join(__dirname, "auth")

let sock
let pairingInProgress = false
let latestQR = null

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

      if (shouldReconnect) startSock()
    }
  })
}

// START SOCKET
startSock()

// ===============================
// HOME ROUTE (FIXES 502)
// ===============================
app.get("/", (req, res) => {
  res.send("✅ Snow Session Server is running")
})

// ===============================
// QR CODE ROUTE
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
// PHONE NUMBER PAIRING
// ===============================
app.post("/pair", async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) {
      return res.json({ error: "Phone number required" })
    }

    if (pairingInProgress) {
      return res.json({ error: "Pairing already in progress" })
    }

    pairingInProgress = true
    const code = await sock.requestPairingCode(phone)
    pairingInProgress = false

    res.json({
      success: true,
      pairingCode: code
    })
  } catch (err) {
    pairingInProgress = false
    res.json({ error: err.message })
  }
})

// ===============================
// SESSION CODE GENERATOR
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
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})
