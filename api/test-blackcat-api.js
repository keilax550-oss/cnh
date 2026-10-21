const { handler } = require("../functions/test-blackcat-api");

module.exports = async (req, res) => {
  const event = {
    httpMethod: req.method,
    queryStringParameters: req.query || {},
    headers: req.headers || {},
    body: req.body ? (typeof req.body === "string" ? req.body : JSON.stringify(req.body)) : null,
  };
  const result = await handler(event);
  Object.entries(result.headers || {}).forEach(([k, v]) => res.setHeader(k, v));
  res.status(result.statusCode).send(result.body);
};
