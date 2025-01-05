import express from 'express';
import { login, register, getProfile, updateProfile, logout } from '../controllers/authController.js';
import auth from '../middleware/auth.js';
import User from '../models/user.js';
import Transaction from '../models/transaction.js';

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', auth, getProfile);
router.patch('/me', auth, updateProfile);
router.post('/logout', auth, logout);

router.get('/balance', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    const lastTransaction = await Transaction.findOne({ 
      $or: [
        { senderId: req.user.id }, 
        { receiverId: req.user.id }
      ] 
    }).sort({ createdAt: -1 });

    res.json({
      balance: user.balance || 0,
      currency: lastTransaction?.currency || 'USD',
      userId: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
