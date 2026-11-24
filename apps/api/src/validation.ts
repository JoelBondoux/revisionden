import { IdSchema } from '@revisionden/core';

/** True when the value is a valid id (uuid); anything else is treated as not found. */
export const isId = (value: string) => IdSchema.safeParse(value).success;
