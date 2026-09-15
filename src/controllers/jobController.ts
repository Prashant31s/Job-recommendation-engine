import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../prisma/client';
import { CreateJobSchema } from '../schemas/jobSchema';
import { RecommendationQuerySchema } from '../schemas/candidateSchema';
import { getCandidateRecommendations } from '../services/recommendationService';

/** POST /jobs */
export async function createJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CreateJobSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const { requiredSkills, ...rest } = parsed.data;
    const job = await prisma.job.create({
      data: {
        ...rest,
        requiredSkills: requiredSkills as unknown as Prisma.InputJsonValue,
      },
    });

    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
}

/** GET /jobs/:id */
export async function getJob(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id } });
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    res.json(job);
  } catch (err) {
    next(err);
  }
}

/** GET /jobs */
export async function listJobs(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const jobs = await prisma.job.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
}

/** GET /jobs/:id/recommendations — best candidates for a job */
export async function getJobCandidateRecommendations(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const queryParsed = RecommendationQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      res.status(400).json({ error: 'Invalid query params', details: queryParsed.error.flatten() });
      return;
    }

    const { limit, weights } = queryParsed.data;

    let result;
    try {
      result = await getCandidateRecommendations(req.params.id, limit, weights as Record<string, number>);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('weights must sum to 100')) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    if (!result) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({
      jobId: result.job.id,
      jobTitle: result.job.title,
      weights: result.weights,
      totalMatches: result.recommendations.length,
      recommendations: result.recommendations.map((r) => ({
        candidateId: r.candidate.id,
        name: r.candidate.name,
        location: r.candidate.location,
        yearsOfExperience: r.candidate.yearsOfExperience,
        expectedSalary: r.candidate.expectedSalary,
        totalScore: r.totalScore,
        breakdown: r.breakdown,
      })),
    });
  } catch (err) {
    next(err);
  }
}
