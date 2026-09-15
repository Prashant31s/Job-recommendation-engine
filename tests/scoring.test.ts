import { Candidate, Job } from '@prisma/client';
import {
  scoreJob,
  rankJobsForCandidate,
  DEFAULT_WEIGHTS,
  ScoringWeights,
} from '../src/services/scoringService';

function makeCandidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: 'c1',
    name: 'Alice',
    skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
    yearsOfExperience: 5,
    location: 'New York',
    expectedSalary: 120000,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'j1',
    title: 'Senior Backend Engineer',
    requiredSkills: [
      { skill: 'TypeScript', type: 'must-have' },
      { skill: 'Node.js', type: 'must-have' },
      { skill: 'Redis', type: 'nice-to-have' },
      { skill: 'PostgreSQL', type: 'nice-to-have' },
    ],
    minYearsExperience: 5,
    location: 'New York',
    salaryMin: 110000,
    salaryMax: 140000,
    remoteAllowed: false,
    createdAt: new Date(),
    ...overrides,
  };
}

// Must-have skill filtering 

describe('Must-have skill hard filter', () => {
  it('excludes a job when candidate is missing a must-have skill', () => {
    const candidate = makeCandidate({ skills: ['TypeScript'] }); // missing Node.js
    const job = makeJob();
    const result = scoreJob(candidate, job);
    expect(result).toBeNull();
  });

  it('excludes a job when candidate has NO skills at all', () => {
    const candidate = makeCandidate({ skills: [] });
    const job = makeJob();
    expect(scoreJob(candidate, job)).toBeNull();
  });

  it('does NOT exclude when candidate has all must-have skills', () => {
    const candidate = makeCandidate({ skills: ['TypeScript', 'Node.js'] });
    const job = makeJob();
    expect(scoreJob(candidate, job)).not.toBeNull();
  });

  it('is case-insensitive for skill matching', () => {
    const candidate = makeCandidate({ skills: ['typescript', 'node.js'] });
    const job = makeJob(); // requires TypeScript, Node.js
    expect(scoreJob(candidate, job)).not.toBeNull();
  });
});

//  Skills scoring 

describe('Skills scoring', () => {
  it('awards full skills score when all must-have and nice-to-have skills match', () => {
    const candidate = makeCandidate({
      skills: ['TypeScript', 'Node.js', 'Redis', 'PostgreSQL'],
    });
    const job = makeJob();
    const result = scoreJob(candidate, job);
    expect(result).not.toBeNull();
    expect(result!.breakdown.skills.score).toBe(DEFAULT_WEIGHTS.skills); // 50
  });

  it('awards only base score when no nice-to-have skills match', () => {
    const candidate = makeCandidate({ skills: ['TypeScript', 'Node.js'] });
    const job = makeJob();
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.skills.score).toBe(30);
  });

  it('awards partial nice-to-have score for partial match', () => {
    const candidate = makeCandidate({ skills: ['TypeScript', 'Node.js', 'Redis'] });
    const job = makeJob(); // 2 nice-to-haves: Redis, PostgreSQL
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.skills.score).toBe(40);
  });

  it('awards full skills score when job has no nice-to-haves', () => {
    const job = makeJob({
      requiredSkills: [
        { skill: 'TypeScript', type: 'must-have' },
        { skill: 'Node.js', type: 'must-have' },
      ],
    });
    const candidate = makeCandidate({ skills: ['TypeScript', 'Node.js'] });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.skills.score).toBe(DEFAULT_WEIGHTS.skills); // 50
  });
});

// Experience scoring

describe('Experience scoring', () => {
  it('awards full experience score when candidate meets minimum', () => {
    const candidate = makeCandidate({ yearsOfExperience: 5 });
    const job = makeJob({ minYearsExperience: 5 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.experience.score).toBe(DEFAULT_WEIGHTS.experience); // 20
  });

  it('awards full experience score when candidate exceeds minimum', () => {
    const candidate = makeCandidate({ yearsOfExperience: 10 });
    const job = makeJob({ minYearsExperience: 5 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.experience.score).toBe(DEFAULT_WEIGHTS.experience);
  });

  it('penalizes (not excludes) when candidate is below minimum', () => {
    const candidate = makeCandidate({ yearsOfExperience: 3 });
    const job = makeJob({ minYearsExperience: 5 });
    const result = scoreJob(candidate, job)!;
    // 20 * (3/5) = 12
    expect(result.breakdown.experience.score).toBe(12);
    expect(result).not.toBeNull(); // not excluded
  });

  it('scores near 0 for heavily underqualified candidate (1yr vs 10yr)', () => {
    const candidate = makeCandidate({ yearsOfExperience: 1 });
    const job = makeJob({ minYearsExperience: 10 });
    const result = scoreJob(candidate, job)!;
    // 20 * (1/10) = 2
    expect(result.breakdown.experience.score).toBe(2);
  });

  it('awards full score when minYearsExperience is 0', () => {
    const job = makeJob({ minYearsExperience: 0 });
    const candidate = makeCandidate({ yearsOfExperience: 0 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.experience.score).toBe(DEFAULT_WEIGHTS.experience);
  });
});

//  Location scoring 

describe('Location scoring', () => {
  it('awards full location score for exact match', () => {
    const candidate = makeCandidate({ location: 'New York' });
    const job = makeJob({ location: 'New York', remoteAllowed: false });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.location.score).toBe(DEFAULT_WEIGHTS.location);
  });

  it('is case-insensitive for location matching', () => {
    const candidate = makeCandidate({ location: 'new york' });
    const job = makeJob({ location: 'New York' });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.location.score).toBe(DEFAULT_WEIGHTS.location);
  });

  it('awards partial score when remote is allowed but no location match', () => {
    const candidate = makeCandidate({ location: 'Los Angeles' });
    const job = makeJob({ location: 'New York', remoteAllowed: true });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.location.score).toBe(10);
  });

  it('awards 0 for location mismatch and not remote', () => {
    const candidate = makeCandidate({ location: 'Chicago' });
    const job = makeJob({ location: 'New York', remoteAllowed: false });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.location.score).toBe(0);
  });

  it('awards full score for exact match even if remote is also allowed', () => {
    const candidate = makeCandidate({ location: 'New York' });
    const job = makeJob({ location: 'New York', remoteAllowed: true });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.location.score).toBe(DEFAULT_WEIGHTS.location);
  });
});

//  Salary scoring 

describe('Salary scoring', () => {
  it('awards full salary score when expected is within range', () => {
    const candidate = makeCandidate({ expectedSalary: 125000 });
    const job = makeJob({ salaryMin: 110000, salaryMax: 140000 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.salary.score).toBe(DEFAULT_WEIGHTS.salary);
  });

  it('awards full score when candidate expects less than salaryMin (job pays more)', () => {
    const candidate = makeCandidate({ expectedSalary: 80000 });
    const job = makeJob({ salaryMin: 100000, salaryMax: 130000 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.salary.score).toBe(DEFAULT_WEIGHTS.salary);
  });

  it('scores near zero when job max is well below expectation', () => {
    const candidate = makeCandidate({ expectedSalary: 200000 });
    const job = makeJob({ salaryMin: 50000, salaryMax: 80000 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.salary.score).toBe(6);
  });

  it('scores zero on salary dimension when job max is 0 (edge case)', () => {
    const candidate = makeCandidate({ expectedSalary: 100000 });
    const job = makeJob({ salaryMin: 0, salaryMax: 0 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.salary.score).toBe(0);
  });

  it('scores exactly at boundary: expected === salaryMax → full score', () => {
    const candidate = makeCandidate({ expectedSalary: 140000 });
    const job = makeJob({ salaryMin: 110000, salaryMax: 140000 });
    const result = scoreJob(candidate, job)!;
    expect(result.breakdown.salary.score).toBe(DEFAULT_WEIGHTS.salary);
  });
});

//  Total score 

describe('Total score', () => {
  it('returns 100 for a perfect match', () => {
    const candidate = makeCandidate({
      skills: ['TypeScript', 'Node.js', 'Redis', 'PostgreSQL'],
      yearsOfExperience: 5,
      location: 'New York',
      expectedSalary: 120000,
    });
    const job = makeJob({
      requiredSkills: [
        { skill: 'TypeScript', type: 'must-have' },
        { skill: 'Node.js', type: 'must-have' },
        { skill: 'Redis', type: 'nice-to-have' },
        { skill: 'PostgreSQL', type: 'nice-to-have' },
      ],
      minYearsExperience: 5,
      location: 'New York',
      salaryMin: 110000,
      salaryMax: 140000,
      remoteAllowed: false,
    });
    const result = scoreJob(candidate, job)!;
    expect(result.totalScore).toBe(100);
  });

  it('total score equals sum of all dimension scores', () => {
    const candidate = makeCandidate();
    const job = makeJob();
    const result = scoreJob(candidate, job)!;
    const { skills, experience, location, salary } = result.breakdown;
    expect(result.totalScore).toBe(
      skills.score + experience.score + location.score + salary.score,
    );
  });
});

//  Configurable weights 

describe('Configurable weights', () => {
  it('respects custom weights summing to 100', () => {
    const customWeights: ScoringWeights = { skills: 60, experience: 15, location: 10, salary: 15 };
    const candidate = makeCandidate({
      skills: ['TypeScript', 'Node.js', 'Redis', 'PostgreSQL'],
    });
    const job = makeJob();
    const result = scoreJob(candidate, job, customWeights)!;
    expect(result.breakdown.skills.max).toBe(60);
    expect(result.breakdown.experience.max).toBe(15);
    expect(result.breakdown.location.max).toBe(10);
    expect(result.breakdown.salary.max).toBe(15);
  });
});

// Ranking    

describe('rankJobsForCandidate', () => {
  it('sorts jobs descending by totalScore', () => {
    const candidate = makeCandidate({
      skills: ['TypeScript', 'Node.js'],
      location: 'New York',
      expectedSalary: 120000,
      yearsOfExperience: 5,
    });

    const perfectJob = makeJob({ id: 'j-perfect', location: 'New York' });
    const remoteJob = makeJob({ id: 'j-remote', location: 'San Francisco', remoteAllowed: true });
    const poorJob = makeJob({ id: 'j-poor', location: 'London', remoteAllowed: false });

    const ranked = rankJobsForCandidate(candidate, [poorJob, remoteJob, perfectJob]);
    expect(ranked[0].job.id).toBe('j-perfect');
    expect(ranked[1].job.id).toBe('j-remote');
    expect(ranked[2].job.id).toBe('j-poor');
  });

  it('excludes jobs where candidate is missing must-have skills', () => {
    const candidate = makeCandidate({ skills: ['TypeScript'] });
    const jobs = [makeJob({ id: 'j1' }), makeJob({ id: 'j2' })];
    const ranked = rankJobsForCandidate(candidate, jobs);
    expect(ranked).toHaveLength(0);
  });

  it('respects the limit parameter', () => {
    const candidate = makeCandidate({
      skills: ['TypeScript', 'Node.js', 'Redis', 'PostgreSQL'],
    });
    const jobs = [makeJob({ id: 'j1' }), makeJob({ id: 'j2' }), makeJob({ id: 'j3' })];
    const ranked = rankJobsForCandidate(candidate, jobs, DEFAULT_WEIGHTS, 2);
    expect(ranked).toHaveLength(2);
  });
});
