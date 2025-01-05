import Stripe from 'stripe';
import Payment from '../models/payment.js';
import Transaction from '../models/transaction.js';
import User from '../models/user.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class PaymentService {
  // Initialize payment and create payment intent
  async createPayment(paymentData) {
    try {
      // Create payment intent with Stripe
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(paymentData.amount * 100), // Convert to cents
        currency: paymentData.currency.toLowerCase(),
        payment_method_types: ['card'],
        metadata: {
          userId: paymentData.userId.toString()
        }
      });

      // Create payment record in our database
      const payment = new Payment({
        amount: paymentData.amount,
        currency: paymentData.currency,
        paymentMethod: 'card',
        userId: paymentData.userId,
        transactionId: paymentIntent.id
      });

      await payment.save();

      return {
        paymentId: payment._id,
        clientSecret: paymentIntent.client_secret,
        amount: paymentData.amount,
        currency: paymentData.currency
      };
    } catch (error) {
      throw new Error('Payment creation failed: ' + error.message);
    }
  }

  // Verify payment status
  async verifyPayment(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      const payment = await Payment.findOne({ transactionId: paymentIntentId });

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (paymentIntent.status === 'succeeded') {
        payment.status = 'completed';
        await payment.save();

        // Create transaction record
        const transaction = new Transaction({
          paymentId: payment._id,
          senderId: payment.userId,
          receiverId: payment.userId, // In case of adding funds, sender = receiver
          amount: payment.amount,
          currency: payment.currency,
          type: 'payment',
          status: 'completed'
        });

        await transaction.save();

        // Update user balance
        const user = await User.findById(payment.userId);
        user.balance += payment.amount;
        await user.save();

        return { success: true, payment, transaction };
      }

      return { success: false, message: 'Payment not completed' };
    } catch (error) {
      throw new Error('Payment verification failed: ' + error.message);
    }
  }

  // Transfer funds between users
  async transferFunds(transferData) {
    try {
      const { senderId, receiverId, amount, currency } = transferData;

      // Check sender's balance
      const sender = await User.findById(senderId);
      if (sender.balance < amount) {
        throw new Error('Insufficient funds');
      }

      const receiver = await User.findById(receiverId);
      if (!receiver) {
        throw new Error('Receiver not found');
      }

      // Create transaction record
      const transaction = new Transaction({
        senderId,
        receiverId,
        amount,
        currency,
        type: 'transfer',
        status: 'completed'
      });

      // Update balances
      sender.balance -= amount;
      receiver.balance += amount;

      // Save all changes in a transaction
      await Promise.all([
        transaction.save(),
        sender.save(),
        receiver.save()
      ]);

      return { success: true, transaction };
    } catch (error) {
      throw new Error('Fund transfer failed: ' + error.message);
    }
  }

  // Refund payment
  async refundPayment(refundData) {
    try {
      const { paymentId, amount } = refundData;
      const payment = await Payment.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      if (payment.status !== 'completed') {
        throw new Error('Payment cannot be refunded');
      }

      // Create refund in Stripe
      const refund = await stripe.refunds.create({
        payment_intent: payment.transactionId,
        amount: Math.round(amount * 100) // Convert to cents
      });

      // Create refund transaction
      const transaction = new Transaction({
        paymentId: payment._id,
        senderId: payment.userId,
        receiverId: payment.userId,
        amount: amount,
        currency: payment.currency,
        type: 'refund',
        status: 'completed'
      });

      // Update payment status
      payment.status = 'refunded';

      // Update user balance
      const user = await User.findById(payment.userId);
      user.balance -= amount;

      await Promise.all([
        transaction.save(),
        payment.save(),
        user.save()
      ]);

      return { success: true, refund, transaction };
    } catch (error) {
      throw new Error('Refund failed: ' + error.message);
    }
  }

  // Get payment history for a user
  async getPaymentHistory(userId) {
    try {
      const transactions = await Transaction.find({
        $or: [{ senderId: userId }, { receiverId: userId }]
      })
      .sort({ createdAt: -1 })
      .populate('senderId', 'email firstName lastName')
      .populate('receiverId', 'email firstName lastName');

      return transactions;
    } catch (error) {
      throw new Error('Failed to fetch payment history: ' + error.message);
    }
  }

  // Get payment details
  async getPaymentDetails(paymentId) {
    try {
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      const stripePayment = await stripe.paymentIntents.retrieve(payment.transactionId);

      return {
        ...payment.toObject(),
        stripeDetails: stripePayment
      };
    } catch (error) {
      throw new Error('Failed to fetch payment details: ' + error.message);
    }
  }
}

export default new PaymentService();
