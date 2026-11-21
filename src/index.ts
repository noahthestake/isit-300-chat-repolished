import { mkdirSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { cors } from 'hono/cors'

type Note = {
  id: number
  body: string
  created_at: string
}


mkdirSync('data', { recursive: true })

const app = new Hono()
app.use('*', cors())
const db = new Database('data/app.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL DEFAULT 'New chat',
    messages TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);


app.get('/api/v1/health', (c) => c.json({ ok: true }))
app.get('/hello', (c) => c.json({message:'hey there!'}))

app.get('/api/notes', (c) => {
  const rows = db.query('SELECT id, body, created_at FROM notes ORDER BY created_at DESC').all() as Note[]
  return c.json({ notes: rows })
})


app.post('/api/v1/notes', async (c) => {
  const body = await c.req.json<{ body?: string }>()
  if (!body.body || body.body.trim().length === 0) {
    return c.json({ error: 'Note body is required' }, 400)
  }
  const result = db.query('INSERT INTO notes (body) VALUES (?)').run(body.body.trim())
  return c.json({ id: Number(result.lastInsertRowid) }, 201)
})

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://ollama:11434"
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'gemma3:270m'

app.get("/api/ollama-status", async (c) => {
  try {
    const response = await fetch(`${OLLAMA_URL}/api/tags`)
    if (!response.ok) {
      return c.json({ ok: false, error: `Ollama returned ${response.status}` }, 503)
    }
    const payload = (await response.json()) as { models?: Array<{ name?: string }> }
    const models = (payload.models ?? [])
      .map((model) => model.name ?? "")
      .filter((name) => name.length > 0)
    return c.json({ ok: true, ollamaUrl: OLLAMA_URL, models })
  } catch (error) {
    return c.json({ ok: false, error: String(error) }, 503)
  }
})
 
app.delete('/api/notes/:id', (c) => {
  const id = c.req.param('id')
  db.query('DELETE FROM notes WHERE id = ?').run(id)
  return c.json({ success: true })
})

app.post('/api/chat', async (c)=> {
const body = (await c.req.json()) as { chatId?: number; userMessage?: string }
const chatId = body.chatId;
const userMessage = body.userMessage;

  const chat = db.query("SELECT messages FROM chats WHERE id = ?").get(chatId) as any;
  if (!chat) {
    return c.json({ error: 'Chat not found' }, 404);
  }

  const messages = JSON.parse(chat.messages);
  messages.push({ role: 'user', content: userMessage });


  const response = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST', 
    headers: { 'Content-Type': 'application/json'},
    body: JSON.stringify({ model: OLLAMA_MODEL, messages: messages, stream: false }),
  })

if (!response.ok) {
    return c.json({ error: `Ollama returned ${response.status}` }, 502)
  }
  const payload = (await response.json()) as { message?: { content?: string }; error?: string }
  if (payload.error) {
    return c.json({ error: payload.error }, 502)
  }
  const reply = payload.message?.content?.trim()
  if (!reply) {
    return c.json({ error: 'Empty reply from Ollama' }, 502)
  }
  messages.push({ role: 'assistant', content: reply });
  db.query("UPDATE chats SET messages = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?").run(JSON.stringify(messages), chatId);
  return c.json({ reply, source: 'ollama', model: OLLAMA_MODEL })  

})

app.get('/api/chats', (c) => {
  const chats = db.query("SELECT id, title, updated_at FROM chats ORDER BY updated_at DESC, id DESC").all();
  return c.json(chats);
});

app.post('/api/chats', (c) => {
  const result = db.query("INSERT INTO chats (title, messages) VALUES ('New chat', '[]') RETURNING id").get() as any;
  return c.json({ id: result.id });
});

app.get('/api/chats/:id', (c) => {
  const id = c.req.param('id');
  const chat = db.query("SELECT * FROM chats WHERE id = ?").get(id) as any;

  if (!chat) {
    return c.json({ error: 'Chat not found' }, 404);
  }

  chat.messages = JSON.parse(chat.messages);
  return c.json(chat);
});

app.delete('/api/chats/:id', (c) => {
  const chatId = c.req.param('id');
  db.query('DELETE FROM chats WHERE id = ?').run(chatId);
  return c.json({ success: true });
});

app.use('/*', serveStatic({ root: './public' }))

export default {
  port: 3000,
  hostname: '0.0.0.0',
  fetch: app.fetch,
}
