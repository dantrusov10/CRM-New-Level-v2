import type { RecordModel } from 'pocketbase';
import type { ZodSchema } from 'zod';
import { pb } from '../pb';
import { parseMany, parseOne } from '../schemas';

export type PbListResult<T> = {
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
  items: T[];
};

function normalizeItems(input: unknown): unknown[] {
  if (!input) return [];
  if (Array.isArray(input)) return input;
  if (typeof input === 'object' && input !== null && Array.isArray((input as { items?: unknown[] }).items)) {
    return (input as { items: unknown[] }).items;
  }
  return [];
}

export async function listAllParsed<T>(
  collection: string,
  schema: ZodSchema<T>,
  options?: Record<string, unknown>,
): Promise<T[]> {
  const result = await pb.collection(collection).getFullList<RecordModel>({ ...(options ?? {}), batch: 500 });
  return parseMany(schema, normalizeItems(result));
}

export async function listPageParsed<T>(
  collection: string,
  schema: ZodSchema<T>,
  page: number,
  perPage: number,
  options?: Record<string, unknown>,
): Promise<PbListResult<T>> {
  const result = await pb.collection(collection).getList<RecordModel>(page, perPage, options ?? {});
  return {
    page: result.page,
    perPage: result.perPage,
    totalItems: result.totalItems,
    totalPages: result.totalPages,
    items: parseMany(schema, normalizeItems(result)),
  };
}

export async function getOneParsed<T>(
  collection: string,
  id: string,
  schema: ZodSchema<T>,
  options?: Record<string, unknown>,
): Promise<T> {
  const result = await pb.collection(collection).getOne<RecordModel>(id, options ?? {});
  return parseOne(schema, result);
}
