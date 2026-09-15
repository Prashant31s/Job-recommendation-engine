import { Router } from 'express';
import {
  createJob,
  getJob,
  listJobs,
  getJobCandidateRecommendations,
} from '../controllers/jobController';

const router = Router();

router.post('/', createJob);
router.get('/', listJobs);
router.get('/:id', getJob);
router.get('/:id/recommendations', getJobCandidateRecommendations);

export default router;
