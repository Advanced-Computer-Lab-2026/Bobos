export const apiErrorHandler = (error, _req, res, _next) => {
  const status = error.type === "entity.parse.failed" ? 400
    : error.type === "entity.too.large" ? 413 : 500;
  const message = status === 400 ? "Request body must contain valid JSON."
    : status === 413 ? "Request body is too large." : "Internal server error.";
  return res.status(status).json({ success: false, message });
};
