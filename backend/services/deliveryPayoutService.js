// backend/services/deliveryPayoutService.js

const {
  createFarmerTransfers,
} = require("./marketplacePayoutService");

async function releaseDeliveryPayout({
  orderId,
  paymentIntentId,
  farmerSplits,
}) {
  try {
    const transfers =
      await createFarmerTransfers({
        orderId,
        paymentIntentId,
        farmerSplits,
      });

    return {
      success: true,
      transfers,
    };
  } catch (error) {
    console.log(
      "Delivery payout release error:",
      error.message
    );

    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  releaseDeliveryPayout,
};