import { z } from 'zod';

export const CreateCandidateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  skills: z
    .array(z.string().min(1))
    .min(1, 'At least one skill is required'),
  yearsOfExperience: z
    .number()
    .int()
    .min(0, 'Years of experience must be non-negative'),
  location: z.string().min(1, 'Location is required'),
  expectedSalary: z
    .number()
    .int()
    .positive('Expected salary must be a positive number'),
});

export type CreateCandidateInput = z.infer<typeof CreateCandidateSchema>;

export const RecommendationQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().min(1).max(100)),
  weights: z
    .object({
      skills: z.string().optional().transform(Number),
      experience: z.string().optional().transform(Number),
      location: z.string().optional().transform(Number),
      salary: z.string().optional().transform(Number),
    })
    .optional(),
});

export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;
