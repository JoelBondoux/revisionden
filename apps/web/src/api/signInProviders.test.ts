import { fetchSignInProviders } from './signInProviders';

const answer = (status: number, body: unknown) => async () =>
  new Response(JSON.stringify(body), { status });

describe('fetchSignInProviders', () => {
  it('returns the providers the API lists', async () => {
    expect(
      await fetchSignInProviders('https://api.test', answer(200, { providers: ['microsoft'] })),
    ).toEqual(['microsoft']);
  });

  it('ignores names it does not know', async () => {
    expect(
      await fetchSignInProviders('https://api.test/', answer(200, { providers: ['google', 'x'] })),
    ).toEqual(['google']);
  });

  it.each([
    ['an error status', answer(500, {})],
    ['an odd answer', answer(200, { providers: 'google' })],
    ['an empty list', answer(200, { providers: [] })],
    [
      'no connection',
      async () => {
        throw new TypeError('offline');
      },
    ],
  ])('offers both after %s', async (_, fetchFn) => {
    expect(await fetchSignInProviders('https://api.test', fetchFn)).toEqual([
      'google',
      'microsoft',
    ]);
  });
});
