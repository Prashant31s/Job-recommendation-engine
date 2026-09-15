import prisma from '../prisma/client';
import {
  rankJobsForCandidate,
  rankCandidatesForJob,
  DEFAULT_WEIGHTS,
  ScoringWeights,
} from './scoringService';

/**
 * Validate and merge user-supplied weights with defaults.
 * If any dimension is overridden, all four must be provided and must sum to 100.
 */
export function resolveWeights(raw?: Partial<Record<string, number>>): ScoringWeights {
  if (!raw || Object.keys(raw).length === 0) {
    return DEFAULT_WEIGHTS;
  }

  const skills = raw.skills ?? DEFAULT_WEIGHTS.skills;
  const experience = raw.experience ?? DEFAULT_WEIGHTS.experience;
  const location = raw.location ?? DEFAULT_WEIGHTS.location;
  const salary = raw.salary ?? DEFAULT_WEIGHTS.salary;

  const total = skills + experience + location + salary;
  if (Math.abs(total - 100) > 0.01) {
    throw new Error(
      `Custom weights must sum to 100 (got ${total}). Provide all four: skills, experience, location, salary.`,
    );
  }

  return { skills, experience, location, salary };
}

/** Get ranked jobs for a candidate */
export async function getJobRecommendations(
  candidateId: string,
  limit: number = 10,
  weights?: Partial<Record<string, number>>,
) {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate) return null;

  const jobs = await prisma.job.findMany();
  const resolvedWeights = resolveWeights(weights);

  return {
    candidate,
    weights: resolvedWeights,
    recommendations: rankJobsForCandidate(candidate, jobs, resolvedWeights, limit),
  };
}

/** Get ranked candidates for a job */
export async function getCandidateRecommendations(
  jobId: string,
  limit: number = 10,
  weights?: Partial<Record<string, number>>,
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return null;

  const candidates = await prisma.candidate.findMany();
  const resolvedWeights = resolveWeights(weights);

  return {
    job,
    weights: resolvedWeights,
    recommendations: rankCandidatesForJob(job, candidates, resolvedWeights, limit),
  };
}
