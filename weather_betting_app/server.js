
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();
const app = express();

// Middleware
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  balance: { type: Number, default: 0 },
});

const User = mongoose.model('User', userSchema);

// Betting Schema
const betSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  condition: String,
  wager: Number,
  result: String, // 'pending', 'won', 'lost'
  createdAt: { type: Date, default: Date.now },
});

const Bet = mongoose.model('Bet', betSchema);

// Routes
// User Registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const user = new User({ username, password: hashedPassword });
  await user.save();
  res.status(201).send({ message: 'User registered successfully' });
});

// User Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).send({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.send({ token });
});

// Place a Bet
app.post('/bets', async (req, res) => {
  const { condition, wager } = req.body;
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).send({ message: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);
    if (user.balance < wager) {
      return res.status(400).send({ message: 'Insufficient balance' });
    }
    const bet = new Bet({ userId: user._id, condition, wager, result: 'pending' });
    user.balance -= wager;
    await user.save();
    await bet.save();
    res.status(201).send({ message: 'Bet placed successfully', bet });
  } catch (error) {
    res.status(401).send({ message: 'Invalid token' });
  }
});

// Fetch Weather Data
app.get('/weather', async (req, res) => {
  const { city } = req.query;
  try {
    const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${process.env.WEATHER_API_KEY}`);
    res.send(response.data);
  } catch (error) {
    res.status(500).send({ message: 'Error fetching weather data' });
  }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
