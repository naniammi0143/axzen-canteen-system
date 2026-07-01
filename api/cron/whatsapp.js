const { initializeApp, checkScheduledWhatsAppReport } = require("../../backend/server");

module.exports = async (req, res) => {
  await initializeApp({ scheduler: false });
  const result = await checkScheduledWhatsAppReport();
  res.status(200).json(result);
};
