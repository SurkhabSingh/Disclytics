function validate(schema, selector = (req) => req.body) {
  return function validateRequest(req, res, next) {
    try {
      req.validated = schema.parse(selector(req));
      return next();
    } catch (error) {
      return next(error);
    }
  };
}

module.exports = { validate };
