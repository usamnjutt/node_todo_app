const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

// Prometheus monitoring imports
const promBundle = require('express-prom-bundle');
const client = require('prom-client');

const app = express();
const port = process.env.PORT || 3000;

// ========== PROMETHEUS METRICS SETUP ==========
// Create a registry for custom metrics
const register = new client.Registry();

// Add default metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics({ register });

// Create metrics middleware
const metricsMiddleware = promBundle({
  includeMethod: true,          // Include HTTP method in metrics
  includePath: true,            // Include URL path in metrics
  includeStatusCode: true,       // Include status code in metrics
  promClient: {                  // Pass the prom-client instance
    collectDefaultMetrics: false // We already collected them above
  }
});

// Custom metric: Count todos created
const todosCreatedCounter = new client.Counter({
  name: 'todos_created_total',
  help: 'Total number of todos created',
  registers: [register]
});

// Custom metric: Database query duration
const dbQueryDuration = new client.Histogram({
  name: 'db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  buckets: [0.1, 0.5, 1, 2, 5], // Buckets for timing
  registers: [register]
});

// Custom metric: Active database connections
const dbConnectionsGauge = new client.Gauge({
  name: 'db_connections_active',
  help: 'Number of active database connections',
  registers: [register]
});

// Apply metrics middleware (must be BEFORE routes)
app.use(metricsMiddleware);

// Expose metrics endpoint for Prometheus to scrape
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});
// ========== END PROMETHEUS SETUP ==========

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Root route
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/index.html');
});

// Database connection with metrics
const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 5432,
});

// Update connection gauge periodically
setInterval(async () => {
  try {
    const result = await pool.query('SELECT count(*) FROM pg_stat_activity WHERE datname = $1', [process.env.DB_NAME]);
    dbConnectionsGauge.set(parseInt(result.rows[0].count));
  } catch (err) {
    console.error('Error getting connection count:', err);
  }
}, 5000); // Update every 5 seconds

// Create table
const createTable = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS todos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        completed BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('Table created or already exists');
  } catch (err) {
    console.error('Error creating table:', err);
  }
};
createTable();

// Routes with monitoring
app.get('/todos', async (req, res) => {
  const start = Date.now();
  try {
    const result = await pool.query('SELECT * FROM todos ORDER BY id');
    
    // Record query duration
    const duration = (Date.now() - start) / 1000;
    dbQueryDuration.observe(duration);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/todos', async (req, res) => {
  const { title } = req.body;
  const start = Date.now();
  
  try {
    const result = await pool.query(
      'INSERT INTO todos (title) VALUES ($1) RETURNING *',
      [title]
    );
    
    // Record query duration
    const duration = (Date.now() - start) / 1000;
    dbQueryDuration.observe(duration);
    
    // Increment todo counter
    todosCreatedCounter.inc();
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { completed } = req.body;
  const start = Date.now();
  
  try {
    const result = await pool.query(
      'UPDATE todos SET completed = $1 WHERE id = $2 RETURNING *',
      [completed, id]
    );
    
    // Record query duration
    const duration = (Date.now() - start) / 1000;
    dbQueryDuration.observe(duration);
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/todos/:id', async (req, res) => {
  const { id } = req.params;
  const start = Date.now();
  
  try {
    await pool.query('DELETE FROM todos WHERE id = $1', [id]);
    
    // Record query duration
    const duration = (Date.now() - start) / 1000;
    dbQueryDuration.observe(duration);
    
    res.json({ message: 'Todo deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Metrics available at http://localhost:${port}/metrics`);
});
