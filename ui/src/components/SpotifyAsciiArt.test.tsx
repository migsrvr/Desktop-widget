import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { SpotifyAsciiArt } from './SpotifyAsciiArt';

// NOTE: effects never run under renderToStaticMarkup, so these tests cover
// structure and fallback paths. Conversion itself is exercised visually and
// guarded at runtime by loading/CORS failure fallbacks.

describe('SpotifyAsciiArt', () => {
  it('renders the placeholder with no source', () => {
    const html = renderToStaticMarkup(<SpotifyAsciiArt src={null} mode="ascii" />);
    expect(html).toContain('Spotify Audio');
    expect(html).not.toContain('<canvas');
  });

  it('renders the photo in original mode without a canvas', () => {
    const html = renderToStaticMarkup(
      <SpotifyAsciiArt src="https://example.com/cover.jpg" mode="original" alt="Cover" />
    );
    expect(html).toContain('<img');
    expect(html).toContain('https://example.com/cover.jpg');
    expect(html).not.toContain('<canvas');
  });

  it('renders a canvas host (plus photo underneath) in ascii mode', () => {
    const html = renderToStaticMarkup(
      <SpotifyAsciiArt src="https://example.com/cover.jpg" mode="ascii" alt="Cover" />
    );
    expect(html).toContain('<canvas');
    // Photo stays mounted for instant paint + failure fallback.
    expect(html).toContain('<img');
  });
});
