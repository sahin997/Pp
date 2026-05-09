const express = require("express")
const path = require("path")
const pino = require("pino")
const fs = require("fs")
const archiver = require("archiver")
const axios = require("axios")
const FormData = require("form-data")
const multer = require("multer")

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const app = express()

app.use(express.json())
app.use(express.static(path.join(__dirname, "public")))

const upload = multer({
  dest: "uploads/"
})

let latestCode = "Waiting..."
let connected = false
let sock

// 🔥 CONFIG
const SESSION_DIR = "./session"

// 🔥 YOUR MAIN BOT URL
const UPLOAD_URL =
"https://pp-ljzg.onrender.com/upload-auth"

// 🔥 SECRET KEY
const SECRET_KEY =
"FOXY_PRIVATE_KEY"

// ================================
// 🔥 UPLOAD SESSION
// ================================
async function uploadSession() {

  return new Promise(async(resolve, reject) => {

    try {

      // delete old zip
      if(fs.existsSync("./session.zip")) {
        fs.unlinkSync("./session.zip")
      }

      const output =
      fs.createWriteStream("./session.zip")

      const archive = archiver("zip", {
        zlib: { level: 9 }
      })

      archive.pipe(output)

      archive.directory(
        SESSION_DIR,
        false
      )

      await archive.finalize()

      output.on("close", async() => {

        try {

          const form = new FormData()

          form.append(
            "file",
            fs.createReadStream("./session.zip")
          )

          await axios.post(
            UPLOAD_URL,
            form,
            {
              headers: {
                ...form.getHeaders(),
                "x-secret-key":
                SECRET_KEY
              }
            }
          )

          console.log(
            "✅ Session Uploaded"
          )

          resolve(true)

        } catch(e) {

          console.log(
            "UPLOAD ERROR:",
            e.toString()
          )

          reject(e)
        }
      })

    } catch(e) {

      reject(e)

    }

  })
}

// ================================
// 🔥 START BOT
// ================================
async function startBot(number) {

  try {

    // close old socket
    if(sock) {

      try {
        sock.ws.close()
      } catch {}

    }

    const {
      state,
      saveCreds
    } =
    await useMultiFileAuthState(
      SESSION_DIR
    )

    const { version } =
    await fetchLatestBaileysVersion()

    sock = makeWASocket({
      version,
      logger: pino({
        level: "silent"
      }),
      auth: state,
      browser: [
        "Ubuntu",
        "Chrome",
        "20.0.04"
      ]
    })

    sock.ev.on(
      "creds.update",
      saveCreds
    )

    // already connected
    if(state.creds.registered) {

      connected = true

      console.log(
        "✅ Existing Session Found"
      )

    }

    // generate pair code
    if (!state.creds.registered) {

      setTimeout(async () => {

        try {

          const code =
          await sock.requestPairingCode(
            number
          )

          latestCode = code

          console.log(
            "PAIR CODE:",
            code
          )

        } catch (err) {

          console.log(err)

        }

      }, 3000)
    }

    // connection update
    sock.ev.on(
      "connection.update",
      async(update) => {

      const {
        connection,
        lastDisconnect
      } = update

      // connecting
      if(connection === "connecting") {

        console.log(
          "Connecting..."
        )

      }

      // connected
      if(connection === "open") {

        connected = true

        console.log(
          "✅ Connected"
        )

        // upload session
        await uploadSession()

      }

      // disconnected
      if(connection === "close") {

        connected = false

        console.log(
          "❌ Connection Closed"
        )

        const shouldReconnect =
        lastDisconnect?.error
        ?.output?.statusCode
        !== DisconnectReason.loggedOut

        if(shouldReconnect) {

          console.log(
            "♻️ Reconnecting..."
          )

          startBot(number)

        }
      }
    })

  } catch(e) {

    console.log(
      "START ERROR:",
      e.toString()
    )

  }
}

// ================================
// 🔥 PAIR API
// ================================
app.post("/pair", async(req, res) => {

  try {

    const number =
    req.body.number

    if(!number) {

      return res.json({
        status: false,
        msg: "Number Required"
      })
    }

    latestCode = "Generating..."

    await startBot(number)

    res.json({
      status: true
    })

  } catch(e) {

    res.json({
      status: false,
      error: e.toString()
    })
  }
})

// ================================
// 🔥 UPLOAD AUTH ROUTE
// ================================
app.post(
  "/upload-auth",
  upload.single("file"),
  async(req, res) => {

    try {

      const key =
      req.headers["x-secret-key"]

      if(key !== SECRET_KEY) {

        return res.status(403).json({
          status: false,
          msg: "Invalid Secret Key"
        })
      }

      if(!req.file) {

        return res.status(400).json({
          status: false,
          msg: "No File Uploaded"
        })
      }

      // save zip
      fs.copyFileSync(
        req.file.path,
        "./session.zip"
      )

      console.log(
        "✅ Session ZIP Received"
      )

      return res.json({
        status: true,
        msg: "Session Uploaded"
      })

    } catch(e) {

      console.log(e)

      return res.status(500).json({
        status: false,
        error: e.toString()
      })
    }
})

// ================================
// 🔥 GET CODE API
// ================================
app.get("/code", (req, res) => {

  res.json({
    code: latestCode,
    connected
  })
})

// ================================
// 🔥 SERVER START
// ================================
const PORT =
process.env.PORT || 3000

app.listen(PORT, () => {

  console.log(
    "✅ Server Running:",
    PORT
  )

})
