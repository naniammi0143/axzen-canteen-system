const { app, initializeApp } = require("../backend/server");

module.exports = async (req, res) => {
  await initializeApp({ scheduler: false });
  return app(req, res);
};
