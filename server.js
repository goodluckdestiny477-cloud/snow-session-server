const express = require("express")
const {
  default: makeWASocket,
  useMultiFileAuthState
} = require("@whiskeysockets/baileys")
const P = require("pino")
const QRCode = require("qrcode")
const { v4: uuidv4 } = require("uuid")
const fs = require("fs")

const app = express()
app.use(express.json())

/* =========================
   QR PAIRING
========================= */
app.get("/pair/qr", async (req, res) => {
  const sessionId = uuidv4()
  const sessionPath = `./sessions/${sessionId}`
  fs.mkdirSync(sessionPath, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  sock.ev.on("connection.update", async (update) => {
    if (update.qr) {
      const qr = await QRCode.toDataURL(update.qr)
      res.json({
        success: true,
        type: "qr",
        sessionId,
        qr
      })
    }
  })

  sock.ev.on("creds.update", saveCreds)
})

/* =========================
   PHONE NUMBER PAIRING
========================= */
app.post("/pair/number", async (req, res) => {
  const { number } = req.body
  if (!number) return res.json({ success: false, error: "Number required" })

  const sessionId = uuidv4()
  const sessionPath = `./sessions/${sessionId}`
  fs.mkdirSync(sessionPath, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath)

  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" })
  })

  const code = await sock.requestPairingCode(number)

  sock.ev.on("creds.update", saveCreds)

  res.json({
    success: true,
    type: "number",
    pairingCode: code,
    sessionId
  })
})

/* ========================= */

app.get("/", (_, res) => {
  res.send("❄️ Snow Session Server is Running")
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () =>
  console.log("Snow session server running on", PORT)
)
