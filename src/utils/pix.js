const QRCode = require('qrcode');
const config = require('../config');

const buildPixPayload = ({ amount, txid }) => {
  return `00020126360014BR.GOV.BCB.PIX0114${config.payments.pixKey}520400005303986540${amount.toFixed(2)}5802BR5913${config.payments.pixName}6009${config.payments.pixCity}62130509${txid}6304ABCD`;
};

const generatePixQr = async ({ amount, txid }) => {
  const payload = buildPixPayload({ amount, txid });
  const buffer = await QRCode.toBuffer(payload, { type: 'png', width: 320 });
  return { payload, buffer };
};

module.exports = { generatePixQr };
