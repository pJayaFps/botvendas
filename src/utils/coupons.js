const applyCouponDiscount = (total, coupon) => {
  if (!coupon) {
    return { total, discount: 0 };
  }

  let discount = 0;
  if (coupon.type === 'porcentagem') {
    discount = total * (coupon.value / 100);
  } else if (coupon.type === 'valor') {
    discount = coupon.value;
  }

  if (discount < 0) discount = 0;
  if (discount > total) discount = total;

  return { total: total - discount, discount };
};

module.exports = { applyCouponDiscount };
