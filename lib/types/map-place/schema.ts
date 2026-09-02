import { z } from 'zod';
import { createFilterSchema, createSimpleListInputSchema, createSortSchema } from '../trpc/schema';
import { mapPlaceFilterFields, mapPlaceSortFields } from './model';

// Filter and sort schemas
const mapPlaceFilterSchema = createFilterSchema(mapPlaceFilterFields);
const mapPlaceSortSchema = createSortSchema(mapPlaceSortFields);

// List input schema for admin
export const mapPlaceListInputSchema = createSimpleListInputSchema({
  filterSchema: mapPlaceFilterSchema,
  sortSchema: mapPlaceSortSchema,
});

// Address components schema
const addressComponentsSchema = z.object({
  street: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

// Create input schema
export const createMapPlaceInputSchema = z.object({
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  google_place_id: z.string().max(255).nullable().optional(),
  address_components: addressComponentsSchema.optional(),
  image_file_id: z.string().max(500).optional(),
});

// Update input schema
export const updateMapPlaceInputSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(255).optional(),
  address: z.string().min(1).max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  google_place_id: z.string().max(255).nullable().optional(),
  address_components: addressComponentsSchema.nullable().optional(),
  image_file_id: z.string().max(500).nullable().optional(),
});

// Search input schema
export const searchMapPlaceInputSchema = z.object({
  query: z.string().min(1).max(100),
  limit: z.number().min(1).max(50).default(10),
});
