require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// JWT middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// Database schema initialization
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS worlds (
        id SERIAL PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        description TEXT,
        genre VARCHAR(100),
        tone VARCHAR(100),
        cover_color VARCHAR(20) DEFAULT '#6366f1',
        is_public BOOLEAN DEFAULT false,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS pages (
        id SERIAL PRIMARY KEY,
        world_id INTEGER REFERENCES worlds(id) ON DELETE CASCADE,
        parent_id INTEGER REFERENCES pages(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL DEFAULT 'Untitled',
        icon VARCHAR(10) DEFAULT '📄',
        page_type VARCHAR(50) DEFAULT 'document',
        content JSONB DEFAULT '[]',
        properties JSONB DEFAULT '{}',
        sort_order INTEGER DEFAULT 0,
        is_archived BOOLEAN DEFAULT false,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        world_id INTEGER REFERENCES worlds(id) ON DELETE CASCADE,
        name VARCHAR(200) NOT NULL,
        icon VARCHAR(10) DEFAULT '📋',
        page_type VARCHAR(50) NOT NULL,
        default_properties JSONB DEFAULT '{}',
        default_blocks JSONB DEFAULT '[]',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Add missing columns if they don't exist
    const worldColumns = await pool.query(`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'worlds' AND column_name IN ('genre', 'tone', 'cover_color')
    `);
    const worldColumnNames = worldColumns.rows.map(r => r.column_name);
    
    if (!worldColumnNames.includes('genre')) {
      await pool.query('ALTER TABLE worlds ADD COLUMN genre VARCHAR(100)');
    }
    if (!worldColumnNames.includes('tone')) {
      await pool.query('ALTER TABLE worlds ADD COLUMN tone VARCHAR(100)');
    }
    if (!worldColumnNames.includes('cover_color')) {
      await pool.query('ALTER TABLE worlds ADD COLUMN cover_color VARCHAR(20) DEFAULT \'#6366f1\'');
    }

    console.log('Database schema initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
})();

// Auth routes
app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email',
      [username, email, hashedPassword]
    );

    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    
    res.json({ user, token });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await pool.query(
      'SELECT id, username, password_hash FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, process.env.JWT_SECRET);
    
    res.json({ 
      user: { id: user.id, username: user.username }, 
      token 
    });
  } catch (error) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// World routes
app.get('/worlds', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.*, u.username as owner_username 
      FROM worlds w 
      JOIN users u ON w.owner_id = u.id 
      WHERE w.owner_id = $1 OR w.is_public = true 
      ORDER BY w.updated_at DESC
    `, [req.user.id]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load worlds' });
  }
});

app.post('/worlds', authenticateToken, async (req, res) => {
  try {
    const { name, description, genre, tone, cover_color, is_public } = req.body;
    
    const result = await pool.query(`
      INSERT INTO worlds (name, description, genre, tone, cover_color, is_public, owner_id) 
      VALUES ($1, $2, $3, $4, $5, $6) 
      RETURNING *
    `, [name, description, genre, tone, cover_color || '#6366f1', is_public || false, req.user.id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create world' });
  }
});

app.put('/worlds/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, genre, tone, cover_color, is_public } = req.body;
    
    const result = await pool.query(`
      UPDATE worlds 
      SET name = $1, description = $2, genre = $3, tone = $4, cover_color = $5, is_public = $6, updated_at = NOW()
      WHERE id = $7 AND owner_id = $8 
      RETURNING *
    `, [name, description, genre, tone, cover_color, is_public, req.params.id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'World not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update world' });
  }
});

app.delete('/worlds/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM worlds WHERE id = $1 AND owner_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'World not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete world' });
  }
});

// Page routes
app.get('/worlds/:worldId/pages', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, parent_id, title, icon, page_type, sort_order, properties, created_at 
      FROM pages 
      WHERE world_id = $1 AND is_archived = false 
      ORDER BY sort_order, created_at
    `, [req.params.worldId]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load pages' });
  }
});

app.post('/worlds/:worldId/pages', authenticateToken, async (req, res) => {
  try {
    const { title, icon, page_type, parent_id, properties } = req.body;
    
    const result = await pool.query(`
      INSERT INTO pages (world_id, parent_id, title, icon, page_type, properties, created_by) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `, [req.params.worldId, parent_id, title || 'Untitled', icon || '📄', page_type || 'document', properties || '{}', req.user.id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create page' });
  }
});

app.get('/pages/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM pages WHERE id = $1',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load page' });
  }
});

app.put('/pages/:id', authenticateToken, async (req, res) => {
  try {
    const { title, icon, content, properties, sort_order, parent_id } = req.body;
    
    const result = await pool.query(`
      UPDATE pages 
      SET title = $1, icon = $2, content = $3, properties = $4, sort_order = $5, parent_id = $6, updated_at = NOW()
      WHERE id = $7 
      RETURNING *
    `, [title, icon, content, properties, sort_order, parent_id, req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update page' });
  }
});

app.delete('/pages/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE pages SET is_archived = true WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to archive page' });
  }
});

app.patch('/pages/:id/restore', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE pages SET is_archived = false WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to restore page' });
  }
});

// Template routes
app.get('/worlds/:worldId/templates', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM templates WHERE world_id = $1 ORDER BY name',
      [req.params.worldId]
    );
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

app.post('/worlds/:worldId/templates', authenticateToken, async (req, res) => {
  try {
    const { name, icon, page_type, default_properties, default_blocks } = req.body;
    
    const result = await pool.query(`
      INSERT INTO templates (world_id, name, icon, page_type, default_properties, default_blocks, created_by) 
      VALUES ($1, $2, $3, $4, $5, $6, $7) 
      RETURNING *
    `, [req.params.worldId, name, icon, page_type, default_properties || '{}', default_blocks || '[]', req.user.id]);
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create template' });
  }
});

app.delete('/templates/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM templates WHERE id = $1 RETURNING id',
      [req.params.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Search route
app.get('/worlds/:worldId/search', authenticateToken, async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q) {
      return res.json([]);
    }
    
    const result = await pool.query(`
      SELECT id, title, icon, page_type, created_at 
      FROM pages 
      WHERE world_id = $1 AND is_archived = false AND title ILIKE $2 
      ORDER BY title
    `, [req.params.worldId, `%${q}%`]);
    
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// Global search (across all worlds)
app.get('/api/search/global', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query required' });
    }
    
    // Search across all user's worlds
    const worldsResult = await pool.query(
      'SELECT w.*, u.username as owner_name FROM worlds w JOIN users u ON w.owner_id = u.id WHERE w.owner_id = $1 AND (w.name ILIKE $2 OR w.description ILIKE $2)',
      [req.user.id, `%${query}%`]
    );
    
    const pagesResult = await pool.query(`
      SELECT p.*, w.name as world_name, w.id as world_id 
      FROM pages p 
      JOIN worlds w ON p.world_id = w.id 
      WHERE w.owner_id = $1 AND p.title ILIKE $2
      ORDER BY p.updated_at DESC
      LIMIT 20`,
      [req.user.id, `%${query}%`]
    );
    
    res.json({
      worlds: worldsResult.rows,
      pages: pagesResult.rows
    });
  } catch (error) {
    console.error('Global search error:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// PUT route for updating pages
app.put('/pages/:id', authenticateToken, async (req, res) => {
  try {
    const { title, icon, page_type, parent_id, properties, content } = req.body;
    
    const result = await pool.query(`
      UPDATE pages 
      SET title = $1, icon = $2, page_type = $3, parent_id = $4, properties = $5, content = $6, updated_at = NOW()
      WHERE id = $7 AND created_by = $8
      RETURNING *
    `, [title, icon, page_type, parent_id, properties, content, req.params.id, req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update page' });
  }
});

// DELETE route for pages
app.delete('/pages/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM pages WHERE id = $1 AND created_by = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete page' });
  }
});

// Serve index.html for all other routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.listen(PORT, () => {
  console.log(`MythIndex server running on port ${PORT}`);
});
