const COOKIE_NAME = 'dp_author_name';
const COOKIE_DAYS = 365;

export function getAuthorName(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function setAuthorName(name: string): void {
  const expires = new Date(Date.now() + COOKIE_DAYS * 864e5).toUTCString();
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(name)};expires=${expires};path=/;SameSite=Lax`;
}
