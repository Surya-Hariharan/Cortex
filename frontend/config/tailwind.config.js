/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ['./frontend/src/renderer/**/*.{js,jsx,html}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                amd: {
                    400: '#f04147',
                    500: '#ED1C24',
                    600: '#cc181e',
                },
                // Updated for better contrast on light backgrounds
                synapse: {
                    50: '#eef2ff',
                    100: '#e0e7ff',
                    200: '#c7d2fe',
                    300: '#a5b4fc',
                    400: '#818cf8',
                    500: '#6366f1',
                    600: '#4f46e5',
                    700: '#4338ca',
                    800: '#3730a3',
                    900: '#312e81',
                    950: '#1e1b4b',
                },
                // ChatGPT-style Neutral Dark Palette
                dark: {
                    50: '#f9f9f9',
                    100: '#ececec',
                    200: '#e3e3e3',
                    300: '#cdcdcd',
                    400: '#b4b4b4',
                    500: '#9b9b9b',
                    600: '#676767',
                    700: '#424242',
                    800: '#2f2f2f',
                    900: '#212121',
                    950: '#171717',
                },
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
                mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'fade-in': 'fadeIn 0.3s ease-out',
                'slide-up': 'slideUp 0.3s ease-out',
                'shimmer': 'shimmer 2s linear infinite',
                'bar-fill': 'barFill 1s cubic-bezier(0.34, 1.56, 0.64, 1) both',
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideUp: {
                    '0%': { opacity: '0', transform: 'translateY(10px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                shimmer: {
                    '0%': { backgroundPosition: '-200% 0' },
                    '100%': { backgroundPosition: '200% 0' },
                },
                barFill: {
                    '0%': { width: '0%' },
                    '100%': { width: '100%' },
                },
            },
            backdropBlur: {
                xs: '2px',
            },
        },
    },
    plugins: [],
};
