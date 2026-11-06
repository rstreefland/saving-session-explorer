import { createElement as h } from 'react';

/** Public copy shared by the initial HTML and the interactive app. No account data. */
export function PublicIntro() {
  return h(
    'section',
    { className: 'intro' },
    h(
      'div',
      null,
      h('h1', null, 'Saving Session Explorer'),
      h(
        'p',
        null,
        'Octopus take a few days to calculate Saving Session results. This tool uses your smart meter data to estimate how you did sooner. It can also compare these estimates with Octopus Energy’s figures when they arrive. Use it to understand the numbers or spot possible missed rewards.',
      ),
      h(
        'p',
        null,
        'Read or contribute to the ',
        h(
          'a',
          { href: 'https://github.com/rstreefland/saving-session-explorer' },
          'code on GitHub',
        ),
        '. Not affiliated with or endorsed by Octopus Energy.',
      ),
    ),
  );
}
