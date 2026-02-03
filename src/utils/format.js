const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const calculateTotal = (items) => items.reduce((sum, item) => sum + item.price * item.quantity, 0);

module.exports = { formatCurrency, calculateTotal };
