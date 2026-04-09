import { Router } from 'express';
import { CreateCommentSchema, CreateReplySchema, UpdateCommentSchema, ListCommentsQuerySchema, generateCommentId, ApiError } from '@deckpipe/shared';
import { validate } from '../middleware/validate.js';
import { listCommentsLimiter, createCommentLimiter, replyCommentLimiter, updateCommentLimiter } from '../middleware/rate-limiter.js';
import { query } from '../db/client.js';

export const commentsRouter = Router({ mergeParams: true });

// GET /v1/decks/:id/comments — List comments for a deck
commentsRouter.get('/', listCommentsLimiter, async (req, res, next) => {
  try {
    const deckId = req.params.id;
    const parsed = ListCommentsQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new ApiError('validation_error', 'Invalid query parameters');
    }
    const { status, slide_id } = parsed.data;

    let sql = 'SELECT * FROM comments WHERE deck_id = $1';
    const params: any[] = [deckId];

    if (status) {
      params.push(status);
      sql += ` AND status = $${params.length}`;
    }
    if (slide_id) {
      params.push(slide_id);
      sql += ` AND slide_id = $${params.length}`;
    }
    sql += ' ORDER BY created_at ASC';

    const result = await query(sql, params);
    res.json(result.rows.map(formatComment));
  } catch (err) {
    next(err);
  }
});

// POST /v1/decks/:id/comments — Create a new comment
commentsRouter.post('/', createCommentLimiter, validate(CreateCommentSchema), async (req, res, next) => {
  try {
    const deckId = req.params.id;
    const { slide_id, content_path, author_name, author_type, body } = req.body;

    // Verify deck exists
    const deckResult = await query('SELECT deck_id FROM decks WHERE deck_id = $1', [deckId]);
    if (deckResult.rows.length === 0) {
      throw new ApiError('not_found', `Deck '${deckId}' not found`);
    }

    const commentId = generateCommentId();
    const message = {
      author_name,
      author_type,
      body,
      created_at: new Date().toISOString(),
    };

    await query(
      'INSERT INTO comments (id, deck_id, slide_id, content_path, messages) VALUES ($1, $2, $3, $4, $5)',
      [commentId, deckId, slide_id, content_path, JSON.stringify([message])]
    );

    const result = await query('SELECT * FROM comments WHERE id = $1', [commentId]);
    res.status(201).json(formatComment(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

// POST /v1/decks/:id/comments/:commentId/replies — Add a reply
commentsRouter.post('/:commentId/replies', replyCommentLimiter, validate(CreateReplySchema), async (req, res, next) => {
  try {
    const { id: deckId, commentId } = req.params;
    const { author_name, author_type, body } = req.body;

    const existing = await query('SELECT * FROM comments WHERE id = $1 AND deck_id = $2', [commentId, deckId]);
    if (existing.rows.length === 0) {
      throw new ApiError('not_found', `Comment '${commentId}' not found`);
    }

    const messages = existing.rows[0].messages;
    messages.push({
      author_name,
      author_type,
      body,
      created_at: new Date().toISOString(),
    });

    await query(
      'UPDATE comments SET messages = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(messages), commentId]
    );

    const result = await query('SELECT * FROM comments WHERE id = $1', [commentId]);
    res.json(formatComment(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

// PATCH /v1/decks/:id/comments/:commentId — Resolve/reopen
commentsRouter.patch('/:commentId', updateCommentLimiter, validate(UpdateCommentSchema), async (req, res, next) => {
  try {
    const { id: deckId, commentId } = req.params;
    const { status } = req.body;

    const existing = await query('SELECT * FROM comments WHERE id = $1 AND deck_id = $2', [commentId, deckId]);
    if (existing.rows.length === 0) {
      throw new ApiError('not_found', `Comment '${commentId}' not found`);
    }

    await query(
      'UPDATE comments SET status = $1, updated_at = NOW() WHERE id = $2',
      [status, commentId]
    );

    const result = await query('SELECT * FROM comments WHERE id = $1', [commentId]);
    res.json(formatComment(result.rows[0]));
  } catch (err) {
    next(err);
  }
});

function formatComment(row: any) {
  return {
    id: row.id,
    deck_id: row.deck_id,
    slide_id: row.slide_id,
    content_path: row.content_path,
    status: row.status,
    messages: row.messages,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}
