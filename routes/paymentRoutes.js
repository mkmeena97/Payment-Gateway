import express from 'express';
import paymentService from '../services/paymentService.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Initialize payment
router.post('/create', auth, async (req, res) => {
  try {
    const paymentIntent = await paymentService.createPayment({
      amount: req.body.amount,
      currency: req.body.currency,
      userId: req.user.id
    });
    res.json(paymentIntent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Verify payment
router.post('/verify/:paymentIntentId', auth, async (req, res) => {
  try {
    const result = await paymentService.verifyPayment(req.params.paymentIntentId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Transfer funds
router.post('/transfer', auth, async (req, res) => {
  try {
    const transfer = await paymentService.transferFunds({
      amount: req.body.amount,
      currency: req.body.currency,
      destinationAccount: req.body.destinationAccount
    });
    res.json(transfer);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
