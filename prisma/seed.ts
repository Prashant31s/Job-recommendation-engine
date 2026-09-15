import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  //  Clear existing data 
  await prisma.job.deleteMany();
  await prisma.candidate.deleteMany();

  //  Candidates 
  const alice = await prisma.candidate.create({
    data: {
      name: 'Alice Chen',
      skills: ['TypeScript', 'Node.js', 'PostgreSQL', 'Redis', 'Docker'],
      yearsOfExperience: 6,
      location: 'New York',
      expectedSalary: 130000,
    },
  });

  const bob = await prisma.candidate.create({
    data: {
      name: 'Bob Patel',
      skills: ['Python', 'Django', 'PostgreSQL', 'AWS'],
      yearsOfExperience: 3,
      location: 'San Francisco',
      expectedSalary: 110000,
    },
  });

  const carol = await prisma.candidate.create({
    data: {
      name: 'Carol Martinez',
      skills: ['TypeScript', 'React', 'Node.js', 'GraphQL'],
      yearsOfExperience: 4,
      location: 'Austin',
      expectedSalary: 105000,
    },
  });

  const dave = await prisma.candidate.create({
    data: {
      name: 'Dave Kim',
      skills: ['Java', 'Spring Boot', 'Kubernetes', 'PostgreSQL'],
      yearsOfExperience: 8,
      location: 'Chicago',
      expectedSalary: 155000,
    },
  });

  // Jobs
  await prisma.job.create({
    data: {
      title: 'Senior Backend Engineer',
      requiredSkills: [
        { skill: 'TypeScript', type: 'must-have' },
        { skill: 'Node.js', type: 'must-have' },
        { skill: 'Redis', type: 'nice-to-have' },
        { skill: 'Docker', type: 'nice-to-have' },
        { skill: 'GraphQL', type: 'nice-to-have' },
      ],
      minYearsExperience: 5,
      location: 'New York',
      salaryMin: 120000,
      salaryMax: 150000,
      remoteAllowed: false,
    },
  });

  await prisma.job.create({
    data: {
      title: 'Full Stack Engineer (Remote)',
      requiredSkills: [
        { skill: 'TypeScript', type: 'must-have' },
        { skill: 'React', type: 'must-have' },
        { skill: 'Node.js', type: 'nice-to-have' },
        { skill: 'GraphQL', type: 'nice-to-have' },
      ],
      minYearsExperience: 3,
      location: 'San Francisco',
      salaryMin: 100000,
      salaryMax: 130000,
      remoteAllowed: true,
    },
  });

  await prisma.job.create({
    data: {
      title: 'Python Backend Developer',
      requiredSkills: [
        { skill: 'Python', type: 'must-have' },
        { skill: 'Django', type: 'must-have' },
        { skill: 'PostgreSQL', type: 'nice-to-have' },
        { skill: 'AWS', type: 'nice-to-have' },
      ],
      minYearsExperience: 2,
      location: 'San Francisco',
      salaryMin: 95000,
      salaryMax: 125000,
      remoteAllowed: false,
    },
  });

  await prisma.job.create({
    data: {
      title: 'Java Platform Engineer',
      requiredSkills: [
        { skill: 'Java', type: 'must-have' },
        { skill: 'Spring Boot', type: 'must-have' },
        { skill: 'Kubernetes', type: 'nice-to-have' },
        { skill: 'PostgreSQL', type: 'nice-to-have' },
      ],
      minYearsExperience: 6,
      location: 'Chicago',
      salaryMin: 140000,
      salaryMax: 170000,
      remoteAllowed: true,
    },
  });

  await prisma.job.create({
    data: {
      title: 'Junior Node.js Developer',
      requiredSkills: [
        { skill: 'Node.js', type: 'must-have' },
        { skill: 'TypeScript', type: 'nice-to-have' },
        { skill: 'PostgreSQL', type: 'nice-to-have' },
      ],
      minYearsExperience: 1,
      location: 'New York',
      salaryMin: 70000,
      salaryMax: 90000,
      remoteAllowed: false,
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
