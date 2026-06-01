[Skip to content](https://vercel.com/storage/blob#geist-skip-nav)

## Easy uploads for edge-delivered files

The simplest way to store and access media files on a global network. Perfect for unstructured data like images, videos, and audio files.

[Get Started](https://vercel.com/dashboard/stores)

[View the Docs](https://vercel.com/docs/storage/vercel-blob)

![The dotted outline of a square with rounded corners encloses three illustrated items. At the center is a large orange blob, peeking from behind on its left is a folder approximately one third the size of the blob. In front, there is a piece of paper.](https://vercel.com/vc-ap-vercel-marketing/_next/image?url=https%3A%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F7nfkS8WTGrO5uFRVfA49Tc%2Fc8285d1069fcb8990782bd9ed3edd424%2FDevice_Desktop__Theme_Light__Type_Blob.png&w=1920&q=75)![The dotted outline of a square with rounded corners encloses three illustrated items. At the center is a large orange blob, peeking from behind on its left is a folder approximately one third the size of the blob. In front, there is a piece of paper.](https://vercel.com/vc-ap-vercel-marketing/_next/image?url=https%3A%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F5lSmESPUsHb1xIUxL7be39%2F18ea63e5f4d4b7f435ab197e8e2682ba%2FDevice_Desktop__Theme_Dark__Type_Blob.png&w=1920&q=75)

### Built for modern web frameworks

Designed for the evolution of JavaScript and TypeScript frameworks, Vercel Blob allows developers to store and retrieve any file with an intuitive, promise-based API.

![Logo for Next.js](https://images.ctfassets.net/e5382hct74si/3x7gJBSsLLS8zAx92C8cok/99346dddca18c06f2c82bb8c6fb23a7c/Frame_427318739.svg)

#### Next.js

Store avatar in Route Handler

![Logo for SvelteKit](https://images.ctfassets.net/e5382hct74si/6JZ5gmzHKJ5mOxnfrTJJ5X/e6da666a3b81e2951388c1bd03db6acb/Frame_427318740.svg)

#### SvelteKit

Store avatar in Server Route

![Logo for Nuxt](https://images.ctfassets.net/e5382hct74si/4tNt7qCFMA0pjyMITIUeSy/5d2cc194d3e447d46cbcbd194197a749/Nuxt.svg)

#### Nuxt

Store avatar in Server Route

![Logo for Next.js](https://images.ctfassets.net/e5382hct74si/3x7gJBSsLLS8zAx92C8cok/99346dddca18c06f2c82bb8c6fb23a7c/Frame_427318739.svg)

#### Next.js

Store avatar in Route Handler

![Logo for SvelteKit](https://images.ctfassets.net/e5382hct74si/6JZ5gmzHKJ5mOxnfrTJJ5X/e6da666a3b81e2951388c1bd03db6acb/Frame_427318740.svg)

#### SvelteKit

Store avatar in Server Route

![Logo for Nuxt](https://images.ctfassets.net/e5382hct74si/4tNt7qCFMA0pjyMITIUeSy/5d2cc194d3e447d46cbcbd194197a749/Nuxt.svg)

#### Nuxt

Store avatar in Server Route

app/profile/route.ts

```tsx
1import { put } from '@vercel/blob';

2

3export async function PUT(request: Request) {

4  const form = await request.formData();

5  const file = form.get('file') as File;

6  const blob = await put('avatars/user-42.png', file, { access: 'public' });

7

8  return Response.json(blob);

9}
```

### Highly available at the lowest latency

Give your files a global home. With one URL, store and read file objects from anywhere.

![](https://vercel.com/vc-ap-vercel-marketing/_next/image?url=https%3A%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F523JQmN0BJdxl7pBOIsmxr%2F4761b8c760d68c456617bed5c51cfc11%2Fglobe-white.png&w=3840&q=75)![](https://vercel.com/vc-ap-vercel-marketing/_next/image?url=https%3A%2F%2Fimages.ctfassets.net%2Fe5382hct74si%2F3ddBNQfDbg1hEWefidu5rH%2Fb3666777e3add0a61e1c3cf54e97f373%2Fglobe-black__1_.png&w=3840&q=75)

![](https://images.ctfassets.net/e5382hct74si/2Ln6ZsIBkehIATRG0Y8axv/bae0ee8e1f0f884f90c497771c26a813/blob-light-desktop.svg)![](https://images.ctfassets.net/e5382hct74si/rNX45s5F8o7K7kVCQbL1E/2c3e86519446915ae01b7f4ca131a8e5/blob-dark-desktop.svg)![](https://images.ctfassets.net/e5382hct74si/1OmHvwS88yUSbtxImPNsi7/b373aa5d0f91a7b8d9d5ac9ce58ad078/blob-light-mobile.svg)![](https://images.ctfassets.net/e5382hct74si/3VLZleTZshyQlFlqZepgUA/f277078cddde17fab76c358b206daaf9/blob-dark-mobile.svg)

#### Global file storage

With Vercel Blob, upload and serve files from a global network through unique and secure, immutable URLs.

Ready for the edge

For low-latency, high-throughput reads and writes, designed to work natively with Vercel's compute products.

No management required

No setup required. Spend your time building your application, not managing database instances.

Effortless scaling

Built to handle the unpredictable nature of web traffic, scaling up and down as needed.

### Develop. Preview. Ship.

Vercel is the platform for frontend developers, providing the speed and reliability innovators need to create at the moment of inspiration.

[Start Deploying](https://vercel.com/new) [Tour the Product](https://vercel.com/product-tour?thankyou)
