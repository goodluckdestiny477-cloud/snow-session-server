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
const SESSION_DIR = "./auth"

let sock
let pairingInProgress = false

// 🔹 Start WhatsApp socket
async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)

  sock = makeWASocket({
    logger: P({ level: "silent" }),
    auth: state,
    printQRInTerminal: false
  })

  sock.ev.on("creds.update", saveCreds)

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update

    if (connection === "open") {
      console.log("✅ WhatsApp Connected")
    }

    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut

      if (shouldReconnect) startSock()
    }
  })
}

startSock()

// 🔹 QR CODE ENDPOINT
app.get("/qr", async (req, res) => {
  if (!sock) return res.send("Socket not ready")

  sock.ev.once("connection.update", async (update) => {
    if (update.qr) {
      const qrImage = await qrcode.toDataURL(update.qr)
      res.send(`
        <h2>Scan QR Code</h2>
        <img src="${qrImage}" />
      `)
    }
  })
})

// 🔹 PHONE NUMBER PAIRING
app.post("/pair", async (req, res) => {
  try {
    const { phone } = req.body
    if (!phone) return res.json({ error: "Phone number required" })

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

// 🔹 SESSION CODE GENERATOR
app.get("/session", (req, res) => {
  if (!fs.existsSync(SESSION_DIR)) {
    return res.json({ error: "No session yet" })
  }

  const data = Buffer.from(
    JSON.stringify(fs.readdirSync(SESSION_DIR))
  ).toString("base64")

  res.json({
    session_code: data
  })
})

app.listen(PORT, () => {
  console.log("🚀 Session server running on port", PORT)
})
