import express from "express"
import axios from "axios"
import dotenv from "dotenv"
import TelegramBot from "node-telegram-bot-api"
import fs from "fs"

dotenv.config()

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 3000
const BOT_TOKEN = process.env.BOT_TOKEN

// Render uses polling fine, webhook optional
const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
})

const NAME_API =
  "https://abbas-apis.vercel.app/api/num-name?number="

const INFO_API =
  "https://phoneintelligence.abstractapi.com/v1/?api_key=" +
  process.env.API_KEY +
  "&phone="

// Database
function loadDB() {
  if (!fs.existsSync("database.json")) {
    fs.writeFileSync("database.json", "{}")
  }
  return JSON.parse(fs.readFileSync("database.json", "utf-8"))
}

function saveDB(db) {
  fs.writeFileSync("database.json", JSON.stringify(db, null, 2))
}

// Start command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
`👋 Hello ${msg.from.first_name}

Send phone number in international format

Example:
+919876543210`
  )
})

// Lookup
bot.on("message", async (msg) => {

  if (!msg.text) return
  if (msg.text.startsWith("/start")) return

  const chatId = msg.chat.id
  const number = msg.text.replace(/\D/g, "")

  if (number.length < 10) {
    bot.sendMessage(chatId, "❌ Invalid number")
    return
  }

  try {

    const [nameRes, infoRes] =
      await Promise.all([
        axios.get(NAME_API + number),
        axios.get(INFO_API + number)
      ])

    const name =
      nameRes.data?.data?.name ||
      "Not Found"

    const carrier =
      infoRes.data?.carrier?.name ||
      infoRes.data?.carrier ||
      "Unknown"

    const location =
      infoRes.data?.location ||
      infoRes.data?.registered_location ||
      infoRes.data?.region ||
      "Unknown"

    const country =
      infoRes.data?.country?.name ||
      infoRes.data?.country_name ||
      infoRes.data?.country ||
      "Unknown"

    let db = loadDB()

    if (!db[number])
      db[number] = []

    if (
      name !== "Not Found" &&
      !db[number].includes(name)
    ) {
      db[number].push(name)
      saveDB(db)
    }

    let communityNames = db[number]

    if (communityNames.length === 0)
      communityNames = ["No reports"]

    const communityText =
      communityNames
        .map((n, i) =>
          i === communityNames.length - 1
            ? `└ ${n}`
            : `├ ${n}`
        )
        .join("\n")

    const result =
`
╭─── Truecaller Lookup ───╮

📱 Number: +${number}
🌍 Country: ${country}

🔎 TrueCaller Says:
Name: ${name}
Carrier: ${carrier}
Location: ${location}

🔎 Community Reports:
${communityText}

╰────────────────────────╯
`

    bot.sendMessage(chatId, result, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "💬 WhatsApp",
              url: `https://wa.me/${number}`
            },
            {
              text: "📨 Telegram",
              url: `https://t.me/+${number}`
            }
          ]
        ]
      }
    })

  } catch (error) {

    console.log(error.response?.data || error.message)

    bot.sendMessage(chatId, "❌ Lookup failed")

  }

})

// health check
app.get("/", (req, res) => {
  res.send("Bot is running on Render 🚀")
})

app.listen(PORT, () => {
  console.log("Server running on port", PORT)
})
