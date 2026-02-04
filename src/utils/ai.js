const config = require('../config');

const recommendProducts = async ({ cartItems }) => {
  if (!config.ai.apiKey) {
    return 'Recomendação inteligente indisponível no momento. Que tal conferir nossa seção de ofertas premium?';
  }

  const prompt = `Você é um vendedor premium. Sugira um produto complementar em uma frase curta. Itens no carrinho: ${cartItems.map((item) => item.name).join(', ')}.`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    return 'No momento estou sem acesso à IA. Quer explorar nossos combos especiais?';
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Que tal adicionar um acessório premium ao seu pedido?';
};

const answerSupport = async ({ question }) => {
  if (!config.ai.apiKey) {
    return 'Estou online para ajudar! Nossa entrega é rápida e garantida. Pergunte mais detalhes quando quiser.';
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.apiKey}`
    },
    body: JSON.stringify({
      model: config.ai.model,
      messages: [
        { role: 'system', content: 'Você é um atendente premium de e-commerce no Discord. Responda de forma objetiva e elegante.' },
        { role: 'user', content: question }
      ],
      temperature: 0.6
    })
  });

  if (!response.ok) {
    return 'Não consegui acessar nossa IA agora, mas posso ajudar: nosso prazo médio é de 24h e os produtos têm garantia premium.';
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Posso ajudar com produtos, preços, entrega e garantia!';
};

module.exports = { recommendProducts, answerSupport };
