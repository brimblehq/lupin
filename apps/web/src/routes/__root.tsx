import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'
import brimbleLogoIcon from '../assets/icons/brimble-logo.svg?url'

const chatwootBootstrapScript = `(function(d,t){
  try {
    if (window.__brimbleChatwootBooted) return;
    window.__brimbleChatwootBooted = true;
    var BASE_URL="https://app.chatwoot.com";
    var existing=d.getElementById("brimble-chatwoot-sdk");
    if (existing) return;
    var g=d.createElement(t),s=d.getElementsByTagName(t)[0];
    g.id="brimble-chatwoot-sdk";
    g.src=BASE_URL+"/packs/js/sdk.js";
    g.defer=true;
    g.async=true;
    s.parentNode.insertBefore(g,s);
    g.onload=function(){
      if (!window.chatwootSDK || !window.chatwootSDK.run) return;
      window.chatwootSDK.run({
        websiteToken:"mn5KENDDuZxcSc6bxFE5S3A9",
        baseUrl:BASE_URL
      });
    };
  } catch (e) {}
})(document,"script");`

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        name: 'theme-color',
        content: '#ffffff',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400&family=IBM+Plex+Sans:wght@400;500&display=swap',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: brimbleLogoIcon,
      },
      {
        rel: 'shortcut icon',
        type: 'image/svg+xml',
        href: brimbleLogoIcon,
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/favicon/apple-touch-icon.png',
      },
      {
        rel: 'manifest',
        href: '/favicon/site.webmanifest',
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-C20V2W5JW0" />
        <script dangerouslySetInnerHTML={{ __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-C20V2W5JW0');` }} />
        <script dangerouslySetInnerHTML={{ __html: `(function(){var t=localStorage.getItem('brimble-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}})()` }} />
      </head>
      <body>
        {children}
        <script dangerouslySetInnerHTML={{ __html: chatwootBootstrapScript }} />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
