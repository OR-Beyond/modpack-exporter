/// <reference types="vite/client" />
/// <reference types="svelte" />

declare module '*.png' {
  const src: string;
  export default src;
}

declare module '*.jpg' {
  const src: string;
  export default src;
}

declare module '*.svg' {
  const src: string;
  export default src;
}

declare module '*.gif' {
  const src: string;
  export default src;
}

declare module '*.ico' {
  const src: string;
  export default src;
}

declare module '*.icns' {
  const src: string;
  export default src;
}

declare const __SANDBOX__: boolean;
declare const __DEV__: boolean;
