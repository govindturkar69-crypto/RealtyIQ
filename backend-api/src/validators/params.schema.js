import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid identifier").transform((value) => value.toLowerCase());

export const objectIdParamSchema = z.object({ id: objectId }).strict();
