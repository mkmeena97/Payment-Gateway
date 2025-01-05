import Payment from '../models/payment.js';
import Transaction from '../models/transaction.js';
import User from '../models/user.js';

class PaymentService {
  // Initialize payment
  async createPayment(paymentData) {
    try {
      // Check if user has existing transactions
      const existingTransaction = await Transaction.findOne({ 
        $or: [
          { senderId: paymentData.userId }, 
          { receiverId: paymentData.userId }
        ] 
      }).sort({ createdAt: -1 });

      // If user has transactions, enforce same currency
      if (existingTransaction && existingTransaction.currency !== paymentData.currency) {
        throw new Error(`Currency mismatch. Your wallet is in ${existingTransaction.currency}. Please use the same currency.`);
      }

      // Create payment record
      const payment = new Payment({
        amount: paymentData.amount,
        currency: paymentData.currency.toUpperCase(), 
        userId: paymentData.userId,
        transactionId: Date.now().toString()
      });

      await payment.save();

      return {
        paymentId: payment._id,
        amount: paymentData.amount,
        currency: payment.currency,
        status: 'pending'
      };
    } catch (error) {
      throw new Error('Payment creation failed: ' + error.message);
    }
  }

  // Verify payment (simplified)
  async verifyPayment(paymentId) {
    try {
      const payment = await Payment.findById(paymentId);

      if (!payment) {
        throw new Error('Payment not found');
      }

      // Update payment status
      payment.status = 'completed';
      await payment.save();

      // Create transaction record for adding funds to wallet
      const transaction = new Transaction({
        paymentId: payment._id,
        senderId: payment.userId,
        receiverId: payment.userId, 
        amount: payment.amount,
        currency: payment.currency,
        type: 'payment', 
        status: 'completed',
        description: 'Added funds to wallet' 
      });

      await transaction.save();

      // Update user balance
      const user = await User.findById(payment.userId);
      if (!user) {
        throw new Error('User not found');
      }

      user.balance = (user.balance || 0) + payment.amount;
      await user.save();

      return { 
        success: true, 
        payment,
        transaction,
        currentBalance: user.balance
      };
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
      if (!sender) {
        throw new Error('Sender not found');
      }

      // Validate currency matches sender's last transaction
      const lastTransaction = await Transaction.findOne({ 
        $or: [{ senderId }, { receiverId: senderId }] 
      }).sort({ createdAt: -1 });

      if (lastTransaction && lastTransaction.currency !== currency) {
        throw new Error(`Currency mismatch. Your wallet is in ${lastTransaction.currency}. Please use the same currency.`);
      }

      if (sender.balance < amount) {
        throw new Error(`Insufficient funds. Your balance is ${sender.balance} ${lastTransaction?.currency || currency}`);
      }

      const receiver = await User.findById(receiverId);
      if (!receiver) {
        throw new Error('Receiver not found');
      }

      // Create a payment record for the transfer
      const payment = new Payment({
        amount,
        currency: lastTransaction?.currency || currency, 
        paymentMethod: 'transfer',
        userId: senderId,
        status: 'completed',
        transactionId: Date.now().toString()
      });

      // Create transaction record
      const transaction = new Transaction({
        paymentId: payment._id,
        senderId,
        receiverId,
        amount,
        currency: lastTransaction?.currency || currency, 
        type: 'transfer',
        status: 'completed',
        description: `Transfer to ${receiver.firstName} ${receiver.lastName}`
      });

      // Update balances
      sender.balance -= amount;
      receiver.balance = (receiver.balance || 0) + amount;

      // Save all changes
      await Promise.all([
        payment.save(),
        transaction.save(),
        sender.save(),
        receiver.save()
      ]);

      return { 
        success: true, 
        transaction,
        senderBalance: sender.balance,
        receiverBalance: receiver.balance,
        currency: lastTransaction?.currency || currency
      };
    } catch (error) {
      throw new Error('Fund transfer failed: ' + error.message);
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

      return payment;
    } catch (error) {
      throw new Error('Failed to fetch payment details: ' + error.message);
    }
  }
}

export default new PaymentService();
