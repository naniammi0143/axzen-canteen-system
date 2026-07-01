const DEFAULT_API_VERSION = "v25.0";

async function sendWhatsAppText(to, message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.WHATSAPP_API_VERSION || DEFAULT_API_VERSION;

  if (!token) {
    throw new Error("Missing WHATSAPP_TOKEN");
  }

  if (!phoneNumberId) {
    throw new Error("Missing WHATSAPP_PHONE_NUMBER_ID");
  }

  if (!to) {
    throw new Error("Missing WhatsApp recipient number");
  }

  const cleanTo = String(to).replace(/[^\d]/g, "");
  if (!cleanTo) {
    throw new Error("Invalid WhatsApp recipient number");
  }

  const response = await fetch(
    `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanTo,
        type: "text",
        text: {
          preview_url: false,
          body: message
        }
      })
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const metaMessage = data.error?.message || data.error?.error_user_msg || response.statusText;
    throw new Error(`Meta API error ${response.status}: ${metaMessage}`);
  }

  return data;
}

module.exports = {
  sendWhatsAppText
};
