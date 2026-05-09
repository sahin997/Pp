const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys")

const pino = require("pino")
const settings = require("./settings")

async function startBot() {

  const { state, saveCreds } =
    await useMultiFileAuthState("./session")

  const { version } =
    await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }),
    auth: state,
    browser: ["Ubuntu", "Chrome", "20.0.04"]
  })

  sock.ev.on("creds.update", saveCreds)

  if (!state.creds.registered) {

    setTimeout(async () => {

      try {

        const code =
          await sock.requestPairingCode(settings.number)

        console.log("\n======================")
        console.log("PAIR CODE:")
        console.log(code)
        console.log("======================\n")

      } catch (err) {

        console.log(err)

      }

    }, 3000)
  }

  sock.ev.on("connection.update", async(update) => {

    const { connection, lastDisconnect } = update

    if(connection === "connecting") {
      console.log("Connecting...")
    }

    if(connection === "open") {
      console.log("✅ Connected")
    }

    if(connection === "close") {

      console.log("❌ Connection Closed")

      const shouldReconnect =
      lastDisconnect?.error?.output?.statusCode
      !== DisconnectReason.loggedOut

      if(shouldReconnect) {
        startBot()
      }
    }
  })
}

startBot()
