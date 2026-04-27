export const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: {
      message: `Route not found: ${req.method} ${req.originalUrl}`,
    },
  });
};

export const errorHandler = (error, _req, res, _next) => {
  const status = error.status || 500;

  res.status(status).json({
    error: {
      message: error.message || "Internal server error",
      details: error.details,
    },
  });
};
