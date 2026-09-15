import { z } from 'zod';

const RequiredSkillSchema = z.object({
  skill: z.string().min(1, 'Skill name is required'),
  type: z.enum(['must-have', 'nice-to-have']),
});

export const CreateJobSchema = z.object({
  title: z.string().min(1, 'Job title is required'),
  requiredSkills: z
    .array(RequiredSkillSchema)
    .min(1, 'At least one required skill must be specified'),
  minYearsExperience: z
    .number()
    .int()
    .min(0, 'Minimum years of experience must be non-negative'),
  location: z.string().min(1, 'Location is required'),
  salaryMin: z.number().int().positive('Minimum salary must be positive'),
  salaryMax: z.number().int().positive('Maximum salary must be positive'),
  remoteAllowed: z.boolean().default(false),
}).refine(
  (data) => data.salaryMax >= data.salaryMin,
  {
    message: 'salaryMax must be greater than or equal to salaryMin',
    path: ['salaryMax'],
  }
);

export type CreateJobInput = z.infer<typeof CreateJobSchema>;
export type RequiredSkill = z.infer<typeof RequiredSkillSchema>;
