export interface CommentMessage {
  author_name: string;
  author_type: 'human' | 'agent';
  body: string;
  created_at: string;
}

export interface Comment {
  id: string;
  deck_id: string;
  slide_id: string;
  content_path: string;
  status: 'open' | 'resolved';
  messages: CommentMessage[];
  created_at: string;
  updated_at: string;
}

export async function fetchComments(
  deckId: string,
  params?: { status?: string; slide_id?: string },
): Promise<Comment[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.slide_id) qs.set('slide_id', params.slide_id);
  const url = `/v1/decks/${deckId}/comments${qs.toString() ? '?' + qs : ''}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

export async function createComment(
  deckId: string,
  body: { slide_id: string; content_path: string; author_name: string; author_type: 'human' | 'agent'; body: string },
): Promise<Comment> {
  const res = await fetch(`/v1/decks/${deckId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to create comment');
  return res.json();
}

export async function addReply(
  deckId: string,
  commentId: string,
  body: { author_name: string; author_type: 'human' | 'agent'; body: string },
): Promise<Comment> {
  const res = await fetch(`/v1/decks/${deckId}/comments/${commentId}/replies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to add reply');
  return res.json();
}

export async function updateComment(
  deckId: string,
  commentId: string,
  body: { status: 'open' | 'resolved' },
): Promise<Comment> {
  const res = await fetch(`/v1/decks/${deckId}/comments/${commentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Failed to update comment');
  return res.json();
}
