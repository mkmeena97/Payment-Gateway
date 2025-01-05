import express from 'express';
import { login, register, getProfile, updateProfile, logout } from '../controllers/authController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getProfile);
router.patch('/me', auth, updateProfile);
router.post('/logout', auth, logout);

export default router;
