import { Router } from 'express';
import {
  createCandidate,
  getCandidate,
  listCandidates,
  getCandidateRecommendations,
} from '../controllers/candidateController';

const router = Router();

router.post('/', createCandidate);
router.get('/', listCandidates);
router.get('/:id', getCandidate);
router.get('/:id/recommendations', getCandidateRecommendations);

export default router;
