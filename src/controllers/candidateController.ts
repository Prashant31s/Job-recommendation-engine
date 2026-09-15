import { Request, Response, NextFunction } from 'express';
import prisma from '../prisma/client';
import { CreateCandidateSchema, RecommendationQuerySchema } from '../schemas/candidateSchema';
import { getJobRecommendations } from '../services/recommendationService';

/** POST /candidates */
export async function createCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parsed = CreateCandidateSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
      return;
    }

    const candidate = await prisma.candidate.create({ data: parsed.data });
    res.status(201).json(candidate);
  } catch (err) {
    next(err);
  }
}

/** GET /candidates/:id */
export async function getCandidate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidate = await prisma.candidate.findUnique({ where: { id: req.params.id } });
    if (!candidate) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }
    res.json(candidate);
  } catch (err) {
    next(err);
  }
}

/** GET /candidates/:id/recommendations */
export async function getCandidateRecommendations(
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
      result = await getJobRecommendations(req.params.id, limit, weights as Record<string, number>);
    } catch (err: unknown) {
      if (err instanceof Error && err.message.includes('weights must sum to 100')) {
        res.status(400).json({ error: err.message });
        return;
      }
      throw err;
    }

    if (!result) {
      res.status(404).json({ error: 'Candidate not found' });
      return;
    }

    res.json({
      candidateId: result.candidate.id,
      candidateName: result.candidate.name,
      weights: result.weights,
      totalMatches: result.recommendations.length,
      recommendations: result.recommendations.map((r) => ({
        jobId: r.job.id,
        title: r.job.title,
        location: r.job.location,
        remoteAllowed: r.job.remoteAllowed,
        salaryRange: { min: r.job.salaryMin, max: r.job.salaryMax },
        totalScore: r.totalScore,
        breakdown: r.breakdown,
      })),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /candidates */
export async function listCandidates(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const candidates = await prisma.candidate.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(candidates);
  } catch (err) {
    next(err);
  }
}
