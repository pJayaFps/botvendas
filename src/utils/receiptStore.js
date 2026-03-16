const receiptMap = new Map();

const saveReceipt = (orderId, data) => {
  const key = String(orderId);
  const previous = receiptMap.get(key) || {};
  receiptMap.set(key, { ...previous, ...data });
};

const getReceipt = (orderId) => receiptMap.get(String(orderId));

const clearReceipt = (orderId) => receiptMap.delete(String(orderId));

module.exports = { saveReceipt, getReceipt, clearReceipt };
