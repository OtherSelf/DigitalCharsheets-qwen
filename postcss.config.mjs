/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    // Tailwind CSS v4: отдельный PostCSS-плагин вместо `tailwindcss`.
    '@tailwindcss/postcss': {},
  },
};

export default config;
