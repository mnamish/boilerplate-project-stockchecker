const express = require('express');
const fetch = require('node-fetch');
const router = express.Router();
const mongoose = require('mongoose');

// Mongoose schema for storing likes per stock per IP
const stockSchema = new mongoose.Schema({
  stock: String,
  ips: [String]
});
const Stock = mongoose.model('Stock', stockSchema);

async function getStockPrice(stock) {
  const response = await fetch(
    `https://stock-price-checker-proxy.freecodecamp.rocks/v1/stock/${stock}/quote`
  );
  const data = await response.json();
  return data.latestPrice;
}

router.get('/stock-prices', async (req, res) => {
  let { stock, like } = req.query;
  const ip = req.ip;

  if (!stock) return res.json({ error: 'No stock provided' });

  // Make stock an array for uniform processing
  const stocks = Array.isArray(stock) ? stock : [stock];

  try {
    const results = [];

    for (let s of stocks) {
      s = s.toUpperCase();
      let dbStock = await Stock.findOne({ stock: s });
      if (!dbStock) dbStock = await Stock.create({ stock: s, ips: [] });

      // Handle likes
      if (like === 'true' && !dbStock.ips.includes(ip)) {
        dbStock.ips.push(ip);
        await dbStock.save();
      }

      const price = await getStockPrice(s);
      results.push({
        stock: s,
        price,
        likes: dbStock.ips.length
      });
    }

    // Handle rel_likes if two stocks
    if (results.length === 2) {
      const [a, b] = results;
      return res.json({
        stockData: [
          { stock: a.stock, price: a.price, rel_likes: a.likes - b.likes },
          { stock: b.stock, price: b.price, rel_likes: b.likes - a.likes }
        ]
      });
    }

    // Single stock
    res.json({ stockData: results[0] });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// Export a function to attach the route to the main app
module.exports = function(app) {
  app.use('/api', router);
};
