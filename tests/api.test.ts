import request from 'supertest';
import app from '../src/app';
import prisma from '../src/prisma/client';


beforeEach(async () => {
  // Clean up in correct order (no FK constraints, but good practice)
  await prisma.job.deleteMany();
  await prisma.candidate.deleteMany();
});

afterAll(async () => {
  await prisma.job.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.$disconnect();
});


const candidatePayload = {
  name: 'Alice Chen',
  skills: ['TypeScript', 'Node.js', 'PostgreSQL'],
  yearsOfExperience: 5,
  location: 'New York',
  expectedSalary: 120000,
};

const jobPayload = {
  title: 'Senior Backend Engineer',
  requiredSkills: [
    { skill: 'TypeScript', type: 'must-have' },
    { skill: 'Node.js', type: 'must-have' },
    { skill: 'Redis', type: 'nice-to-have' },
  ],
  minYearsExperience: 4,
  location: 'New York',
  salaryMin: 100000,
  salaryMax: 140000,
  remoteAllowed: false,
};

// POST /candidates

describe('POST /candidates', () => {
  it('creates a candidate and returns 201', async () => {
    const res = await request(app).post('/candidates').send(candidatePayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Alice Chen');
    expect(res.body.skills).toEqual(['TypeScript', 'Node.js', 'PostgreSQL']);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request(app).post('/candidates').send({ name: 'Bob' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('returns 400 for negative experience', async () => {
    const res = await request(app)
      .post('/candidates')
      .send({ ...candidatePayload, yearsOfExperience: -1 });
    expect(res.status).toBe(400);
  });
});

// POST /jobs 

describe('POST /jobs', () => {
  it('creates a job and returns 201', async () => {
    const res = await request(app).post('/jobs').send(jobPayload);
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Senior Backend Engineer');
  });

  it('returns 400 when salaryMax < salaryMin', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({ ...jobPayload, salaryMin: 150000, salaryMax: 100000 });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid skill type', async () => {
    const res = await request(app)
      .post('/jobs')
      .send({
        ...jobPayload,
        requiredSkills: [{ skill: 'Python', type: 'optional' }],
      });
    expect(res.status).toBe(400);
  });
});

//  GET /candidates/:id/recommendations  

describe('GET /candidates/:id/recommendations', () => {
  it('returns ranked job list with score breakdown', async () => {
    const candidateRes = await request(app).post('/candidates').send(candidatePayload);
    await request(app).post('/jobs').send(jobPayload);

    const recRes = await request(app).get(
      `/candidates/${candidateRes.body.id}/recommendations`,
    );

    expect(recRes.status).toBe(200);
    expect(recRes.body.recommendations).toBeInstanceOf(Array);
    expect(recRes.body.recommendations.length).toBeGreaterThan(0);

    const first = recRes.body.recommendations[0];
    expect(first.totalScore).toBeDefined();
    expect(first.breakdown.skills).toBeDefined();
    expect(first.breakdown.experience).toBeDefined();
    expect(first.breakdown.location).toBeDefined();
    expect(first.breakdown.salary).toBeDefined();
  });

  it('respects the limit query param', async () => {
    const candidateRes = await request(app).post('/candidates').send(candidatePayload);
    // Create 3 jobs
    for (let i = 0; i < 3; i++) {
      await request(app).post('/jobs').send({ ...jobPayload, title: `Job ${i}` });
    }

    const recRes = await request(app).get(
      `/candidates/${candidateRes.body.id}/recommendations?limit=2`,
    );

    expect(recRes.status).toBe(200);
    expect(recRes.body.recommendations.length).toBeLessThanOrEqual(2);
  });

  it('excludes jobs where candidate is missing a must-have skill', async () => {
    const noSkillCandidate = await request(app)
      .post('/candidates')
      .send({ ...candidatePayload, skills: ['Python'] }); // missing TypeScript & Node.js

    await request(app).post('/jobs').send(jobPayload);

    const recRes = await request(app).get(
      `/candidates/${noSkillCandidate.body.id}/recommendations`,
    );

    expect(recRes.status).toBe(200);
    expect(recRes.body.recommendations).toHaveLength(0);
  });

  it('returns 404 for unknown candidate', async () => {
    const res = await request(app).get('/candidates/nonexistent-id/recommendations');
    expect(res.status).toBe(404);
  });

  it('returns 400 when custom weights do not sum to 100', async () => {
    const candidateRes = await request(app).post('/candidates').send(candidatePayload);
    const res = await request(app).get(
      `/candidates/${candidateRes.body.id}/recommendations?weights[skills]=50&weights[experience]=10&weights[location]=10&weights[salary]=10`,
    );
    expect(res.status).toBe(400);
  });
});

//  GET /jobs/:id/recommendations 

describe('GET /jobs/:id/recommendations', () => {
  it('returns ranked candidates for a job', async () => {
    await request(app).post('/candidates').send(candidatePayload);
    const jobRes = await request(app).post('/jobs').send(jobPayload);

    const recRes = await request(app).get(`/jobs/${jobRes.body.id}/recommendations`);

    expect(recRes.status).toBe(200);
    expect(recRes.body.recommendations).toBeInstanceOf(Array);
    expect(recRes.body.recommendations[0].candidateId).toBeDefined();
    expect(recRes.body.recommendations[0].totalScore).toBeDefined();
  });

  it('returns 404 for unknown job', async () => {
    const res = await request(app).get('/jobs/nonexistent-id/recommendations');
    expect(res.status).toBe(404);
  });
});

//  GET /health 

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
