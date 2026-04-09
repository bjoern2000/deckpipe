import rateLimit from 'express-rate-limit';

function createLimiter(max: number, windowMinutes: number = 60) {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      res.status(429).json({
        error: {
          code: 'rate_limited',
          message: `Rate limit exceeded. Try again later.`,
        },
      });
    },
  });
}

export const createDeckLimiter = createLimiter(60);
export const getDeckLimiter = createLimiter(300);
export const updateDeckLimiter = createLimiter(120);
export const exportPdfLimiter = createLimiter(30);
export const uploadImageLimiter = createLimiter(120);
export const viewerLimiter = createLimiter(600);
export const listCommentsLimiter = createLimiter(300);
export const createCommentLimiter = createLimiter(120);
export const replyCommentLimiter = createLimiter(120);
export const updateCommentLimiter = createLimiter(120);
