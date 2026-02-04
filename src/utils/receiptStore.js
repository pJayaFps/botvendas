const receiptMap = new Map();

const saveReceipt = (orderId, data) => {
  receiptMap.set(String(orderId), data);
};

const getReceipt = (orderId) => receiptMap.get(String(orderId));

const clearReceipt = (orderId) => receiptMap.delete(String(orderId));

module.exports = { saveReceipt, getReceipt, clearReceipt };
