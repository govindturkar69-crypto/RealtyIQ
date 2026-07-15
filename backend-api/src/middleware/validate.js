import { ApiError } from "../utils/ApiError.js";

export const validate = (schema, source = "body") => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
    return next(ApiError.badRequest("Validation failed", details));
  }
  req[source] = result.data;
  next();
};
