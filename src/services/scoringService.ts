import { Candidate, Job } from '@prisma/client';
import { RequiredSkill } from '../schemas/jobSchema';

export interface ScoringWeights {
  skills: number;      // default 50
  experience: number;  // default 20
  location: number;    // default 15
  salary: number;      // default 15
}

export interface ScoreBreakdown {
  skills: { score: number; max: number };
  experience: { score: number; max: number };
  location: { score: number; max: number };
  salary: { score: number; max: number };
}

export interface JobScore {
  job: Job;
  totalScore: number;      // 0–100
  breakdown: ScoreBreakdown;
}

// Default weights

export const DEFAULT_WEIGHTS: ScoringWeights = {
  skills: 50,
  experience: 20,
  location: 15,
  salary: 15,
};


/** Normalise a string for comparison: lowercase + trim */
function normalise(s: string): string {
  return s.toLowerCase().trim();
}

function parseRequiredSkills(raw: unknown): RequiredSkill[] {
  if (!Array.isArray(raw)) return [];
  return raw as RequiredSkill[];
}


/**
 * Skills score (0 – weights.skills)
 *
 * Hard filter: if the candidate is missing ANY must-have skill → returns null
 * (the job must be excluded from results entirely).
 *
 * Base points  = 60% of the weight (must-haves all present).
 * Nice-to-have = remaining 40% split evenly across nice-to-have skills,
 *                 awarded per matched skill.
 *
 * Example (weight = 50):
 *   base = 30 pts (must-haves OK)
 *   nice-to-have pool = 20 pts / total_nice_to_have skills
 */
function scoreSkills(
  candidateSkills: string[],
  requiredSkills: RequiredSkill[],
  maxPoints: number,
): number | null {
  const candidateSet = new Set(candidateSkills.map(normalise));

  const mustHaves = requiredSkills.filter((s) => s.type === 'must-have');
  const niceToHaves = requiredSkills.filter((s) => s.type === 'nice-to-have');

  // Hard filter — missing any must-have skill → exclude job
  for (const req of mustHaves) {
    if (!candidateSet.has(normalise(req.skill))) {
      return null;
    }
  }

  // Base score for having all must-haves (60% of maxPoints)
  const basePoints = mustHaves.length > 0 ? maxPoints * 0.6 : maxPoints * 0.6;

  // Nice-to-have boost (40% of maxPoints)
  let niceScore = 0;
  if (niceToHaves.length > 0) {
    const pointPerSkill = (maxPoints * 0.4) / niceToHaves.length;
    for (const req of niceToHaves) {
      if (candidateSet.has(normalise(req.skill))) {
        niceScore += pointPerSkill;
      }
    }
  } else {
    // No nice-to-haves → award the full nice-to-have pool as bonus
    niceScore = maxPoints * 0.4;
  }

  return Math.round(basePoints + niceScore);
}

/**
 * Experience score (0 – weights.experience)
 *
 * Meet or exceed → full points.
 * Below → linear penalty: score = max * (candidate / required).
 *
 * Design decision: We penalise rather than exclude so that a candidate
 * who is 1 year short of a 5-year requirement still sees the job and
 * can make an informed decision. Strict exclusion creates invisible
 * dead-zones; the formula surfaces the trade-off transparently.
 */
function scoreExperience(
  candidateYears: number,
  minYears: number,
  maxPoints: number,
): number {
  if (minYears === 0) return maxPoints; // no minimum → full score

  if (candidateYears >= minYears) {
    return maxPoints;
  }

  // Linear penalty — never goes negative
  const ratio = candidateYears / minYears;
  return Math.round(maxPoints * ratio);
}

/**
 * Location score (0 – weights.location)
 *
 * Exact match            → 100% of maxPoints
 * Remote allowed, no match → 67% of maxPoints  (≈ good but not ideal)
 * No match, not remote   → 0
 */
function scoreLocation(
  candidateLocation: string,
  jobLocation: string,
  remoteAllowed: boolean,
  maxPoints: number,
): number {
  if (normalise(candidateLocation) === normalise(jobLocation)) {
    return maxPoints;
  }
  if (remoteAllowed) {
    return Math.round(maxPoints * (2 / 3));
  }
  return 0;
}

/**
 * Salary score (0 – weights.salary)
 *
 * expected ≤ salaryMax (job can pay candidate):
 *   - expected is within range [min, max] → full points
 *   - expected < min (job pays more than expected) → full points (candidate wins)
 *
 * expected > salaryMax (job cannot meet expectation):
 *   - Score = maxPoints * (salaryMax / expected)
 *   - As gap widens the score approaches 0
 *
 * Design: we don't hard-filter on salary because salary is often negotiable,
 * but a job whose ceiling is well below expectation should rank very low.
 */
function scoreSalary(
  expectedSalary: number,
  salaryMin: number,
  salaryMax: number,
  maxPoints: number,
): number {
  // Job can comfortably pay the candidate (or pays more)
  if (expectedSalary <= salaryMax) {
    return maxPoints;
  }

  // Job's max is below the candidate's expectation
  const ratio = salaryMax / expectedSalary;
  return Math.round(maxPoints * ratio);
}


/**
 * Score a single job against a candidate.
 * Returns null if the job is hard-filtered out (missing must-have skill).
 */
export function scoreJob(
  candidate: Candidate,
  job: Job,
  weights: ScoringWeights = DEFAULT_WEIGHTS,
): JobScore | null {
  const requiredSkills = parseRequiredSkills(job.requiredSkills);

  // Skills — may return null (hard filter)
  const skillScore = scoreSkills(candidate.skills, requiredSkills, weights.skills);
  if (skillScore === null) return null; // exclude

  const experienceScore = scoreExperience(
    candidate.yearsOfExperience,
    job.minYearsExperience,
    weights.experience,
  );

  const locationScore = scoreLocation(
    candidate.location,
    job.location,
    job.remoteAllowed,
    weights.location,
  );

  const salaryScore = scoreSalary(
    candidate.expectedSalary,
    job.salaryMin,
    job.salaryMax,
    weights.salary,
  );

  const totalScore = skillScore + experienceScore + locationScore + salaryScore;

  return {
    job,
    totalScore,
    breakdown: {
      skills: { score: skillScore, max: weights.skills },
      experience: { score: experienceScore, max: weights.experience },
      location: { score: locationScore, max: weights.location },
      salary: { score: salaryScore, max: weights.salary },
    },
  };
}

/**
 * Score and rank all jobs for a candidate.
 * Jobs missing must-have skills are excluded.
 * Results are sorted descending by totalScore.
 */
export function rankJobsForCandidate(
  candidate: Candidate,
  jobs: Job[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  limit?: number,
): JobScore[] {
  const scored = jobs
    .map((job) => scoreJob(candidate, job, weights))
    .filter((s): s is JobScore => s !== null)
    .sort((a, b) => b.totalScore - a.totalScore);

  return limit ? scored.slice(0, limit) : scored;
}

/**
 * Score and rank all candidates for a job (reverse view).
 * Candidates missing must-have skills are excluded.
 */
export function rankCandidatesForJob(
  job: Job,
  candidates: Candidate[],
  weights: ScoringWeights = DEFAULT_WEIGHTS,
  limit?: number,
): Array<{ candidate: Candidate; totalScore: number; breakdown: ScoreBreakdown }> {
  const requiredSkills = parseRequiredSkills(job.requiredSkills);

  const scored = candidates
    .map((candidate) => {
      const skillScore = scoreSkills(candidate.skills, requiredSkills, weights.skills);
      if (skillScore === null) return null;

      const experienceScore = scoreExperience(
        candidate.yearsOfExperience,
        job.minYearsExperience,
        weights.experience,
      );

      const locationScore = scoreLocation(
        candidate.location,
        job.location,
        job.remoteAllowed,
        weights.location,
      );

      const salaryScore = scoreSalary(
        candidate.expectedSalary,
        job.salaryMin,
        job.salaryMax,
        weights.salary,
      );

      const totalScore = skillScore + experienceScore + locationScore + salaryScore;

      return {
        candidate,
        totalScore,
        breakdown: {
          skills: { score: skillScore, max: weights.skills },
          experience: { score: experienceScore, max: weights.experience },
          location: { score: locationScore, max: weights.location },
          salary: { score: salaryScore, max: weights.salary },
        },
      };
    })
    .filter(
      (s): s is { candidate: Candidate; totalScore: number; breakdown: ScoreBreakdown } =>
        s !== null,
    )
    .sort((a, b) => b.totalScore - a.totalScore);

  return limit ? scored.slice(0, limit) : scored;
}
